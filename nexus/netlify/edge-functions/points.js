/* ============================================================
   NEXUS — points (PART 34): the site's own currency, kept on the SERVER.
   A browser can read its balance and history (firestore.rules) but can
   never write them: every change is made here with the service account,
   in one Firestore commit together with the reason for it.

   Earn:  a rewarded ad watched to the end        +POINTS_PER_AD (5)
          the welcome gift (once per account)       +POINTS_WELCOME (50)
          every 10 minutes others play your game    +POINTS_PER_PLAY_REWARD (5)
   Spend: a hosted file                             POINTS_PER_MB (10) per MB
          10 more AI requests today                 AI_PACK_POINTS (10)
   Pro ($20 / month through Stripe): hosted files free, 150 AI requests a day.
   Points stay inside the site — they are not money and cannot be cashed out.

   Ads:
   • AdMob (Android / iOS app): Google calls GET /api/points/admob-ssv with a
     signed reward (Server-Side Verification). The signature is checked
     against Google's published keys, the transaction is counted once.
     AdMob console → the rewarded ad unit → Server-side verification →
     callback URL: https://YOUR-SITE/api/points/admob-ssv
   • In a browser (AdSense H5 games rewarded ads): the page asks for a ticket
     (/ad/start), shows the ad, and claims it (/ad/claim) no sooner than the
     ad could have run. Google does not confirm these to the server, so they
     are only accepted when ADS_WEB=1 — and always within the daily limit.

   Environment (Netlify → Site configuration → Environment variables):
     FIREBASE_SERVICE_ACCOUNT   required — the service account JSON
     ADMOB_REWARDED_UNITS       the rewarded ad unit(s) accepted (comma list)
     ADS_WEB=1                  accept browser (AdSense H5) rewards
     STRIPE_SECRET_KEY · STRIPE_PRICE_ID · STRIPE_WEBHOOK_SECRET   for Pro
       Stripe → Developers → Webhooks → endpoint https://YOUR-SITE/api/points/stripe
       events: checkout.session.completed, invoice.paid,
               customer.subscription.updated, customer.subscription.deleted
     optional numbers: POINTS_PER_AD · ADS_PER_DAY · ADS_COOLDOWN_SECONDS ·
       ADS_MIN_SECONDS · POINTS_WELCOME · POINTS_PER_MB · FILE_MAX_MB ·
       AI_FREE_PER_DAY · AI_PACK_REQUESTS · AI_PACK_POINTS · PRO_AI_PER_DAY ·
       PLAY_MINUTES_PER_REWARD · POINTS_PER_PLAY_REWARD · PLAY_MINUTES_PER_PLAYER_DAY
   ============================================================ */
const env = k => { try { return (globalThis.Netlify && Netlify.env.get(k)) || ''; } catch { return ''; } };
const te = s => new TextEncoder().encode(s);
const txt = b => new TextDecoder().decode(b);
const b64u = s => { s = String(s || '').replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const u64 = b => { let s = ''; const u = b instanceof Uint8Array ? b : new Uint8Array(b); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const fail = (status, code, message, extra = {}) => json(status, Object.assign({ ok: false, error: { code, message } }, extra));
const coded = (status, code, message, extra) => Object.assign(new Error(message), { status, code, extra });
const rid = (n = 20) => u64(crypto.getRandomValues(new Uint8Array(n))).replace(/[^A-Za-z0-9]/g, '').slice(0, n) || String(Date.now());
const today = () => new Date().toISOString().slice(0, 10);          // the day the limits count (UTC)

/* ---------------- the numbers (one place; each can be changed in Netlify) ---------------- */
const num = (k, d) => { const v = env(k); return v !== '' && Number.isFinite(+v) ? +v : d; };
const cfg = () => ({
  welcome: num('POINTS_WELCOME', 50),
  ad: num('POINTS_PER_AD', 5), adsPerDay: num('ADS_PER_DAY', 15), adCooldown: num('ADS_COOLDOWN_SECONDS', 60), adMinSeconds: num('ADS_MIN_SECONDS', 15),
  adsWeb: env('ADS_WEB') === '1',
  mb: num('POINTS_PER_MB', 10), fileMaxMB: num('FILE_MAX_MB', 25),
  aiFree: num('AI_FREE_PER_DAY', 20), aiPack: num('AI_PACK_REQUESTS', 10), aiPackPrice: num('AI_PACK_POINTS', 10), proAI: num('PRO_AI_PER_DAY', 150),
  playMinutes: num('PLAY_MINUTES_PER_REWARD', 10), playPoints: num('POINTS_PER_PLAY_REWARD', 5), playCap: num('PLAY_MINUTES_PER_PLAYER_DAY', 30), playGap: num('PLAY_HEARTBEAT_SECONDS', 55),
  stripe: !!(env('STRIPE_SECRET_KEY') && env('STRIPE_PRICE_ID')), proPrice: env('PRO_PRICE_LABEL') || '20$'
});
/* the rewarded ad unit(s) whose AdMob rewards are accepted — the numeric part after «/» */
const ADMOB_UNITS = () => (env('ADMOB_REWARDED_UNITS') || 'ca-app-pub-4399025548645078/3848566420').split(/[\s,]+/).filter(Boolean).map(u => u.split('/').pop());
/* what may be hosted with a direct link */
const HOSTED = /\.(html?|png|jpe?g|gif|webp|svg|json|js|css|zip|txt|mp3|ogg|wav|glb|gltf)$/i;

/* ---------------- the service account (as ai.js / passkeys.js) ---------------- */
function saRead() {
  let raw = env('FIREBASE_SERVICE_ACCOUNT').trim();
  const email2 = env('FIREBASE_CLIENT_EMAIL').trim(), key2 = env('FIREBASE_PRIVATE_KEY');
  if (!raw && !(email2 && key2)) return null;
  let j;
  if (raw) {
    if (/^['"`]/.test(raw) && /['"`]$/.test(raw)) raw = raw.slice(1, -1).trim();
    if (!raw.startsWith('{')) { try { const d = atob(raw.replace(/\s+/g, '')); if (d.trim().startsWith('{')) raw = d.trim(); } catch { } }
    try { j = JSON.parse(raw); } catch { return null; }
  } else j = { client_email: email2, private_key: key2 };
  const pk = String((j && j.private_key) || '').replace(/\\n/g, '\n');
  if (!j.client_email || !/-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----/.test(pk)) return null;
  return Object.assign({}, j, { private_key: pk });
}
const ready = () => !!(saRead() || env('FIRESTORE_EMULATOR_HOST'));
const projectId = () => env('FIREBASE_PROJECT_ID') || (saRead() || {}).project_id || '';
let saKey = null, access = { v: '', exp: 0 };
async function accessToken() {
  if (env('FIRESTORE_EMULATOR_HOST')) return 'owner';
  if (access.exp > Date.now() + 60e3) return access.v;
  const s = saRead(), now = Math.floor(Date.now() / 1000);
  if (!saKey) saKey = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(s.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), c => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const head = u64(te(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: s.private_key_id })));
  const body = u64(te(JSON.stringify({ iss: s.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })));
  const sig = u64(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', saKey, te(head + '.' + body))));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + head + '.' + body + '.' + sig });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) { saKey = null; throw new Error('service account refused'); }
  access = { v: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return access.v;
}

/* ---------------- Firestore (REST, admin) ---------------- */
const base = () => (env('FIRESTORE_EMULATOR_HOST') ? 'http://' + env('FIRESTORE_EMULATOR_HOST') : 'https://firestore.googleapis.com') + '/v1/projects/' + projectId() + '/databases/(default)/documents';
const docName = path => 'projects/' + projectId() + '/databases/(default)/documents/' + path;
const toFs = v => v === null || v === undefined ? { nullValue: null } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : typeof v === 'string' ? { stringValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(toFs) } } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFs(x)])) } };
const fromFs = f => 'nullValue' in f ? null : 'booleanValue' in f ? f.booleanValue : 'integerValue' in f ? +f.integerValue : 'doubleValue' in f ? f.doubleValue : 'stringValue' in f ? f.stringValue
  : 'timestampValue' in f ? Date.parse(f.timestampValue) : 'arrayValue' in f ? (f.arrayValue.values || []).map(fromFs) : 'mapValue' in f ? Object.fromEntries(Object.entries(f.mapValue.fields || {}).map(([k, x]) => [k, fromFs(x)])) : null;
const fields = o => toFs(o).mapValue.fields;
async function getDoc(path) {
  const r = await fetch(base() + '/' + path, { headers: { authorization: 'Bearer ' + await accessToken() } });
  if (r.status === 404) return { exists: false, data: null };
  if (!r.ok) throw coded(503, 'store', 'قاعدة البيانات لا تجيب (' + r.status + ')');
  const d = await r.json();
  return { exists: true, updateTime: d.updateTime, data: fromFs({ mapValue: { fields: d.fields || {} } }) };
}
/* one write: set these fields (only these), optionally add to counters, only if the document is as it was read */
const put = (path, f, { pre, incr, whole } = {}) => Object.assign({ update: { name: docName(path), fields: fields(f) } },
  whole ? {} : { updateMask: { fieldPaths: Object.keys(f) } },
  pre ? { currentDocument: pre } : {},
  incr ? { updateTransforms: Object.entries(incr).map(([k, n]) => ({ fieldPath: k, increment: { integerValue: String(n) } })) } : {});
const create = (path, f) => put(path, f, { whole: true, pre: { exists: false } });
const preOf = d => d.exists ? { updateTime: d.updateTime } : { exists: false };
/* all or nothing; a document that changed since it was read → { conflict } and the caller reads again */
async function commit(writes) {
  const r = await fetch(base() + ':commit', { method: 'POST', headers: { authorization: 'Bearer ' + await accessToken(), 'content-type': 'application/json' }, body: JSON.stringify({ writes }) });
  if (r.ok) return { ok: true, results: (await r.json()).writeResults || [] };
  const t = await r.text().catch(() => '');
  return { ok: false, conflict: r.status === 409 || /FAILED_PRECONDITION|ALREADY_EXISTS|NOT_FOUND/.test(t), status: r.status, text: t.slice(0, 300) };
}
async function runQuery(q) {
  const r = await fetch(base() + ':runQuery', { method: 'POST', headers: { authorization: 'Bearer ' + await accessToken(), 'content-type': 'application/json' }, body: JSON.stringify({ structuredQuery: q }) });
  if (!r.ok) throw coded(503, 'store', 'قاعدة البيانات لا تجيب (' + r.status + ')');
  return (await r.json()).filter(x => x.document).map(x => Object.assign({ id: x.document.name.split('/').pop() }, fromFs({ mapValue: { fields: x.document.fields || {} } })));
}

/* ---------------- the wallet: every change in one commit with its reason ----------------
   plan(wallet) may refuse ({ error }), change fields, and add writes of its own
   (a used ad ticket, an upload ticket …) — all land together or none does. */
async function change(uid, delta, reason, note, plan) {
  for (let i = 0; i < 5; i++) {
    const w = await getDoc('wallets/' + uid);
    if (!w.exists) { await wallet(uid); continue; }       // a first change: the wallet (and its welcome gift) first
    const d = w.data || {};
    const p = plan ? await plan(d, w) : {};
    if (p.error) throw p.error;
    const dl = p.delta != null ? p.delta : delta;
    if (dl < 0 && (d.points || 0) + dl < 0) throw coded(402, 'not_enough', 'رصيدك ' + (d.points || 0) + ' نقطة — تحتاج ' + (-dl) + '.', { points: d.points || 0, need: -dl });
    const f = Object.assign({ updatedAt: Date.now() }, p.fields || {});
    const writes = [put('wallets/' + uid, f, { pre: preOf(w), incr: dl ? { points: dl } : null })];
    if (dl) writes.push(create('wallets/' + uid + '/ledger/' + Date.now() + '_' + rid(6), { delta: dl, reason, note: String(p.note || note || '').slice(0, 120), at: Date.now() }));
    (p.writes || []).forEach(x => writes.push(x));
    const r = await commit(writes);
    if (r.ok) {
      const t = r.results[0] && r.results[0].transformResults && r.results[0].transformResults[0];
      return { points: t ? +t.integerValue : (d.points || 0) + dl, wallet: Object.assign({}, d, f), delta: dl, result: p.result };
    }
    if (!r.conflict) throw coded(503, 'store', 'تعذّر الحفظ (' + r.status + ')');
  }
  throw coded(409, 'busy', 'حاول مرة أخرى بعد لحظة');
}
/* a first visit: the wallet with the welcome gift (the precondition makes it happen once) */
async function wallet(uid) {
  let w = await getDoc('wallets/' + uid);
  if (w.exists) return w.data;
  const gift = cfg().welcome;
  const r = await commit([put('wallets/' + uid, { welcomed: true, createdAt: Date.now(), updatedAt: Date.now() }, { pre: { exists: false }, incr: gift ? { points: gift } : null })]
    .concat(gift ? [create('wallets/' + uid + '/ledger/' + Date.now() + '_welcome', { delta: gift, reason: 'welcome', note: 'هدية الترحيب', at: Date.now() })] : []));
  if (!r.ok && !r.conflict) throw coded(503, 'store', 'تعذّر إنشاء المحفظة');
  w = await getDoc('wallets/' + uid);
  return w.data || {};
}
const isPro = d => !!(d && d.proUntil > Date.now());

/* ---------------- who is asking: a Firebase ID token of an account (not a guest) ---------------- */
const JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwks = { at: 0, keys: [] };
async function publicKey(kid) {
  if (!jwks.keys.some(k => k.kid === kid) || Date.now() - jwks.at > 3600e3) { const r = await fetch(env('FIREBASE_JWKS_URL') || JWKS); jwks = { at: Date.now(), keys: (await r.json()).keys || [] }; }
  const jwk = jwks.keys.find(k => k.kid === kid);
  return jwk ? crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']) : null;
}
async function who(req) {
  const parts = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').split('.');
  if (parts.length !== 3) return null;
  let head, c;
  try { head = JSON.parse(txt(b64u(parts[0]))); c = JSON.parse(txt(b64u(parts[1]))); } catch { return null; }
  const pid = projectId(), now = Date.now() / 1000;
  if (c.aud !== pid || c.iss !== 'https://securetoken.google.com/' + pid || !c.sub || !(c.exp > now)) return null;
  const emulator = head.alg === 'none' && env('NEXUS_TEST_EMULATOR_TOKENS') === '1';
  if (!emulator) {
    if (head.alg !== 'RS256') return null;
    const key = await publicKey(head.kid).catch(() => null);
    if (!key || !(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(parts[2]), te(parts[0] + '.' + parts[1])))) return null;
  }
  if ((c.firebase && c.firebase.sign_in_provider) === 'anonymous') return null;     // points belong to accounts
  return { uid: c.sub, email: c.email || '', name: c.name || '' };
}

/* ================================================================ ADS */
/* a ticket before an ad is shown: the limits are checked first */
async function adStart(me, via) {
  const c = cfg(), d = await wallet(me.uid), now = Date.now();
  const n = d.adsDay === today() ? d.adsN || 0 : 0;
  if (n >= c.adsPerDay) throw coded(429, 'ads_daily', 'شاهدت ' + c.adsPerDay + ' إعلانًا اليوم — الحدّ اليومي. عد غدًا.');
  const wait = Math.ceil(((d.adsLast || 0) + c.adCooldown * 1000 - now) / 1000);
  if (wait > 0) throw coded(429, 'ads_cooldown', 'انتظر ' + wait + ' ثانية قبل الإعلان التالي.', { wait });
  const nonce = rid(24);
  const r = await commit([create('ad_sessions/' + nonce, { uid: me.uid, at: now, via, used: false })]);
  if (!r.ok) throw coded(503, 'store', 'تعذّر بدء الإعلان');
  return { nonce, minSeconds: c.adMinSeconds, points: c.ad, left: c.adsPerDay - n };
}
/* the reward: once per ticket (and per AdMob transaction), within the day's limit */
async function adReward(uid, nonce, via, tx) {
  const c = cfg();
  return change(uid, c.ad, 'ad', via === 'admob' ? 'إعلان بمكافأة (AdMob)' : 'إعلان بمكافأة', async d => {
    const now = Date.now();
    const s = await getDoc('ad_sessions/' + nonce);
    if (!s.exists || s.data.uid !== uid) return { error: coded(404, 'ad_ticket', 'تذكرة الإعلان غير موجودة') };
    if (s.data.used) return { error: coded(409, 'ad_used', 'هذا الإعلان احتُسب من قبل') };
    if (now - s.data.at > 3600e3) return { error: coded(410, 'ad_old', 'انتهت صلاحية تذكرة الإعلان') };
    if (via === 'web' && now - s.data.at < c.adMinSeconds * 1000) return { error: coded(425, 'ad_short', 'الإعلان لم يكتمل بعد') };
    const n = d.adsDay === today() ? d.adsN || 0 : 0;
    if (n >= c.adsPerDay) return { error: coded(429, 'ads_daily', 'وصلت الحدّ اليومي للإعلانات') };
    if ((d.adsLast || 0) + c.adCooldown * 1000 > now) return { error: coded(429, 'ads_cooldown', 'إعلانان متقاربان جدًا') };
    const writes = [put('ad_sessions/' + nonce, { used: true, usedAt: now, via }, { pre: preOf(s) })];
    if (tx) writes.push(create('ad_tx/' + tx, { uid, at: now, nonce }));
    return { fields: { adsDay: today(), adsN: n + 1, adsLast: now }, writes };
  });
}

/* AdMob Server-Side Verification: ECDSA P-256 / SHA-256 over the query up to «&signature=» */
let admobKeys = { at: 0, keys: [] };
async function admobKey(id) {
  if (!admobKeys.keys.some(k => String(k.keyId) === String(id)) || Date.now() - admobKeys.at > 12 * 3600e3) {
    const r = await fetch(env('ADMOB_KEYS_URL') || 'https://www.gstatic.com/admob/reward/verifier-keys.json');
    admobKeys = { at: Date.now(), keys: ((await r.json()) || {}).keys || [] };
  }
  const k = admobKeys.keys.find(x => String(x.keyId) === String(id));
  return k ? crypto.subtle.importKey('spki', b64u(k.base64), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']) : null;
}
function derToRaw(sig) {                       // an ECDSA DER signature → r‖s (64 bytes) for WebCrypto
  let i = 2; const out = new Uint8Array(64);
  for (let k = 0; k < 2; k++) { i++; const n = sig[i++]; let v = sig.slice(i, i + n); i += n; while (v.length > 32 && v[0] === 0) v = v.slice(1); out.set(v, k * 32 + (32 - v.length)); }
  return out;
}
async function admobSSV(url) {
  const q = url.search.slice(1), cut = q.indexOf('&signature=');
  const p = url.searchParams;
  if (cut < 0 || !p.get('key_id')) return fail(400, 'ssv', 'not a signed AdMob reward');
  const key = await admobKey(p.get('key_id')).catch(() => null);
  const ok = key && await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(b64u(p.get('signature'))), te(q.slice(0, cut))).catch(() => false);
  if (!ok) return fail(400, 'ssv_signature', 'bad signature');
  /* a real reward from Google from here on: always answer 200 so AdMob does not retry a refusal */
  const uid = p.get('user_id') || '', nonce = p.get('custom_data') || '', tx = String(p.get('transaction_id') || '').replace(/[^\w-]/g, '').slice(0, 120);
  if (!ADMOB_UNITS().includes(String(p.get('ad_unit') || '').split('/').pop())) return json(200, { ok: false, reason: 'ad_unit' });
  if (!uid || !nonce || !tx) return json(200, { ok: false, reason: 'missing' });
  if ((await getDoc('ad_tx/' + tx)).exists) return json(200, { ok: true, duplicate: true });
  try { const r = await adReward(uid, nonce, 'admob', tx); return json(200, { ok: true, points: r.points }); }
  catch (e) { return json(200, { ok: false, reason: e.code || 'error' }); }
}

/* ================================================================ PRO (Stripe) */
const form = (o, pre = '') => Object.entries(o).flatMap(([k, v]) => v != null && typeof v === 'object' ? [form(v, pre ? pre + '[' + k + ']' : k)] : v == null ? [] : [encodeURIComponent(pre ? pre + '[' + k + ']' : k) + '=' + encodeURIComponent(v)]).join('&');
async function stripeCall(path, params) {
  const r = await fetch((env('STRIPE_API_BASE') || 'https://api.stripe.com') + '/v1/' + path, { method: 'POST',
    headers: { authorization: 'Bearer ' + env('STRIPE_SECRET_KEY'), 'content-type': 'application/x-www-form-urlencoded' }, body: form(params) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw coded(502, 'stripe', 'Stripe: ' + ((j.error && j.error.message) || r.status));
  return j;
}
async function stripeSigned(req, raw) {
  const secret = env('STRIPE_WEBHOOK_SECRET');
  const h = Object.fromEntries(String(req.headers.get('stripe-signature') || '').split(',').map(x => x.split('=')).filter(x => x.length === 2).map(([k, v]) => [k.trim(), v.trim()]));
  if (!secret || !h.t || !h.v1 || Math.abs(Date.now() / 1000 - +h.t) > 300) return false;
  const k = await crypto.subtle.importKey('raw', te(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const want = hex(await crypto.subtle.sign('HMAC', k, te(h.t + '.' + raw)));
  const got = String(req.headers.get('stripe-signature')).split(',').filter(x => x.trim().startsWith('v1=')).map(x => x.trim().slice(3));
  return got.some(g => g.length === want.length && [...g].every((ch, i) => ch === want[i]));
}
async function stripeHook(req) {
  const raw = await req.text();
  if (!(await stripeSigned(req, raw))) return fail(400, 'stripe_signature', 'bad signature');
  let ev; try { ev = JSON.parse(raw); } catch { return fail(400, 'bad_request', 'bad json'); }
  const seen = await commit([create('stripe_events/' + String(ev.id).replace(/[^\w-]/g, ''), { type: ev.type, at: Date.now() })]);
  if (!seen.ok) return json(200, { received: true, duplicate: true });
  const o = (ev.data && ev.data.object) || {};
  const uidOf = async sub => (o.metadata && o.metadata.uid) || (o.subscription_details && o.subscription_details.metadata && o.subscription_details.metadata.uid)
    || (sub && (await getDoc('stripe_subs/' + sub)).data || {}).uid || null;
  if (ev.type === 'checkout.session.completed') {
    const uid = o.client_reference_id || (o.metadata && o.metadata.uid);
    if (uid && o.subscription) {
      await change(uid, 0, 'pro', '', () => ({ fields: { proStatus: 'active', proSub: String(o.subscription), proCustomer: String(o.customer || ''), proUntil: Date.now() + 32 * 864e5 },
        writes: [put('stripe_subs/' + o.subscription, { uid, customer: String(o.customer || ''), at: Date.now() })] }));
    }
  } else if (ev.type === 'invoice.paid' || ev.type === 'invoice.payment_succeeded') {
    const sub = o.subscription, uid = await uidOf(sub);
    const end = o.lines && o.lines.data && o.lines.data[0] && o.lines.data[0].period && o.lines.data[0].period.end;
    if (uid && end) await change(uid, 0, 'pro', '', () => ({ fields: { proStatus: 'active', proUntil: end * 1000 + 2 * 864e5 } }));
  } else if (ev.type === 'customer.subscription.deleted' || ev.type === 'customer.subscription.updated') {
    const uid = await uidOf(o.id);
    if (uid) await change(uid, 0, 'pro', '', d => ({ fields: ev.type === 'customer.subscription.deleted' || o.status === 'canceled'
      ? { proStatus: 'canceled', proUntil: Math.min(d.proUntil || 0, Date.now()) }
      : { proStatus: String(o.status || 'active') } }));
  }
  return json(200, { received: true });
}

/* ================================================================ FILES (direct links) */
const safeName = n => String(n || 'file').split(/[\\/]/).pop().replace(/[^\w.\-]+/g, '_').replace(/^\.+/, '').slice(-80) || 'file';
const costOf = (bytes, c) => Math.max(1, Math.ceil(bytes / (1024 * 1024))) * c.mb;
async function uploadStart(me, b) {
  const c = cfg(), name = safeName(b.name), bytes = Math.floor(+b.bytes || 0);
  if (!HOSTED.test(name)) throw coded(400, 'file_type', 'نوع غير مدعوم — المسموح: html · png · jpg · gif · webp · svg · json · js · css · zip · txt · mp3 · ogg · wav · glb · gltf');
  if (!(bytes > 0) || bytes > c.fileMaxMB * 1024 * 1024) throw coded(413, 'file_size', 'الحجم الأقصى ' + c.fileMaxMB + ' ميجابايت');
  const fileId = 'f' + rid(15), path = 'hosting/' + me.uid + '/' + fileId + '/' + name;
  const d = await wallet(me.uid);
  const cost = isPro(d) ? 0 : costOf(bytes, c);
  const r = await change(me.uid, -cost, 'upload', 'رفع ' + name, () => ({ writes: [create('hosting_tickets/' + fileId, { uid: me.uid, name, bytes, cost, path, state: 'open', at: Date.now() })] }));
  return { fileId, path, name, cost, pro: cost === 0, points: r.points };
}
const OK_URL = /^(https:\/\/firebasestorage\.googleapis\.com\/|https:\/\/(www\.)?googleapis\.com\/drive\/|https:\/\/drive\.google\.com\/|http:\/\/(127\.0\.0\.1|localhost):9199\/)/;
async function uploadDone(me, b) {
  const id = String(b.fileId || '').replace(/[^\w]/g, '');
  const t = await getDoc('hosting_tickets/' + id);
  if (!t.exists || t.data.uid !== me.uid) throw coded(404, 'ticket', 'لا توجد عملية رفع بهذا الرقم');
  if (t.data.state !== 'open') throw coded(409, 'ticket_used', 'انتهت عملية الرفع هذه');
  const url = String(b.url || '');
  if (!OK_URL.test(url)) throw coded(400, 'file_url', 'رابط الملف غير معروف');
  const bytes = Math.min(t.data.bytes, Math.floor(+b.bytes || t.data.bytes));
  const rec = { fileId: id, ownerId: me.uid, name: t.data.name, type: (/\.([a-z0-9]+)$/i.exec(t.data.name) || [, ''])[1].toLowerCase(), bytes, cost: t.data.cost, path: t.data.path, url, at: Date.now() };
  const r = await commit([put('hosting_tickets/' + id, { state: 'done' }, { pre: preOf(t) }), create('files/' + id, rec)]);
  if (!r.ok) throw coded(409, 'ticket_used', 'انتهت عملية الرفع هذه');
  return { file: rec };
}
async function uploadCancel(me, b) {
  const id = String(b.fileId || '').replace(/[^\w]/g, '');
  const t = await getDoc('hosting_tickets/' + id);
  if (!t.exists || t.data.uid !== me.uid || t.data.state !== 'open') throw coded(409, 'ticket', 'لا شيء لإلغائه');
  const r = await change(me.uid, t.data.cost, 'refund', 'أُعيدت نقاط رفع لم يكتمل', () => ({ writes: [put('hosting_tickets/' + id, { state: 'cancelled' }, { pre: preOf(t) })] }));
  return { refunded: t.data.cost, points: r.points };
}

/* ================================================================ AI requests */
async function aiBuy(me) {
  const c = cfg(), day = today();
  return change(me.uid, -c.aiPackPrice, 'ai', c.aiPack + ' طلبات ذكاء إضافية', async () => {
    const u = await getDoc('usage/' + me.uid);
    const cur = u.data && u.data.day === day ? u.data : { day, used: 0, extra: 0 };
    return { writes: [put('usage/' + me.uid, { day, used: cur.used || 0, extra: (cur.extra || 0) + c.aiPack }, { pre: preOf(u) })], result: { extra: (cur.extra || 0) + c.aiPack } };
  });
}

/* ================================================================ PLAY TIME → the creator's points */
async function play(me, b) {
  const c = cfg(), gid = String(b.gameId || '').replace(/[^\w-]/g, '');
  if (!gid) throw coded(400, 'bad_request', 'اللعبة غير محدّدة');
  const g = await getDoc('games/' + gid);
  if (!g.exists || g.data.visibility === 'private') throw coded(404, 'game', 'اللعبة غير موجودة');
  if (g.data.ownerId === me.uid) return { counted: false, why: 'own' };
  const markId = me.uid + '_' + gid + '_' + today(), now = Date.now();
  const m = await getDoc('play_marks/' + markId);
  const n = (m.data && m.data.n) || 0;
  if (n >= c.playCap) return { counted: false, why: 'cap' };
  if (m.data && now - m.data.last < c.playGap * 1000) return { counted: false, why: 'early' };   // one minute counted per minute
  const r = await commit([put('play_marks/' + markId, { n: n + 1, last: now }, { pre: preOf(m) }),
    put('playtime/' + gid, { gameId: gid, ownerId: g.data.ownerId, updatedAt: now }, { incr: { minutes: 1 } })]);
  if (!r.ok) return { counted: false, why: 'busy' };
  const total = +((r.results[1].transformResults || [])[0] || {}).integerValue || 0;
  let paid = false;
  if (total > 0 && total % c.playMinutes === 0 && c.playPoints) {
    try { await change(g.data.ownerId, c.playPoints, 'play', total + ' دقيقة لعب في «' + String(g.data.title || '').slice(0, 60) + '»'); paid = true; } catch { }
  }
  return { counted: true, minutes: total, paid };
}

/* ================================================================ the router */
const pub = c => ({ welcome: c.welcome, ad: c.ad, adsPerDay: c.adsPerDay, adCooldown: c.adCooldown, adMinSeconds: c.adMinSeconds, adsWeb: c.adsWeb,
  mb: c.mb, fileMaxMB: c.fileMaxMB, aiFree: c.aiFree, aiPack: c.aiPack, aiPackPrice: c.aiPackPrice, proAI: c.proAI,
  playMinutes: c.playMinutes, playPoints: c.playPoints, playCap: c.playCap, stripe: c.stripe, proPrice: c.proPrice });

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/api\/points/, '') || '/';
  try {
    /* server-to-server: Google (AdMob) and Stripe — signed, no browser */
    if (path === '/admob-ssv') return ready() ? await admobSSV(url) : fail(503, 'off', 'points server not configured');
    if (path === '/stripe' && req.method === 'POST') return ready() ? await stripeHook(req) : fail(503, 'off', 'points server not configured');

    const origin = req.headers.get('origin');
    if (origin && origin !== url.origin) return fail(403, 'origin', 'غير مسموح');
    const c = cfg();
    if (path === '/config') return json(200, { ok: true, ready: ready(), ...pub(c) });
    if (!ready()) return fail(503, 'off', 'نظام النقاط يحتاج FIREBASE_SERVICE_ACCOUNT في إعدادات Netlify.', { ready: false });
    const me = await who(req);
    if (!me) return fail(401, 'signin', 'النقاط لأصحاب الحسابات — سجّل الدخول (Google أو البريد).');
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

    if (path === '/me' && req.method === 'GET') {
      const d = await wallet(me.uid), u = (await getDoc('usage/' + me.uid)).data;
      const day = today(), ads = d.adsDay === day ? d.adsN || 0 : 0, used = u && u.day === day ? u.used || 0 : 0, extra = u && u.day === day ? u.extra || 0 : 0;
      return json(200, { ok: true, ready: true, points: d.points || 0, ...pub(c),
        ads: { today: ads, left: Math.max(0, c.adsPerDay - ads), wait: Math.max(0, Math.ceil(((d.adsLast || 0) + c.adCooldown * 1000 - Date.now()) / 1000)) },
        ai: { used, limit: isPro(d) ? c.proAI : c.aiFree + extra, extra },
        pro: { active: isPro(d), until: d.proUntil || 0, status: d.proStatus || null, manage: !!d.proCustomer } });
    }
    if (path === '/ad/start' && req.method === 'POST') return json(200, { ok: true, ...(await adStart(me, body.via === 'admob' ? 'admob' : 'web')) });
    if (path === '/ad/claim' && req.method === 'POST') {
      if (!c.adsWeb) return fail(403, 'ads_web_off', 'إعلانات المتصفح غير مفعّلة على هذا الموقع (ADS_WEB).');
      const r = await adReward(me.uid, String(body.nonce || '').replace(/[^\w]/g, ''), 'web', null);
      return json(200, { ok: true, points: r.points, added: c.ad });
    }
    if (path === '/ai/buy' && req.method === 'POST') { const r = await aiBuy(me); return json(200, { ok: true, points: r.points, extra: r.result.extra }); }
    if (path === '/upload/start' && req.method === 'POST') return json(200, { ok: true, ...(await uploadStart(me, body)) });
    if (path === '/upload/done' && req.method === 'POST') return json(200, { ok: true, ...(await uploadDone(me, body)) });
    if (path === '/upload/cancel' && req.method === 'POST') return json(200, { ok: true, ...(await uploadCancel(me, body)) });
    if (path === '/play' && req.method === 'POST') return json(200, { ok: true, ...(await play(me, body)) });
    if (path === '/pro/checkout' && req.method === 'POST') {
      if (!c.stripe) return fail(503, 'pro_off', 'اشتراك Pro غير مفعّل بعد على هذا الموقع (Stripe).');
      const d = await wallet(me.uid);
      if (isPro(d)) return fail(409, 'pro_already', 'حسابك Pro بالفعل');
      const s = await stripeCall('checkout/sessions', { mode: 'subscription', line_items: { 0: { price: env('STRIPE_PRICE_ID'), quantity: 1 } },
        client_reference_id: me.uid, metadata: { uid: me.uid }, subscription_data: { metadata: { uid: me.uid } }, customer_email: me.email || null,
        success_url: url.origin + '/#wallet', cancel_url: url.origin + '/#wallet' });
      return json(200, { ok: true, url: s.url });
    }
    if (path === '/pro/portal' && req.method === 'POST') {
      const d = await wallet(me.uid);
      if (!c.stripe || !d.proCustomer) return fail(404, 'pro_none', 'لا يوجد اشتراك لإدارته');
      const s = await stripeCall('billing_portal/sessions', { customer: d.proCustomer, return_url: url.origin + '/#wallet' });
      return json(200, { ok: true, url: s.url });
    }
    return fail(404, 'not_found', 'غير موجود');
  } catch (e) {
    if (e && e.status) return fail(e.status, e.code, e.message, e.extra || {});
    console.error('[points]', e);
    return fail(500, 'error', 'خطأ في الخادم');
  }
};

export const config = { path: '/api/points/*' };
