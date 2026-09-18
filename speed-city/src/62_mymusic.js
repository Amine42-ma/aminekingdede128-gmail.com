/* ============================================================================
   SPEED CITY — مكتبة الموسيقى الشخصية

   ما يفعله هذا الملف:
     • يضيف مقاطع صوتية يختارها اللاعب **من جهازه** فقط (MP3 / WAV / OGG…).
     • يحفظها في IndexedDB **على الجهاز وحده**. لا تُرفع إلى أي خادم أبداً.
     • يشغّلها داخل اللعبة كبديل عن الراديو.

   ما لا يفعله — عن قصد:
     • لا ينزّل موسيقى من الإنترنت، ولا يقبل رابط يوتيوب أو سبوتيفاي أو أي
       خدمة أخرى، ولا يستخرج صوتاً من روابط. لا يوجد أي حقل رابط في الواجهة.
     • لا يرسل ملفّ الصوت إلى لاعب آخر ولا يعيد بثّه. مشاركة «ما أستمع إليه»
       ترسل **الاسم فقط** (نصّاً)، وهي مطفأة افتراضياً، ويستطيع مشغّل الخادم
       تعطيلها كلّياً (ALLOW_MUSIC_SHARING).

   مسؤولية الحقوق على من يضيف الملف: الواجهة تطلب إقراراً صريحاً قبل كل
   إضافة، وتتيح الإبلاغ والحذف. هذا التصميم يهدف إلى **تقليل مخاطر انتهاك
   حقوق النشر** والامتثال لشروط المنصّات — وليس ضماناً قانونياً.
   ========================================================================== */
SC.mylib = (function () {
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

  const U = SC.util;

  const DB_NAME = 'speedcity-mylib', ST_BLOB = 'blobs', ST_META = 'meta';
  const MAX_SIZE = 40 * 1024 * 1024;              // ٤٠ ميغابايت للمقطع الواحد
  const MAX_TRACKS = 40;
  const OK_TYPE = /^audio\/|\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i;

  /* تصنيف الحقوق الذي يختاره اللاعب عند الإضافة */
  const RIGHTS = [
    { id: 'own',      label: 'من إنتاجي وأملك حقوقه',            share: true },
    { id: 'licensed', label: 'مرخّص لي باستخدامه ومشاركته',       share: true },
    { id: 'free',     label: 'صاحبه يسمح بإعادة الاستخدام (مثل CC)', share: true },
    { id: 'personal', label: 'للاستماع الشخصي فقط — لا أملك حقّ مشاركته', share: false }
  ];
  const rightsOf = (id) => RIGHTS.find((r) => r.id === id) || RIGHTS[3];

  const state = {
    list: [],                 // البيانات الوصفية فقط (بلا الملفّات)
    ready: false,
    playingId: null,
    el: null,
    objUrl: null,
    shareOn: false,           // مفتاح عام — مطفأ افتراضياً
    policy: { sharing: false },   // ما يسمح به الخادم
    blocked: {},              // عناوين أوقف الخادم مشاركتها بعد بلاغ
    heard: [],                // ما يشاركه من في غرفتك (أسماء فقط)
    onChange: null
  };

  const emit = () => {
    if (SC.audio && SC.audio.refreshStations) SC.audio.refreshStations();
    if (state.onChange) state.onChange();
  };

  /* ------------------------------ التخزين ------------------------------- */
  let dbPromise = null;
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((res) => {
      try {
        const rq = indexedDB.open(DB_NAME, 1);
        rq.onupgradeneeded = () => {
          const db = rq.result;
          if (!db.objectStoreNames.contains(ST_BLOB)) db.createObjectStore(ST_BLOB);
          if (!db.objectStoreNames.contains(ST_META)) db.createObjectStore(ST_META);
        };
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => res(null);
      } catch (e) { res(null); }
    });
    return dbPromise;
  }
  function tx(store, mode, fn) {
    return openDB().then((db) => new Promise((res) => {
      if (!db) return res(null);
      try {
        const t = db.transaction(store, mode);
        const rq = fn(t.objectStore(store));
        if (rq) { rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); }
        else { t.oncomplete = () => res(true); t.onerror = () => res(null); }
      } catch (e) { res(null); }
    }));
  }
  const metaGet = () => tx(ST_META, 'readonly', (s) => s.get('list'));
  const metaPut = (v) => tx(ST_META, 'readwrite', (s) => { s.put(v, 'list'); });
  const blobGet = (id) => tx(ST_BLOB, 'readonly', (s) => s.get(id));
  const blobPut = (id, b) => tx(ST_BLOB, 'readwrite', (s) => { s.put(b, id); });
  const blobDel = (id) => tx(ST_BLOB, 'readwrite', (s) => { s.delete(id); });

  function load() {
    return metaGet().then((v) => {
      state.list = Array.isArray(v) ? v : [];
      state.ready = true;
      try { state.shareOn = localStorage.getItem('speedcity-music-share') === '1'; } catch (e) {}
      emit();
      return state.list;
    });
  }
  const save = () => metaPut(state.list.map((t) => Object.assign({}, t)));

  /* ------------------------------ الإضافة ------------------------------- *
     تُستدعى بعد أن يوافق اللاعب صراحةً على إقرار الحقوق في الواجهة.
     الملفّ يبقى على الجهاز: لا رفع ولا إرسال. */
  function add(file, opts) {
    const o = opts || {};
    if (!o.confirmed) return Promise.reject(new Error('needs-confirm'));
    if (!file) return Promise.reject(new Error('no-file'));
    if (!(OK_TYPE.test(file.type || '') || OK_TYPE.test(file.name || ''))) {
      return Promise.reject(new Error('type'));
    }
    if (file.size > MAX_SIZE) return Promise.reject(new Error('size'));
    if (state.list.length >= MAX_TRACKS) return Promise.reject(new Error('full'));

    const id = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const title = (o.title || file.name.replace(/\.[^.]+$/, '')).slice(0, 60).trim() || 'مقطع';
    const rights = rightsOf(o.rights).id;
    const rec = { id, title, size: file.size, type: file.type || '', added: Date.now(),
                  rights, share: false, reported: false, artist: (o.artist || '').slice(0, 40) };
    return blobPut(id, file).then((ok) => {
      if (ok === null) throw new Error('store');
      state.list.push(rec);
      return save().then(() => { emit(); return rec; });
    });
  }

  /* ------------------------------ الحذف --------------------------------- */
  function remove(id) {
    const i = state.list.findIndex((t) => t.id === id);
    if (i < 0) return Promise.resolve(false);
    if (state.playingId === id) stop();
    state.list.splice(i, 1);
    return blobDel(id).then(() => save()).then(() => { emit(); return true; });
  }
  function clearAll() {
    const ids = state.list.map((t) => t.id);
    stop();
    state.list.length = 0;
    return Promise.all(ids.map(blobDel)).then(() => save()).then(() => { emit(); return true; });
  }

  /* ------------------------------ التشغيل ------------------------------- */
  function ensureEl() {
    if (state.el) return state.el;
    const el = new Audio();
    el.preload = 'none';
    el.addEventListener('ended', () => next());
    state.el = el;
    return el;
  }
  function volume() {
    const v = SC.settings && SC.settings.music;
    return U.clamp((v == null ? 0.45 : v) * 1.15, 0, 1);
  }
  function play(id) {
    const rec = state.list.find((t) => t.id === id);
    if (!rec) return Promise.resolve(false);
    return blobGet(id).then((blob) => {
      if (!blob) return false;
      const el = ensureEl();
      SC.audio.radioSet && SC.audio.radioSet('off');     // لا يعملان معاً
      if (state.objUrl) URL.revokeObjectURL(state.objUrl);
      state.objUrl = URL.createObjectURL(blob);
      el.src = state.objUrl;
      el.volume = volume();
      state.playingId = id;
      const pr = el.play();
      if (pr && pr.catch) pr.catch(() => {});
      shareNow(rec);
      emit();
      return true;
    });
  }
  function stop() {
    if (state.el) state.el.pause();
    if (state.objUrl) { URL.revokeObjectURL(state.objUrl); state.objUrl = null; }
    state.playingId = null;
    shareNow(null);
    emit();
  }
  function next() {
    if (!state.list.length) return;
    const i = state.list.findIndex((t) => t.id === state.playingId);
    play(state.list[(i + 1) % state.list.length].id);
  }
  function setVolume() { if (state.el) state.el.volume = volume(); }
  function pause() { if (state.el) state.el.pause(); }
  function resume() {
    if (state.el && state.playingId && volume() > 0) {
      const pr = state.el.play(); if (pr && pr.catch) pr.catch(() => {});
    }
  }

  /* ---------------------------- المشاركة (الاسم فقط) --------------------- *
     لا يُرسل الملفّ ولا أي جزء منه. تُرسل كلمة واحدة: عنوان المقطع، وفقط
     إذا: سمح الخادم + فعّل اللاعب المفتاح العام + أقرّ بحقّ مشاركة المقطع
     + لم يُبلَّغ عنه. أي شرط يسقط ⇒ لا تُرسل شيئاً. */
  function canShare(rec) {
    return !!(state.policy.sharing && state.shareOn && rec && rec.share &&
              rightsOf(rec.rights).share && !rec.reported &&
              !isBlocked(rec.title));
  }
  const titleKey = normTitle;

  /* هل مُنع هذا العنوان — أو ما يشبهه كثيراً؟ */
  function isBlocked(title) {
    const k = normTitle(title);
    if (!k) return false;
    if (state.blocked[k]) return true;
    for (const b in state.blocked) if (similar(b, k) >= SIM_AT) return true;
    return false;
  }

  function shareNow(rec) {
    if (!SC.net || !SC.net.connected) return;
    if (rec && canShare(rec)) SC.net.send({ t: 'music.now', title: rec.title.slice(0, 60) });
    else SC.net.send({ t: 'music.now', title: '' });      // أوقف عرض اسمي عندهم
  }

  function setShare(id, on) {
    const rec = state.list.find((t) => t.id === id);
    if (!rec) return false;
    if (on && !rightsOf(rec.rights).share) return false;  // لا مشاركة لِما لا تملك حقّه
    if (on && rec.reported) return false;
    rec.share = !!on;
    save().then(emit);
    if (state.playingId === id) shareNow(rec);
    return true;
  }
  function setShareAll(on) {
    state.shareOn = !!on;
    try { localStorage.setItem('speedcity-music-share', on ? '1' : '0'); } catch (e) {}
    if (!on) shareNow(null);
    else {
      const rec = state.list.find((t) => t.id === state.playingId);
      if (rec) shareNow(rec);
    }
    emit();
  }

  /* ------------------------- الإبلاغ والإزالة ---------------------------- *
     البلاغ يوقف المشاركة فوراً عند المُبلِّغ، ويُرسَل إلى الخادم ليوقف
     مشاركة ذلك العنوان لدى الجميع ويسجّله لمشغّل الخادم لينظر فيه. */
  const REASONS = [
    { id: 'copyright', label: 'موسيقى محمية بحقوق نشر بلا إذن' },
    { id: 'offensive', label: 'محتوى مسيء' },
    { id: 'other',     label: 'سبب آخر' }
  ];

  function report(target, reason, note) {
    const r = { title: '', ownerId: 0, reason: reason || 'copyright',
                note: String(note || '').slice(0, 200) };
    if (typeof target === 'string' && state.list.some((t) => t.id === target)) {
      const rec = state.list.find((t) => t.id === target);
      rec.reported = true; rec.share = false;             // أوقفها محلياً فوراً
      r.title = rec.title;
      save().then(emit);
      if (state.playingId === rec.id) shareNow(null);
    } else if (target && typeof target === 'object') {
      r.title = target.title || ''; r.ownerId = target.id || 0;
    }
    state.blocked[titleKey(r.title)] = true;
    if (SC.net && SC.net.connected) SC.net.send({ t: 'music.report', title: r.title,
                                                  ownerId: r.ownerId, reason: r.reason, note: r.note });
    emit();
    return r;
  }

  /* رسائل الخادم: السياسة، وما يسمعه من في الغرفة، وقوائم المنع */
  function onNet(m) {
    if (m.t === 'music.policy') { state.policy.sharing = !!m.sharing; emit(); }
    else if (m.t === 'music.now') {
      const i = state.heard.findIndex((h) => h.id === m.id);
      if (!m.title) { if (i >= 0) state.heard.splice(i, 1); }
      else if (i >= 0) { state.heard[i].title = m.title; state.heard[i].name = m.name; }
      else state.heard.push({ id: m.id, name: m.name, title: m.title });
      emit();
    } else if (m.t === 'music.blocked') {
      (m.titles || []).forEach((t) => { state.blocked[titleKey(t)] = true; });
      /* أوقف مشاركة ما مُنع، وأعلِم صاحبه */
      let hit = false;
      state.list.forEach((rec) => {
        if (isBlocked(rec.title) && rec.share) { rec.share = false; rec.reported = true; hit = true; }
      });
      if (hit) { save().then(emit); SC.hud && SC.hud.toast('أُوقفت مشاركة مقطع بعد بلاغ حقوق', 'bad', 5000); }
      state.heard = state.heard.filter((h) => !isBlocked(h.title));
      emit();
    } else if (m.t === 'music.reported') {
      SC.hud && SC.hud.toast('وصل بلاغك — أُوقفت مشاركة المقطع', 'ok', 4000);
    }
  }

  function clearHeard() { state.heard.length = 0; emit(); }

  /* الراديو يطلب الملفّ من هنا ليشغّله كمحطّة — يبقى على الجهاز */
  function blob(id) { return blobGet(id); }

  return { RIGHTS, REASONS, state, load, add, remove, clearAll, blob,
           play, stop, pause, resume, next, setVolume,
           setShare, setShareAll, canShare, report, onNet, clearHeard,
           rightsOf, MAX_SIZE, MAX_TRACKS, normTitle, similar, isBlocked, SIM_AT,
           get playing() { return state.list.find((t) => t.id === state.playingId) || null; },
           set onChange(f) { state.onChange = f; } };
})();
