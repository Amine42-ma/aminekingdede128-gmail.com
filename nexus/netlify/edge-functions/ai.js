/* ============================================================
   NEXUS — free built-in AI for every signed-in player.
   The keys live HERE, on the server, never in index.html or Git:
   Netlify → Site configuration → Environment variables:
     GEMINI_KEYS     = key1,key2,…     (Google AI Studio)
     GROQ_KEYS       = gsk_…,gsk_…     (Groq)
     OPENROUTER_KEYS = sk-or-…,sk-or-… (OpenRouter — its free models only)
   The player picks a model (or «auto»): Gemini 3.6 Flash (the model
   these Google AI Studio keys serve), every model of Groq's own list,
   OpenRouter's free ones.
   optional: GEMINI_MODELS (default gemini-3.6-flash; GEMINI_ALL_MODELS=1
   offers every chat model Google lists for the keys) · GROQ_MODELS /
   OPENROUTER_MODELS (a fixed list instead of the provider's own) ·
   FIREBASE_PROJECT_ID (jknbb-n) ·
   AI_MAX_TOKENS (4096) · AI_PER_MINUTE (20)
   THE OWNER'S KEY BOX: instead of (or besides) the variables above, the
   site owner can type keys inside NEXUS (⚙ ← «مفاتيح الذكاء المجاني»).
   They are sent here once, tested, and kept in the site's own Netlify Blobs
   store (every function on a linked Netlify site has it — nothing to set
   up). Elsewhere: Firestore platformSecrets/ai — a document no browser may
   read or write (firestore.rules) — via FIREBASE_SERVICE_ACCOUNT.
   Nobody ever gets a key back, the owner included: only «Groq ••••a1b2».
   Who the owner is: ADMIN_EMAILS (comma list) if set; otherwise the first
   verified Google account that saves a key claims the box.
   The page calls /api/ai/… with the player's Firebase sign-in token.
   This function checks the token, picks a key, and when a key is out
   of quota or refused it moves to the next key, then to the other
   provider — and says which model answered. No key ever leaves here.
   ============================================================ */
const env = k => { try { return (globalThis.Netlify && Netlify.env.get(k)) || ''; } catch { return ''; } };
const list = k => env(k).split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
const VAR = { gemini: 'GEMINI_KEYS', groq: 'GROQ_KEYS', openrouter: 'OPENROUTER_KEYS' };
/* a provider's keys: the site's variables, then the owner's key box */
const keysOf = p => Array.from(new Set(list(VAR[p]).concat(box.keys.filter(k => k.provider === p).map(k => k.key))));

const P = {
  gemini: { label: 'Gemini', base: () => env('GEMINI_BASE') || 'https://generativelanguage.googleapis.com/v1beta/openai',
    keys: () => keysOf('gemini'), models: () => geminiModels() },
  groq: { label: 'Groq', base: () => env('GROQ_BASE') || 'https://api.groq.com/openai/v1',
    keys: () => keysOf('groq'), models: () => groqModels() },
  openrouter: { label: 'OpenRouter', base: () => env('OPENROUTER_BASE') || 'https://openrouter.ai/api/v1',
    keys: () => keysOf('openrouter'), models: () => openrouterModels() }
};
const ORDER = ['gemini', 'groq', 'openrouter'];
/* which provider offers a model: the one whose list has it (none → treated as «auto») */
async function owner(m) {
  for (const p of ORDER) if (P[p].keys().length && (await P[p].models()).includes(m)) return p;
  return null;
}
const json = (status, obj, extra = {}) => new Response(JSON.stringify(obj), { status, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, extra) });
const fail = (status, code, message, extra) => json(status, { error: { code, message } }, extra);

/* how providers say «this key is refused» (Google: «Invalid Auth key.», «API key not valid») */
const KEY_WORDS = /api[_ ]?key|auth(entication)?[_ ]?key|invalid[^"]{0,24}key|credential|permission|unauthori[sz]ed/i;

/* ---------- which keys may be tried now ---------- */
const rest = new Map();                     // key → resting until (ms)
const turn = { gemini: 0, groq: 0, openrouter: 0 };   // round-robin start, spreads the load over the keys
/* a key that is refused rests as a whole; a key out of quota / rate-limited
   rests only for THAT model (its other models keep working) */
const resting = (k, model) => rest.get(k) > Date.now() || (model && rest.get(k + '|' + model) > Date.now());
function keysNow(p, model) {
  const all = P[p].keys(), n = all.length;
  if (!n) return [];
  const s = turn[p]++ % n;
  return all.slice(s).concat(all.slice(0, s)).filter(k => !resting(k, model));
}
function restFor(status, text, headers) {
  const t = String(text || '');
  if (status === 401 || status === 403 || (status === 400 && KEY_WORDS.test(t))) return 6 * 3600e3;   // refused key
  if (status === 429) {
    if (/per[- ]day|daily|quota|limit: ?0|RESOURCE_EXHAUSTED/i.test(t)) return 3600e3;   // out of quota for now
    const ra = +(headers.get('retry-after') || 0), m = /try again in\s*([\d.]+)\s*(ms|s|m)/i.exec(t);
    const s = ra || (m ? (+m[1]) * (m[2] === 'ms' ? 0.001 : m[2] === 'm' ? 60 : 1) : 20);
    return Math.min(600, Math.max(5, s)) * 1000;
  }
  if (status === 402) return 3600e3;                 // OpenRouter: this key has no credit left
  if (status >= 500 || status === 0) return 30e3;
  return 0;
}

/* ---------- Google's own model list (every Gemini / Gemma that can chat), asked once an hour ---------- */
let gemCache = { at: 0, ids: null };
const GEM_FIRST = () => env('GEMINI_MODEL') || 'gemini-3.6-flash';
async function geminiModels() {
  if (list('GEMINI_MODELS').length) return list('GEMINI_MODELS');
  /* Google AI Studio keys serve Gemini 3.6 Flash; other models answer «quota 0» — not offered unless asked for */
  if (env('GEMINI_ALL_MODELS') !== '1') return [GEM_FIRST()];
  if (gemCache.ids && Date.now() - gemCache.at < 3600e3) return gemCache.ids;
  const native = P.gemini.base().replace(/\/openai\/?$/, '');
  /* the resting keys are skipped; the chat's round-robin turn is left as it is */
  for (const key of P.gemini.keys().filter(k => !(rest.get(k) > Date.now()))) {
    try {
      const r = await fetch(native + '/models?pageSize=1000', { headers: { 'x-goog-api-key': key } });
      if (!r.ok) { const t = await r.text(); if (r.status === 401 || r.status === 403 || KEY_WORDS.test(t)) rest.set(key, Date.now() + restFor(r.status, t, r.headers)); continue; }
      const j = await r.json();
      const ids = (j.models || j.data || [])
        .filter(m => m && (!m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent')))
        .map(m => String(m.name || m.id || '').replace(/^models\//, ''))
        .filter(id => /^(gemini|gemma)/i.test(id) && !/embed|image|imagen|veo|tts|audio|live|aqa|robotics|computer-use|learnlm|native/i.test(id));
      /* newest flash first, then pro, then the light ones, then Gemma */
      const rank = id => /gemma/i.test(id) ? 4 : /lite/i.test(id) ? 3 : /pro/i.test(id) ? 2 : /flash/i.test(id) ? 1 : 3;
      const ver = id => +((/(\d+(?:\.\d+)?)/.exec(id) || [])[1] || 0);
      const sorted = Array.from(new Set(ids)).sort((a, b) => rank(a) - rank(b) || ver(b) - ver(a) || a.localeCompare(b));
      gemCache = { at: Date.now(), ids: [GEM_FIRST()].concat(sorted.filter(x => x !== GEM_FIRST())) };
      return gemCache.ids;
    } catch { /* next key */ }
  }
  return gemCache.ids || [GEM_FIRST()];
}

/* ---------- Groq's own model list, asked once an hour ---------- */
let groqCache = { at: 0, ids: null };
async function groqModels() {
  if (list('GROQ_MODELS').length) return list('GROQ_MODELS');
  if (groqCache.ids && Date.now() - groqCache.at < 3600e3) return groqCache.ids;
  for (const key of keysNow('groq')) {
    try {
      const r = await fetch(P.groq.base() + '/models', { headers: { authorization: 'Bearer ' + key } });
      if (!r.ok) { const t = await r.text(); rest.set(key, Date.now() + restFor(r.status, t, r.headers)); continue; }
      const ids = ((await r.json()).data || []).filter(m => m && m.active !== false).map(m => m.id)
        .filter(id => id && !/whisper|tts|playai|embed|guard|orpheus|speech|audio|transcribe|prompt-guard|compound/i.test(id)).sort();
      const first = ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b'];
      groqCache = { at: Date.now(), ids: first.filter(x => ids.includes(x)).concat(ids.filter(x => !first.includes(x))) };
      return groqCache.ids;
    } catch { /* next key */ }
  }
  return groqCache.ids || ['llama-3.3-70b-versatile'];
}

/* ---------- OpenRouter: its FREE models only (the owner's credit is never spent), asked once an hour ---------- */
let orCache = { at: 0, ids: null };
async function openrouterModels() {
  if (list('OPENROUTER_MODELS').length) return list('OPENROUTER_MODELS');
  if (orCache.ids && Date.now() - orCache.at < 3600e3) return orCache.ids;
  try {
    const r = await fetch(P.openrouter.base() + '/models');
    if (r.ok) {
      const free = ((await r.json()).data || []).filter(m => m && m.id && m.pricing && +m.pricing.prompt === 0 && +m.pricing.completion === 0
        && !/image|audio|vision-only|embed|tts|guard/i.test(m.id) && (!m.architecture || !m.architecture.output_modalities || m.architecture.output_modalities.includes('text')));
      const pref = [/deepseek/i, /llama-3\.3-70b/i, /qwen/i, /gemma/i, /mistral/i];
      const rank = id => { const i = pref.findIndex(re => re.test(id)); return i < 0 ? pref.length : i; };
      orCache = { at: Date.now(), ids: free.map(m => m.id).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).slice(0, 80) };
      return orCache.ids;
    }
  } catch { /* the cached list, or none */ }
  return orCache.ids || [];
}

/* ---------- who is asking: a Firebase sign-in token (Google / email) ---------- */
const JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwks = { at: 0, keys: [] };
const b64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - s.length % 4) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const txt = u8 => new TextDecoder().decode(u8);
async function publicKey(kid) {
  if (!jwks.keys.some(k => k.kid === kid) || Date.now() - jwks.at > 3600e3) {
    const r = await fetch(env('FIREBASE_JWKS_URL') || JWKS);
    jwks = { at: Date.now(), keys: (await r.json()).keys || [] };
  }
  const jwk = jwks.keys.find(k => k.kid === kid);
  return jwk ? crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']) : null;
}
async function who(req) {
  const tok = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const parts = tok.split('.');
  if (parts.length !== 3) return { error: 'signin' };
  let head, c;
  try { head = JSON.parse(txt(b64u(parts[0]))); c = JSON.parse(txt(b64u(parts[1]))); } catch { return { error: 'signin' }; }
  const pid = env('FIREBASE_PROJECT_ID') || 'jknbb-n', now = Date.now() / 1000;
  if (c.aud !== pid || c.iss !== 'https://securetoken.google.com/' + pid || !c.sub) return { error: 'signin' };
  if (!(c.exp > now) || c.iat > now + 300) return { error: 'expired' };
  /* the local emulator's tokens are unsigned — accepted ONLY in a local test run */
  const emulator = head.alg === 'none' && env('NEXUS_TEST_EMULATOR_TOKENS') === '1';
  if (!emulator) {
    if (head.alg !== 'RS256') return { error: 'signin' };
    const key = await publicKey(head.kid).catch(() => null);
    if (!key || !(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1])))) return { error: 'signin' };
  }
  if ((c.firebase && c.firebase.sign_in_provider) === 'anonymous' && env('AI_ALLOW_ANONYMOUS') !== '1') return { error: 'signin' };
  return { uid: c.sub, email: c.email || '', verified: !!c.email_verified, provider: (c.firebase && c.firebase.sign_in_provider) || '' };
}

/* ---------- the owner's key box: Firestore platformSecrets/ai, server-only ---------- */
const b64url = u => btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
/* the service account, however it was pasted: the JSON file as it is, wrapped in quotes, in base64,
   with the key's lines broken by a phone copy — or two variables FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY */
function saRead() {
  let raw = env('FIREBASE_SERVICE_ACCOUNT').trim();
  const email2 = env('FIREBASE_CLIENT_EMAIL').trim(), key2 = env('FIREBASE_PRIVATE_KEY');
  if (!raw && !(email2 && key2)) return { state: 'missing' };
  let j;
  if (raw) {
    if (/^['"`]/.test(raw) && /['"`]$/.test(raw)) raw = raw.slice(1, -1).trim();
    if (!raw.startsWith('{')) { try { const d = atob(raw.replace(/\s+/g, '')); if (d.trim().startsWith('{')) raw = d.trim(); } catch { } }
    try { j = JSON.parse(raw); }
    catch {
      const f = k => { const m = new RegExp('"' + k + '"\\s*:\\s*"([\\s\\S]*?)"\\s*[,}]').exec(raw); return m ? m[1] : ''; };
      j = { client_email: f('client_email'), private_key: f('private_key'), private_key_id: f('private_key_id'), project_id: f('project_id') };
    }
  } else j = { client_email: email2, private_key: key2 };
  const pk = String((j && j.private_key) || '').replace(/\\n/g, '\n');
  if (!j || (!j.client_email && !pk)) return { state: 'not-json', length: raw.length };
  if (!j.client_email || !/-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----/.test(pk)) return { state: 'incomplete', client_email: !!j.client_email, private_key: !!pk };
  return { state: 'ok', sa: Object.assign({}, j, { private_key: pk }) };
}
function sa() { const r = saRead(); return r.state === 'ok' ? r.sa : null; }
const fsProject = () => env('FIREBASE_PROJECT_ID') || (sa() || {}).project_id || 'jknbb-n';
let saKey = null, access = { v: '', exp: 0 };
async function adminToken() {
  if (env('FIRESTORE_EMULATOR_HOST')) return 'owner';
  if (access.exp > Date.now() + 60e3) return access.v;
  const s = sa(), now = Math.floor(Date.now() / 1000), te = x => new TextEncoder().encode(x);
  if (!saKey) saKey = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(s.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), c => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const head = b64url(te(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: s.private_key_id })));
  const body = b64url(te(JSON.stringify({ iss: s.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })));
  const sig = b64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', saKey, te(head + '.' + body))));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + head + '.' + body + '.' + sig });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) { saKey = null; throw new Error(String(j.error_description || j.error || ('HTTP ' + r.status))); }
  access = { v: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return access.v;
}
const boxURL = () => (env('FIRESTORE_EMULATOR_HOST') ? 'http://' + env('FIRESTORE_EMULATOR_HOST') : 'https://firestore.googleapis.com') + '/v1/projects/' + fsProject() + '/databases/(default)/documents/platformSecrets/ai';
/* The box lives in the site's own Netlify Blobs store — Netlify gives every function on a linked
   site that store, nothing to set up. Without it (another host): Firestore through the service account. */
function blobsCtx() {
  try {
    const raw = globalThis.netlifyBlobsContext || env('NETLIFY_BLOBS_CONTEXT');
    if (!raw) return null;
    const c = JSON.parse(atob(String(raw)));
    return c && c.siteID && c.token ? c : null;
  } catch { return null; }
}
const BLOB_PATH = c => '/' + c.siteID + '/site:nexus-ai-keys/box';
async function blobsReq(c, method, body, fresh) {
  let url, headers = { authorization: 'Bearer ' + c.token };
  if (c.edgeURL) url = new URL(BLOB_PATH(c), fresh && c.uncachedEdgeURL ? c.uncachedEdgeURL : c.edgeURL).toString();
  else {
    /* the API hands out a signed address for the blob */
    const r = await fetch(new URL('/api/v1/blobs' + BLOB_PATH(c), c.apiURL || 'https://api.netlify.com').toString(), { method, headers: Object.assign({ accept: 'application/json;type=signed-url' }, headers) });
    if (r.status !== 200) throw new Error('Netlify Blobs ' + r.status);
    url = (await r.json()).url; headers = {};
  }
  if (method === 'put') Object.assign(headers, { 'content-type': 'application/json', 'cache-control': 'max-age=0, stale-while-revalidate=60' });
  return fetch(url, { method: method.toUpperCase(), headers, body });
}
/* the box is kept as one JSON value — nothing in it is ever sent to a browser */
let box = { at: 0, keys: [], owner: null };
const boxFrom = d => ({ at: Date.now(), keys: Array.isArray(d && d.keys) ? d.keys : [], owner: (d && d.owner) || null });
async function loadBox(force) {
  const c = blobsCtx();
  if (!c && !sa() && !env('FIRESTORE_EMULATOR_HOST')) return box;
  if (!force && Date.now() - box.at < 60e3) return box;
  try {
    if (c) {
      const r = await blobsReq(c, 'get', undefined, force);
      if (r.status === 404) box = boxFrom(null);
      else if (r.ok) box = boxFrom(JSON.parse((await r.text()) || '{}'));
      return box;
    }
    const r = await fetch(boxURL(), { headers: { authorization: 'Bearer ' + await adminToken() } });
    if (r.status === 404) box = boxFrom(null);
    else if (r.ok) { const f = ((await r.json()).fields || {}).data; box = boxFrom(f ? JSON.parse(f.stringValue || '{}') : {}); }
  } catch { /* the last box read stays in use */ }
  return box;
}
async function saveBox(next) {
  const data = JSON.stringify({ keys: next.keys, owner: next.owner });
  const c = blobsCtx();
  if (c) {
    const r = await blobsReq(c, 'put', data);
    if (!r.ok) throw new Error('Netlify Blobs ' + r.status);
  } else {
    const r = await fetch(boxURL(), { method: 'PATCH', headers: { authorization: 'Bearer ' + await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ fields: { data: { stringValue: data } } }) });
    if (!r.ok) throw new Error('firestore ' + r.status);
  }
  box = Object.assign({ at: Date.now() }, next);
}
const boxReady = () => !!(blobsCtx() || sa() || env('FIRESTORE_EMULATOR_HOST'));
/* why the box is (not) ready — said plainly, never showing the secret itself */
async function boxCheck() {
  const c = blobsCtx();
  if (c) {
    try { const r = await blobsReq(c, 'get', undefined, true); return r.ok || r.status === 404 ? { state: 'ok', store: 'netlify' } : { state: 'blobs', error: 'Netlify Blobs ' + r.status }; }
    catch (e) { return { state: 'blobs', error: String(e.message || e).slice(0, 200) }; }
  }
  if (env('FIRESTORE_EMULATOR_HOST')) return { state: 'ok', store: 'firestore' };
  const i = saRead();
  if (i.state !== 'ok') { delete i.sa; return i; }
  try { await adminToken(); } catch (e) { return { state: 'refused', error: String(e.message || e).slice(0, 200) }; }
  try {
    const r = await fetch(boxURL(), { headers: { authorization: 'Bearer ' + await adminToken() } });
    if (r.ok || r.status === 404) return { state: 'ok', store: 'firestore', project: fsProject() };
    const t = await r.text().catch(() => '');
    return { state: 'firestore', status: r.status, project: fsProject(), error: ((/"message"\s*:\s*"([^"]{0,220})/.exec(t) || [])[1]) || ('HTTP ' + r.status) };
  } catch (e) { return { state: 'firestore', project: fsProject(), error: String(e.message || e).slice(0, 200) }; }
}
const providerOf = k => /^gsk_/.test(k) ? 'groq' : /^sk-or-/.test(k) ? 'openrouter' : /^(AIza|AQ\.)/.test(k) ? 'gemini' : null;
const LABEL = { gemini: 'Gemini', groq: 'Groq', openrouter: 'OpenRouter' };
const shown = k => ({ id: k.id, provider: k.provider, label: LABEL[k.provider], tail: '••••' + String(k.key).slice(-4), addedAt: k.addedAt });
/* the owner: ADMIN_EMAILS, or whoever claimed the box first (a verified Google e-mail) */
function isOwner(me) {
  const admins = list('ADMIN_EMAILS').map(x => x.toLowerCase());
  if (admins.length) return !!(me.email && me.verified && admins.includes(me.email.toLowerCase()));
  return !!(box.owner && box.owner.uid === me.uid);
}
const canClaim = me => !list('ADMIN_EMAILS').length && !box.owner && !!(me.email && me.verified && me.provider === 'google.com');
/* one tiny real request: is this key accepted? */
async function tryKey(p, key) {
  const model = p === 'gemini' ? GEM_FIRST() : p === 'groq' ? 'llama-3.3-70b-versatile' : 'deepseek/deepseek-chat-v3:free';
  try {
    const headers = { 'content-type': 'application/json', authorization: 'Bearer ' + key };
    const r = await fetch(P[p].base() + '/chat/completions', { method: 'POST', headers, body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply with one word: OK' }], max_tokens: 64 }) });
    if (r.ok) return 'ok';
    const t = await r.text().catch(() => '');
    if (r.status === 401 || r.status === 403 || KEY_WORDS.test(t)) return 'refused';
    if (r.status === 429 || r.status === 402) return 'limit';
    return 'unknown';
  } catch { return 'unknown'; }
}
async function keyBox(path, me, req) {
  let body = {};
  try { body = await req.json(); } catch { }
  await loadBox(true);
  const owner = isOwner(me), mask = e => String(e || '').replace(/^(.).*(@.*)$/, '$1•••$2');
  if (path === '/keys/status') { const setup = await boxCheck(); return json(200, { ready: setup.state === 'ok', setup, owner, canClaim: canClaim(me), ownerEmail: box.owner ? mask(box.owner.email) : null,
    fromVariables: Object.fromEntries(ORDER.map(p => [p, list(VAR[p]).length])), keys: owner ? box.keys.map(shown) : [] }); }
  if (!boxReady()) return fail(503, 'box_off', 'صندوق المفاتيح لا يجد مكانًا يحفظ فيه: اربط الموقع بـ GitHub في Netlify (يعمل وحده)، أو ضع FIREBASE_SERVICE_ACCOUNT.');
  if (!owner && !canClaim(me)) return fail(403, 'not_owner', 'هذه الصفحة لصاحب الموقع فقط.');
  if (path === '/keys/add') {
    const keys = String(body.keys || body.key || '').split(/[\s,;]+/).map(x => x.trim()).filter(Boolean).slice(0, 30);
    if (!keys.length) return fail(400, 'empty', 'الصق مفتاحًا واحدًا على الأقل');
    const next = { keys: box.keys.slice(), owner: box.owner || (owner ? null : { uid: me.uid, email: me.email }) };
    const results = [];
    for (const k of keys) {
      const p = providerOf(k);
      if (!p) { results.push({ tail: '••••' + k.slice(-4), status: 'unknown_provider' }); continue; }
      if (next.keys.some(x => x.key === k) || list(VAR[p]).includes(k)) { results.push({ label: LABEL[p], tail: '••••' + k.slice(-4), status: 'duplicate' }); continue; }
      const st = await tryKey(p, k);
      if (st === 'refused') { results.push({ label: LABEL[p], tail: '••••' + k.slice(-4), status: 'refused' }); continue; }
      const rec = { id: crypto.randomUUID().slice(0, 12), provider: p, key: k, addedAt: Date.now(), by: me.uid };
      next.keys.push(rec);
      results.push(Object.assign(shown(rec), { status: st }));
    }
    if (next.keys.length !== box.keys.length || (!box.owner && next.owner)) await saveBox(next);
    return json(200, { results, keys: box.keys.map(shown), owner: true });
  }
  if (path === '/keys/remove') {
    if (!owner) return fail(403, 'not_owner', 'هذه الصفحة لصاحب الموقع فقط.');
    const next = { keys: box.keys.filter(k => k.id !== body.id), owner: box.owner };
    if (next.keys.length !== box.keys.length) await saveBox(next);
    return json(200, { keys: box.keys.map(shown), owner: true });
  }
  return fail(404, 'not_found', 'غير موجود');
}

/* ---------- a fair share per player (per server instance) ---------- */
const recent = new Map();
function allowed(uid) {
  const per = +(env('AI_PER_MINUTE') || 20), now = Date.now();
  const r = (recent.get(uid) || []).filter(t => now - t < 60e3);
  if (r.length >= per) { recent.set(uid, r); return Math.ceil((60e3 - (now - r[0])) / 1000); }
  r.push(now); recent.set(uid, r);
  if (recent.size > 5000) recent.clear();
  return 0;
}

async function chat(req, body) {
  const msgs = Array.isArray(body.messages) ? body.messages : null;
  if (!msgs || !msgs.length || msgs.length > 60) return fail(400, 'bad_request', 'طلب غير صالح');
  const size = msgs.reduce((n, m) => n + String(m && m.content || '').length, 0);
  if (size > 160000) return fail(413, 'too_large', 'الطلب كبير جدًا — ابدأ محادثة جديدة');
  const clean = { messages: msgs.map(m => ({ role: ['system', 'user', 'assistant'].includes(m.role) ? m.role : 'user', content: String(m.content || '') })),
    stream: !!body.stream, max_tokens: Math.min(+(env('AI_MAX_TOKENS') || 4096), Math.max(64, +body.max_tokens || +body.max_completion_tokens || 2048)) };
  if (Number.isFinite(+body.temperature)) clean.temperature = Math.min(1.5, Math.max(0, +body.temperature));

  /* the chosen model's provider first, then the others */
  const asked = String(body.model || 'auto');
  const first = (asked !== 'auto' && await owner(asked)) || ORDER[0];
  const order = [first].concat(ORDER.filter(p => p !== first)).filter(p => P[p].keys().length);
  if (!order.length) return fail(503, 'free_ai_unavailable', 'الذكاء المجاني غير مُعدّ على هذا الموقع بعد.');
  const notes = [];
  for (const p of order) {
    const models = await P[p].models();
    const model = asked !== 'auto' && first === p && models.includes(asked) ? asked : models[0];
    if (!model) { notes.push(P[p].label + ' بلا نماذج متاحة'); continue; }
    const keys = keysNow(p, model);
    /* every key resting (refused, out of quota or rate-limited) */
    if (!keys.length) { notes.push(P[p].label + ' غير متاح الآن'); continue; }
    let why = 'غير متاح الآن';
    for (const key of keys) {
      let r;
      try {
        const headers = { 'content-type': 'application/json', authorization: 'Bearer ' + key };
        if (p === 'openrouter') { headers['HTTP-Referer'] = new URL(req.url).origin; headers['X-Title'] = 'NEXUS'; }
        r = await fetch(P[p].base() + '/chat/completions', { method: 'POST', headers, body: JSON.stringify(Object.assign({ model }, clean)) });
      } catch { rest.set(key, Date.now() + 30e3); continue; }
      if (r.ok) {
        const h = { 'content-type': r.headers.get('content-type') || (clean.stream ? 'text/event-stream' : 'application/json'),
          'cache-control': 'no-store', 'x-nexus-served': p + ':' + model };
        if (notes.length) h['x-nexus-note'] = encodeURIComponent(notes.join(' · ') + ' — أجاب ' + P[p].label + ' (' + model + ')');
        return new Response(r.body, { status: 200, headers: h });
      }
      const t = await r.text().catch(() => '');
      const keyIssue = r.status === 401 || r.status === 403 || KEY_WORDS.test(t);
      /* the model is gone: the other provider */
      if (!keyIssue && (r.status === 404 || r.status === 400) && /model/i.test(t)) { why = '(النموذج غير متاح)'; break; }
      /* the request itself (too large, malformed): no other key helps — the page adapts it */
      if (!keyIssue && (r.status === 413 || r.status === 400 || r.status === 422))
        return new Response(t, { status: r.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
      /* the service is overloaded: the other provider, the keys are fine */
      if (r.status >= 500) { why = 'مشغول الآن'; break; }
      /* this key: out of quota, rate-limited or refused — it rests, the next key is tried */
      rest.set(keyIssue || r.status === 402 ? key : key + '|' + model, Date.now() + (restFor(r.status, t, r.headers) || 15e3));
    }
    notes.push(P[p].label + ' ' + why);
  }
  return fail(503, 'free_ai_unavailable', 'الذكاء المجاني غير متاح الآن — كل المفاتيح وصلت حدّها أو لا تعمل (' + notes.join('، ') + '). جرّب بعد قليل، أو أضف مفتاحك الخاص من ⚙. Please try again in 60s.');
}

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/api\/ai/, '') || '/';
  /* this site's pages only */
  const origin = req.headers.get('origin');
  if (origin && origin !== url.origin) return fail(403, 'origin', 'غير مسموح');
  await loadBox();
  if (req.method === 'GET' && path === '/health') {
    const providers = Object.keys(P).filter(p => P[p].keys().length);
    return json(200, { free: providers.length > 0, providers, signin: 'google', keyBox: boxReady() });
  }
  const me = await who(req);
  if (me.error) return fail(401, 'signin', 'سجّل الدخول بحساب Google لاستعمال الذكاء المجاني');
  if (req.method === 'POST' && path.startsWith('/keys/')) return keyBox(path, me, req);
  if (req.method === 'GET' && path === '/models') {
    /* every model of every provider that has keys here, grouped by provider (the page shows the groups) */
    const data = [{ id: 'auto', owned_by: 'nexus', provider: 'NEXUS' }];
    const lists = await Promise.all(ORDER.map(p => P[p].keys().length ? P[p].models().catch(() => []) : []));
    ORDER.forEach((p, i) => lists[i].forEach(id => { if (!data.some(d => d.id === id)) data.push({ id, owned_by: p, provider: P[p].label }); }));
    return json(200, { object: 'list', data });
  }
  if (req.method === 'POST' && path === '/chat/completions') {
    const wait = allowed(me.uid);
    if (wait) return fail(429, 'rate_limit', 'طلبات كثيرة — انتظر قليلًا. Please try again in ' + wait + 's.');
    let body;
    try { body = await req.json(); } catch { return fail(400, 'bad_request', 'طلب غير صالح'); }
    return chat(req, body);
  }
  return fail(404, 'not_found', 'غير موجود');
};

export const config = { path: '/api/ai/*' };
