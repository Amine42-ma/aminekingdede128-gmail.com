/* ============================================================
   NEXUS — free built-in AI for every signed-in player.
   The keys live HERE, on the server, never in index.html or Git:
   Netlify → Site configuration → Environment variables:
     GEMINI_KEYS     = key1,key2,…     (Google AI Studio)
     GROQ_KEYS       = gsk_…,gsk_…     (Groq)
     OPENROUTER_KEYS = sk-or-…,sk-or-… (OpenRouter — its free models only)
     ANTHROPIC_KEYS  = sk-ant-…        (Claude — paid: every request is billed to the key)
   The player picks a model (or «auto»): Gemini 3.6 Flash (the model
   these Google AI Studio keys serve), every model of Groq's own list,
   OpenRouter's free ones, Claude's own list (GET /v1/models).
   «auto» never spends a Claude key unless ANTHROPIC_AUTO=1: Claude
   answers when a player (or a council member) picks a Claude model.
   optional: GEMINI_MODELS (default gemini-3.6-flash; GEMINI_ALL_MODELS=1
   offers every chat model Google lists for the keys) · GROQ_MODELS /
   OPENROUTER_MODELS / ANTHROPIC_MODELS (a fixed list instead of the
   provider's own) · GEMINI_BASE / GROQ_BASE / OPENROUTER_BASE /
   ANTHROPIC_BASE (another address for the same API) ·
   FIREBASE_PROJECT_ID (jknbb-n) ·
   AI_MAX_TOKENS (4096) · AI_PER_MINUTE (20)
   THE MULTI-AI COUNCIL (NEXUS Pro) — POST /api/ai/council: up to 4 models
   work on one request (each from its role), then one of them reviews the
   results and writes ONE final answer. Several models collaborating — not a
   new, stronger model. Pro is read HERE from wallets/<uid>.proUntil (written
   only by the server, firestore.rules): a free account always gets one
   model, whatever its page sends. Every model call counts as one AI request
   of the day (AI_FREE_PER_DAY / PRO_AI_PER_DAY); calls not made are given
   back. One council at a time per account. Limits (set here, never by a page):
     COUNCIL_ENABLED=0                off switch
     COUNCIL_MAX_MODELS (4)           maxModelsPerRequest — Pro; free = 1
     COUNCIL_MAX_PARALLEL (4)         maxParallelRequests to providers
     COUNCIL_MAX_SYNTHESIS_TOKENS (4096)  the final answer (and the lead draft)
     COUNCIL_MAX_MEMBER_TOKENS (1536) every other member's contribution
     COUNCIL_MAX_REQUEST_MS (120000)  maxRequestTime — the whole council
     COUNCIL_MEMBER_TIMEOUT_MS (60000)  one provider call
     COUNCIL_MAX_RETRIES (2)          maxRetries — more keys / providers per member
     COUNCIL_USE_DONATED=0            council members use the site's keys only
     COUNCIL_SMART_THRESHOLDS ("2,4,6")  Smart Council: the points needed for 2 · 3 · 4 models
     COUNCIL_SMART_WEIGHTS ("wholeGame=4,assets=1,…")  the points of each factor Smart reads
   THE OWNER'S KEY BOX: instead of (or besides) the variables above, the
   site owner can type keys inside NEXUS (⚙ ← «مفاتيح الذكاء المجاني»).
   They are sent here once, tested, and kept in the site's own Netlify Blobs
   store (every function on a linked Netlify site has it — nothing to set
   up). Elsewhere: Firestore platformSecrets/ai — a document no browser may
   read or write (firestore.rules) — via FIREBASE_SERVICE_ACCOUNT.
   Nobody ever gets a key back, the owner included: only «Groq ••••a1b2».
   Who the owner is: ADMIN_EMAILS (comma list) if set; otherwise the first
   verified Google account that saves a key claims the box.
   THE KEY POOL (players' donated keys): Firestore api_keys — the rules let
   a signed-in player add a key and delete their own, and let NO browser read
   one. With FIREBASE_SERVICE_ACCOUNT this function reads the active ones
   (after the site's own keys), marks a key the provider refuses as
   status «disabled», and tells the donor only «Groq ••••a1b2 — active».
   The same pool is served by the Cloud Function processRequest
   (functions/index.js) when the Firebase project is on the Blaze plan.
   The page calls /api/ai/… with the player's Firebase sign-in token.
   This function checks the token, picks a key, and when a key is out
   of quota or refused it moves to the next key, then to the other
   provider — and says which model answered. No key ever leaves here.
   ============================================================ */
const env = k => { try { return (globalThis.Netlify && Netlify.env.get(k)) || ''; } catch { return ''; } };
const list = k => env(k).split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
const VAR = { gemini: 'GEMINI_KEYS', groq: 'GROQ_KEYS', openrouter: 'OPENROUTER_KEYS', anthropic: 'ANTHROPIC_KEYS' };
/* a provider's keys: the site's variables, the owner's key box, then the keys players donated (api_keys) */
const keysOf = p => Array.from(new Set(list(VAR[p]).concat(box.keys.filter(k => k.provider === p).map(k => k.key), pool.keys.filter(k => k.provider === p).map(k => k.key))));
const donated = k => pool.keys.some(x => x.key === k);

const P = {
  gemini: { label: 'Gemini', base: () => env('GEMINI_BASE') || 'https://generativelanguage.googleapis.com/v1beta/openai',
    keys: () => keysOf('gemini'), models: () => geminiModels() },
  groq: { label: 'Groq', base: () => env('GROQ_BASE') || 'https://api.groq.com/openai/v1',
    keys: () => keysOf('groq'), models: () => groqModels() },
  openrouter: { label: 'OpenRouter', base: () => env('OPENROUTER_BASE') || 'https://openrouter.ai/api/v1',
    keys: () => keysOf('openrouter'), models: () => openrouterModels() },
  /* Claude speaks the Messages API — translated here to the OpenAI shape the page reads */
  anthropic: { label: 'Claude', shape: 'anthropic', base: () => env('ANTHROPIC_BASE') || 'https://api.anthropic.com',
    keys: () => keysOf('anthropic'), models: () => anthropicModels() }
};
const ORDER = ['gemini', 'groq', 'openrouter', 'anthropic'];
/* the providers «auto» may use: a Claude key is paid per request, so it answers only when chosen (or ANTHROPIC_AUTO=1) */
const AUTO = () => ORDER.filter(p => p !== 'anthropic' || env('ANTHROPIC_AUTO') === '1');
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
const turn = { gemini: 0, groq: 0, openrouter: 0, anthropic: 0 };   // round-robin start, spreads the load over the keys
/* a key that is refused rests as a whole; a key out of quota / rate-limited
   rests only for THAT model (its other models keep working) */
const resting = (k, model) => rest.get(k) > Date.now() || (model && rest.get(k + '|' + model) > Date.now());
function keysNow(p, model, { donatedToo = true } = {}) {
  const all = P[p].keys().filter(k => donatedToo || !donated(k)), n = all.length;
  if (!n) return [];
  const s = turn[p]++ % n;
  return all.slice(s).concat(all.slice(0, s)).filter(k => !resting(k, model));
}
/* a key with no credit left (Claude: «Your credit balance is too low…», a 400) — like OpenRouter's 402 */
const NO_CREDIT = /credit balance|insufficient[_ ]?(credit|funds|balance)|billing/i;
function restFor(status, text, headers) {
  const t = String(text || '');
  if (status === 401 || status === 403 || (status === 400 && KEY_WORDS.test(t))) return 6 * 3600e3;   // refused key
  if (status === 400 && NO_CREDIT.test(t)) return 3600e3;
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

/* ---------- Claude: Anthropic's own model list (GET /v1/models), asked once an hour ---------- */
const antHeaders = key => ({ 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': env('ANTHROPIC_VERSION') || '2023-06-01' });
let antCache = { at: 0, ids: null };
async function anthropicModels() {
  if (list('ANTHROPIC_MODELS').length) return list('ANTHROPIC_MODELS');
  if (antCache.ids && Date.now() - antCache.at < 3600e3) return antCache.ids;
  for (const key of P.anthropic.keys().filter(k => !(rest.get(k) > Date.now()))) {
    try {
      const r = await fetch(P.anthropic.base() + '/v1/models?limit=1000', { headers: antHeaders(key) });
      if (!r.ok) { const t = await r.text(); if (r.status === 401 || r.status === 403) rest.set(key, Date.now() + restFor(r.status, t, r.headers)); continue; }
      const ids = ((await r.json()).data || []).map(m => m && m.id).filter(Boolean);
      /* the list comes newest first: Sonnet, then Opus, then Haiku — each family keeps that order */
      const fam = id => /sonnet/i.test(id) ? 0 : /opus/i.test(id) ? 1 : /haiku/i.test(id) ? 2 : 3;
      antCache = { at: Date.now(), ids: ids.map((id, i) => [id, i]).sort((a, b) => fam(a[0]) - fam(b[0]) || a[1] - b[1]).map(x => x[0]) };
      return antCache.ids;
    } catch { /* next key */ }
  }
  return antCache.ids || [];
}

/* ---------- one request to a provider, answered in the OpenAI shape the page reads ----------
   Claude's Messages API is translated both ways here: the system text goes to «system», the turns
   alternate user / assistant, and its answer (or its event stream) comes back as chat.completions. */
const STOP = { end_turn: 'stop', stop_sequence: 'stop', max_tokens: 'length', pause_turn: 'stop', tool_use: 'tool_calls', refusal: 'refusal' };
function toAnthropic(model, c) {
  const system = c.messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const turns = [];
  c.messages.filter(m => m.role !== 'system' && String(m.content || '').trim()).forEach(m => {
    const role = m.role === 'assistant' ? 'assistant' : 'user', last = turns[turns.length - 1];
    if (last && last.role === role) last.content += '\n\n' + m.content; else turns.push({ role, content: String(m.content) });
  });
  if (!turns.length || turns[0].role !== 'user') turns.unshift({ role: 'user', content: '…' });
  /* no sampling parameters: current Claude models refuse some of them (the page's own adapter does the same) */
  const b = { model, max_tokens: c.max_tokens || 1024, messages: turns, stream: !!c.stream };
  if (system) b.system = system;
  return b;
}
const fromAnthropic = (j, model) => ({ id: j.id, object: 'chat.completion', model: j.model || model,
  choices: [{ index: 0, message: { role: 'assistant', content: (j.content || []).filter(b => b && b.type === 'text').map(b => b.text || '').join('') }, finish_reason: STOP[j.stop_reason] || j.stop_reason || 'stop' }],
  usage: j.usage ? { prompt_tokens: j.usage.input_tokens || 0, completion_tokens: j.usage.output_tokens || 0 } : undefined });
function anthropicSSE(model) {
  const dec = new TextDecoder(), enc = new TextEncoder();
  let buf = '', inTok = 0;
  const out = (c, o) => c.enqueue(enc.encode('data: ' + JSON.stringify(o) + '\n\n'));
  const chunk = (delta, finish, usage) => Object.assign({ object: 'chat.completion.chunk', model, choices: [{ index: 0, delta, finish_reason: finish || null }] }, usage ? { usage } : {});
  return new TransformStream({
    transform(bytes, c) {
      buf += dec.decode(bytes, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        let j; try { j = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (j.type === 'message_start') inTok = (j.message && j.message.usage && j.message.usage.input_tokens) || 0;
        else if (j.type === 'content_block_delta' && j.delta && j.delta.type === 'text_delta') out(c, chunk({ content: j.delta.text || '' }));
        else if (j.type === 'message_delta') out(c, chunk({}, STOP[j.delta && j.delta.stop_reason] || 'stop', { prompt_tokens: inTok, completion_tokens: (j.usage && j.usage.output_tokens) || 0 }));
        else if (j.type === 'message_stop') c.enqueue(enc.encode('data: [DONE]\n\n'));
        else if (j.type === 'error') out(c, { error: j.error || { message: 'provider error' } });
      }
    }
  });
}
async function send(p, key, model, clean, req, signal) {
  if (P[p].shape !== 'anthropic') {
    const headers = { 'content-type': 'application/json', authorization: 'Bearer ' + key };
    if (p === 'openrouter') { headers['HTTP-Referer'] = new URL(req.url).origin; headers['X-Title'] = 'NEXUS'; }
    return fetch(P[p].base() + '/chat/completions', { method: 'POST', headers, body: JSON.stringify(Object.assign({ model }, clean)), signal });
  }
  const r = await fetch(P[p].base() + '/v1/messages', { method: 'POST', headers: antHeaders(key), body: JSON.stringify(toAnthropic(model, clean)), signal });
  if (!r.ok) return r;
  if (clean.stream) return new Response(r.body.pipeThrough(anthropicSSE(model)), { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } });
  return new Response(JSON.stringify(fromAnthropic(await r.json(), model)), { status: 200, headers: { 'content-type': 'application/json' } });
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

/* ---------- the donated key pool: Firestore «api_keys» — players write a key once, no browser can
   read it (firestore.rules); read here with the service account (the rules do not bind it) ---------- */
let pool = { at: 0, keys: [], readable: false };
const fsDocs = () => (env('FIRESTORE_EMULATOR_HOST') ? 'http://' + env('FIRESTORE_EMULATOR_HOST') : 'https://firestore.googleapis.com') + '/v1/projects/' + fsProject() + '/databases/(default)/documents';
const poolReady = () => !!(sa() || env('FIRESTORE_EMULATOR_HOST'));
async function poolQuery(field, value) {
  const r = await fetch(fsDocs() + ':runQuery', { method: 'POST', headers: { authorization: 'Bearer ' + await adminToken(), 'content-type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'api_keys' }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } }, limit: 500 } }) });
  if (!r.ok) throw new Error('firestore ' + r.status);
  return (await r.json()).filter(x => x.document).map(x => {
    const f = x.document.fields || {};
    return { id: x.document.name.split('/').pop(), key: (f.key || {}).stringValue || '', status: (f.status || {}).stringValue || '', reason: (f.disabledReason || {}).stringValue || null };
  });
}
async function loadPool(force) {
  if (!poolReady()) return pool;
  if (!force && Date.now() - pool.at < 60e3) return pool;
  try {
    const rows = await poolQuery('status', 'active');
    pool = { at: Date.now(), readable: true, keys: rows.map(k => Object.assign(k, { provider: providerOf(k.key) })).filter(k => k.provider) };
  } catch { pool = Object.assign({}, pool, { at: Date.now(), readable: false }); }
  return pool;
}
/* a donated key the provider refused: disabled for good (the donor sees it on their page) */
async function poolDisable(key, reason) {
  const k = pool.keys.find(x => x.key === key);
  if (!k) return;
  pool.keys = pool.keys.filter(x => x !== k);
  try {
    await fetch(fsDocs() + '/api_keys/' + encodeURIComponent(k.id) + '?updateMask.fieldPaths=status&updateMask.fieldPaths=disabledReason&updateMask.fieldPaths=disabledAt', {
      method: 'PATCH', headers: { authorization: 'Bearer ' + await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ fields: { status: { stringValue: 'disabled' }, disabledReason: { stringValue: reason }, disabledAt: { timestampValue: new Date().toISOString() } } }) });
  } catch { /* it rests here anyway */ }
}
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
const providerOf = k => /^gsk_/.test(k) ? 'groq' : /^sk-or-/.test(k) ? 'openrouter' : /^sk-ant-/.test(k) ? 'anthropic' : /^(AIza|AQ\.)/.test(k) ? 'gemini' : null;
const LABEL = { gemini: 'Gemini', groq: 'Groq', openrouter: 'OpenRouter', anthropic: 'Claude' };
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
  /* Claude: its model list says whether the key is accepted, without spending anything */
  if (p === 'anthropic') {
    try {
      const r = await fetch(P.anthropic.base() + '/v1/models?limit=1', { headers: antHeaders(key) });
      if (r.ok) return 'ok';
      return r.status === 401 || r.status === 403 ? 'refused' : r.status === 429 ? 'limit' : 'unknown';
    } catch { return 'unknown'; }
  }
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
function allowed(uid, n = 1) {
  const per = +(env('AI_PER_MINUTE') || 20), now = Date.now();
  const r = (recent.get(uid) || []).filter(t => now - t < 60e3);
  n = Math.max(1, Math.min(n, per));                    // a council counts each of its model calls
  if (r.length + n > per) { recent.set(uid, r); return Math.max(1, Math.ceil((60e3 - (now - r[0])) / 1000)); }
  for (let i = 0; i < n; i++) r.push(now);
  recent.set(uid, r);
  if (recent.size > 5000) recent.clear();
  return 0;
}

/* ---------- the day's requests per player (PART 34): AI_FREE_PER_DAY free (20), more bought
   with points (points.js adds to «extra»), Pro PRO_AI_PER_DAY (150). Counted in Firestore usage/<uid>
   with the service account — no browser can write it. No service account: no daily counter. ---------- */
const numEnv = (k, d) => { const v = env(k); return v !== '' && Number.isFinite(+v) ? +v : d; };
const dayNow = () => new Date().toISOString().slice(0, 10);
async function fsGetDoc(path) {
  const r = await fetch(fsDocs() + '/' + path, { headers: { authorization: 'Bearer ' + await adminToken() } });
  if (r.status === 404) return { exists: false, data: {} };
  if (!r.ok) throw new Error('firestore ' + r.status);
  /* proUntil is milliseconds (points.js); a date typed by the owner in the Firebase console counts too */
  const d = await r.json(), f = d.fields || {}, n = k => !f[k] ? 0 : f[k].timestampValue ? Date.parse(f[k].timestampValue) || 0 : +(f[k].integerValue || f[k].doubleValue || 0);
  return { exists: true, updateTime: d.updateTime, data: { day: (f.day || {}).stringValue || '', used: n('used'), extra: n('extra'), proUntil: n('proUntil'), councilUntil: n('councilUntil') } };
}
/* reserves `want` requests of the day — a number, or pro => number (a council asks for more when the
   account is Pro). `lock` (ms): one council at a time per account; the usage document says until when. */
async function aiQuota(uid, want = 1, lock = 0) {
  const ask = pro => Math.max(0, typeof want === 'function' ? want(pro) : want);
  if (!poolReady()) return { ok: true, took: ask(false), verified: false };
  const day = dayNow(), name = 'projects/' + fsProject() + '/databases/(default)/documents/usage/' + uid;
  try {
    for (let i = 0; i < 4; i++) {
      const [u, w] = await Promise.all([fsGetDoc('usage/' + uid), fsGetDoc('wallets/' + uid)]);
      const pro = w.data.proUntil > Date.now();
      const cur = u.data.day === day ? u.data : { day, used: 0, extra: 0 };
      const limit = pro ? numEnv('PRO_AI_PER_DAY', 150) : numEnv('AI_FREE_PER_DAY', 20) + (cur.extra || 0);
      if (lock && u.data.councilUntil > Date.now()) return { ok: false, busy: true, pro, limit, verified: true };
      const wanted = ask(pro), took = Math.max(0, Math.min(wanted, limit - cur.used));
      if (wanted > 0 && !took) return { ok: false, pro, limit, verified: true };
      const fields = { day: { stringValue: day }, used: { integerValue: String(cur.used + took) }, extra: { integerValue: String(cur.extra || 0) },
        councilUntil: { integerValue: String(lock ? Date.now() + lock : (u.data.councilUntil || 0)) } };
      const r = await fetch(fsDocs() + ':commit', { method: 'POST', headers: { authorization: 'Bearer ' + await adminToken(), 'content-type': 'application/json' },
        body: JSON.stringify({ writes: [{ update: { name, fields }, currentDocument: u.exists ? { updateTime: u.updateTime } : { exists: false } }] }) });
      if (r.ok) return { ok: true, pro, limit, took, left: limit - cur.used - took, verified: true, locked: !!lock };
    }
  } catch (e) { console.warn('[ai] usage', e && e.message); }
  /* the counter is busy or unreachable: the player is not blocked for it (nor taken for Pro) */
  return { ok: true, took: ask(false), verified: false };
}
/* a request no provider could answer does not count; `unlock` ends this account's council */
async function aiRefund(uid, n = 1, unlock = false) {
  if (!poolReady() || (!n && !unlock)) return;
  try {
    const name = 'projects/' + fsProject() + '/databases/(default)/documents/usage/' + uid;
    const back = n ? [{ fieldPath: 'used', increment: { integerValue: String(-n) } }] : [];
    const write = unlock
      ? Object.assign({ update: { name, fields: { councilUntil: { integerValue: '0' } } }, updateMask: { fieldPaths: ['councilUntil'] } }, back.length ? { updateTransforms: back } : {})
      : { transform: { document: name, fieldTransforms: back } };
    await fetch(fsDocs() + ':commit', { method: 'POST', headers: { authorization: 'Bearer ' + await adminToken(), 'content-type': 'application/json' },
      body: JSON.stringify({ writes: [Object.assign(write, { currentDocument: { exists: true } })] }) });
  } catch { }
}
/* Pro, read without counting anything (the council's config) */
async function tierOf(uid) {
  if (!poolReady()) return { pro: false, verified: false };
  try { return { pro: (await fsGetDoc('wallets/' + uid)).data.proUntil > Date.now(), verified: true }; }
  catch { return { pro: false, verified: false }; }
}

async function chat(req, body) {
  const msgs = Array.isArray(body.messages) ? body.messages : null;
  if (!msgs || !msgs.length || msgs.length > 60) return fail(400, 'bad_request', 'طلب غير صالح');
  const size = msgs.reduce((n, m) => n + String(m && m.content || '').length, 0);
  if (size > 160000) return fail(413, 'too_large', 'الطلب كبير جدًا — ابدأ محادثة جديدة');
  const clean = { messages: msgs.map(m => ({ role: ['system', 'user', 'assistant'].includes(m.role) ? m.role : 'user', content: String(m.content || '') })),
    stream: !!body.stream, max_tokens: Math.min(+(env('AI_MAX_TOKENS') || 4096), Math.max(64, +body.max_tokens || +body.max_completion_tokens || 2048)) };
  if (Number.isFinite(+body.temperature)) clean.temperature = Math.min(1.5, Math.max(0, +body.temperature));

  /* the chosen model's provider first, then the others («auto» never reaches a paid Claude key by itself) */
  const asked = String(body.model || 'auto');
  const first = (asked !== 'auto' && await owner(asked)) || AUTO()[0];
  const order = [first].concat(AUTO().filter(p => p !== first)).filter(p => P[p].keys().length);
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
      try { r = await send(p, key, model, clean, req); }
      catch { rest.set(key, Date.now() + 30e3); continue; }
      if (r.ok) {
        const h = { 'content-type': r.headers.get('content-type') || (clean.stream ? 'text/event-stream' : 'application/json'),
          'cache-control': 'no-store', 'x-nexus-served': p + ':' + model };
        if (notes.length) h['x-nexus-note'] = encodeURIComponent(notes.join(' · ') + ' — أجاب ' + P[p].label + ' (' + model + ')');
        return new Response(r.body, { status: 200, headers: h });
      }
      const t = await r.text().catch(() => '');
      const keyIssue = r.status === 401 || r.status === 403 || KEY_WORDS.test(t);
      const noCredit = !keyIssue && r.status === 400 && NO_CREDIT.test(t);
      /* the model is gone: the other provider */
      if (!keyIssue && !noCredit && (r.status === 404 || r.status === 400) && /model/i.test(t)) { why = '(النموذج غير متاح)'; break; }
      /* the request itself (too large, malformed): no other key helps — the page adapts it */
      if (!keyIssue && !noCredit && (r.status === 413 || r.status === 400 || r.status === 422))
        return new Response(t, { status: r.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
      /* the service is overloaded (Claude: 529): the other provider, the keys are fine */
      if (r.status >= 500) { why = 'مشغول الآن'; break; }
      /* a donated key that is refused is disabled in the pool, not only rested here */
      if (keyIssue) poolDisable(key, 'invalid');
      /* this key: out of quota, rate-limited or refused — it rests, the next key is tried */
      rest.set(keyIssue || noCredit || r.status === 402 ? key : key + '|' + model, Date.now() + (restFor(r.status, t, r.headers) || 15e3));
    }
    notes.push(P[p].label + ' ' + why);
  }
  return fail(503, 'free_ai_unavailable', 'الذكاء المجاني غير متاح الآن — كل المفاتيح وصلت حدّها أو لا تعمل (' + notes.join('، ') + '). جرّب بعد قليل، أو أضف مفتاحك الخاص من ⚙. Please try again in 60s.');
}

/* ============================================================
   THE MULTI-AI COUNCIL (NEXUS Pro) — several models collaborate on one
   request, then one of them reviews every result and writes ONE final
   answer. The page's orchestrator (AIClient, PART 16) plans the members
   and their roles; HERE the limits are enforced, Pro is read, the keys
   (site · owner's box · donated pool) rotate, a failing member does not
   stop the others, and the progress streams back as text/event-stream:
     plan · member (thinking | retrying | done | failed) · synthesis · final | error · done
   Phases: «all» (members + synthesis) · «members» (the server's members
   only — the page runs the models of the player's own keys beside them) ·
   «synthesis» (merges contributions the page brings, Pro only for several).
   ============================================================ */
const clampEnv = (k, d, lo, hi) => Math.min(hi, Math.max(lo, numEnv(k, d)));
const councilCfg = () => ({
  enabled: env('COUNCIL_ENABLED') !== '0',
  maxModels: clampEnv('COUNCIL_MAX_MODELS', 4, 1, 4),                    // maxModelsPerRequest (Pro; free = 1)
  maxParallel: clampEnv('COUNCIL_MAX_PARALLEL', 4, 1, 4),                // maxParallelRequests
  maxSynthesisTokens: clampEnv('COUNCIL_MAX_SYNTHESIS_TOKENS', 4096, 256, 16384),
  maxMemberTokens: clampEnv('COUNCIL_MAX_MEMBER_TOKENS', 1536, 128, 8192),
  maxRequestMs: clampEnv('COUNCIL_MAX_REQUEST_MS', 120000, 10000, 300000), // maxRequestTime
  memberMs: clampEnv('COUNCIL_MEMBER_TIMEOUT_MS', 60000, 3000, 180000),
  maxRetries: clampEnv('COUNCIL_MAX_RETRIES', 2, 0, 5),                  // maxRetries
  donated: env('COUNCIL_USE_DONATED') !== '0'
});
/* Smart Council: the points of each factor and the thresholds for 2 · 3 · 4 models — the page reads
   them from /council/config, so the owner tunes Smart here without a new upload.
   COUNCIL_SMART_THRESHOLDS="2,4,6"   COUNCIL_SMART_WEIGHTS="wholeGame=4,assets=1,…" */
const SMART_WEIGHTS = { size: 1, operations: 1, files: 1, wholeGame: 4, builder: 1, assets: 1, systems: 1, code: 1, errors: 1, existing: 1, review: 1, simple: 2 };
const smartCfg = () => {
  const th = String(env('COUNCIL_SMART_THRESHOLDS') || '').split(',').map(x => x.trim()).filter(Boolean).map(Number);
  const thresholds = th.length === 3 && th.every(Number.isFinite) && th[0] <= th[1] && th[1] <= th[2] ? th : [2, 4, 6];
  const weights = Object.assign({}, SMART_WEIGHTS);
  String(env('COUNCIL_SMART_WEIGHTS') || '').split(',').forEach(pair => {
    const [k, v] = pair.split('=').map(x => String(x || '').trim());
    if (k in weights && v !== '' && Number.isFinite(+v)) weights[k] = Math.max(-10, Math.min(10, +v));
  });
  return { thresholds, weights };
};
const councilPub = C => ({ maxModelsPerRequest: C.maxModels, maxParallelRequests: C.maxParallel, maxSynthesisTokens: C.maxSynthesisTokens,
  maxMemberTokens: C.maxMemberTokens, maxRequestTime: C.maxRequestMs, memberTimeout: C.memberMs, maxRetries: C.maxRetries });

/* a model a provider said it does not have: not asked again for 10 minutes */
const gone = new Map();
const isGone = (p, m) => gone.get(p + '|' + m) > Date.now();
/* a donated key serves one council call at a time — someone's own key is never hit in parallel bursts */
const keyBusy = new Map();
async function onKey(key, fn) {
  if (!donated(key)) return fn();
  const before = keyBusy.get(key) || Promise.resolve();
  let release; const mine = new Promise(r => { release = r; });
  const chain = before.then(() => mine);
  keyBusy.set(key, chain);
  await before;
  try { return await fn(); }
  finally { release(); if (keyBusy.get(key) === chain) keyBusy.delete(key); }
}
/* the provider's own words, never anything that looks like a key */
const KEY_LIKE = /(AIza[0-9A-Za-z_-]{10,}|AQ\.[0-9A-Za-z_.-]{10,}|gsk_[A-Za-z0-9]{8,}|sk-(?:or-|ant-)?[A-Za-z0-9_-]{8,}|Bearer\s+\S+)/g;
const saidBy = t => ((/"message"\s*:\s*"([^"]{1,160})/.exec(String(t || '')) || [])[1] || '').replace(KEY_LIKE, '[key]');

/* where one council call goes: the models asked for (on the provider whose real list has them), then
   the first model of every other provider — those other members already use come last, so members differ */
async function councilRoute(wants, avoid = []) {
  const out = [], seen = new Set();
  const add = (p, model) => { if (model && !seen.has(p + '|' + model) && !isGone(p, model)) { seen.add(p + '|' + model); out.push({ p, model }); } };
  for (const w of wants) if (w && w !== 'auto') { const p = await owner(w); if (p) add(p, w); }
  const others = AUTO().filter(p => P[p].keys().length).sort((a, b) => avoid.includes(a) - avoid.includes(b));
  for (const p of others) add(p, (await P[p].models().catch(() => [])).find(m => !isGone(p, m)));
  return out;
}

/* one council call, never streamed: along its route, key after key — at most `tries` attempts, each ≤ `ms` */
async function councilCall(req, route, clean, { tries, ms, deadline, signal, donatedToo, onTry }) {
  const notes = [];
  let attempts = 0;
  for (const { p, model } of route) {
    const keys = keysNow(p, model, { donatedToo }).sort((a, b) => keyBusy.has(a) - keyBusy.has(b));
    for (const key of keys) {
      if (signal.aborted) return { ok: false, attempts, notes, aborted: true };
      if (attempts >= tries || Date.now() > deadline - 1500) return { ok: false, attempts, notes };
      if (resting(key, model)) continue;                     // rested while this call waited its turn
      attempts++;
      if (onTry) onTry(p, model, attempts > 1 ? notes[notes.length - 1] || null : null);
      const label = P[p].label + ' · ' + model;
      const r = await onKey(key, async () => {
        const ctrl = new AbortController(), stop = () => ctrl.abort();
        signal.addEventListener('abort', stop);
        const timer = setTimeout(stop, Math.max(1000, Math.min(ms, deadline - Date.now())));
        try {
          const res = await send(p, key, model, Object.assign({}, clean, { stream: false }), req, ctrl.signal);
          const t = await res.text();
          return { status: res.status, ok: res.ok, headers: res.headers, t };
        } catch (e) { return { lost: ctrl.signal.aborted ? 'timeout' : 'network' }; }
        finally { clearTimeout(timer); signal.removeEventListener('abort', stop); }
      });
      if (signal.aborted) return { ok: false, attempts, notes, aborted: true };
      if (r.lost) {
        rest.set(key + '|' + model, Date.now() + 30e3);
        notes.push(label + ': ' + (r.lost === 'timeout' ? 'انتهت المهلة (timeout)' : 'تعذّر الاتصال'));
        if (r.lost === 'timeout') break;                   // a slow provider: the next one, not its other keys
        continue;
      }
      if (r.ok) {
        let j = null; try { j = JSON.parse(r.t); } catch { }
        const c = j && j.choices && j.choices[0];
        const text = String((c && c.message && c.message.content) || '').replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
        if (text) return { ok: true, text, provider: P[p].label, p, model, stop: (c && c.finish_reason) || null, attempts, notes,
          usage: j.usage ? { in: j.usage.prompt_tokens || 0, out: j.usage.completion_tokens || 0 } : null };
        notes.push(label + ': ردّ فارغ');
        continue;
      }
      const keyIssue = r.status === 401 || r.status === 403 || KEY_WORDS.test(r.t);
      const noCredit = !keyIssue && (r.status === 402 || (r.status === 400 && NO_CREDIT.test(r.t)));
      if (!keyIssue && !noCredit && (r.status === 404 || r.status === 400) && /model/i.test(r.t)) {
        gone.set(p + '|' + model, Date.now() + 600e3);
        notes.push(label + ': النموذج غير متاح');
        break;
      }
      if (!keyIssue && !noCredit && r.status !== 429) {
        /* overloaded, too large for this provider (Groq's per-minute budget), refused as a request: the next provider */
        notes.push(label + ': HTTP ' + r.status + (saidBy(r.t) ? ' — ' + saidBy(r.t) : ''));
        break;
      }
      if (keyIssue) poolDisable(key, 'invalid');
      rest.set(keyIssue || noCredit ? key : key + '|' + model, Date.now() + (restFor(r.status, r.t, r.headers) || 15e3));
      notes.push(label + ': ' + (r.status === 429 ? 'وصل حدّه (429) — مفتاح آخر' : noCredit ? 'مفتاح بلا رصيد — مفتاح آخر' : 'مفتاح مرفوض — مفتاح آخر'));
    }
  }
  if (!attempts) notes.push('لا مفتاح متاح الآن لهذا النموذج');
  return { ok: false, attempts, notes };
}

/* what each role does when the page sends no brief of its own */
const ROLE_BRIEF = {
  lead: 'Write the COMPLETE answer to the request, in exactly the format required above. It is the draft the final answer is built on.',
  planner: 'Analyse the request against the context: what the result must contain (objects, systems, files, steps and their order), what already exists and must be reused, what could go wrong. A short plan in bullets — no code.',
  assets: 'Choose the assets for this request ONLY from those listed in the context (by their handle or id): which one for which need, how many, where. Say plainly what is missing — never invent an id, a handle or a file.',
  reviewer: 'Review the contributions below: invented ids / handles / files / objects / APIs, engine-API misuse, missing parts, a wrong format, logic errors. List every problem with its exact fix.',
  analyst: 'State the facts from the context that the answer depends on (files, functions, objects, values) and what must not break. Bullets — not the whole answer.',
  tester: 'List how the result could fail when it is built or run (errors, edge cases, API misuse) and what the final answer must check. Bullets.'
};
function memberSystem(system, m, n, deps) {
  return system + '\n\n---\nNEXUS AI COUNCIL — Multi-AI collaboration: ' + n + ' AI models work on this request, each from its own role; NEXUS reviews and merges their results into ONE final answer for the user.\n'
    + 'YOUR ROLE: ' + m.title + '. ' + (m.brief || ROLE_BRIEF[m.role] || ROLE_BRIEF.analyst) + '\n'
    + (m.lead ? '' : 'Contribute only your part, concisely — the other members cover the rest; do not write the whole final answer.\n')
    + 'Use only what the context above really contains — never invent asset ids, handles, files, objects or APIs.'
    + (deps.length ? '\n\nCONTRIBUTIONS TO REVIEW:\n' + deps.map(d => '### ' + d.m.title + ' — ' + d.provider + ' · ' + d.model + '\n' + d.text).join('\n\n') : '');
}
function synthesisSystem(system, brief) {
  return system + '\n\n---\nNEXUS AI COUNCIL — REVIEW & SYNTHESIS. Several AI models worked on the user\'s request (Multi-AI collaboration); their contributions are at the end of the last message. You write the ONE final answer:\n'
    + '1. Review the contributions against each other, the request and the context/rules above: errors, contradictions, invented ids / handles / files / objects / APIs, missing parts.\n'
    + '2. Answer the request once, in exactly the format required above (when a JSON object or a nexus-actions block is required, output it complete and valid).\n'
    + '3. Build on the lead draft and the other contributions: keep what is correct, fix what is wrong, add what is missing — do not start again from scratch when they are usable.\n'
    + '4. Speak to the user directly; do not mention the council, its members or the models unless the user asks.' + (brief ? '\n' + brief : '');
}
function withContributions(messages, got) {
  const block = '\n\n---\nCOUNCIL CONTRIBUTIONS (for you only — the user does not see them):\n\n'
    + got.map((r, i) => '### #' + (i + 1) + ' ' + r.m.title + (r.m.lead ? ' (lead draft)' : '') + ' — ' + r.provider + ' · ' + r.model + '\n' + r.text).join('\n\n');
  const out = messages.slice(), i = out.map(m => m.role).lastIndexOf('user');
  if (i >= 0) out[i] = { role: 'user', content: out[i].content + block }; else out.push({ role: 'user', content: block.trim() });
  return out;
}

async function council(req, me, body) {
  const C = councilCfg();
  if (!C.enabled) return fail(503, 'council_off', 'مجلس الذكاء (AI Council) متوقّف على هذا الموقع.');
  if (!ORDER.some(p => P[p].keys().length)) return fail(503, 'free_ai_unavailable', 'الذكاء المجاني غير مُعدّ على هذا الموقع بعد.');
  /* ---- the request, checked ---- */
  const msgs = Array.isArray(body.messages) ? body.messages : null;
  if (!msgs || !msgs.length || msgs.length > 60) return fail(400, 'bad_request', 'طلب غير صالح');
  const messages = msgs.map(m => ({ role: m && m.role === 'assistant' ? 'assistant' : 'user', content: String((m && m.content) || '') }));
  const system = String(body.system || '');
  if (system.length + messages.reduce((n, m) => n + m.content.length, 0) > 200000) return fail(413, 'too_large', 'الطلب كبير جدًا — ابدأ محادثة جديدة');
  const phase = ['members', 'synthesis'].includes(body.phase) ? body.phase : 'all';
  const mode = ['single', 'smart', 'full'].includes(body.mode) ? body.mode : 'smart';
  const word = (s, n) => String(s == null ? '' : s).replace(/[^\w-]/g, '').slice(0, n);
  let asked = (Array.isArray(body.members) ? body.members : []).filter(m => m && typeof m === 'object').slice(0, 8).map((m, i) => ({
    id: 'm' + (i + 1), role: word(m.role, 24) || 'member', title: String(m.title || m.role || 'Member').slice(0, 60), brief: String(m.brief || '').slice(0, 4000),
    model: String(m.model || 'auto').slice(0, 160), lead: !!m.lead, after: Array.isArray(m.after) ? m.after.map(x => word(x, 24)).slice(0, 3) : [] }));
  asked.sort((a, b) => b.lead - a.lead);                  // the lead draft is never the one left out
  const contributions = (Array.isArray(body.contributions) ? body.contributions : []).filter(c => c && String(c.text || '').trim()).slice(0, 4).map((c, i) => ({
    ok: true, text: String(c.text).slice(0, 24000), provider: String(c.provider || 'مفتاحك').slice(0, 40), model: String(c.model || '').slice(0, 160),
    m: { id: 'c' + (i + 1), role: word(c.role, 24) || 'member', title: String(c.title || c.role || 'Member').slice(0, 60), lead: !!c.lead } }));
  const external = phase === 'members' ? Math.max(0, Math.min(4, parseInt(body.external, 10) || 0)) : 0;
  const synth = { want: String((body.synthesis && body.synthesis.model) || 'auto').slice(0, 160), brief: String((body.synthesis && body.synthesis.brief) || '').slice(0, 3000) };
  const finalTokens = Math.max(256, Math.min(C.maxSynthesisTokens, +body.maxTokens || C.maxSynthesisTokens));

  /* ---- how many models: Pro, read HERE → up to COUNCIL_MAX_MODELS; everyone else → one ---- */
  const size = pro => {
    const allowedN = pro && mode !== 'single' ? C.maxModels : 1;
    if (phase === 'synthesis') return { allowedN, members: 0, calls: contributions.length ? 1 : 0 };
    const members = Math.max(phase === 'members' ? 0 : 1, Math.min(asked.length || 1, allowedN - external));
    return { allowedN, members, calls: members + (phase === 'all' && members > 1 ? 1 : 0) };
  };
  const q = await aiQuota(me.uid, pro => size(pro).calls, phase === 'synthesis' ? 0 : C.maxRequestMs + 15e3);
  if (!q.ok) return q.busy ? fail(429, 'council_busy', 'مجلس آخر يعمل لحسابك الآن — انتظر حتى ينتهي. Please try again in 30s.')
    : fail(429, 'daily_limit', q.pro ? 'وصلت حدّ Pro اليومي (' + q.limit + ' طلبًا) — يتجدّد غدًا.' : 'انتهت طلبات الذكاء المجانية اليوم (' + q.limit + ').');
  const pro = !!(q.verified && q.pro), S = size(pro), took = q.took || 0;
  const release = n => aiRefund(me.uid, n, !!q.locked);
  /* more than one model for an account that is not Pro (read above, from its wallet — whatever the
     page was made to send): refused, nothing runs, nothing is counted */
  const several = phase === 'synthesis' ? contributions.length > S.allowedN : !pro && (asked.length > 1 || external > 0);
  if (several) {
    await release(took);
    return fail(403, 'pro_required', q.verified ? 'Multi-AI Council (أكثر من نموذج في المهمة الواحدة) من مزايا NEXUS Pro — الحساب المجاني: نموذج واحد.' : 'لا يستطيع الخادم التحقق من اشتراك Pro هنا (يحتاج FIREBASE_SERVICE_ACCOUNT) — يعمل نموذج واحد فقط.');
  }
  /* the day's requests may allow fewer calls than planned: a smaller council (two members need three calls) */
  let n = S.members;
  if (phase === 'all' && S.calls > took) n = took >= 3 ? took - 1 : 1;
  if (phase === 'members' && S.members > took) n = took;
  if (!asked.length && phase !== 'synthesis') asked = [{ id: 'm1', role: 'lead', title: 'Lead', brief: '', model: 'auto', lead: true, after: [] }];
  const members = phase === 'synthesis' ? [] : asked.slice(0, n);
  if (phase === 'all' && members.length && !members.some(m => m.lead)) members[0].lead = true;
  members.forEach(m => { m.after = m.after.filter(r => members.some(x => x.role === r && x !== m)); });
  const reduced = phase !== 'synthesis' && asked.length > members.length ? (pro ? (took < S.calls ? 'daily_limit' : 'limit') : q.verified ? 'pro_required' : 'pro_unverified') : null;

  /* ---- the answer is a stream of progress events ---- */
  const enc = new TextEncoder(), abort = new AbortController();
  let out = null, closed = false;
  const stream = new ReadableStream({ start(c) { out = c; }, cancel() { closed = true; abort.abort(); } });
  const emit = (event, data) => { if (closed) return; try { out.enqueue(enc.encode('event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n')); } catch { closed = true; } };
  const ping = setInterval(() => { if (!closed) { try { out.enqueue(enc.encode(': ping\n\n')); } catch { closed = true; } } }, 10000);
  (async () => {
    let counted = 0;
    try {
      counted = await runCouncil({ req, C, phase, mode, pro, verified: !!q.verified, allowedN: S.allowedN, reduced, members, contributions, external, synth,
        system, messages, finalTokens, took, emit, signal: abort.signal, deadline: Date.now() + C.maxRequestMs });
    } catch (e) {
      console.warn('[ai] council', e && e.message);
      emit('error', { code: 'council_failed', message: 'توقّف المجلس: ' + String((e && e.message) || e).replace(KEY_LIKE, '[key]').slice(0, 200) });
    } finally {
      clearInterval(ping);
      await release(Math.max(0, took - counted));        // calls not made (or that no provider answered) are given back
      emit('done', { counted, refunded: Math.max(0, took - counted) });
      closed = true;
      try { out.close(); } catch { }
    }
  })();
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' } });
}

async function runCouncil(x) {
  const { req, C, phase, members, emit, signal, deadline, system, messages, finalTokens } = x;
  const t0 = Date.now(), donatedToo = C.donated, results = new Map();
  let counted = 0;
  /* every member gets its first provider now — a different one from the others' when there is one */
  const usedP = [];
  for (const m of members) {
    m.route = await councilRoute([m.model], usedP);
    if (m.route[0]) usedP.push(m.route[0].p);
    if (m.model !== 'auto' && (!m.route[0] || m.route[0].model !== m.model)) m.note = 'النموذج «' + m.model + '» غير متاح الآن — اختير غيره';
  }
  const first = m => m.route && m.route[0] ? { provider: P[m.route[0].p].label, model: m.route[0].model } : { provider: null, model: null };
  emit('plan', { phase, mode: x.mode, pro: x.pro, verified: x.verified, allowed: x.allowedN, reduced: x.reduced, calls: x.took, external: x.external, limits: councilPub(C),
    members: members.map(m => Object.assign({ id: m.id, role: m.role, title: m.title, lead: m.lead, after: m.after, note: m.note || null }, first(m))) });

  /* ---- the members: at most COUNCIL_MAX_PARALLEL calls at once; a reviewer starts when what it reviews is ready ---- */
  if (members.length) {
    let active = 0;
    const waiting = [];
    const slot = () => new Promise(res => { if (active < C.maxParallel) { active++; res(); } else waiting.push(res); });
    const free = () => { active--; const nx = waiting.shift(); if (nx) { active++; nx(); } };
    const reserve = phase === 'all' && members.length > 1 ? Math.min(45000, C.maxRequestMs / 3) : 0;   // time kept for the synthesis
    const tasks = new Map();
    const runOne = async m => {
      const deps = members.filter(d => d !== m && m.after.includes(d.role) && members.indexOf(d) < members.indexOf(m));
      await Promise.all(deps.map(d => tasks.get(d.id)));
      await slot();
      const t = Date.now();
      try {
        emit('member', Object.assign({ id: m.id, state: 'thinking' }, first(m)));
        const reviewed = deps.map(d => results.get(d.id)).filter(r => r && r.ok);
        const clean = { messages: [{ role: 'system', content: memberSystem(system, m, members.length + x.external, reviewed) }].concat(messages), max_tokens: m.lead ? finalTokens : C.maxMemberTokens };
        const r = await councilCall(req, m.route, clean, { tries: 1 + C.maxRetries, ms: C.memberMs, deadline: deadline - reserve, signal, donatedToo,
          onTry: (p, model, why) => { if (why) emit('member', { id: m.id, state: 'retrying', provider: P[p].label, model, note: why }); } });
        r.m = m; r.ms = Date.now() - t;
        results.set(m.id, r);
        if (r.ok) { counted++; emit('member', { id: m.id, state: 'done', provider: r.provider, model: r.model, ms: r.ms, usage: r.usage, tries: r.attempts }); }
        else emit('member', { id: m.id, state: 'failed', ms: r.ms, error: r.aborted ? 'أُوقف' : r.notes.slice(-2).join(' · ') || 'لا مزوّد متاح الآن', tries: r.attempts });
      } finally { free(); }
    };
    members.forEach(m => tasks.set(m.id, runOne(m)));
    await Promise.all(tasks.values());
  }
  const summary = () => members.map(m => {
    const r = results.get(m.id) || { notes: [] };
    return { id: m.id, role: m.role, title: m.title, lead: m.lead, state: r.ok ? 'done' : 'failed', provider: r.provider || first(m).provider, model: r.model || first(m).model,
      ms: r.ms || 0, usage: r.usage || null, tries: r.attempts || 0, error: r.ok ? null : (r.notes || []).slice(-2).join(' · ') || null, text: r.ok ? r.text : null };
  });
  const sum = list => list.reduce((u, r) => r && r.usage ? { in: u.in + (r.usage.in || 0), out: u.out + (r.usage.out || 0) } : u, { in: 0, out: 0 });
  if (phase === 'members') { emit('final', { phase, members: summary(), usage: sum(Array.from(results.values())), ms: Date.now() - t0 }); return counted; }

  /* ---- review & synthesis: one model writes the final answer from what the others produced ---- */
  const got = phase === 'synthesis' ? x.contributions : members.map(m => results.get(m.id)).filter(r => r && r.ok);
  if (!got.length) {
    emit('error', { code: 'council_failed', message: 'لم يُجب أي نموذج في المجلس الآن — ' + (Array.from(results.values()).flatMap(r => r.notes || []).slice(-3).join(' · ') || 'لا مزوّد متاح') + '. Please try again in 60s.', members: summary() });
    return counted;
  }
  const lead = got.find(r => r.m.lead);
  /* one answer only (the council had one model, or the others failed): it IS the final answer — no merge call */
  if (got.length === 1 && lead) {
    emit('synthesis', { state: 'skipped', note: members.length > 1 ? 'أجاب نموذج واحد فقط — استُعملت إجابته كما هي' : null });
    emit('final', { text: lead.text, provider: lead.provider, model: lead.model, usage: sum(got), stop: lead.stop || null, truncated: lead.stop === 'length',
      degraded: members.length > 1, members: summary(), synthesis: null, ms: Date.now() - t0 });
    return counted;
  }
  emit('synthesis', { state: 'processing' });
  const route = await councilRoute([x.synth.want].concat(lead ? [lead.model] : [], got.map(r => r.model)), []);
  const clean = { messages: [{ role: 'system', content: synthesisSystem(system, x.synth.brief) }].concat(withContributions(messages, got)), max_tokens: finalTokens };
  const t = Date.now();
  const s = await councilCall(req, route, clean, { tries: Math.min(5, Math.max(1 + C.maxRetries, route.length)), ms: Math.max(C.memberMs, deadline - Date.now()), deadline, signal, donatedToo,
    onTry: (p, model, why) => emit('synthesis', { state: why ? 'fallback' : 'processing', provider: P[p].label, model, note: why }) });
  if (s.ok) {
    counted++;
    emit('synthesis', { state: 'done', provider: s.provider, model: s.model, ms: Date.now() - t, tries: s.attempts });
    emit('final', { text: s.text, provider: s.provider, model: s.model, usage: sum(got.concat([s])), stop: s.stop, truncated: s.stop === 'length',
      degraded: got.length < Math.max(members.length, x.contributions.length), members: phase === 'synthesis' ? [] : summary(),
      synthesis: { provider: s.provider, model: s.model, tries: s.attempts, notes: s.notes }, ms: Date.now() - t0 });
    return counted;
  }
  emit('synthesis', { state: 'failed', error: s.aborted ? 'أُوقف' : s.notes.slice(-2).join(' · ') || 'لا نموذج متاح للدمج' });
  /* nobody could merge: the lead draft is still a complete answer */
  if (lead) emit('final', { text: lead.text, provider: lead.provider, model: lead.model, usage: sum(got), stop: lead.stop || null, truncated: lead.stop === 'length',
    degraded: true, note: 'تعذّر الدمج — هذه مسودة النموذج الرئيسي كما هي', members: summary(), synthesis: null, ms: Date.now() - t0 });
  else emit('error', { code: 'synthesis_failed', message: 'تعذّر دمج نتائج المجلس الآن — ' + (s.notes.slice(-2).join(' · ') || 'لا نموذج متاح') + '. Please try again in 60s.', members: summary() });
  return counted;
}

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/api\/ai/, '') || '/';
  /* this site's pages only */
  const origin = req.headers.get('origin');
  if (origin && origin !== url.origin) return fail(403, 'origin', 'غير مسموح');
  await loadBox();
  await loadPool();
  if (req.method === 'GET' && path === '/health') {
    const providers = Object.keys(P).filter(p => P[p].keys().length);
    return json(200, { free: providers.length > 0, providers, signin: 'google', keyBox: boxReady(), pool: { readable: pool.readable, active: pool.keys.length },
      council: councilCfg().enabled && providers.length > 0 });
  }
  const me = await who(req);
  if (me.error) return fail(401, 'signin', 'سجّل الدخول بحساب Google لاستعمال الذكاء المجاني');
  if (req.method === 'POST' && path.startsWith('/keys/')) return keyBox(path, me, req);
  /* the donor's own donated keys: provider, last four characters, state — never a key */
  if (req.method === 'GET' && path === '/pool') {
    const out = { readable: poolReady() && pool.readable, active: pool.keys.length, providers: {} };
    pool.keys.forEach(k => { out.providers[k.provider] = (out.providers[k.provider] || 0) + 1; });
    if (out.readable) { try { out.mine = (await poolQuery('donorUid', me.uid)).map(k => ({ id: k.id, provider: providerOf(k.key), tail: '••••' + k.key.slice(-4), status: k.status, reason: k.reason })); } catch { out.mine = null; } }
    return json(200, out);
  }
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
    const q = await aiQuota(me.uid);
    if (!q.ok) return fail(429, 'daily_limit', q.pro
      ? 'وصلت حدّ Pro اليومي (' + q.limit + ' طلبًا) — يتجدّد غدًا.'
      : 'انتهت طلبات الذكاء المجانية اليوم (' + q.limit + '). من «💰 نقاطي»: اشترِ ' + numEnv('AI_PACK_REQUESTS', 10) + ' طلبات بـ' + numEnv('AI_PACK_POINTS', 10) + ' نقاط (شاهد إعلانًا لتجمعها)، أو اشترك في Pro.');
    const res = await chat(req, body);
    if (res.status === 503) aiRefund(me.uid);
    else if (q.left != null) res.headers.set('x-nexus-left', String(q.left));
    return res;
  }
  /* the Multi-AI Council: what this account may use (read on the server), then the council itself */
  if (req.method === 'GET' && path === '/council/config') {
    const C = councilCfg(), t = await tierOf(me.uid), providers = ORDER.filter(p => P[p].keys().length);
    return json(200, { enabled: C.enabled && providers.length > 0, pro: t.pro, verified: t.verified, maxModels: t.pro ? C.maxModels : 1, proMaxModels: C.maxModels, freeMaxModels: 1,
      limits: councilPub(C), smart: smartCfg(), providers: providers.map(p => P[p].label), modes: t.pro ? ['single', 'smart', 'full'] : ['single'], donated: C.donated });
  }
  if (req.method === 'POST' && path === '/council') {
    const wait = allowed(me.uid);
    if (wait) return fail(429, 'rate_limit', 'طلبات كثيرة — انتظر قليلًا. Please try again in ' + wait + 's.');
    let body;
    try { body = await req.json(); } catch { return fail(400, 'bad_request', 'طلب غير صالح'); }
    const n = Math.min(5, (Array.isArray(body.members) ? body.members.length : 0) + 1);
    if (n > 1 && allowed(me.uid, n - 1)) return fail(429, 'rate_limit', 'طلبات كثيرة — انتظر قليلًا. Please try again in 30s.');
    return council(req, me, body);
  }
  return fail(404, 'not_found', 'غير موجود');
};

export const config = { path: '/api/ai/*' };
