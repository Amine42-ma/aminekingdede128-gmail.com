/* ============================================================================
   SPEED CITY — خادم اللعب الجماعي (بلا أي مكتبات خارجية)
   يشغّل: خادم ملفات ثابت + WebSocket لتبادل مواقع اللاعبين والدعوات والصوت.

   التشغيل:
       node server/server.mjs            # المنفذ 8080
       PORT=3000 node server/server.mjs

   ثم افتح  http://localhost:8080  من هاتفك أو حاسوبك على نفس الشبكة،
   واكتب في اللعبة عنوان الخادم:  ws://<عنوان الجهاز>:8080
   ========================================================================== */
import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8080);
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

/* ------------------------------ WebSocket ------------------------------- */
const clients = new Map();          // id -> { socket, name, car, state, room }
let nextId = 1;

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
function broadcast(obj, exceptId) {
  const buf = frame(JSON.stringify(obj));
  for (const [id, c] of clients) {
    if (id === exceptId) continue;
    try { c.socket.write(buf); } catch (e) {}
  }
}

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept(key) + '\r\n\r\n');
  socket.setNoDelay(true);

  const id = nextId++;
  const client = { socket, id, name: 'لاعب ' + id, car: 'cortina', state: null };
  clients.set(id, client);
  send(client, { t: 'welcome', id, players: [...clients.values()].filter((c) => c.id !== id)
    .map((c) => ({ id: c.id, name: c.name, car: c.car })) });
  broadcast({ t: 'join', id, name: client.name, car: client.car }, id);
  console.log('→ اتّصل', client.name, '| المتّصلون:', clients.size);

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
    clients.delete(id);
    broadcast({ t: 'leave', id });
    console.log('← خرج', client.name, '| المتّصلون:', clients.size);
  };
  socket.on('close', bye);
  socket.on('error', bye);
});

function handle(c, m) {
  switch (m.t) {
    case 'hello':
      c.name = String(m.name || c.name).slice(0, 20);
      c.car = m.car || c.car;
      broadcast({ t: 'name', id: c.id, name: c.name, car: c.car }, c.id);
      break;
    case 'pos':
      c.state = m;
      broadcast({ t: 'pos', id: c.id, x: m.x, z: m.z, y: m.y, yaw: m.yaw, v: m.v, car: m.car }, c.id);
      break;
    case 'chat':
      broadcast({ t: 'chat', id: c.id, name: c.name, msg: String(m.msg || '').slice(0, 200) });
      break;
    case 'invite': case 'accept': case 'decline': case 'race': case 'rtc': {
      const to = clients.get(m.to);
      if (to) send(to, Object.assign({}, m, { from: c.id, name: c.name }));
      break;
    }
    case 'ping': send(c, { t: 'pong', ts: m.ts }); break;
  }
}

server.listen(PORT, () => {
  console.log('\n  🏁 خادم مدينة السرعة يعمل');
  console.log('  الصفحة:   http://localhost:' + PORT);
  console.log('  الخادم:   ws://localhost:' + PORT + '\n');
});
