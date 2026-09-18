/* ============================================================================
   SPEED CITY — خادم اللعب الجماعي (بلا أي مكتبات خارجية)
   يشغّل: خادم ملفات ثابت + WebSocket للغرف ومواقع اللاعبين والدردشة والصوت.

   التشغيل:
       node server/server.mjs            # المنفذ 8080
       PORT=3000 node server/server.mjs
       MAX_ROOMS=5 node server/server.mjs   # حدّ الغرف لكل شخص (٣ افتراضياً)

   ثم افتح  http://localhost:8080  من هاتفك أو حاسوبك على نفس الشبكة،
   واكتب في اللعبة عنوان الخادم:  ws://<عنوان الجهاز>:8080

   الغرف:
     • كل لاعب داخل غرفة واحدة دائماً. الافتراضية «المدينة الحرّة» ولا تُحذف.
     • ينشئ اللاعب غرفاً برمز عشوائي، وله حدّ أقصى — إن بلغه فعليه حذف
       غرفة قديمة من غرفه قبل إنشاء جديدة.
     • المواقع والدردشة والصوت لا تتجاوز حدود الغرفة.
   ========================================================================== */
import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8080);
const MAX_ROOMS = Math.max(1, Number(process.env.MAX_ROOMS || 3));   // لكل شخص
const MAX_PLAYERS = Math.max(2, Number(process.env.MAX_PLAYERS || 12));
/* الغرفة تبقى قائمة بعد خروج صاحبها — يدخلها الناس بالرابط متى شاؤوا.
   لا تُزال إلّا إذا حذفها صاحبها، أو بقيت فارغة تماماً هذه المدّة. */
const ROOM_TTL_H = Math.max(1, Number(process.env.ROOM_TTL_H || 48));
/* مشاركة أسماء ما يسمعه اللاعبون: مطفأة افتراضياً.
   حتى حين تُفعَّل لا يمرّ عبر الخادم أي ملفّ صوتي — نصّ العنوان فقط. */
const MUSIC_SHARING = process.env.ALLOW_MUSIC_SHARING === '1';
const REPORTS_FILE = join(ROOT, 'server', 'music-reports.json');
const ROOMS_FILE = join(ROOT, 'server', 'rooms.json');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.glb': 'model/gltf-binary',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp'
};

/* ----------------------------- خادم الملفات ----------------------------- */
const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/' || p === '') p = '/index.html';
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
    const data = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache'
    });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('غير موجود');
  }
});

/* ------------------------------ الغرف ----------------------------------- */
const LOBBY = 'CITY';
const rooms = new Map();          // code -> { code, name, key, ownerName, created, members:Set, max, fixed }
const clients = new Map();        // id   -> { socket, id, name, car, key, room, state }
let nextId = 1;

rooms.set(LOBBY, {
  code: LOBBY, name: 'المدينة الحرّة', key: null, ownerName: 'الخادم',
  created: Date.now(), members: new Set(), max: 64, fixed: true
});

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // بلا حروف تلتبس بالأرقام
function newCode() {
  for (let attempt = 0; attempt < 400; attempt++) {
    let c = '';
    for (let i = 0; i < 5; i++) c += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0];
    if (!rooms.has(c)) return c;
  }
  return 'R' + Date.now().toString(36).toUpperCase();
}

const roomInfo = (r) => ({
  code: r.code, name: r.name, ownerName: r.ownerName, players: r.members.size,
  max: r.max, fixed: !!r.fixed, created: r.created, seen: r.seen || r.created,
  /* أسماء من هم داخلها الآن: بها يعرف اللاعب أين الناس قبل أن يدخل */
  names: [...r.members].map((id) => (clients.get(id) || {}).name).filter(Boolean).slice(0, 8)
});

/* قائمة الغرف كما يراها لاعب بعينه: يعرف أيّها غرفه وكم بقي له */
function roomsFor(c) {
  const list = [...rooms.values()]
    .sort((a, b) => (b.fixed ? 1 : 0) - (a.fixed ? 1 : 0) || b.created - a.created)
    .map((r) => Object.assign(roomInfo(r), { mine: !!(c.key && r.key === c.key) }));
  return { t: 'rooms', list, limit: MAX_ROOMS, mine: countOwned(c.key), room: c.room,
           total: clients.size };          // كم شخصاً على الخادم كلّه
}
function countOwned(key) {
  if (!key) return 0;
  let n = 0;
  for (const r of rooms.values()) if (r.key === key) n++;
  return n;
}

/* --------------------------- بلاغات الموسيقى ----------------------------
   الخادم لا يستضيف أي ملفّ صوتي ولا ينقله. يمرّ به عنوان نصّي فقط، وعند
   أي بلاغ يُمنع ذلك العنوان من المشاركة فوراً ويُسجَّل ليراجعه المشغّل
   وينفّذ الإزالة المناسبة. */
const blockedTitles = new Set();
const reports = [];
/* -------------------- تطبيع العناوين ومطابقة المتشابه --------------------
   لا يوجد في المتصفّح بصمة صوتية حقيقية (تحتاج قاعدة بصمات مرخّصة)، لكن
   أكثر ما يفلت من المنع هو العنوان نفسه مكتوباً بصيغة أخرى:
   «Song (Official Video)» و«song - HQ» و«سونغ ft. فلان». فنُطبّع العنوان
   ونقارن تشابهه، فيُمسك المتشابه لا المطابق وحده. */
const NOISE = /\b(official|video|audio|lyrics?|lyric|hd|hq|4k|full|remaster(ed)?|version|mv|mp3|free|download|visuali[sz]er|live|cover|feat|ft|prod|by|the|a)\b/g;
/* تُطبَّق بعد توحيد الهمزة والياء والتاء المربوطة، فتُكتب بصورتها بعد التوحيد */
const AR_NOISE = /(الاغنيه|اغنيه|النسخه|نسخه|الاصليه|اصليه|كلمات|بدون موسيقي|فيديو|كليب|رسميه|رسمي|حصريه|حصري|تحميل|جديد|اوديو|بجوده عاليه)/g;
const AR_DIAC = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

function normTitle(t) {
  let s = String(t || '').toLowerCase();
  try { s = s.normalize('NFKD').replace(/[̀-ͯ]/g, ''); } catch (e) {}
  s = s.replace(AR_DIAC, '')
       .replace(/[أإآٱ]/g, 'ا').replace(/[ىئ]/g, 'ي').replace(/[ؤ]/g, 'و')
       .replace(/ة/g, 'ه')
       .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, ' ')      // ما بين الأقواس زينة غالباً
       .replace(/[^\p{L}\p{N}]+/gu, ' ')
       .replace(AR_NOISE, ' ')
       .replace(NOISE, ' ')
       .replace(/\s+/g, ' ').trim();
  return s.slice(0, 80);
}

/* تشابه: نصف من الكلمات المشتركة ونصف من تقارب الحروف */
function tokenSim(a, b) {
  const A = new Set(a.split(' ').filter(Boolean));
  const B = new Set(b.split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((w) => { if (B.has(w)) inter++; });
  return inter / (A.size + B.size - inter);
}
function charSim(a, b) {
  if (a === b) return 1;
  const big = (s) => { const g = new Set(); for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2)); return g; };
  const A = big(a), B = big(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((g) => { if (B.has(g)) inter++; });
  return (2 * inter) / (A.size + B.size);
}
function similar(a, b) {
  const x = normTitle(a), y = normTitle(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  /* «اسم» داخل «اسم - نسخة» — بشرط أن يكون الجزء معتبراً لا حرفين،
     وإلّا لَمنَعَ عنوانٌ قصيرٌ كلَّ ما احتواه */
  const short = x.length < y.length ? x : y, long = x.length < y.length ? y : x;
  if (short.length >= 5 && short.length * 2 >= long.length && long.includes(short)) return 0.95;
  return 0.5 * tokenSim(x, y) + 0.5 * charSim(x, y);
}
const SIM_AT = 0.82;                                     // فوقها يُعدّ العنوانان واحداً
const tkey = normTitle;

/* العنوان ممنوع إن طابق ممنوعاً أو أشبهه */
function blockedLike(title) {
  const k = tkey(title);
  if (!k) return false;
  if (blockedTitles.has(k)) return true;
  for (const b of blockedTitles) if (similar(b, k) >= SIM_AT) return true;
  return false;
}

/* الغرف تُكتب على القرص: لو أُعيد تشغيل الخادم رجعت الغرف بأسمائها
   ورموزها، فيظلّ رابط الدعوة الذي أرسله اللاعب لأصدقائه صالحاً. */
let roomsDirty = false;
const markRooms = () => { roomsDirty = true; };
async function saveRooms() {
  if (!roomsDirty) return;
  roomsDirty = false;
  try {
    await writeFile(ROOMS_FILE, JSON.stringify({
      updated: new Date().toISOString(),
      rooms: [...rooms.values()].filter((r) => !r.fixed).map((r) => ({
        code: r.code, name: r.name, key: r.key, ownerName: r.ownerName,
        created: r.created, seen: r.seen || r.created, max: r.max
      }))
    }, null, 2), 'utf8');
  } catch (e) { /* القرص للقراءة فقط أحياناً — الغرف تبقى في الذاكرة */ }
}
async function loadRooms() {
  try {
    const raw = JSON.parse(await readFile(ROOMS_FILE, 'utf8'));
    const cut = Date.now() - ROOM_TTL_H * 3600e3;
    let n = 0;
    (raw.rooms || []).forEach((r) => {
      if (!r.code || rooms.has(r.code)) return;
      if ((r.seen || r.created || 0) <= cut) return;        // خالية ومهجورة
      rooms.set(r.code, {
        code: r.code, name: r.name, key: r.key || null,
        ownerName: r.ownerName || '—', created: r.created || Date.now(),
        seen: r.seen || r.created || Date.now(),
        members: new Set(), max: r.max || MAX_PLAYERS, fixed: false
      });
      n++;
    });
    if (n) console.log('  استُرجعت ' + n + ' غرفة من التشغيل السابق');
  } catch (e) { /* أوّل تشغيل */ }
}
setInterval(saveRooms, 10e3).unref?.();

async function saveReports() {
  try {
    await writeFile(REPORTS_FILE, JSON.stringify({
      updated: new Date().toISOString(),
      blocked: [...blockedTitles],
      reports: reports.slice(-500)
    }, null, 2), 'utf8');
  } catch (e) { /* التسجيل على القرص اختياري */ }
}
async function loadReports() {
  try {
    const raw = JSON.parse(await readFile(REPORTS_FILE, 'utf8'));
    (raw.blocked || []).forEach((t) => blockedTitles.add(t));
    (raw.reports || []).forEach((r) => reports.push(r));
    if (blockedTitles.size) console.log('  عناوين ممنوعة من المشاركة:', blockedTitles.size);
  } catch (e) { /* أوّل تشغيل */ }
}

/* ------------------------------ WebSocket ------------------------------- */
function accept(key) {
  return createHash('sha1').update(key + GUID).digest('base64');
}

function frame(str) {
  const payload = Buffer.from(str, 'utf8');
  const len = payload.length;
  let head;
  if (len < 126) head = Buffer.from([0x81, len]);
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([head, payload]);
}

function send(c, obj) {
  try { c.socket.write(frame(JSON.stringify(obj))); } catch (e) {}
}
/* البثّ داخل غرفة واحدة فقط — لا يسمع لاعبو غرفة لاعبي غرفة أخرى */
function roomcast(code, obj, exceptId) {
  const r = rooms.get(code);
  if (!r) return;
  const buf = frame(JSON.stringify(obj));
  for (const id of r.members) {
    if (id === exceptId) continue;
    const c = clients.get(id);
    if (!c) continue;
    try { c.socket.write(buf); } catch (e) {}
  }
}
/* تُرسل قائمة الغرف للجميع عند أي تغيّر، وكلٌّ يراها بمنظوره */
function pushRooms() {
  for (const c of clients.values()) send(c, roomsFor(c));
}

function mates(c) {
  const r = rooms.get(c.room);
  if (!r) return [];
  return [...r.members].filter((id) => id !== c.id)
    .map((id) => clients.get(id)).filter(Boolean)
    .map((o) => ({ id: o.id, name: o.name, car: o.car }));
}

/* كنس دوريّ: الغرفة الخالية التي لم يدخلها أحد منذ ROOM_TTL_H ساعة تُزال.
   ما دام فيها أحد — أو دخلها أحد حديثاً — فهي باقية وإن غاب صاحبها. */
function sweepRooms() {
  const cut = Date.now() - ROOM_TTL_H * 3600e3;
  let gone = 0;
  for (const r of rooms.values()) {
    if (r.fixed || r.members.size) continue;
    if ((r.seen || r.created) > cut) continue;
    rooms.delete(r.code); gone++; markRooms();
    console.log('⌛ أُزيلت غرفة خالية منذ مدّة:', r.code, '«' + r.name + '»');
  }
  if (gone) pushRooms();
}
setInterval(sweepRooms, 30 * 60e3).unref?.();

/* غرفة عشوائية فيها ناس: يفضّل الآهلة غير الممتلئة، ثم أي غرفة، ثم المدينة */
function randomRoomCode(c) {
  const open = [...rooms.values()].filter((r) => !r.fixed && r.members.size < r.max &&
                                                 r.code !== c.room);
  const busy = open.filter((r) => r.members.size > 0);
  const pool = busy.length ? busy : open;
  if (!pool.length) return null;
  return pool[(Math.random() * pool.length) | 0].code;
}

function enterRoom(c, code) {
  const r = rooms.get(code);
  if (!r) { send(c, { t: 'room.error', code: 'missing' }); return false; }
  if (r.members.size >= r.max && c.room !== code) {
    send(c, { t: 'room.error', code: 'full' }); return false;
  }
  leaveRoom(c, true);
  r.members.add(c.id);
  r.seen = Date.now(); markRooms();
  c.room = code;
  send(c, { t: 'room.joined', room: roomInfo(r), players: mates(c) });
  roomcast(code, { t: 'join', id: c.id, name: c.name, car: c.car }, c.id);
  console.log('→', c.name, 'دخل الغرفة', code, '(' + r.members.size + ')');
  return true;
}
function leaveRoom(c, quiet) {
  const r = rooms.get(c.room);
  if (!r) { c.room = null; return; }
  r.members.delete(c.id);
  r.seen = Date.now(); markRooms();
  if (c.nowPlaying) roomcast(r.code, { t: 'music.now', id: c.id, name: c.name, title: '' });
  roomcast(r.code, { t: 'leave', id: c.id });
  c.room = null;
  if (!quiet) send(c, { t: 'room.left' });
}

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept(key) + '\r\n\r\n');
  socket.setNoDelay(true);

  const id = nextId++;
  const client = { socket, id, name: 'لاعب ' + id, car: 'cortina',
                   key: null, room: null, state: null };
  clients.set(id, client);
  enterRoom(client, LOBBY);
  send(client, { t: 'welcome', id, players: mates(client), limit: MAX_ROOMS });
  send(client, { t: 'music.policy', sharing: MUSIC_SHARING });
  if (blockedTitles.size) send(client, { t: 'music.blocked', titles: [...blockedTitles] });
  send(client, roomsFor(client));
  pushRooms();

  let buf = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const op = buf[0] & 0x0f;
      const masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      const maskLen = masked ? 4 : 0;
      if (buf.length < off + maskLen + len) return;
      const mask = masked ? buf.subarray(off, off + 4) : null;
      const payload = buf.subarray(off + maskLen, off + maskLen + len);
      if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      buf = buf.subarray(off + maskLen + len);

      if (op === 8) { socket.end(); return; }
      if (op === 9) { socket.write(Buffer.from([0x8a, 0])); continue; }
      if (op !== 1) continue;
      let msg;
      try { msg = JSON.parse(payload.toString('utf8')); } catch (e) { continue; }
      handle(client, msg);
    }
  });

  const bye = () => {
    if (!clients.has(id)) return;
    leaveRoom(client, true);
    clients.delete(id);
    console.log('←', client.name, 'خرج | المتّصلون:', clients.size);
    pushRooms();
  };
  socket.on('close', bye);
  socket.on('error', bye);
});

function handle(c, m) {
  switch (m.t) {
    case 'hello':
      c.name = String(m.name || c.name).slice(0, 20);
      c.car = m.car || c.car;
      /* مفتاح ثابت يحفظه اللاعب في متصفّحه: به نعرف غرفه بعد إعادة الاتّصال */
      if (m.key) c.key = String(m.key).slice(0, 64);
      roomcast(c.room, { t: 'name', id: c.id, name: c.name, car: c.car }, c.id);
      send(c, roomsFor(c));
      break;

    case 'rooms':
      send(c, roomsFor(c));
      break;

    case 'room.create': {
      if (!c.key) { send(c, { t: 'room.error', code: 'nokey' }); break; }
      const owned = [...rooms.values()].filter((r) => r.key === c.key);
      if (owned.length >= MAX_ROOMS) {
        send(c, { t: 'room.error', code: 'limit', limit: MAX_ROOMS,
                  rooms: owned.map(roomInfo) });
        break;
      }
      const code = newCode();
      const room = {
        code, name: String(m.name || '').trim().slice(0, 24) || ('غرفة ' + code),
        key: c.key, ownerName: c.name, created: Date.now(),
        members: new Set(), max: MAX_PLAYERS, fixed: false
      };
      rooms.set(code, room);
      markRooms();
      console.log('+ غرفة', code, '«' + room.name + '» لـ', c.name);
      enterRoom(c, code);
      pushRooms();
      break;
    }

    case 'room.delete': {
      const r = rooms.get(String(m.code || ''));
      if (!r) { send(c, { t: 'room.error', code: 'missing' }); break; }
      if (r.fixed || !c.key || r.key !== c.key) {
        send(c, { t: 'room.error', code: 'notowner' }); break;
      }
      /* أعِد من فيها إلى المدينة الحرّة قبل الحذف */
      for (const id of [...r.members]) {
        const o = clients.get(id);
        if (o) { enterRoom(o, LOBBY); send(o, { t: 'room.closed', code: r.code, name: r.name }); }
      }
      rooms.delete(r.code);
      markRooms();
      console.log('- حُذفت الغرفة', r.code);
      send(c, { t: 'room.deleted', code: r.code });
      pushRooms();
      break;
    }

    case 'room.join':
      if (enterRoom(c, String(m.code || '').toUpperCase())) pushRooms();
      break;

    /* «دخول عشوائي»: يختار الخادم غرفة فيها ناس ليقع اللاعب مع وجوه جديدة */
    case 'room.random': {
      const pick = randomRoomCode(c);
      if (!pick) { send(c, { t: 'room.error', code: 'norandom' }); break; }
      if (enterRoom(c, pick)) pushRooms();
      break;
    }

    case 'room.leave':
      enterRoom(c, LOBBY);
      pushRooms();
      break;

    case 'pos':
      c.state = m;
      roomcast(c.room, { t: 'pos', id: c.id, x: m.x, z: m.z, y: m.y,
                         yaw: m.yaw, v: m.v, car: m.car }, c.id);
      break;

    case 'chat':
      roomcast(c.room, { t: 'chat', id: c.id, name: c.name,
                         msg: String(m.msg || '').slice(0, 200) });
      break;

    /* الرسائل المباشرة: لا تُسلَّم إلا داخل الغرفة نفسها */
    case 'invite': case 'accept': case 'decline': case 'race': case 'rtc': {
      const to = clients.get(m.to);
      if (to && to.room === c.room) send(to, Object.assign({}, m, { from: c.id, name: c.name }));
      break;
    }

    /* ------------------------- الموسيقى الشخصية ------------------------ *
       يمرّ العنوان نصّاً فقط. لا ملفّات ولا بثّ ولا تخزين للصوت هنا. */
    case 'music.now': {
      if (!MUSIC_SHARING) { send(c, { t: 'music.policy', sharing: false }); break; }
      const title = String(m.title || '').slice(0, 60).trim();
      if (title && blockedLike(title)) {
        send(c, { t: 'music.blocked', titles: [title] });
        break;
      }
      c.nowPlaying = title;
      roomcast(c.room, { t: 'music.now', id: c.id, name: c.name, title }, c.id);
      break;
    }

    case 'music.report': {
      const title = String(m.title || '').slice(0, 60).trim();
      if (!title) break;
      blockedTitles.add(tkey(title));
      const rec = { at: new Date().toISOString(), title, reason: String(m.reason || 'other').slice(0, 30),
                    note: String(m.note || '').slice(0, 200), by: c.name, byId: c.id,
                    ownerId: Number(m.ownerId) || 0, room: c.room };
      reports.push(rec);
      console.log('🚩 بلاغ موسيقى:', rec.title, '|', rec.reason, '| من', rec.by);
      saveReports();
      /* أوقف مشاركته لدى الجميع فوراً */
      for (const o of clients.values()) {
        if (tkey(o.nowPlaying) === tkey(title)) {
          o.nowPlaying = '';
          roomcast(o.room, { t: 'music.now', id: o.id, name: o.name, title: '' });
        }
        send(o, { t: 'music.blocked', titles: [title] });
      }
      send(c, { t: 'music.reported', title });
      break;
    }

    case 'ping': send(c, { t: 'pong', ts: m.ts }); break;
  }
}

await loadReports();
await loadRooms();

server.listen(PORT, () => {
  console.log('\n  🏁 خادم مدينة السرعة يعمل');
  console.log('  الصفحة:   http://localhost:' + PORT);
  console.log('  الخادم:   ws://localhost:' + PORT);
  console.log('  حدّ الغرف لكل لاعب: ' + MAX_ROOMS + ' — وحدّ اللاعبين في الغرفة: ' + MAX_PLAYERS);
  console.log('  مشاركة أسماء الموسيقى: ' + (MUSIC_SHARING ? 'مفعّلة (أسماء نصّية فقط)' : 'معطّلة')
              + '  — للتفعيل: ALLOW_MUSIC_SHARING=1');
  console.log('  بلاغات الموسيقى تُسجَّل في server/music-reports.json');
  console.log('  الغرف محفوظة في server/rooms.json — تبقى بعد خروج صاحبها وبعد إعادة التشغيل');
  console.log('  تُزال الغرفة الخالية بعد ' + ROOM_TTL_H + ' ساعة (ROOM_TTL_H)\n');
});

/* اكتب الغرف قبل الإغلاق حتى لا يضيع رابط أنشئ قبل ثوانٍ */
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => { roomsDirty = true; await saveRooms(); process.exit(0); });
}
