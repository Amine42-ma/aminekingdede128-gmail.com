/* ============================================================
   NEXUS — points (PART 34): the site's own currency, kept on the SERVER.
   A browser can read its balance and history (firestore.rules) but can
   never write them: every change is made here with the service account,
   in one Firestore commit together with the reason for it.

   Earn:  a rewarded ad watched to the end        +POINTS_PER_AD (5)
          the welcome gift (once per account)       +POINTS_WELCOME (50)
          🔥 the daily login streak · 🎡 the lucky spin · 🎁 inviting a friend (REWARDS below)
          — 👑 VIP doubles these (VIP_MULTIPLIER); sales and tips are never multiplied
          (play time is timed by THIS server's clock — PLAY TIME below — and earns no points by itself)
   Spend: a hosted file                             POINTS_PER_MB (10) per MB
          10 more AI requests today                 AI_PACK_POINTS (10)
   Pro ($20 / month through Stripe): hosted files free, 150 AI requests a day.
   💳 Top-up and withdrawal (PART 43): a point is a token priced BASE_TOKEN_PRICE_USD (0.01 → 100 = $1) —
   bought for any amount through Stripe; EARNED tokens may be withdrawn when the site's owner turns it on.
   Every amount is exact: integers of millionths of a token, whole cents — never a float (EXACT AMOUNTS below).

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
     top-up and withdrawal: BASE_TOKEN_PRICE_USD · TOPUP_* · WITHDRAW_* (see TOP-UP AND WITHDRAWAL)
   ============================================================ */
import { aiOwner } from './ai.js';
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
const today = () => new Date(Date.now()).toISOString().slice(0, 10);          // the day the limits count (UTC)

/* ---------------- EXACT AMOUNTS: fixed point, never a float ----------------
   A balance is an integer of millionths of a token (wallets/<uid>.micro: 0.25 → 250000; .points = micro / 1e6 is
   only for reading). Dollars are whole cents; the price is micro-dollars per token (0.01 → 10000). The sums are
   integer (BigInt):  tokens = dollars ÷ price  ·  dollars = tokens × price  — the page (PART 43) does the very same
   ones to show them, the server does them again and only its result counts. The side a person typed is exact; the
   other is rounded to its unit (one cent, one millionth) — by less than that unit, never to the person's gain:
   a top-up's dollars UP and its tokens DOWN, a withdrawal's dollars DOWN and its tokens UP. */
const MICRO = 1000000, PER_CENT = 10000000000n;           // micro-tokens × micro-dollars in one cent (1e6 × 1e4)
const DIGITS = /[\u0660-\u0669\u06F0-\u06F9\u0966-\u096F]/g;     // ٠-٩ · ۰-۹ · ०-९ → 0-9
/* what a person wrote ("12.5", "٠٫٢٥", "1,000.75", "0,5") → an exact integer of 10^-places, or null */
function fixed(s, places) {
  let t = String(s == null ? '' : s).trim().replace(DIGITS, c => { const n = c.charCodeAt(0); return String(n - (n >= 0x966 ? 0x966 : n >= 0x6F0 ? 0x6F0 : 0x660)); })
    .replace(/٫/g, '.').replace(/[\s٬_'’]/g, '');
  if (t.includes('.')) t = t.replace(/,/g, ''); else if ((t.match(/,/g) || []).length === 1) t = t.replace(',', '.');
  const m = /^(\d{0,9})(?:\.(\d*))?$/.exec(t);
  if (!m || !(m[1] || m[2]) || (m[2] || '').length > places) return null;
  return Number(BigInt(m[1] || '0') * 10n ** BigInt(places) + BigInt(((m[2] || '') + '0'.repeat(places)).slice(0, places)));
}
/* 12500000, 6 → "12.5" · 151, 2, true → "1.51" (keep: the zeros after the point stay) */
function fmtFixed(n, places, keep) {
  const s = String(Math.abs(Math.round(n))).padStart(places + 1, '0');
  let f = s.slice(s.length - places);
  if (!keep) f = f.replace(/0+$/, '');
  return (n < 0 ? '-' : '') + s.slice(0, s.length - places) + (f ? '.' + f : '');
}
const divUp = (a, b) => (a + b - 1n) / b;
const toMicro = (cents, price, up) => Number(up ? divUp(BigInt(cents) * PER_CENT, BigInt(price)) : BigInt(cents) * PER_CENT / BigInt(price));
const toCents = (micro, price, up) => Number(up ? divUp(BigInt(micro) * BigInt(price), PER_CENT) : BigInt(micro) * BigInt(price) / PER_CENT);
/* what was typed (anchor 'usd' or 'tokens') → both sides, for a top-up ('topup') or a withdrawal ('withdraw') */
function quote(kind, anchor, amount, price) {
  const topup = kind === 'topup';
  if (anchor === 'usd') {
    const cents = fixed(amount, 2);
    if (cents == null) throw coded(400, 'amount_usd', 'اكتب المبلغ بالدولار — حتى منزلتين بعد الفاصلة (سنت).');
    return { anchor, cents, micro: toMicro(cents, price, !topup) };
  }
  const micro = fixed(amount, 6);
  if (micro == null) throw coded(400, 'amount_tokens', 'اكتب عدد التوكن — حتى 6 منازل بعد الفاصلة.');
  return { anchor: 'tokens', micro, cents: toCents(micro, price, topup) };
}
/* a balance in millionths. The server always writes both (micro, and points = micro / 1e6 — a double that gives
   micro back exactly); a wallet from before has points only, and points changed by hand (the Firebase console)
   no longer matches micro — either way points × 1e6 is the balance */
const microOf = d => { const m = Math.round(((d && d.points) || 0) * MICRO); return d && Number.isInteger(d.micro) && d.micro === m ? d.micro : m; };

/* ---------------- the numbers (one place; each can be changed in Netlify) ---------------- */
const num = (k, d) => { const v = env(k); return v !== '' && Number.isFinite(+v) ? +v : d; };
const cfg = () => ({
  welcome: num('POINTS_WELCOME', 50),
  ad: num('POINTS_PER_AD', 5), adsPerDay: num('ADS_PER_DAY', 15), adCooldown: num('ADS_COOLDOWN_SECONDS', 60), adMinSeconds: num('ADS_MIN_SECONDS', 15),
  adsWeb: env('ADS_WEB') === '1',
  mb: num('POINTS_PER_MB', 10), fileMaxMB: num('FILE_MAX_MB', 25),
  aiFree: num('AI_FREE_PER_DAY', 20), aiPack: num('AI_PACK_REQUESTS', 10), aiPackPrice: num('AI_PACK_POINTS', 10), proAI: num('PRO_AI_PER_DAY', 150),
  stripe: !!(env('STRIPE_SECRET_KEY') && env('STRIPE_PRICE_ID')), proPrice: env('PRO_PRICE_LABEL') || '20$'
});
/* ---------------- the economy (Play Rewards, the marketplace): Netlify variables → what the site's owner set
   inside NEXUS (economy/config — written only by the server after checking the owner, market.js) → bounds.
   Never a number a page sends. ---------------- */
const ECON = {
  heartbeatSeconds:    [['PLAY_HEARTBEAT_SECONDS'], 60, 15, 600],             // a page says «still playing» this often
  sessionMaxMinutes:   [['PLAY_SESSION_MAX_MINUTES'], 240, 10, 1440],         // one session counts at most this long
  marketOn:            [['MARKET_ENABLED'], 1, 0, 1],
  minPrice:            [['MARKET_MIN_PRICE'], 10, 1, 1000000],
  maxPrice:            [['MARKET_MAX_PRICE'], 100000, 1, 10000000],
  feePercent:          [['MARKET_FEE_PERCENT'], 15, 0, 90],                   // the site's commission on every sale; the seller gets the rest
  buyerMinAgeHours:    [['MARKET_MIN_BUYER_AGE_HOURS'], 0, 0, 720],
  /* 💳 the token's price — ONE number, in dollars (0.01), kept as micro-dollars (10000) — and the top-up / withdrawal
     limits in dollars, kept as cents: the 5th number is that scale (what a person writes × scale = what is kept) */
  tokenPriceMicro:     [['BASE_TOKEN_PRICE_USD'], 10000, 1, 1e9, 1e6],
  topupOn:             [['TOPUP_ENABLED'], 1, 0, 1],
  topupMinCents:       [['TOPUP_MIN_USD'], 100, 50, 1e7, 100],          // Stripe takes no less than $0.50
  topupMaxCents:       [['TOPUP_MAX_USD'], 50000, 50, 1e7, 100],
  withdrawOn:          [['WITHDRAW_ENABLED'], 0, 0, 1],                 // off until the site's owner turns it on
  withdrawMinCents:    [['WITHDRAW_MIN_USD'], 500, 1, 1e7, 100],
  withdrawMaxCents:    [['WITHDRAW_MAX_USD'], 50000, 1, 1e7, 100],      // one request
  withdrawMinAgeDays:  [['WITHDRAW_MIN_ACCOUNT_DAYS'], 7, 0, 365],
  /* 🔥 streak · 🎡 spin · 🎁 invites · 👑 VIP · 💝 tips (the lists — STREAK_REWARDS, SPIN_PRIZES — below) */
  streakOn:            [['STREAK_ENABLED'], 1, 0, 1],
  spinOn:              [['SPIN_ENABLED'], 1, 0, 1],
  spinFreePerDay:      [['SPIN_FREE_PER_DAY'], 1, 0, 10],
  spinAdsPerDay:       [['SPIN_ADS_PER_DAY'], 3, 0, 20],                    // more spins, each after a rewarded ad
  referralOn:          [['REFERRAL_ENABLED'], 1, 0, 1],
  referralPoints:      [['REFERRAL_POINTS'], 100, 0, 100000],               // to the one who invited
  referralFriendPoints:[['REFERRAL_FRIEND_POINTS'], 50, 0, 100000],         // to the friend who came
  referralPlayMinutes: [['REFERRAL_PLAY_MINUTES'], 30, 1, 1440],            // the friend's real play before either is paid
  referralJoinHours:   [['REFERRAL_JOIN_HOURS'], 72, 1, 720],               // a link counts for an account this new
  referralPerDay:      [['REFERRAL_MAX_PER_DAY'], 20, 0, 1000],             // paid invitations a day, per person
  vipOn:               [['VIP_ENABLED'], 1, 0, 1],
  vipMultiplier:       [['VIP_MULTIPLIER'], 2, 1, 10],
  vipPriceCents:       [['VIP_PRICE_USD'], 499, 50, 100000, 100],          // a month through Stripe
  vipTokens:           [['VIP_TOKENS_30D'], 499, 0, 10000000],             // 30 days paid with tokens (0: not offered)
  tipMin:              [['TIP_MIN'], 1, 1, 1000000],
  tipMax:              [['TIP_MAX'], 10000, 1, 10000000],
  tipFeePercent:       [['TIP_FEE_PERCENT'], 0, 0, 90]
};
const STREAK_DEFAULT = '5,10,15,20,25,30,50';                               // day 1 … day 7 (and every day after)
const SPIN_DEFAULT = '1:30,2:25,5:20,10:12,20:8,50:4,100:1';                // points : weight
const ECON_PRESETS = '100,500,1000,5000';
let econCache = { at: 0, v: null };
async function econ(force) {
  if (!force && econCache.v && Date.now() - econCache.at < 30e3) return econCache.v;
  let over = {};
  if (ready()) { try { const d = await getDoc('economy/config'); if (d.exists) over = d.data || {}; } catch { } }
  const v = {};
  for (const [k, [names, def, lo, hi, scale = 1]] of Object.entries(ECON)) {
    let x = def;
    for (const n of names) { const e = env(n); if (e !== '' && Number.isFinite(+e)) { x = +e * scale; break; } }
    if (over[k] != null && Number.isFinite(+over[k])) x = +over[k];
    v[k] = Math.min(hi, Math.max(lo, Math.round(x)));
  }
  if (v.maxPrice < v.minPrice) v.maxPrice = v.minPrice;
  if (v.topupMaxCents < v.topupMinCents) v.topupMaxCents = v.topupMinCents;
  if (v.withdrawMaxCents < v.withdrawMinCents) v.withdrawMaxCents = v.withdrawMinCents;
  const pre = Array.isArray(over.pricePresets) ? over.pricePresets : (env('MARKET_PRICE_PRESETS') || ECON_PRESETS).split(/[\s,;]+/);
  v.pricePresets = pre.map(Number).filter(n => Number.isInteger(n) && n >= v.minPrice && n <= v.maxPrice).slice(0, 8);
  /* the streak's points day by day, and the wheel's prizes with their weights */
  const sr = Array.isArray(over.streakRewards) ? over.streakRewards : (env('STREAK_REWARDS') || STREAK_DEFAULT).split(/[\s,;]+/);
  v.streakRewards = sr.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 1000000).slice(0, 14);
  if (!v.streakRewards.length) v.streakRewards = STREAK_DEFAULT.split(',').map(Number);
  const sp = Array.isArray(over.spinPrizes) ? over.spinPrizes : (env('SPIN_PRIZES') || SPIN_DEFAULT).split(/[\s,;]+/);
  v.spinPrizes = sp.map(x => String(x).split(':').map(Number)).filter(([p, w]) => Number.isInteger(p) && p >= 0 && p <= 1000000 && Number.isInteger(w) && w > 0 && w <= 1000000)
    .map(([p, w]) => ({ points: p, weight: w })).slice(0, 12);
  if (v.spinPrizes.length < 2) v.spinPrizes = SPIN_DEFAULT.split(',').map(x => x.split(':').map(Number)).map(([p, w]) => ({ points: p, weight: w }));
  v.updatedAt = over.updatedAt || 0;
  econCache = { at: Date.now(), v };
  return v;
}
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
/* mask: only these fields (a big document — a project, a game — read for two of its fields) */
async function getDoc(path, mask) {
  const q = mask && mask.length ? '?' + mask.map(f => 'mask.fieldPaths=' + encodeURIComponent(f)).join('&') : '';
  const r = await fetch(base() + '/' + path + q, { headers: { authorization: 'Bearer ' + await accessToken() } });
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
async function runQuery(q, parent) {
  const r = await fetch(base() + (parent ? '/' + parent : '') + ':runQuery', { method: 'POST', headers: { authorization: 'Bearer ' + await accessToken(), 'content-type': 'application/json' }, body: JSON.stringify({ structuredQuery: q }) });
  if (!r.ok) throw coded(503, 'store', 'قاعدة البيانات لا تجيب (' + r.status + ')');
  return (await r.json()).filter(x => x.document).map(x => Object.assign({ id: x.document.name.split('/').pop() }, fromFs({ mapValue: { fields: x.document.fields || {} } })));
}

/* ---------------- the wallet: every change in one commit with its reason ----------------
   plan(wallet) may refuse ({ error }), change fields, and add writes of its own
   (a used ad ticket, an upload ticket …) — all land together or none does. */
/* the amount: points (whole or not) as the callers give it — or exact millionths from a plan (p.micro).
   The balance is written whole (micro, points) — never added to blindly: the precondition (the wallet as it was
   read) makes two changes at once wait for each other, and none is lost. */
async function change(uid, delta, reason, note, plan) {
  for (let i = 0; i < 5; i++) {
    const w = await getDoc('wallets/' + uid);
    if (!w.exists) { await wallet(uid); continue; }       // a first change: the wallet (and its welcome gift) first
    const d = w.data || {};
    const p = plan ? await plan(d, w) : {};
    if (p.error) throw p.error;
    const dm = p.micro != null ? p.micro : Math.round((p.delta != null ? p.delta : delta) * MICRO), have = microOf(d), now = Date.now();
    if (dm < 0 && have + dm < 0) throw coded(402, 'not_enough', 'رصيدك ' + fmtFixed(have, 6) + ' نقطة — تحتاج ' + fmtFixed(-dm, 6) + '.', { points: have / MICRO, need: -dm / MICRO });
    const f = Object.assign({ updatedAt: now }, dm ? walletAfter(d, await earnedOf(uid, d), dm, reason) : {}, p.fields || {});
    const writes = [put('wallets/' + uid, f, { pre: preOf(w) })];
    if (dm) writes.push(create('wallets/' + uid + '/ledger/' + now + '_' + rid(6), Object.assign({ delta: dm / MICRO, micro: dm, reason, note: String(p.note || note || '').slice(0, 120), at: now }, p.tx ? { tx: p.tx } : {})));
    (p.writes || []).forEach(x => writes.push(x));
    const r = await commit(writes);
    if (r.ok) return { points: (have + dm) / MICRO, micro: have + dm, wallet: Object.assign({}, d, f), delta: dm / MICRO, result: p.result };
    if (!r.conflict) throw coded(503, 'store', 'تعذّر الحفظ (' + r.status + ')');
  }
  throw coded(409, 'busy', 'حاول مرة أخرى بعد لحظة');
}
/* EARNED tokens — the part of a balance that may be withdrawn: sales (projects, files & code), tips received,
   challenge prizes (and Play Rewards from before they were removed); never the welcome gift, ads, streak, spins,
   invitations, refunds nor tokens bought. Spending takes the rest first (earned = at most
   the balance); a withdrawal takes from it; a withdrawal refused or cancelled gives it back. */
const EARNED = ['market_sale', 'play', 'challenge', 'tip_received'];
async function earnedOf(uid, d) {
  if (d && Number.isInteger(d.earnMicro)) return d.earnMicro;
  /* a wallet from before: what its ledger says it earned (once — the next change keeps it in the wallet) */
  let sum = 0;
  try {
    const rows = await runQuery({ from: [{ collectionId: 'ledger' }], where: { fieldFilter: { field: { fieldPath: 'reason' }, op: 'IN',
      value: { arrayValue: { values: EARNED.map(x => ({ stringValue: x })) } } } } }, 'wallets/' + uid);
    rows.forEach(x => { sum += Number.isInteger(x.micro) ? x.micro : Math.round((x.delta || 0) * MICRO); });
  } catch { }
  return Math.max(0, Math.min(sum, microOf(d)));
}
/* a wallet's numbers after m millionths moved for this reason */
function walletAfter(d, earn, m, reason) {
  const micro = microOf(d) + m;
  const e = earn + ((m > 0 && EARNED.includes(reason)) || reason === 'withdraw' || reason === 'withdraw_back' ? m : 0);
  return { micro, points: micro / MICRO, earnMicro: Math.max(0, Math.min(e, micro)) };
}
/* a first visit: the wallet with the welcome gift (the precondition makes it happen once) */
async function wallet(uid) {
  let w = await getDoc('wallets/' + uid);
  if (w.exists) return w.data;
  const gift = cfg().welcome, m = Math.round(gift * MICRO), now = Date.now();
  const r = await commit([put('wallets/' + uid, { welcomed: true, createdAt: now, updatedAt: now, micro: m, points: m / MICRO, earnMicro: 0 }, { pre: { exists: false } })]
    .concat(m ? [create('wallets/' + uid + '/ledger/' + now + '_welcome', { delta: m / MICRO, micro: m, reason: 'welcome', note: 'هدية الترحيب', at: now }), statsWrite({ giftMicro: m })] : []));
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
  return { uid: c.sub, email: c.email || '', name: c.name || '', verified: !!c.email_verified };
}

/* ================================================================ ADS */
/* a ticket before an ad is shown: the limits are checked first */
/* purpose 'spin': the ad's reward is one more 🎡 spin (SPIN_ADS_PER_DAY) instead of points */
async function adStart(me, via, purpose) {
  const c = cfg(), d = await wallet(me.uid), now = Date.now(), forSpin = purpose === 'spin';
  const n = d.adsDay === today() ? d.adsN || 0 : 0;
  if (n >= c.adsPerDay) throw coded(429, 'ads_daily', 'شاهدت ' + c.adsPerDay + ' إعلانًا اليوم — الحدّ اليومي. عد غدًا.');
  const wait = Math.ceil(((d.adsLast || 0) + c.adCooldown * 1000 - now) / 1000);
  if (wait > 0) throw coded(429, 'ads_cooldown', 'انتظر ' + wait + ' ثانية قبل الإعلان التالي.', { wait });
  if (forSpin) { const e = await econ(); if (!e.spinOn || !spinState(e, d).adsLeft) throw coded(429, 'spin_ads', 'انتهت دورات الإعلانات اليوم — عد غدًا.'); }
  const nonce = rid(24);
  const r = await commit([create('ad_sessions/' + nonce, { uid: me.uid, at: now, via, used: false, purpose: forSpin ? 'spin' : 'points' })]);
  if (!r.ok) throw coded(503, 'store', 'تعذّر بدء الإعلان');
  const strong = await strongDonor(me.uid), e = await econ();
  return { nonce, minSeconds: c.adMinSeconds, points: forSpin ? 0 : boost(d, c.ad * (strong ? 2 : 1), e), spin: forSpin, strongDonor: strong, vip: isVip(d), left: c.adsPerDay - n };
}
/* the reward: once per ticket (and per AdMob transaction), within the day's limit */
/* a strong donor (donors/<uid>, written by ai.js): ×2 on an ad's points while one of their strong keys is still active */
async function strongDonor(uid) {
  const d = await getDoc('donors/' + uid).catch(() => ({ exists: false }));
  if (!d.exists || d.data.tier !== 'strong') return false;
  for (const id of (d.data.strongKeys || []).slice(0, 5)) {
    const k = await getDoc('api_keys/' + id).catch(() => ({ exists: false }));
    if (k.exists && k.data.status === 'active' && k.data.tier === 'strong') return true;
  }
  return false;
}
async function adReward(uid, nonce, via, tx) {
  const c = cfg(), strong = await strongDonor(uid), e = await econ();
  return change(uid, 0, 'ad', (via === 'admob' ? 'إعلان بمكافأة (AdMob)' : 'إعلان بمكافأة') + (strong ? ' · ×2 💎 متبرّع قوي' : ''), async d => {
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
    const fields = { adsDay: today(), adsN: n + 1, adsLast: now };
    /* 🎡 an ad for a spin: one more spin, no points */
    if (s.data.purpose === 'spin') {
      const day = today(), used = d.spinAdDay === day ? d.spinAdN || 0 : 0;
      if (used >= e.spinAdsPerDay) return { error: coded(429, 'spin_ads', 'انتهت دورات الإعلانات اليوم') };
      return { delta: 0, fields: Object.assign(fields, { spinBank: (d.spinBank || 0) + 1, spinAdDay: day, spinAdN: used + 1 }), writes, result: { spin: true } };
    }
    const pts = boost(d, c.ad * (strong ? 2 : 1), e);
    writes.push(statsWrite({ giftMicro: pts * MICRO }));
    return { delta: pts, fields, writes, note: (via === 'admob' ? 'إعلان بمكافأة (AdMob)' : 'إعلان بمكافأة') + (strong ? ' · ×2 💎' : '') + (isVip(d) ? ' · 👑 ×' + e.vipMultiplier : '') };
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
  /* 💳 a top-up: kept once by its transaction's own state (pending → completed) — a failure here answers an error
     and Stripe sends the event again */
  const ob = (ev.data && ev.data.object) || {};
  if (/^checkout\.session\./.test(ev.type) && ob.metadata && ob.metadata.kind === 'topup') return json(200, Object.assign({ received: true }, await topupEvent(ev.type, ob)));
  if (ev.type === 'charge.refunded' || ev.type === 'charge.dispute.created') return json(200, Object.assign({ received: true }, await topupReversed(ev.type, ob)));
  const seen = await commit([create('stripe_events/' + String(ev.id).replace(/[^\w-]/g, ''), { type: ev.type, at: Date.now() })]);
  if (!seen.ok) return json(200, { received: true, duplicate: true });
  const o = (ev.data && ev.data.object) || {};
  /* whose subscription, and which: ⭐ Pro or 👑 VIP (its metadata, else what was kept when it began) */
  const subOf = async sub => {
    const meta = Object.assign({}, o.subscription_details && o.subscription_details.metadata, o.metadata);
    const kept = sub ? (await getDoc('stripe_subs/' + sub)).data || {} : {};
    return { uid: meta.uid || kept.uid || null, plan: (meta.plan || kept.plan) === 'vip' ? 'vip' : 'pro' };
  };
  const F = plan => plan === 'vip' ? { status: 'vipStatus', until: 'vipUntil', sub: 'vipSub', customer: 'vipCustomer' } : { status: 'proStatus', until: 'proUntil', sub: 'proSub', customer: 'proCustomer' };
  if (ev.type === 'checkout.session.completed') {
    const uid = o.client_reference_id || (o.metadata && o.metadata.uid), plan = (o.metadata && o.metadata.plan) === 'vip' ? 'vip' : 'pro', k = F(plan);
    if (uid && o.subscription) {
      await change(uid, 0, plan, '', () => ({ fields: { [k.status]: 'active', [k.sub]: String(o.subscription), [k.customer]: String(o.customer || ''), [k.until]: Date.now() + 32 * 864e5 },
        writes: [put('stripe_subs/' + o.subscription, { uid, plan, customer: String(o.customer || ''), at: Date.now() })].concat(plan === 'vip' ? [statsWrite({ vipSubs: 1 })] : []) }));
    }
  } else if (ev.type === 'invoice.paid' || ev.type === 'invoice.payment_succeeded') {
    const { uid, plan } = await subOf(o.subscription), k = F(plan);
    const end = o.lines && o.lines.data && o.lines.data[0] && o.lines.data[0].period && o.lines.data[0].period.end;
    if (uid && end) await change(uid, 0, plan, '', () => ({ fields: { [k.status]: 'active', [k.until]: end * 1000 + 2 * 864e5 } }));
  } else if (ev.type === 'customer.subscription.deleted' || ev.type === 'customer.subscription.updated') {
    const { uid, plan } = await subOf(o.id), k = F(plan);
    if (uid) await change(uid, 0, plan, '', d => ({ fields: ev.type === 'customer.subscription.deleted' || o.status === 'canceled'
      ? { [k.status]: 'canceled', [k.until]: Math.min(d[k.until] || 0, Date.now()) }
      : { [k.status]: String(o.status || 'active') } }));
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

/* ================================================================ PLAY TIME — timed by THIS server, sealed (🛡 anti-cheat)
   ⏱ Play time is a number of its own (playtime/<gameId>: seconds, sessions, players) — it earns no points by
   itself; it tells a creator how much their game is played, and tells 🎁 an invitation that the friend really
   played. A page cannot send a duration:
   • /play/start {gameId} → a playSessionId and its TOKEN; one counted session per account: a newer one (another
     tab, another device, another game) ends the older one («replaced»).
   • /play/beat {sessionId, token, hidden, idle} every PLAY_HEARTBEAT_SECONDS while the game is on screen: the time
     since the last beat is credited — never a beat sooner than half the interval (nothing written), never a
     silence longer than 2.5 intervals (closed, offline, in the background), minus the seconds the page says it
     was hidden, nothing when idle, at most PLAY_SESSION_MAX_MINUTES; the creator's own play is not counted.
   • /play/end {sessionId, token}: the last stretch, and the session's endedAt / duration.
   🛡 The token is the session sealed with AES-GCM under a key only this server has (PLAY_TOKEN_SECRET, or one made
   once and kept in server_secrets/, which no page can read): session, account, game and the beat's NUMBER. Each
   beat must bring the latest token and gets the next one — a token written by a page (or a bot) does not open, an
   old one (replayed, or a copy running in a second tab) is refused, a session cannot be beaten for someone else. */
const SESS = 'play_sessions';
const cleanId = v => String(v || '').replace(/[^\w-]/g, '').slice(0, 64);
let playKey = null;
async function sealKey() {
  if (playKey) return playKey;
  let raw = env('PLAY_TOKEN_SECRET');
  if (!raw) {
    const k = await getDoc('server_secrets/play');
    if (k.exists) raw = k.data.key;
    else {
      const fresh = u64(crypto.getRandomValues(new Uint8Array(32)));
      const r = await commit([create('server_secrets/play', { key: fresh, at: Date.now() })]);
      raw = r.ok ? fresh : (await getDoc('server_secrets/play')).data.key;
    }
  }
  playKey = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', te('nexus-play|' + raw)), 'AES-GCM', false, ['encrypt', 'decrypt']);
  return playKey;
}
async function seal(o) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return u64(iv) + '.' + u64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await sealKey(), te(JSON.stringify(o))));
}
async function unseal(t) {
  try { const [a, b] = String(t || '').split('.'); return JSON.parse(txt(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64u(a) }, await sealKey(), b64u(b)))); }
  catch { return null; }
}
async function playStart(me, b) {
  const e = await econ(), gid = cleanId(b.gameId);
  if (!gid) throw coded(400, 'bad_request', 'اللعبة غير محدّدة');
  const g = await getDoc('games/' + gid, ['ownerId', 'visibility', 'projectId', 'title']);
  if (!g.exists || g.data.visibility === 'private') throw coded(404, 'game', 'اللعبة غير موجودة');
  const own = g.data.ownerId === me.uid;
  /* 🎁 a friend who came by an invitation and still has to play: this session counts toward it */
  const rf = own ? null : await getDoc('referrals/' + me.uid).catch(() => null);
  const ref = !!(rf && rf.exists && rf.data.status === 'joined');
  for (let i = 0; i < 4; i++) {
    const now = Date.now(), sid = 'ps' + rid(18);
    const a = await getDoc('play_active/' + me.uid);
    if (a.exists && now - (a.data.at || 0) < 2000) throw coded(429, 'play_busy', 'جلسة لعب بدأت للتوّ — انتظر لحظة');
    const writes = [];
    /* an older session of this account, still running: it ends where its last beat was */
    if (a.exists && a.data.sessionId) {
      const old = await getDoc(SESS + '/' + a.data.sessionId);
      if (old.exists && old.data.state === 'active') writes.push(put(SESS + '/' + a.data.sessionId, { state: 'replaced', endedAt: old.data.lastHeartbeat || now }, { pre: preOf(old) }));
    }
    writes.push(create(SESS + '/' + sid, { sessionId: sid, gameId: gid, projectId: g.data.projectId || null, ownerUid: g.data.ownerId, playerUid: me.uid,
      startedAt: now, lastHeartbeat: now, endedAt: null, duration: 0, beats: 0, ignored: 0, seq: 0, state: 'active', own, ref }));
    writes.push(put('play_active/' + me.uid, { sessionId: sid, gameId: gid, at: now }, { pre: preOf(a) }));
    if (!own) {
      /* 🎮 sessions and 👥 players (a player counted once per game) — other people only */
      const pm = await getDoc('play_players/' + gid + '_' + me.uid);
      writes.push(put('playtime/' + gid, { gameId: gid, ownerId: g.data.ownerId, projectId: g.data.projectId || null, title: String(g.data.title || '').slice(0, 120), updatedAt: now }, { incr: Object.assign({ sessions: 1 }, pm.exists ? {} : { players: 1 }) }));
      if (!pm.exists) writes.push(create('play_players/' + gid + '_' + me.uid, { gameId: gid, uid: me.uid, at: now }));
    }
    const r = await commit(writes);
    if (r.ok) return { sessionId: sid, token: await seal({ s: sid, u: me.uid, g: gid, n: 0 }), beat: e.heartbeatSeconds, counted: !own, why: own ? 'own' : null };
    if (!r.conflict) throw coded(503, 'store', 'تعذّر بدء الجلسة (' + r.status + ')');
  }
  throw coded(409, 'busy', 'حاول مرة أخرى بعد لحظة');
}
async function playBeat(me, b, { ending = false } = {}) {
  const e = await econ(), sid = cleanId(b.sessionId);
  const hidden = Math.max(0, Math.min(86400, +b.hidden || 0)), idle = b.idle === true;
  const tk = await unseal(b.token);
  if (!tk || tk.s !== sid || tk.u !== me.uid) throw coded(403, 'play_token', 'جلسة اللعب غير صالحة — تبدأ من جديد');
  for (let i = 0; i < 5; i++) {
    const s = await getDoc(SESS + '/' + sid);
    if (!s.exists || s.data.playerUid !== me.uid) throw coded(404, 'play_session', 'جلسة اللعب غير موجودة');
    const d = s.data, now = Date.now(), beat = e.heartbeatSeconds;
    if (d.state !== 'active') return { credited: 0, state: d.state, stop: true };
    if (tk.n !== (d.seq || 0)) throw coded(409, 'play_replay', 'نبضة قديمة أو مكرّرة — لم تُحتسب');
    const gap = (now - d.lastHeartbeat) / 1000;
    /* sooner than half an interval: nothing written — a page cannot make the clock run faster */
    if (!ending && gap < beat * 0.5) return { credited: 0, why: 'early', wait: Math.ceil(beat * 0.5 - gap), token: b.token };
    let credit = 0, why = null;
    if (gap > beat * 2.5) why = 'gap';                                  // closed, offline, in the background: not counted
    else if (idle) why = 'idle';
    else credit = Math.max(0, gap - Math.min(gap, hidden));
    const maxS = e.sessionMaxMinutes * 60;
    if (credit > 0 && d.duration + credit > maxS) { credit = Math.max(0, maxS - d.duration); why = 'long'; }
    credit = Math.floor(credit);
    if (d.own) credit = 0;                                              // the creator's own play: not counted
    const f = { lastHeartbeat: now, duration: (d.duration || 0) + credit, beats: (d.beats || 0) + 1, seq: (d.seq || 0) + 1, ignored: (d.ignored || 0) + Math.max(0, Math.floor(gap) - credit) };
    if (ending) Object.assign(f, { state: 'ended', endedAt: now });
    const writes = [put(SESS + '/' + sid, f, { pre: preOf(s) })];
    if (credit > 0) writes.push(put('playtime/' + d.gameId, { gameId: d.gameId, ownerId: d.ownerUid, updatedAt: now }, { incr: { seconds: credit } }));
    /* 🎁 the invited friend's real play, toward the invitation */
    let rf = null;
    if (credit > 0 && d.ref) {
      rf = await getDoc('referrals/' + me.uid);
      if (rf.exists && rf.data.status === 'joined') writes.push(put('referrals/' + me.uid, { updatedAt: now }, { pre: preOf(rf), incr: { playedSeconds: credit } }));
      else rf = null;
    }
    const r = await commit(writes);
    if (r.ok) {
      const out = { credited: credit, why, duration: f.duration, state: ending ? 'ended' : 'active', token: ending ? null : await seal({ s: sid, u: me.uid, g: d.gameId, n: f.seq }) };
      if (rf && (rf.data.playedSeconds || 0) + credit >= e.referralPlayMinutes * 60) out.referral = await referralPay(me.uid).catch(() => null);
      return out;
    }
    if (!r.conflict) throw coded(503, 'store', 'تعذّر الحفظ (' + r.status + ')');
  }
  throw coded(409, 'busy', 'حاول مرة أخرى بعد لحظة');
}
/* the page of an older visit (one call a minute with the game's id, no token): no longer counted — it reloads */
async function playLegacy() { return { counted: false, why: 'update' }; }

/* ================================================================ 💳 TOP-UP AND WITHDRAWAL (PART 43)
   Any amount — no packs: the page sends what the person typed (dollars OR tokens) and the numbers it showed; the
   server works both sides out again (quote, EXACT AMOUNTS) and only its own numbers count — a page that was edited
   (or a price that changed meanwhile) gets «quote_changed» and nothing happens. Every one is a row of
   transactions/<txId> (type, status, both sides, the price used), written only here; its owner may read it.
   • Top-up: Stripe Checkout for exactly the server's amount (price_data — no fixed Stripe price). The tokens are
     added only when Stripe's SIGNED webhook says it is paid: the transaction goes pending → completed once, in the
     same commit as the wallet and its ledger. Refunded or disputed later → taken back (never below zero).
   • Withdrawal: EARNED tokens only (sales, Play Rewards, prizes), a verified e-mail, 18+ (ages/<uid>), an account
     WITHDRAW_MIN_ACCOUNT_DAYS old. The tokens leave the wallet at once (held: «pending»); the site's owner pays
     outside NEXUS (PayPal, a bank …) and marks it «paid» with a reference — or refuses it, and the tokens come
     back; the person may cancel while it waits. Off until the owner turns it on.
   Netlify: BASE_TOKEN_PRICE_USD (0.01) · TOPUP_ENABLED · TOPUP_MIN_USD · TOPUP_MAX_USD · WITHDRAW_ENABLED ·
   WITHDRAW_MIN_USD · WITHDRAW_MAX_USD · WITHDRAW_MIN_ACCOUNT_DAYS — and STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET,
   the webhook (…/api/points/stripe) with also: checkout.session.async_payment_succeeded,
   checkout.session.async_payment_failed, checkout.session.expired, charge.refunded, charge.dispute.created. */
const stripeOn = () => !!(env('STRIPE_SECRET_KEY') && env('STRIPE_WEBHOOK_SECRET'));
const cleanTx = v => String(v || '').replace(/[^\w-]/g, '').slice(0, 64);
const usd = c => fmtFixed(c, 2, true);
const moneyPub = e => ({ price: fmtFixed(e.tokenPriceMicro, 6), priceMicro: e.tokenPriceMicro, unit: 'NEXUS_POINTS', currency: 'USD',
  topup: { on: !!e.topupOn && stripeOn(), enabled: !!e.topupOn, stripe: stripeOn(), minCents: e.topupMinCents, maxCents: e.topupMaxCents, min: usd(e.topupMinCents), max: usd(e.topupMaxCents) },
  withdraw: { on: !!e.withdrawOn, minCents: e.withdrawMinCents, maxCents: e.withdrawMaxCents, min: usd(e.withdrawMinCents), max: usd(e.withdrawMaxCents), minAgeDays: e.withdrawMinAgeDays } });
const pubQuote = (q, price) => ({ anchor: q.anchor, micro: q.micro, cents: q.cents, tokens: fmtFixed(q.micro, 6), usd: usd(q.cents), priceMicro: price, price: fmtFixed(price, 6) });
/* the numbers the page showed — if they are not the server's, nothing happens and the page gets the right ones */
function sameQuote(q, x, price) {
  if (!x || typeof x !== 'object') return;
  if (+x.micro !== q.micro || +x.cents !== q.cents || (x.priceMicro != null && +x.priceMicro !== price))
    throw coded(409, 'quote_changed', 'تغيّر الحساب (سعر التوكن الآن $' + fmtFixed(price, 6) + ') — راجع الأرقام وأكّد من جديد.', { quote: pubQuote(q, price) });
}
const inRange = (kind, q, lo, hi) => { if (!(q.micro > 0) || q.cents < lo || q.cents > hi) throw coded(400, 'amount_range', (kind === 'topup' ? 'الشحن' : 'السحب') + ' بين $' + usd(lo) + ' و$' + usd(hi) + '.', { min: usd(lo), max: usd(hi) }); };
const newTx = now => 'tx_' + now.toString(36) + '_' + rid(10);
const txRow = (id, uid, type, q, price, b, now, extra) => Object.assign({ txId: id, uid, type, status: 'pending', anchor: q.anchor, typed: String(b.amount == null ? '' : b.amount).slice(0, 40),
  micro: q.micro, tokens: fmtFixed(q.micro, 6), cents: q.cents, usd: usd(q.cents), priceMicro: price, price: fmtFixed(price, 6), currency: 'USD', unit: 'NEXUS_POINTS', createdAt: now, updatedAt: now }, extra);
/* 18 or older, from the birth month the account gave once (ages/<uid> — as firestore.rules count it) */
async function adult(uid) {
  const a = await getDoc('ages/' + uid).catch(() => ({ exists: false }));
  if (!a.exists || !Number.isInteger(a.data.y) || !Number.isInteger(a.data.m)) return false;
  const n = new Date(Date.now());
  return n.getUTCFullYear() - a.data.y - (n.getUTCMonth() + 1 < a.data.m ? 1 : 0) >= 18;
}

/* ---- top-up: the transaction, then Stripe's page for exactly its amount ---- */
async function topupStart(me, b, origin) {
  const e = await econ();
  if (!e.topupOn) throw coded(403, 'topup_off', 'الشحن متوقف الآن على هذا الموقع.');
  if (!stripeOn()) throw coded(503, 'topup_stripe', 'الشحن يحتاج ربط Stripe — يضع صاحب الموقع STRIPE_SECRET_KEY و STRIPE_WEBHOOK_SECRET في Netlify.');
  const q = quote('topup', b.anchor, b.amount, e.tokenPriceMicro);
  sameQuote(q, b.expect, e.tokenPriceMicro);
  inRange('topup', q, e.topupMinCents, e.topupMaxCents);
  await wallet(me.uid);
  const now = Date.now(), id = newTx(now), price = e.tokenPriceMicro;
  const c0 = await commit([create('transactions/' + id, txRow(id, me.uid, 'topup', q, price, b, now, { provider: 'stripe' }))]);
  if (!c0.ok) throw coded(503, 'store', 'تعذّر بدء الشحن — لم يُدفع شيء.');
  /* back to the same page of this site (its path — never another site) with the wallet open */
  const back = String(b.back || '/'), home = origin + (/^\/(?!\/)[^\s#\\]{0,300}$/.test(back) ? back : '/') + '#wallet';
  let s;
  try {
    const meta = { uid: me.uid, kind: 'topup', tx: id };
    s = await stripeCall('checkout/sessions', { mode: 'payment', client_reference_id: me.uid, customer_email: me.email || null,
      line_items: { 0: { quantity: 1, price_data: { currency: 'usd', unit_amount: q.cents, product_data: { name: 'NEXUS · ' + fmtFixed(q.micro, 6) + ' tokens', description: '1 token = $' + fmtFixed(price, 6) } } } },
      metadata: meta, payment_intent_data: { metadata: meta }, expires_at: Math.floor(now / 1000) + 31 * 60,
      success_url: home, cancel_url: home });
  } catch (err) { await commit([put('transactions/' + id, { status: 'failed', updatedAt: Date.now() })]).catch(() => {}); throw err; }
  await commit([put('transactions/' + id, { stripeSession: String(s.id || ''), updatedAt: Date.now() })]).catch(() => {});
  return { tx: id, url: s.url, quote: pubQuote(q, price) };
}
/* Stripe says: paid (completed / a delayed payment succeeded) → the tokens, once; expired or failed → closed */
async function topupEvent(type, o) {
  const id = cleanTx(o.metadata.tx), uid = String(o.metadata.uid || '');
  const t = await getDoc('transactions/' + id);
  if (!t.exists || t.data.type !== 'topup' || t.data.uid !== uid || (t.data.stripeSession && o.id && t.data.stripeSession !== o.id)) return { ignored: 'unknown' };
  if (type === 'checkout.session.expired' || type === 'checkout.session.async_payment_failed') {
    if (t.data.status === 'pending') await commit([put('transactions/' + id, { status: type.endsWith('expired') ? 'expired' : 'failed', updatedAt: Date.now() }, { pre: preOf(t) })]);
    return { status: 'closed' };
  }
  if (type !== 'checkout.session.completed' && type !== 'checkout.session.async_payment_succeeded') return { ignored: type };
  if (o.payment_status !== 'paid') return { status: 'waiting' };                    // a delayed payment: its own event later
  if (t.data.status !== 'pending') return { duplicate: true };
  if (+o.amount_total !== t.data.cents || String(o.currency || '').toLowerCase() !== 'usd') {
    await commit([put('transactions/' + id, { status: 'review', why: 'paid ' + o.amount_total + ' ' + o.currency, updatedAt: Date.now() }, { pre: preOf(t) })]);
    return { status: 'review' };
  }
  try {
    const r = await change(uid, 0, 'topup', '$' + t.data.usd + ' → ' + t.data.tokens, async () => {
      const cur = await getDoc('transactions/' + id);
      if (cur.data.status !== 'pending') return { error: coded(409, 'tx_done', 'done') };
      return { micro: cur.data.micro, tx: id, writes: [put('transactions/' + id, { status: 'completed', completedAt: Date.now(), updatedAt: Date.now(),
        paymentIntent: String(o.payment_intent || ''), stripeSession: String(o.id || '') }, { pre: preOf(cur) }), statsWrite({ topups: 1, topupCents: cur.data.cents, topupMicro: cur.data.micro })] };
    });
    return { status: 'completed', points: r.points };
  } catch (e) { if (e.code === 'tx_done') return { duplicate: true }; throw e; }
}
/* refunded (all or part) or disputed: those tokens are taken back — what was already spent stays on the transaction (shortMicro) */
async function topupReversed(type, o) {
  const pi = String(o.payment_intent || '');
  if (!pi) return { ignored: 'no_payment' };
  const [t0] = await runQuery({ from: [{ collectionId: 'transactions' }], where: { fieldFilter: { field: { fieldPath: 'paymentIntent' }, op: 'EQUAL', value: { stringValue: pi } } }, limit: 1 });
  if (!t0 || t0.type !== 'topup' || !['completed', 'refunded', 'disputed'].includes(t0.status)) return { ignored: 'unknown' };
  const dispute = type === 'charge.dispute.created';
  try {
    await change(t0.uid, 0, 'topup_back', '↩ $' + t0.usd + (dispute ? ' · dispute' : ' · refund'), async d => {
      const t = await getDoc('transactions/' + t0.id);
      const want = dispute ? t.data.micro : Number(BigInt(t.data.micro) * BigInt(Math.min(Math.max(0, Math.round(+o.amount_refunded || 0)), t.data.cents)) / BigInt(t.data.cents));
      const due = want - (t.data.reversedMicro || 0);
      if (due <= 0) return { error: coded(409, 'tx_done', 'done') };
      const take = Math.min(due, microOf(d));
      return { micro: -take, tx: t0.id, writes: [put('transactions/' + t0.id, { status: dispute ? 'disputed' : 'refunded', reversedMicro: (t.data.reversedMicro || 0) + due,
        shortMicro: (t.data.shortMicro || 0) + due - take, updatedAt: Date.now() }, { pre: preOf(t) }), statsWrite({ reversedMicro: due })] };
    });
    return { status: 'reversed' };
  } catch (e) { if (e.code === 'tx_done') return { duplicate: true }; throw e; }
}

/* ---- withdrawal: held at once, paid (or refused) by the site's owner ---- */
async function withdrawStart(me, b) {
  const e = await econ(), price = e.tokenPriceMicro;
  if (!e.withdrawOn) throw coded(403, 'withdraw_off', 'السحب غير مفعّل على هذا الموقع بعد — يفعّله صاحبه.');
  if (!me.verified) throw coded(403, 'withdraw_verify', 'السحب لحساب بريده مؤكَّد (حساب Google، أو أكّد بريدك).');
  if (!(await adult(me.uid))) throw coded(403, 'withdraw_age', 'السحب لمن عمره 18 سنة فأكثر — حسب شهر الميلاد في حسابك.');
  const method = ['paypal', 'bank', 'other'].includes(b.method) ? b.method : '', payTo = String(b.payTo || '').trim().slice(0, 160);
  if (!method || payTo.length < 3) throw coded(400, 'withdraw_to', 'اختر طريقة الاستلام واكتب بياناتها (بريد PayPal أو الحساب البنكي).');
  const q = quote('withdraw', b.anchor, b.amount, price);
  sameQuote(q, b.expect, price);
  inRange('withdraw', q, e.withdrawMinCents, e.withdrawMaxCents);
  const now = Date.now(), id = newTx(now);
  const r = await change(me.uid, 0, 'withdraw', '$' + usd(q.cents) + ' ← ' + fmtFixed(q.micro, 6), async d => {
    if (e.withdrawMinAgeDays && now - (d.createdAt || now) < e.withdrawMinAgeDays * 864e5) return { error: coded(403, 'withdraw_new', 'السحب بعد ' + e.withdrawMinAgeDays + ' أيام من إنشاء الحساب.') };
    const can = Math.min(microOf(d), await earnedOf(me.uid, d));
    if (q.micro > can) return { error: coded(402, 'withdraw_more', 'القابل للسحب ' + fmtFixed(can, 6) + ' توكن — أرباحك من بيع المشاريع ومكافآت اللعب والتحديات (لا هدية الترحيب ولا الإعلانات ولا ما شحنته).', { withdrawable: fmtFixed(can, 6), withdrawableMicro: can }) };
    return { micro: -q.micro, tx: id, writes: [create('transactions/' + id, txRow(id, me.uid, 'withdraw', q, price, b, now, { provider: 'manual', queue: 'withdraw', method, payTo, email: me.email || '' }))] };
  });
  return { tx: id, quote: pubQuote(q, price), points: r.points, micro: r.micro };
}
/* refused by the owner, or cancelled by its own person while it waits: the tokens come back (earned again) */
async function withdrawBack(id, status, by, why, owner) {
  const t0 = await getDoc('transactions/' + id);
  if (!t0.exists || t0.data.type !== 'withdraw' || (!owner && t0.data.uid !== by)) throw coded(404, 'tx_none', 'لا يوجد طلب سحب بهذا الرقم.');
  const r = await change(t0.data.uid, 0, 'withdraw_back', '↩ $' + t0.data.usd, async () => {
    const t = await getDoc('transactions/' + id);
    if (t.data.status !== 'pending') return { error: coded(409, 'tx_closed', 'هذا الطلب لم يعد معلّقًا.') };
    return { micro: t.data.micro, tx: id, writes: [put('transactions/' + id, { status, queue: null, decidedAt: Date.now(), decidedBy: by, why: String(why || '').slice(0, 200), updatedAt: Date.now() }, { pre: preOf(t) })] };
  });
  return { tx: id, status, points: r.points };
}
async function withdrawPaid(me, id, ref) {
  const t = await getDoc('transactions/' + id);
  if (!t.exists || t.data.type !== 'withdraw') throw coded(404, 'tx_none', 'لا يوجد طلب سحب بهذا الرقم.');
  if (t.data.status !== 'pending') throw coded(409, 'tx_closed', 'هذا الطلب لم يعد معلّقًا.');
  const now = Date.now();
  const r = await commit([put('transactions/' + id, { status: 'paid', queue: null, paidAt: now, decidedAt: now, decidedBy: me.uid, ref: String(ref || '').slice(0, 120), updatedAt: now }, { pre: preOf(t) }),
    statsWrite({ withdrawsPaid: 1, withdrawPaidCents: t.data.cents, withdrawPaidMicro: t.data.micro })]);
  if (!r.ok) throw coded(409, 'busy', 'حاول مرة أخرى');
  return { tx: id, status: 'paid' };
}
const txOut = (t, full) => Object.assign({ id: t.id, type: t.type, status: t.status, anchor: t.anchor, tokens: t.tokens, micro: t.micro, usd: t.usd, cents: t.cents, price: t.price,
  createdAt: t.createdAt, completedAt: t.completedAt || null, paidAt: t.paidAt || null, method: t.method || null, ref: t.ref || null, why: t.why || null },
  full ? { uid: t.uid, email: t.email || '', payTo: t.payTo || '' } : { payTo: t.payTo ? String(t.payTo).replace(/^(.{2}).*(.{3})$/, '$1•••$2') : null });
const txQuery = (field, value) => runQuery({ from: [{ collectionId: 'transactions' }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } }, limit: 300 });
const mustOwn = async me => { if (!(await aiOwner(me))) throw coded(403, 'not_owner', 'لصاحب الموقع فقط.'); };

/* ================================================================ REWARDS (PART 44): 🔥 streak · 🎡 spin · 🎁 invites · 👑 VIP · 📊 the owner's dashboard
   Every number and every draw is the server's: a page asks, the server decides and writes it in ONE commit with
   the wallet and its ledger — the day is the server's (UTC), the wheel's prize is drawn here (crypto random) BEFORE
   the page spins to it, an invitation is paid once.
   • 🔥 Daily login streak (/daily, once a day): day 1, 2, 3 … in a row earn STREAK_REWARDS (5,10,15,20,25,30,50 —
     the last again every day after); a missed day starts again at day 1.
   • 🎡 Lucky spin (/spin): SPIN_FREE_PER_DAY free (+1 for VIP — no ad asked), then one more after each rewarded ad
     (SPIN_ADS_PER_DAY); prizes and their weights: SPIN_PRIZES (points:weight).
   • 🎁 Invite & earn: everyone has a link (…?ref=<code>). An account at most REFERRAL_JOIN_HOURS old, with a verified
     e-mail, claims it once; when that friend has PLAYED REFERRAL_PLAY_MINUTES for real (server-timed sessions, games
     not their own) the one who invited gets REFERRAL_POINTS (at most REFERRAL_MAX_PER_DAY a day) and the friend
     REFERRAL_FRIEND_POINTS — once each.
   • 👑 VIP: Stripe monthly (VIP_PRICE_USD, or STRIPE_VIP_PRICE_ID) or 30 days for VIP_TOKENS_30D tokens; Pro includes it.
     VIP_MULTIPLIER (×2) on what the SITE gives — ads, streak, spin, invitations — never on sales, tips or top-ups
     (tokens that move between people are never multiplied); one more free spin a day instead of an ad.
   • 📊 economy/stats: running totals kept in the same commits (top-ups, withdrawals, commissions, tips, VIP, gifts)
     for the owner's dashboard (/admin/* — the owner only, checked here). */
const DAY_MS = 864e5;
const yesterday = () => new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);
const isVip = d => !!(d && ((d.vipUntil || 0) > Date.now() || (d.proUntil || 0) > Date.now()));
const boost = (d, pts, e) => isVip(d) ? pts * e.vipMultiplier : pts;
/* the owner's running totals — increments, so two commits at once never lose one */
const statsWrite = incr => put('economy/stats', { updatedAt: Date.now() }, { incr });

/* ---- 🔥 the daily login streak ---- */
const streakState = (e, d) => {
  const done = d.streakDay === today(), cur = done || d.streakDay === yesterday() ? d.streak || 0 : 0, list = e.streakRewards;
  return { on: !!e.streakOn, today: done, streak: cur, best: d.streakBest || 0, rewards: list, next: list[Math.min(cur + 1, list.length) - 1] || 0 };
};
async function dailyClaim(me) {
  const e = await econ();
  if (!e.streakOn) throw coded(403, 'streak_off', 'سلسلة الدخول اليومية متوقفة على هذا الموقع.');
  const day = today(), list = e.streakRewards;
  let out = null;
  try {
    const r = await change(me.uid, 0, 'streak', '', d => {
      if (d.streakDay === day) return { error: coded(409, 'streak_done', 'done') };
      const n = d.streakDay === yesterday() ? (d.streak || 0) + 1 : 1, base = list[Math.min(n, list.length) - 1] || 0, pts = boost(d, base, e);
      out = { claimed: true, streak: n, base, points: pts, vip: isVip(d) };
      return { delta: pts, note: '🔥 ' + n + (pts !== base ? ' · ×' + e.vipMultiplier : ''), fields: { streakDay: day, streak: n, streakBest: Math.max(n, d.streakBest || 0) },
        writes: pts ? [statsWrite({ giftMicro: pts * MICRO })] : [] };
    });
    return Object.assign(out, { balance: r.points, state: streakState(e, r.wallet) });
  } catch (err) {
    if (err.code !== 'streak_done') throw err;
    return { claimed: false, state: streakState(e, await wallet(me.uid)) };
  }
}

/* ---- 🎡 the lucky spin ---- */
const spinState = (e, d) => {
  const day = today(), used = d.spinDay === day ? d.spinN || 0 : 0, adsUsed = d.spinAdDay === day ? d.spinAdN || 0 : 0;
  return { on: !!e.spinOn, free: Math.max(0, e.spinFreePerDay + (isVip(d) ? 1 : 0) - used), bank: d.spinBank || 0, adsLeft: Math.max(0, e.spinAdsPerDay - adsUsed),
    prizes: e.spinPrizes.map(x => x.points), vip: isVip(d), multiplier: e.vipMultiplier };
};
/* a fair draw by weight — crypto random, never Math.random */
function draw(prizes) {
  const total = prizes.reduce((a, x) => a + x.weight, 0), r = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 * total;
  let acc = 0;
  for (let i = 0; i < prizes.length; i++) { acc += prizes[i].weight; if (r < acc) return i; }
  return prizes.length - 1;
}
async function spin(me) {
  const e = await econ();
  if (!e.spinOn) throw coded(403, 'spin_off', 'عجلة الحظ متوقفة على هذا الموقع.');
  let out = null;
  const r = await change(me.uid, 0, 'spin', '', d => {
    const st = spinState(e, d), day = today();
    let fields;
    if (st.free > 0) fields = { spinDay: day, spinN: (d.spinDay === day ? d.spinN || 0 : 0) + 1 };
    else if (st.bank > 0) fields = { spinBank: st.bank - 1 };
    else return { error: coded(429, 'spin_none', 'لا دورات متبقية اليوم — شاهد إعلانًا لدورة أخرى، أو عد غدًا.', { state: st }) };
    const i = draw(e.spinPrizes), base = e.spinPrizes[i].points, pts = boost(d, base, e);
    out = { index: i, base, prize: pts, vip: isVip(d), from: st.free > 0 ? 'free' : 'ad' };
    return { delta: pts, note: '🎡 ' + base + (pts !== base ? ' · ×' + e.vipMultiplier : ''), fields, writes: pts ? [statsWrite({ giftMicro: pts * MICRO })] : [] };
  });
  return Object.assign(out, { points: r.points, state: spinState(e, r.wallet) });
}

/* ---- 🎁 invite & earn ---- */
async function refCode(uid) {
  const w = await wallet(uid);
  if (w.refCode) return w.refCode;
  for (let i = 0; i < 6; i++) {
    const code = rid(12).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 7);
    if (code.length < 6) continue;
    const r = await commit([create('ref_codes/' + code, { uid, at: Date.now() })]);
    if (r.ok) { await change(uid, 0, 'refcode', '', () => ({ fields: { refCode: code } })); return code; }
  }
  throw coded(503, 'store', 'تعذّر إنشاء رابط الدعوة');
}
async function referralClaim(me, b) {
  const e = await econ();
  if (!e.referralOn) throw coded(403, 'ref_off', 'الدعوات متوقفة على هذا الموقع.');
  const code = String(b.code || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
  const c = code ? await getDoc('ref_codes/' + code) : { exists: false };
  if (!c.exists) throw coded(404, 'ref_code', 'رابط الدعوة غير معروف.');
  if (c.data.uid === me.uid) throw coded(409, 'ref_self', 'هذا رابطك أنت — أرسله لأصدقائك.');
  const prior = await getDoc('referrals/' + me.uid);
  if (prior.exists) return { already: true, status: prior.data.status, mine: prior.data.referrer === c.data.uid };
  if (!me.verified) throw coded(403, 'ref_verify', 'أكّد بريدك أولًا (حسابات Google مؤكَّدة) — ثم تُحتسب الدعوة.');
  const w = await wallet(me.uid), now = Date.now();
  if (now - (w.createdAt || 0) > e.referralJoinHours * 3600e3) throw coded(409, 'ref_late', 'الدعوة لحسابات جديدة فقط.');
  const u = await getDoc('users/' + me.uid, ['name']).catch(() => ({ exists: false }));
  const name = String((u.exists && u.data.name) || (me.email || '').split('@')[0] || 'player').slice(0, 40);
  const r = await commit([create('referrals/' + me.uid, { uid: me.uid, name, referrer: c.data.uid, code, status: 'joined', playedSeconds: 0, needSeconds: e.referralPlayMinutes * 60, at: now, updatedAt: now })]);
  if (!r.ok) { const cur = await getDoc('referrals/' + me.uid); if (cur.exists) return { already: true, status: cur.data.status, mine: cur.data.referrer === c.data.uid }; throw coded(503, 'store', 'تعذّر حفظ الدعوة'); }
  return { joined: true, minutes: e.referralPlayMinutes, friendPoints: e.referralFriendPoints };
}
/* the friend has played enough: the one who invited (within the day's limit) and the friend — once each */
async function referralPay(uid) {
  const e = await econ(), rf = await getDoc('referrals/' + uid);
  if (!rf.exists || rf.data.status !== 'joined' || (rf.data.playedSeconds || 0) < e.referralPlayMinutes * 60) return null;
  const out = {}, once = err => { if (err.code !== 'ref_done') throw err; };
  await change(rf.data.referrer, 0, 'referral', '🎁 ' + String(rf.data.name || '').slice(0, 40), async d => {
    const cur = await getDoc('referrals/' + uid);
    if (cur.data.status !== 'joined') return { error: coded(409, 'ref_done', 'done') };
    const day = today(), n = d.refDay === day ? d.refN || 0 : 0, capped = n >= e.referralPerDay, pts = capped ? 0 : boost(d, e.referralPoints, e);
    out.referrer = pts;
    return { delta: pts, fields: capped ? {} : { refDay: day, refN: n + 1 },
      writes: [put('referrals/' + uid, { status: capped ? 'capped' : 'rewarded', rewardedAt: Date.now(), referrerPoints: pts, updatedAt: Date.now() }, { pre: preOf(cur) })].concat(pts ? [statsWrite({ giftMicro: pts * MICRO, referrals: 1 })] : []) };
  }).catch(once);
  await change(uid, 0, 'referral', '🎁', async d => {
    const cur = await getDoc('referrals/' + uid);
    if (cur.data.friendPaid) return { error: coded(409, 'ref_done', 'done') };
    const pts = boost(d, e.referralFriendPoints, e);
    out.friend = pts;
    return { delta: pts, writes: [put('referrals/' + uid, { friendPaid: true, friendPoints: pts, updatedAt: Date.now() }, { pre: preOf(cur) })].concat(pts ? [statsWrite({ giftMicro: pts * MICRO })] : []) };
  }).catch(once);
  if (out.referrer) {
    const nid = 'n_' + Date.now().toString(36) + rid(6);
    await commit([create('users/' + rf.data.referrer + '/notifications/' + nid, { id: nid, type: 'referral', event: 'rewarded', actorId: uid, actorName: String(rf.data.name || 'player').slice(0, 40), points: out.referrer, at: Date.now(), read: false })]).catch(() => {});
  }
  return out;
}
async function referralInfo(me) {
  const e = await econ(), code = await refCode(me.uid);
  const rows = await runQuery({ from: [{ collectionId: 'referrals' }], where: { fieldFilter: { field: { fieldPath: 'referrer' }, op: 'EQUAL', value: { stringValue: me.uid } } }, limit: 300 });
  return { code, on: !!e.referralOn, points: e.referralPoints, friendPoints: e.referralFriendPoints, minutes: e.referralPlayMinutes, count: rows.length,
    rewarded: rows.filter(x => x.status === 'rewarded').length, earned: rows.reduce((a, x) => a + (x.referrerPoints || 0), 0),
    invited: rows.sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 50).map(x => ({ name: x.name || 'player', status: x.status, minutes: Math.floor((x.playedSeconds || 0) / 60), at: x.at || 0, points: x.referrerPoints || 0 })) };
}

/* ---- 👑 VIP ---- */
const vipOf = d => ({ active: isVip(d), until: Math.max(d.vipUntil || 0, d.proUntil || 0), status: d.vipStatus || null, viaPro: (d.proUntil || 0) > Date.now(), manage: !!d.vipCustomer });
async function vipCheckout(me, b, origin) {
  const e = await econ();
  if (!e.vipOn) throw coded(403, 'vip_off', 'عضوية VIP متوقفة على هذا الموقع.');
  if (!stripeOn()) throw coded(503, 'vip_stripe', 'الاشتراك يحتاج ربط Stripe من صاحب الموقع — أو ادفع بالتوكن.');
  const d = await wallet(me.uid);
  if ((d.vipUntil || 0) > Date.now() && d.vipSub) throw coded(409, 'vip_already', 'عضويتك VIP مفعّلة بالفعل.');
  const back = String(b.back || '/'), home = origin + (/^\/(?!\/)[^\s#\\]{0,300}$/.test(back) ? back : '/') + '#wallet';
  const line = env('STRIPE_VIP_PRICE_ID') ? { price: env('STRIPE_VIP_PRICE_ID'), quantity: 1 }
    : { quantity: 1, price_data: { currency: 'usd', unit_amount: e.vipPriceCents, recurring: { interval: 'month' }, product_data: { name: 'NEXUS VIP' } } };
  const s = await stripeCall('checkout/sessions', { mode: 'subscription', line_items: { 0: line }, client_reference_id: me.uid, customer_email: me.email || null,
    metadata: { uid: me.uid, plan: 'vip' }, subscription_data: { metadata: { uid: me.uid, plan: 'vip' } }, success_url: home, cancel_url: home });
  return { url: s.url };
}
async function vipTokens(me) {
  const e = await econ();
  if (!e.vipOn || !e.vipTokens) throw coded(403, 'vip_off', 'شراء VIP بالتوكن غير متاح على هذا الموقع.');
  const now = Date.now();
  const r = await change(me.uid, 0, 'vip', '👑 VIP · 30', d => ({ micro: -e.vipTokens * MICRO,
    fields: { vipUntil: Math.max(now, d.vipUntil || 0) + 30 * DAY_MS, vipStatus: d.vipSub && (d.vipUntil || 0) > now ? d.vipStatus : 'tokens' },
    writes: [statsWrite({ vipMicro: e.vipTokens * MICRO, vipBuys: 1 })] }));
  return { points: r.points, vip: vipOf(r.wallet) };
}

/* ---- 📊 the owner's dashboard ---- */
const STAT_KEYS = ['topups', 'topupCents', 'topupMicro', 'withdrawsPaid', 'withdrawPaidCents', 'withdrawPaidMicro', 'reversedMicro', 'sales', 'salesMicro', 'feeMicro',
  'tips', 'tipsMicro', 'tipFeeMicro', 'vipBuys', 'vipMicro', 'vipSubs', 'giftMicro', 'referrals', 'adjusts', 'adjustMicro'];
async function adminSummary() {
  const e = await econ(), st = (await getDoc('economy/stats')).data || {};
  const pend = await txQuery('queue', 'withdraw');
  const recent = await runQuery({ from: [{ collectionId: 'transactions' }], orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }], limit: 60 });
  return { money: moneyPub(e), stats: Object.fromEntries(STAT_KEYS.map(k => [k, +st[k] || 0])), statsAt: st.updatedAt || 0,
    pending: { count: pend.length, micro: pend.reduce((a, t) => a + (t.micro || 0), 0), cents: pend.reduce((a, t) => a + (t.cents || 0), 0) },
    recent: recent.map(t => txOut(t, true)) };
}
async function adminTransactions(type) {
  const rows = ['topup', 'withdraw', 'adjust'].includes(type) ? await txQuery('type', type)
    : await runQuery({ from: [{ collectionId: 'transactions' }], orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }], limit: 200 });
  return rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 200).map(t => txOut(t, true));
}
/* the owner gives or takes tokens by hand (support, a correction) — a transaction and a ledger line, never below zero */
async function adminAdjust(me, b) {
  const uid = cleanId(b.uid), raw = String(b.amount == null ? '' : b.amount).trim(), neg = raw.startsWith('-'), m = fixed(raw.replace(/^[-+]/, ''), 6);
  if (!uid || m == null || m === 0) throw coded(400, 'adjust', 'اكتب الحساب (UID) والمقدار، مثل 25 أو ‎-10.5');
  const [u, w] = await Promise.all([getDoc('users/' + uid, ['name']), getDoc('wallets/' + uid)]);
  if (!u.exists && !w.exists) throw coded(404, 'adjust_user', 'لا يوجد حساب بهذا الـ UID.');
  const micro = neg ? -m : m, now = Date.now(), id = newTx(now), note = String(b.note || '').slice(0, 120);
  const r = await change(uid, 0, 'admin', note || ('👤 ' + fmtFixed(micro, 6)), () => ({ micro, tx: id,
    writes: [create('transactions/' + id, { txId: id, uid, type: 'adjust', status: 'completed', anchor: 'tokens', typed: raw.slice(0, 40), micro, tokens: fmtFixed(micro, 6), cents: 0, usd: '0.00',
      priceMicro: 0, price: '0', currency: 'USD', unit: 'NEXUS_POINTS', why: note, by: me.uid, createdAt: now, updatedAt: now, completedAt: now }), statsWrite({ adjustMicro: micro, adjusts: 1 })] }));
  return { uid, tx: id, points: r.points };
}

/* ================================================================ the router */
const pub = (c, e) => ({ welcome: c.welcome, ad: c.ad, adsPerDay: c.adsPerDay, adCooldown: c.adCooldown, adMinSeconds: c.adMinSeconds, adsWeb: c.adsWeb,
  mb: c.mb, fileMaxMB: c.fileMaxMB, aiFree: c.aiFree, aiPack: c.aiPack, aiPackPrice: c.aiPackPrice, proAI: c.proAI,
  playBeat: e.heartbeatSeconds, stripe: c.stripe, proPrice: c.proPrice, money: moneyPub(e), rewards: rewardsPub(e) });
const rewardsPub = e => ({ streak: { on: !!e.streakOn, rewards: e.streakRewards }, spin: { on: !!e.spinOn, prizes: e.spinPrizes.map(x => x.points), free: e.spinFreePerDay, ads: e.spinAdsPerDay },
  referral: { on: !!e.referralOn, points: e.referralPoints, friendPoints: e.referralFriendPoints, minutes: e.referralPlayMinutes },
  vip: { on: !!e.vipOn, multiplier: e.vipMultiplier, price: usd(e.vipPriceCents), tokens: e.vipTokens, stripe: stripeOn() },
  tips: { min: e.tipMin, max: e.tipMax, feePercent: e.tipFeePercent }, feePercent: e.feePercent });

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
    if (path === '/config') return json(200, { ok: true, ready: ready(), ...pub(c, await econ()) });
    if (!ready()) return fail(503, 'off', 'نظام النقاط يحتاج FIREBASE_SERVICE_ACCOUNT في إعدادات Netlify.', { ready: false });
    const me = await who(req);
    if (!me) return fail(401, 'signin', 'النقاط لأصحاب الحسابات — سجّل الدخول (Google أو البريد).');
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

    if (path === '/me' && req.method === 'GET') {
      const d = await wallet(me.uid), u = (await getDoc('usage/' + me.uid)).data;
      const day = today(), ads = d.adsDay === day ? d.adsN || 0 : 0, used = u && u.day === day ? u.used || 0 : 0, extra = u && u.day === day ? u.extra || 0 : 0;
      const e = await econ(), micro = microOf(d);
      const rf = await getDoc('referrals/' + me.uid).catch(() => ({ exists: false }));
      return json(200, { ok: true, ready: true, points: micro / MICRO, micro, ...pub(c, e),
        streak: streakState(e, d), spin: spinState(e, d), vip: vipOf(d), owner: await aiOwner(me).catch(() => false),
        referral: rf.exists ? { status: rf.data.status, minutes: Math.floor((rf.data.playedSeconds || 0) / 60), need: e.referralPlayMinutes, friendPoints: rf.data.friendPoints || null } : null,
        withdrawable: e.withdrawOn ? Math.min(micro, await earnedOf(me.uid, d)) : null, verified: me.verified, adult: e.withdrawOn ? await adult(me.uid) : null,
        ads: { today: ads, left: Math.max(0, c.adsPerDay - ads), wait: Math.max(0, Math.ceil(((d.adsLast || 0) + c.adCooldown * 1000 - Date.now()) / 1000)) },
        ai: { used, limit: isPro(d) ? c.proAI : c.aiFree + extra, extra },
        pro: { active: isPro(d), until: d.proUntil || 0, status: d.proStatus || null, manage: !!d.proCustomer } });
    }
    if (path === '/ad/start' && req.method === 'POST') return json(200, { ok: true, ...(await adStart(me, body.via === 'admob' ? 'admob' : 'web', body.purpose)) });
    if (path === '/ad/claim' && req.method === 'POST') {
      if (!c.adsWeb) return fail(403, 'ads_web_off', 'إعلانات المتصفح غير مفعّلة على هذا الموقع (ADS_WEB).');
      const r = await adReward(me.uid, String(body.nonce || '').replace(/[^\w]/g, ''), 'web', null);
      return json(200, { ok: true, points: r.points, added: r.delta || 0, spin: !!(r.result && r.result.spin) });
    }
    if (path === '/ai/buy' && req.method === 'POST') { const r = await aiBuy(me); return json(200, { ok: true, points: r.points, extra: r.result.extra }); }
    if (path === '/upload/start' && req.method === 'POST') return json(200, { ok: true, ...(await uploadStart(me, body)) });
    if (path === '/upload/done' && req.method === 'POST') return json(200, { ok: true, ...(await uploadDone(me, body)) });
    if (path === '/upload/cancel' && req.method === 'POST') return json(200, { ok: true, ...(await uploadCancel(me, body)) });
    if (path === '/play' && req.method === 'POST') return json(200, { ok: true, ...(await playLegacy()) });
    if (path === '/play/start' && req.method === 'POST') return json(200, { ok: true, ...(await playStart(me, body)) });
    if (path === '/play/beat' && req.method === 'POST') return json(200, { ok: true, ...(await playBeat(me, body)) });
    if (path === '/play/end' && req.method === 'POST') return json(200, { ok: true, ...(await playBeat(me, body, { ending: true })) });
    /* 🔥 🎡 🎁 👑 rewards */
    if (path === '/daily' && req.method === 'POST') return json(200, { ok: true, ...(await dailyClaim(me)) });
    if (path === '/spin' && req.method === 'POST') return json(200, { ok: true, ...(await spin(me)) });
    if (path === '/referral' && req.method === 'GET') return json(200, { ok: true, ...(await referralInfo(me)) });
    if (path === '/referral/claim' && req.method === 'POST') return json(200, { ok: true, ...(await referralClaim(me, body)) });
    if (path === '/vip/checkout' && req.method === 'POST') return json(200, { ok: true, ...(await vipCheckout(me, body, url.origin)) });
    if (path === '/vip/tokens' && req.method === 'POST') return json(200, { ok: true, ...(await vipTokens(me)) });
    if (path === '/vip/portal' && req.method === 'POST') {
      const d = await wallet(me.uid);
      if (!stripeOn() || !d.vipCustomer) return fail(404, 'vip_none', 'لا يوجد اشتراك VIP لإدارته');
      const s = await stripeCall('billing_portal/sessions', { customer: d.vipCustomer, return_url: url.origin + '/#wallet' });
      return json(200, { ok: true, url: s.url });
    }
    /* 📊 the owner's dashboard */
    if (path === '/admin/summary' && req.method === 'GET') { await mustOwn(me); return json(200, { ok: true, ...(await adminSummary()) }); }
    if (path === '/admin/transactions' && req.method === 'GET') { await mustOwn(me); return json(200, { ok: true, transactions: await adminTransactions(url.searchParams.get('type')) }); }
    if (path === '/admin/adjust' && req.method === 'POST') { await mustOwn(me); return json(200, { ok: true, ...(await adminAdjust(me, body)) }); }
    /* 💳 top-up and withdrawal */
    if (path === '/money/quote' && req.method === 'POST') { const e = await econ(); return json(200, { ok: true, quote: pubQuote(quote(body.kind === 'withdraw' ? 'withdraw' : 'topup', body.anchor, body.amount, e.tokenPriceMicro), e.tokenPriceMicro) }); }
    if (path === '/topup' && req.method === 'POST') return json(200, { ok: true, ...(await topupStart(me, body, url.origin)) });
    if (path === '/withdraw' && req.method === 'POST') return json(200, { ok: true, ...(await withdrawStart(me, body)) });
    if (path === '/withdraw/cancel' && req.method === 'POST') return json(200, { ok: true, ...(await withdrawBack(cleanTx(body.tx), 'canceled', me.uid, '', false)) });
    if (path === '/transactions' && req.method === 'GET') return json(200, { ok: true, transactions: (await txQuery('uid', me.uid)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 40).map(t => txOut(t)) });
    if (path === '/withdrawals' && req.method === 'GET') { await mustOwn(me); return json(200, { ok: true, withdrawals: (await txQuery('queue', 'withdraw')).sort((a, b) => a.createdAt - b.createdAt).map(t => txOut(t, true)) }); }
    if (path === '/withdraw/decide' && req.method === 'POST') {
      await mustOwn(me);
      const id = cleanTx(body.tx);
      return json(200, { ok: true, ...(body.action === 'paid' ? await withdrawPaid(me, id, body.ref) : await withdrawBack(id, 'rejected', me.uid, body.why, true)) });
    }
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

/* for the site's other server parts (challenges.js — challenge prizes): the same wallet, the same
   ledger, the same Firestore access — never a second points system */
export { ready, getDoc, commit, put, create, preOf, runQuery, change, wallet, coded, base as fsBase, docName, accessToken, fromFs, econ, ECON, rid, today, who as pointsWho, fields as fsFields,
  MICRO, microOf, earnedOf, walletAfter, fmtFixed, moneyPub, statsWrite, isVip, rewardsPub };

export const config = { path: '/api/points/*' };
