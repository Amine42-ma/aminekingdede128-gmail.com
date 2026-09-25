/* ============================================================
   NEXUS — optional sign-in with a passkey (WebAuthn).
   Firebase Authentication has no passkeys of its own, so this
   function does the WebAuthn part and then hands the browser a
   Firebase custom token for the same account.
   It needs ONE secret, set by the site owner in
   Netlify → Site configuration → Environment variables:
     FIREBASE_SERVICE_ACCOUNT = the JSON key of a service account of
       the Firebase project (Project settings → Service accounts →
       Generate new private key) — paste the whole JSON
   optional: FIREBASE_PROJECT_ID (else the service account's),
             PASSKEY_RP_ID (else this site's host name)
   Without it /api/passkey/status answers {configured:false} and the
   page does not offer passkeys; the other sign-in methods are
   untouched. The service account never leaves this server.
   Passkeys are stored in Firestore «passkeys/<credential id>», which
   the security rules close to every browser.
   ============================================================ */
const env = k => { try { return (globalThis.Netlify && Netlify.env.get(k)) || ''; } catch { return ''; } };
const te = s => new TextEncoder().encode(s);
const txt = b => new TextDecoder().decode(b);
const b64u = s => { s = String(s || '').replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const u64 = b => { let s = ''; const u = b instanceof Uint8Array ? b : new Uint8Array(b); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const sha256 = async b => new Uint8Array(await crypto.subtle.digest('SHA-256', b));
const eqBytes = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const fail = (status, code, message) => json(status, { error: { code, message } });

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
const projectId = () => env('FIREBASE_PROJECT_ID') || (sa() || {}).project_id || '';

/* ---------------- the service account: RS256 signatures ---------------- */
let saKey = null;
async function signingKey() {
  if (saKey) return saKey;
  const pem = sa().private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  saKey = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  return saKey;
}
async function signJWT(payload) {
  const head = u64(te(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: sa().private_key_id })));
  const body = u64(te(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await signingKey(), te(head + '.' + body)));
  return head + '.' + body + '.' + u64(sig);
}

/* ---------------- Firestore with admin access (REST) ---------------- */
let access = { v: '', exp: 0 };
async function accessToken() {
  if (env('FIRESTORE_EMULATOR_HOST')) return 'owner';
  if (access.exp > Date.now() + 60e3) return access.v;
  const now = Math.floor(Date.now() / 1000), s = sa();
  const assertion = await signJWT({ iss: s.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + assertion });
  const j = await r.json();
  if (!j.access_token) throw new Error('service account refused');
  access = { v: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return access.v;
}
const docsURL = () => (env('FIRESTORE_EMULATOR_HOST') ? 'http://' + env('FIRESTORE_EMULATOR_HOST') : 'https://firestore.googleapis.com') + '/v1/projects/' + projectId() + '/databases/(default)/documents';
const toFs = v => v === null || v === undefined ? { nullValue: null } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : typeof v === 'string' ? { stringValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(toFs) } } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFs(x)])) } };
const fromFs = f => 'nullValue' in f ? null : 'booleanValue' in f ? f.booleanValue : 'integerValue' in f ? +f.integerValue : 'doubleValue' in f ? f.doubleValue : 'stringValue' in f ? f.stringValue
  : 'arrayValue' in f ? (f.arrayValue.values || []).map(fromFs) : 'mapValue' in f ? Object.fromEntries(Object.entries(f.mapValue.fields || {}).map(([k, x]) => [k, fromFs(x)])) : null;
async function fsGet(id) {
  const r = await fetch(docsURL() + '/passkeys/' + encodeURIComponent(id), { headers: { authorization: 'Bearer ' + await accessToken() } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('firestore ' + r.status);
  return fromFs({ mapValue: { fields: (await r.json()).fields || {} } });
}
async function fsSet(id, obj) {
  const r = await fetch(docsURL() + '/passkeys/' + encodeURIComponent(id), { method: 'PATCH', headers: { authorization: 'Bearer ' + await accessToken(), 'content-type': 'application/json' },
    body: JSON.stringify({ fields: toFs(obj).mapValue.fields }) });
  if (!r.ok) throw new Error('firestore ' + r.status);
}
async function fsDelete(id) { await fetch(docsURL() + '/passkeys/' + encodeURIComponent(id), { method: 'DELETE', headers: { authorization: 'Bearer ' + await accessToken() } }); }
async function fsByUid(uid) {
  const r = await fetch(docsURL() + ':runQuery', { method: 'POST', headers: { authorization: 'Bearer ' + await accessToken(), 'content-type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'passkeys' }], where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: { stringValue: uid } } }, limit: 20 } }) });
  if (!r.ok) throw new Error('firestore ' + r.status);
  return (await r.json()).filter(x => x.document).map(x => Object.assign({ id: decodeURIComponent(x.document.name.split('/').pop()) }, fromFs({ mapValue: { fields: x.document.fields || {} } })));
}

/* ---------------- who is asking (Firebase ID token, as /api/ai) ---------------- */
const JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwks = { at: 0, keys: [] };
async function publicKey(kid) {
  if (!jwks.keys.some(k => k.kid === kid) || Date.now() - jwks.at > 3600e3) { const r = await fetch(env('FIREBASE_JWKS_URL') || JWKS); jwks = { at: Date.now(), keys: (await r.json()).keys || [] }; }
  const jwk = jwks.keys.find(k => k.kid === kid);
  return jwk ? crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']) : null;
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
  if ((c.firebase && c.firebase.sign_in_provider) === 'anonymous') return null;   // a passkey belongs to a real account
  return { uid: c.sub, name: c.name || c.email || 'NEXUS' };
}

/* ---------------- challenges: random, signed, 5 minutes, one purpose ---------------- */
let hkey = null;
async function hmacKey() { return hkey || (hkey = await crypto.subtle.importKey('raw', await sha256(te(sa().private_key + '|nexus-passkey-challenge')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])); }
async function issue(purpose, uid) {
  const c = u64(crypto.getRandomValues(new Uint8Array(32)));
  const body = u64(te(JSON.stringify({ c, p: purpose, u: uid || null, e: Date.now() + 5 * 60e3 })));
  return { challenge: c, token: body + '.' + u64(new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(), te(body)))) };
}
async function check(token, purpose) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig || !(await crypto.subtle.verify('HMAC', await hmacKey(), b64u(sig), te(body)))) throw new Error('challenge');
  const d = JSON.parse(txt(b64u(body)));
  if (d.p !== purpose || !(d.e > Date.now())) throw new Error('challenge expired');
  return d;
}

/* ---------------- WebAuthn: a small CBOR reader, authenticator data, COSE keys ---------------- */
function cbor(bytes) {
  let i = 0;
  const u = n => { let v = 0; for (let k = 0; k < n; k++) v = v * 256 + bytes[i++]; return v; };
  const len = ai => ai < 24 ? ai : ai === 24 ? u(1) : ai === 25 ? u(2) : ai === 26 ? u(4) : ai === 27 ? u(8) : NaN;
  const item = () => {
    const b = bytes[i++], mt = b >> 5, ai = b & 31;
    if (mt === 7) return ai === 20 ? false : ai === 21 ? true : ai === 22 ? null : undefined;
    const n = len(ai);
    if (mt === 0) return n;
    if (mt === 1) return -1 - n;
    if (mt === 2) { const v = bytes.slice(i, i + n); i += n; return v; }
    if (mt === 3) { const v = txt(bytes.slice(i, i + n)); i += n; return v; }
    if (mt === 4) { const a = []; for (let k = 0; k < n; k++) a.push(item()); return a; }
    if (mt === 5) { const m = new Map(); for (let k = 0; k < n; k++) { const key = item(); m.set(key, item()); } return m; }
    if (mt === 6) return item();
    throw new Error('cbor');
  };
  const v = item();
  return { value: v, used: i };
}
function authData(b) {
  const out = { rpIdHash: b.slice(0, 32), flags: b[32], signCount: ((b[33] << 24) >>> 0) + (b[34] << 16) + (b[35] << 8) + b[36] };
  if (out.flags & 0x40) {
    const n = (b[53] << 8) + b[54];
    out.credId = b.slice(55, 55 + n);
    const rest = b.slice(55 + n);
    out.cose = cbor(rest).value;
  }
  return out;
}
function coseToJwk(m) {
  const kty = m.get(1), alg = m.get(3);
  if (kty === 2 && alg === -7 && m.get(-1) === 1) return { alg: -7, jwk: { kty: 'EC', crv: 'P-256', x: u64(m.get(-2)), y: u64(m.get(-3)) } };
  if (kty === 3 && alg === -257) return { alg: -257, jwk: { kty: 'RSA', n: u64(m.get(-1)), e: u64(m.get(-2)) } };
  if (kty === 1 && alg === -8 && m.get(-1) === 6) return { alg: -8, jwk: { kty: 'OKP', crv: 'Ed25519', x: u64(m.get(-2)) } };
  throw new Error('unsupported key type');
}
/* ES256 signatures come DER-encoded; WebCrypto wants r || s */
function derToRaw(sig) {
  let i = 2; const out = new Uint8Array(64);
  for (let k = 0; k < 2; k++) {
    i++; let n = sig[i++]; let v = sig.slice(i, i + n); i += n;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);
    out.set(v, k * 32 + (32 - v.length));
  }
  return out;
}
async function verifySig(stored, data, sig) {
  if (stored.alg === -7) {
    const k = await crypto.subtle.importKey('jwk', stored.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, derToRaw(sig), data);
  }
  if (stored.alg === -257) {
    const k = await crypto.subtle.importKey('jwk', Object.assign({ alg: 'RS256' }, stored.jwk), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return crypto.subtle.verify('RSASSA-PKCS1-v1_5', k, sig, data);
  }
  if (stored.alg === -8) {
    const k = await crypto.subtle.importKey('jwk', stored.jwk, { name: 'Ed25519' }, false, ['verify']);
    return crypto.subtle.verify('Ed25519', k, sig, data);
  }
  return false;
}
function clientData(b64, type, challenge, origin) {
  const c = JSON.parse(txt(b64u(b64)));
  if (c.type !== type) throw new Error('type');
  if (c.challenge !== challenge) throw new Error('challenge mismatch');
  if (c.origin !== origin) throw new Error('origin');
  return c;
}

/* ---------------- routes ---------------- */
export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/api\/passkey/, '') || '/';
  const origin = req.headers.get('origin');
  if (origin && origin !== url.origin) return fail(403, 'origin', 'غير مسموح');
  const configured = !!(sa() && projectId());
  if (req.method === 'GET' && path === '/status') return json(200, { configured });
  if (!configured) return fail(503, 'not_configured', 'الدخول بمفتاح المرور غير مفعّل على هذا الموقع (يحتاج FIREBASE_SERVICE_ACCOUNT في إعدادات Netlify).');
  const rpId = env('PASSKEY_RP_ID') || url.hostname;
  let body = {};
  if (req.method === 'POST') { try { const t = await req.text(); body = t ? JSON.parse(t) : {}; } catch { return fail(400, 'bad_request', 'طلب غير صالح'); } }
  try {
    if (req.method === 'POST' && path === '/register/options') {
      const me = await who(req);
      if (!me) return fail(401, 'signin', 'سجّل الدخول بحسابك أولًا (Google أو البريد)');
      const mine = await fsByUid(me.uid);
      const { challenge, token } = await issue('reg', me.uid);
      return json(200, { token, publicKey: {
        challenge, rp: { name: 'NEXUS', id: rpId },
        user: { id: u64(te(me.uid)), name: String(me.name).slice(0, 64), displayName: String(me.name).slice(0, 64) },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }, { type: 'public-key', alg: -8 }],
        authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'preferred' },
        attestation: 'none', timeout: 60000,
        excludeCredentials: mine.map(x => ({ type: 'public-key', id: x.id }))
      } });
    }
    if (req.method === 'POST' && path === '/register/verify') {
      const me = await who(req);
      if (!me) return fail(401, 'signin', 'سجّل الدخول أولًا');
      const ch = await check(body.token, 'reg');
      if (ch.u !== me.uid) return fail(403, 'challenge', 'التحدي لحساب آخر');
      const r = body.response || {};
      clientData(r.clientDataJSON, 'webauthn.create', ch.c, url.origin);
      const att = cbor(b64u(r.attestationObject)).value;
      const ad = authData(att.get('authData'));
      if (!eqBytes(ad.rpIdHash, await sha256(te(rpId)))) return fail(400, 'rp', 'النطاق لا يطابق');
      if (!(ad.flags & 0x01)) return fail(400, 'presence', 'لم يؤكّد المستخدم');
      if (!ad.credId || u64(ad.credId) !== body.id) return fail(400, 'credential', 'معرّف المفتاح لا يطابق');
      const key = coseToJwk(ad.cose);
      if (await fsGet(body.id)) return fail(409, 'exists', 'هذا المفتاح مسجّل بالفعل');
      await fsSet(body.id, { uid: me.uid, alg: key.alg, jwk: key.jwk, signCount: ad.signCount, name: String(body.name || 'Passkey').slice(0, 40), createdAt: Date.now(), lastUsed: null, lastChallenge: '' });
      return json(200, { ok: true });
    }
    if (req.method === 'POST' && path === '/login/options') {
      const { challenge, token } = await issue('login', null);
      return json(200, { token, publicKey: { challenge, rpId, userVerification: 'preferred', timeout: 60000, allowCredentials: [] } });
    }
    if (req.method === 'POST' && path === '/login/verify') {
      const ch = await check(body.token, 'login');
      const r = body.response || {};
      const cred = body.id ? await fsGet(String(body.id)) : null;
      if (!cred) return fail(401, 'unknown', 'هذا المفتاح غير مسجّل في NEXUS');
      if (cred.lastChallenge === ch.c) return fail(401, 'replay', 'طلب مكرّر');
      clientData(r.clientDataJSON, 'webauthn.get', ch.c, url.origin);
      const adBytes = b64u(r.authenticatorData);
      const ad = authData(adBytes);
      if (!eqBytes(ad.rpIdHash, await sha256(te(rpId)))) return fail(401, 'rp', 'النطاق لا يطابق');
      if (!(ad.flags & 0x01)) return fail(401, 'presence', 'لم يؤكّد المستخدم');
      if (r.userHandle && txt(b64u(r.userHandle)) !== cred.uid) return fail(401, 'user', 'المفتاح لحساب آخر');
      const signed = new Uint8Array(adBytes.length + 32);
      signed.set(adBytes, 0); signed.set(await sha256(b64u(r.clientDataJSON)), adBytes.length);
      if (!(await verifySig(cred, signed, b64u(r.signature)))) return fail(401, 'signature', 'التوقيع غير صحيح');
      if (cred.signCount > 0 && ad.signCount > 0 && ad.signCount <= cred.signCount) return fail(401, 'cloned', 'عدّاد المفتاح غير متوقّع — قد يكون منسوخًا');
      await fsSet(String(body.id), Object.assign({}, cred, { signCount: ad.signCount, lastUsed: Date.now(), lastChallenge: ch.c }));
      const now = Math.floor(Date.now() / 1000), s = sa();
      const token = await signJWT({ iss: s.client_email, sub: s.client_email, aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit', iat: now, exp: now + 3600, uid: cred.uid });
      return json(200, { token });
    }
    if (req.method === 'POST' && path === '/list') {
      const me = await who(req);
      if (!me) return fail(401, 'signin', 'سجّل الدخول أولًا');
      return json(200, { items: (await fsByUid(me.uid)).map(x => ({ id: x.id, name: x.name, createdAt: x.createdAt, lastUsed: x.lastUsed })) });
    }
    if (req.method === 'POST' && path === '/delete') {
      const me = await who(req);
      if (!me) return fail(401, 'signin', 'سجّل الدخول أولًا');
      const cred = await fsGet(String(body.id || ''));
      if (!cred || cred.uid !== me.uid) return fail(404, 'not_found', 'غير موجود');
      await fsDelete(String(body.id));
      return json(200, { ok: true });
    }
  } catch (e) {
    return fail(400, 'passkey', 'تعذّر: ' + String((e && e.message) || e).slice(0, 120));
  }
  return fail(404, 'not_found', 'غير موجود');
};

export const config = { path: '/api/passkey/*' };
