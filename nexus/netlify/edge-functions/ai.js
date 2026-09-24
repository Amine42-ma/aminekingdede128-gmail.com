/* ============================================================
   NEXUS — free built-in AI for every signed-in player.
   The keys live HERE, on the server, never in index.html or Git:
   Netlify → Site configuration → Environment variables:
     GEMINI_KEYS     = key1,key2,…     (Google AI Studio)
     GROQ_KEYS       = gsk_…,gsk_…     (Groq)
     OPENROUTER_KEYS = sk-or-…,sk-or-… (OpenRouter — its free models only)
   optional: GEMINI_MODELS (gemini-3.6-flash) · GROQ_MODELS (the
   account's real list) · FIREBASE_PROJECT_ID (jknbb-n) ·
   AI_MAX_TOKENS (4096) · AI_PER_MINUTE (20)
   The page calls /api/ai/… with the player's Firebase sign-in token.
   This function checks the token, picks a key, and when a key is out
   of quota or refused it moves to the next key, then to the other
   provider — and says which model answered. No key ever leaves here.
   ============================================================ */
const env = k => { try { return (globalThis.Netlify && Netlify.env.get(k)) || ''; } catch { return ''; } };
const list = k => env(k).split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);

const P = {
  gemini: { label: 'Gemini', base: () => env('GEMINI_BASE') || 'https://generativelanguage.googleapis.com/v1beta/openai',
    keys: () => list('GEMINI_KEYS'), models: async () => list('GEMINI_MODELS').length ? list('GEMINI_MODELS') : ['gemini-3.6-flash'] },
  groq: { label: 'Groq', base: () => env('GROQ_BASE') || 'https://api.groq.com/openai/v1',
    keys: () => list('GROQ_KEYS'), models: () => groqModels() },
  openrouter: { label: 'OpenRouter', base: () => env('OPENROUTER_BASE') || 'https://openrouter.ai/api/v1',
    keys: () => list('OPENROUTER_KEYS'), models: () => openrouterModels() }
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
const turn = { gemini: 0, groq: 0 };        // round-robin start, spreads the load over the keys
function keysNow(p) {
  const all = P[p].keys(), n = all.length;
  if (!n) return [];
  const s = turn[p]++ % n;
  return all.slice(s).concat(all.slice(0, s)).filter(k => !(rest.get(k) > Date.now()));
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
      orCache = { at: Date.now(), ids: free.map(m => m.id).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).slice(0, 30) };
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
  return { uid: c.sub };
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
    const keys = keysNow(p);
    if (!keys.length) { notes.push(P[p].label + ' مشغول الآن'); continue; }
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
      rest.set(key, Date.now() + (restFor(r.status, t, r.headers) || 15e3));
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
  if (req.method === 'GET' && path === '/health') {
    const providers = Object.keys(P).filter(p => P[p].keys().length);
    return json(200, { free: providers.length > 0, providers, signin: 'google' });
  }
  const me = await who(req);
  if (me.error) return fail(401, 'signin', 'سجّل الدخول بحساب Google لاستعمال الذكاء المجاني');
  if (req.method === 'GET' && path === '/models') {
    const data = [{ id: 'auto', owned_by: 'nexus' }];
    for (const p of Object.keys(P)) if (P[p].keys().length) (await P[p].models()).forEach(id => data.push({ id, owned_by: p }));
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
