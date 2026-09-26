/* ============================================================
   NEXUS · API KEY POOL — the Cloud Function «processRequest»

   Players may donate their own AI keys (Gemini · Groq · OpenRouter) so
   the site's free AI keeps working for everyone. A donated key is written
   by the browser ONCE into Firestore «api_keys» (firestore.rules: nobody
   can read it back — not the donor, not another player, not a bot) and
   is only ever used HERE, on the server:

     browser ──(Firebase sign-in token + the question)──▶ processRequest
     processRequest ──(admin SDK, rules do not apply)──▶ api_keys
     processRequest ──(a random active key)──▶ the provider's API
     processRequest ──(the answer only)──▶ browser

   The key never leaves this function: it is not in the answer, not in an
   error message, not in a log line (keys are logged by their document id).

   Why the target is NOT chosen by the browser: a proxy that forwards a key
   to any address a caller names would hand the key to that caller. The
   providers and their addresses are fixed below.

   Requires the Firebase Blaze plan (Cloud Functions). Deploy:
     cd functions && npm install && cd ..
     firebase deploy --only functions:processRequest,firestore:rules

   Settings (optional — functions/.env, see .env.example):
     POOL_PER_MINUTE       requests per player per minute        (20)
     POOL_MAX_TOKENS       the longest answer                    (2048)
     POOL_MAX_TRIES        keys tried for one request            (5)
     POOL_TIMEOUT_MS       how long one provider may take        (60000)
     POOL_ALLOW_ANONYMOUS  1 = guest sessions may use it too      (off)
     POOL_ALLOWED_ORIGINS  the site's address(es), comma separated (any)
     GEMINI_MODEL · GROQ_MODEL · OPENROUTER_MODEL   the default models
   ============================================================ */
'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const crypto = require('crypto');

initializeApp();
/* the Admin SDK's Firestore — what older code writes as admin.firestore().
   It runs with the server's own credentials, so the «allow read: if false»
   rule that shuts every browser out of api_keys does not apply here. */
const db = getFirestore();

/* ---------------------------------------------------------------- settings */
const env = (k, d) => (process.env[k] != null && process.env[k] !== '' ? process.env[k] : d);
const num = (k, d, lo, hi) => { const v = +env(k, d); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
const CFG = {
  perMinute: num('POOL_PER_MINUTE', 20, 1, 600),
  maxTokens: num('POOL_MAX_TOKENS', 2048, 64, 8192),
  maxTries: num('POOL_MAX_TRIES', 5, 1, 20),
  timeoutMs: num('POOL_TIMEOUT_MS', 60000, 5000, 120000),
  reviveEveryMs: num('POOL_REVIVE_EVERY_MS', 60000, 1000, 3600000),
  cacheMs: num('POOL_CACHE_MS', 30000, 0, 600000),
  allowAnonymous: env('POOL_ALLOW_ANONYMOUS', '') === '1',
  origins: String(env('POOL_ALLOWED_ORIGINS', '')).split(/[\s,]+/).filter(Boolean)
};

/* ---------------------------------------------------------------- the providers (fixed, never from the request) */
const PROVIDERS = {
  gemini: { label: 'Gemini', base: () => env('GEMINI_BASE', 'https://generativelanguage.googleapis.com/v1beta/openai'), model: () => env('GEMINI_MODEL', 'gemini-3.6-flash') },
  groq: { label: 'Groq', base: () => env('GROQ_BASE', 'https://api.groq.com/openai/v1'), model: () => env('GROQ_MODEL', 'llama-3.3-70b-versatile') },
  openrouter: { label: 'OpenRouter', base: () => env('OPENROUTER_BASE', 'https://openrouter.ai/api/v1'), model: () => env('OPENROUTER_MODEL', 'meta-llama/llama-3.3-70b-instruct:free') }
};
/* which provider a key belongs to — decided here from the key itself, never trusted from the browser */
function providerOf(key) {
  const k = String(key || '');
  if (/^gsk_[A-Za-z0-9]{20,}$/.test(k)) return 'groq';
  if (/^sk-or-[A-Za-z0-9_-]{20,}$/.test(k)) return 'openrouter';
  if (/^(AIza[0-9A-Za-z_-]{30,}|AQ\.[0-9A-Za-z_.-]{20,})$/.test(k)) return 'gemini';
  return null;
}

/* anything that looks like a key is cut out of every text that leaves this function */
const KEY_LIKE = /(AIza[0-9A-Za-z_-]{10,}|AQ\.[0-9A-Za-z_.-]{10,}|gsk_[A-Za-z0-9]{8,}|sk-(or-)?[A-Za-z0-9_-]{8,}|Bearer\s+\S+)/g;
const scrub = s => String(s == null ? '' : s).replace(KEY_LIKE, '[key]').slice(0, 300);

/* how a provider says «this key is refused» */
const KEY_WORDS = /api[_ ]?key|auth(entication)?[_ ]?key|invalid[^"]{0,24}key|credential|permission|unauthori[sz]ed/i;
/* how it says «out of quota for the day» (vs. a short per-minute limit) */
const QUOTA_WORDS = /per[- ]day|daily|quota|RESOURCE_EXHAUSTED|limit: ?0|insufficient[_ ]credit|credits/i;

/* ---------------------------------------------------------------- small helpers */
class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
function send(res, status, body) {
  res.set('Cache-Control', 'no-store');
  res.status(status).json(body);
}
function sendError(res, e) {
  const status = e instanceof HttpError ? e.status : 500;
  const code = e instanceof HttpError ? e.code : 'internal';
  const message = e instanceof HttpError ? e.message : 'خطأ في الخادم — حاول بعد قليل';
  if (!(e instanceof HttpError)) logger.error('processRequest failed', { error: scrub(e && e.stack || e) });
  send(res, status, { ok: false, error: { code, message } });
}
/* a random order, from a real random source */
function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const tail = k => '••••' + String(k).slice(-4);

/* ---------------------------------------------------------------- who is asking */
async function caller(req) {
  const m = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '');
  if (!m) throw new HttpError(401, 'signin', 'سجّل الدخول أولًا');
  let t;
  try { t = await getAuth().verifyIdToken(m[1]); }
  catch { throw new HttpError(401, 'signin', 'انتهت جلسة الدخول — سجّل الدخول من جديد'); }
  if (t.firebase && t.firebase.sign_in_provider === 'anonymous' && !CFG.allowAnonymous) throw new HttpError(401, 'signin', 'الذكاء المجاني لمن سجّل الدخول بحساب (Google أو البريد)');
  return { uid: t.uid };
}

/* ---------------------------------------------------------------- per-player rate limit (a counter per minute, in Firestore) */
async function limit(uid) {
  const ref = db.collection('api_usage').doc(uid);
  const minute = Math.floor(Date.now() / 60000);
  const n = await db.runTransaction(async tx => {
    const d = (await tx.get(ref)).data() || {};
    const count = d.minute === minute ? (d.count || 0) + 1 : 1;
    tx.set(ref, { minute, count, at: FieldValue.serverTimestamp() });
    return count;
  });
  if (n > CFG.perMinute) throw new HttpError(429, 'rate_limit', 'طلبات كثيرة — انتظر دقيقة ثم حاول');
}

/* ---------------------------------------------------------------- the request, checked */
function readBody(body) {
  const b = body && typeof body === 'object' ? body : {};
  const msgs = Array.isArray(b.messages) ? b.messages : null;
  if (!msgs || !msgs.length || msgs.length > 40) throw new HttpError(400, 'bad_request', 'الرسائل مفقودة أو كثيرة جدًا');
  const messages = msgs.map(m => ({
    role: ['system', 'user', 'assistant'].includes(m && m.role) ? m.role : 'user',
    content: String((m && m.content) || '')
  }));
  const size = messages.reduce((n, m) => n + m.content.length, 0);
  if (!size) throw new HttpError(400, 'bad_request', 'الرسالة فارغة');
  if (size > 60000) throw new HttpError(413, 'too_large', 'الطلب كبير جدًا');
  let provider = b.provider == null || b.provider === 'auto' ? null : String(b.provider);
  if (provider && !PROVIDERS[provider]) throw new HttpError(400, 'bad_provider', 'مزوّد غير معروف: ' + scrub(provider));
  let model = b.model == null || b.model === 'auto' ? null : String(b.model);
  if (model && !/^[\w.:/-]{1,80}$/.test(model)) throw new HttpError(400, 'bad_model', 'اسم نموذج غير صالح');
  const out = { messages, provider, model, max_tokens: Math.min(CFG.maxTokens, Math.max(64, +b.max_tokens || 1024)) };
  if (Number.isFinite(+b.temperature)) out.temperature = Math.min(1.5, Math.max(0, +b.temperature));
  return out;
}

/* ---------------------------------------------------------------- the pool */
let cache = { at: 0, keys: [] };
let revivedAt = 0;
/* keys that rested after a rate limit come back when their time is up */
async function revive() {
  if (Date.now() - revivedAt < CFG.reviveEveryMs) return;
  revivedAt = Date.now();
  const snap = await db.collection('api_keys').where('reviveAt', '<=', Timestamp.now()).limit(50).get();
  await Promise.all(snap.docs.map(d => {
    const k = d.data();
    if (k.status !== 'disabled' || k.disabledReason !== 'rate-limit') return null;
    return d.ref.update({ status: 'active', reviveAt: FieldValue.delete(), disabledReason: FieldValue.delete() }).catch(() => null);
  }));
  if (snap.size) cache.at = 0;
}
async function activeKeys(provider) {
  await revive().catch(e => logger.warn('revive', { error: scrub(e.message) }));
  /* read again every 30 s (POOL_CACHE_MS) — or at once (at most every 3 s) when no key fits: a new donation is used right away */
  const age = Date.now() - cache.at, fits = cache.keys.some(k => !provider || k.provider === provider);
  if (age < CFG.cacheMs && (fits || age < Math.min(3000, CFG.cacheMs))) return cache.keys;
  const snap = await db.collection('api_keys').where('status', '==', 'active').limit(500).get();
  cache = {
    at: Date.now(),
    keys: snap.docs.map(d => ({ id: d.id, key: d.get('key'), provider: providerOf(d.get('key')), failCount: d.get('failCount') || 0 }))
      .filter(k => k.provider)
  };
  return cache.keys;
}
/* a key that failed: refused → disabled for good; rate-limited → disabled until reviveAt */
async function disable(k, reason, restMs) {
  cache.keys = cache.keys.filter(x => x.id !== k.id);
  const patch = { status: 'disabled', disabledReason: reason, disabledAt: FieldValue.serverTimestamp(), failCount: FieldValue.increment(1) };
  /* a key that keeps failing is not revived again */
  if (reason === 'rate-limit' && k.failCount + 1 < 20) patch.reviveAt = Timestamp.fromMillis(Date.now() + restMs);
  else if (reason === 'rate-limit') patch.disabledReason = 'too-many-failures';
  await db.collection('api_keys').doc(k.id).update(patch).catch(e => logger.warn('disable', { id: k.id, error: scrub(e.message) }));
  logger.info('key disabled', { id: k.id, reason });
}
function used(k) {
  db.collection('api_keys').doc(k.id).update({ lastUsedAt: FieldValue.serverTimestamp(), uses: FieldValue.increment(1) }).catch(() => {});
}

/* ---------------------------------------------------------------- one call to a provider */
async function callProvider(p, key, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CFG.timeoutMs);
  try {
    const headers = { 'content-type': 'application/json', authorization: 'Bearer ' + key };
    if (p === 'openrouter') { headers['X-Title'] = 'NEXUS'; }
    const r = await fetch(PROVIDERS[p].base() + '/chat/completions', { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
    const text = await r.text();
    return { status: r.status, text, retryAfter: +(r.headers.get('retry-after') || 0) };
  } catch (e) {
    return { status: 0, text: e && e.name === 'AbortError' ? 'timeout' : String(e && e.message || e) };
  } finally { clearTimeout(timer); }
}
function restFor(r) {
  if (QUOTA_WORDS.test(r.text)) return 6 * 3600e3;                                  // out of quota: hours
  const m = /try again in\s*([\d.]+)\s*(ms|s|m)\b/i.exec(r.text);
  const s = r.retryAfter || (m ? +m[1] * (m[2] === 'ms' ? 0.001 : m[2] === 'm' ? 60 : 1) : 60);
  return Math.min(3600, Math.max(30, s)) * 1000;
}

/* ---------------------------------------------------------------- the answer */
async function answer(q) {
  const all = await activeKeys(q.provider);
  const pool = shuffle(all.filter(k => !q.provider || k.provider === q.provider));   // random rotation
  if (!pool.length) throw new HttpError(503, 'no_keys', q.provider ? 'لا توجد مفاتيح ' + PROVIDERS[q.provider].label + ' نشطة الآن' : 'لا توجد مفاتيح نشطة في المجمّع الآن');
  const tries = pool.slice(0, CFG.maxTries);
  const notes = [];
  for (const k of tries) {
    const model = q.model || PROVIDERS[k.provider].model();
    const body = { model, messages: q.messages, max_tokens: q.max_tokens, stream: false };
    if (q.temperature != null) body.temperature = q.temperature;
    const r = await callProvider(k.provider, k.key, body);
    if (r.status >= 200 && r.status < 300) {
      let j = null;
      try { j = JSON.parse(r.text); } catch { /* handled below */ }
      const text = j && j.choices && j.choices[0] && j.choices[0].message ? String(j.choices[0].message.content || '') : null;
      if (text == null) { notes.push(PROVIDERS[k.provider].label + ': ردّ غير مفهوم'); continue; }
      used(k);
      return { ok: true, text, provider: k.provider, model: (j && j.model) || model, usage: j && j.usage ? { in: j.usage.prompt_tokens || 0, out: j.usage.completion_tokens || 0 } : null, tried: notes.length + 1 };
    }
    const refused = r.status === 401 || r.status === 403 || (r.status === 400 && KEY_WORDS.test(r.text));
    if (refused) { await disable(k, 'invalid', 0); notes.push(PROVIDERS[k.provider].label + ': مفتاح مرفوض — عُطّل'); continue; }
    if (r.status === 429 || r.status === 402) { await disable(k, 'rate-limit', restFor(r)); notes.push(PROVIDERS[k.provider].label + ': وصل حدّه — عُطّل مؤقتًا'); continue; }
    /* the model named in the request does not exist there: the request's fault, no key is to blame */
    if ((r.status === 404 || r.status === 400) && /model/i.test(r.text) && q.model) throw new HttpError(400, 'bad_model', 'النموذج «' + scrub(q.model) + '» غير متاح لدى ' + PROVIDERS[k.provider].label);
    if (r.status === 400 || r.status === 413 || r.status === 422) throw new HttpError(r.status, 'provider_rejected', 'رفض المزوّد الطلب: ' + scrub((/"message"\s*:\s*"([^"]*)"/.exec(r.text) || [])[1] || 'طلب غير صالح'));
    /* overloaded or unreachable: another key, this one stays active */
    notes.push(PROVIDERS[k.provider].label + ': ' + (r.status ? 'HTTP ' + r.status : scrub(r.text)));
  }
  throw new HttpError(503, 'all_failed', 'تعذّر الرد الآن — جُرّب ' + tries.length + ' مفتاح (' + notes.join('، ') + ')');
}

/* ---------------------------------------------------------------- what a player may know about the pool (never a key) */
async function status(uid) {
  const all = await activeKeys();
  const byProvider = {};
  all.forEach(k => { byProvider[k.provider] = (byProvider[k.provider] || 0) + 1; });
  const out = { ok: true, active: all.length, providers: byProvider };
  if (uid) {
    /* the donor's own keys: provider, last four characters and state only */
    const mine = await db.collection('api_keys').where('donorUid', '==', uid).limit(10).get();
    out.mine = mine.docs.map(d => ({ id: d.id, provider: providerOf(d.get('key')), tail: tail(d.get('key')), status: d.get('status'), reason: d.get('disabledReason') || null, uses: d.get('uses') || 0 }));
  }
  return out;
}

/* ---------------------------------------------------------------- the function */
exports.processRequest = onRequest({ region: env('POOL_REGION', 'us-central1'), timeoutSeconds: 120, memory: '256MiB', maxInstances: 10 }, async (req, res) => {
  /* CORS: the site's own pages (POOL_ALLOWED_ORIGINS), or any origin when unset — a sign-in token is required either way */
  const origin = req.get('origin');
  if (origin) {
    if (CFG.origins.length && !CFG.origins.includes(origin)) return send(res, 403, { ok: false, error: { code: 'origin', message: 'غير مسموح من هذا الموقع' } });
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Headers', 'authorization, content-type');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Max-Age', '3600');
  }
  if (req.method === 'OPTIONS') return res.status(204).send('');
  try {
    if (req.method === 'GET') {
      /* ?mine=1 with a sign-in token: the donor's own keys (tails and states) */
      const me = req.query.mine ? await caller(req) : null;
      return send(res, 200, await status(me && me.uid));
    }
    if (req.method !== 'POST') throw new HttpError(405, 'method', 'POST فقط');
    const me = await caller(req);
    await limit(me.uid);
    const q = readBody(req.body);
    return send(res, 200, await answer(q));
  } catch (e) {
    return sendError(res, e);
  }
});
