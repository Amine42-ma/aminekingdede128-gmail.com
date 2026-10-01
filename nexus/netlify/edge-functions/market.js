/* ============================================================
   NEXUS — 🛒 the project marketplace (PART 42). A creator sells COPIES of a
   game's project for NEXUS Points; the buyer gets their own copy (a new
   project of theirs) — never the original, never an account, never the site.
   Everything that decides points, a price or who owns what is decided HERE,
   on the server (the service account — firestore.rules let no browser write
   any of it), with the wallet, the ledger and the Firestore access of
   points.js — never a second points system:
   • a listing (market/<gameId>) is written only after checking that the
     caller owns the published game AND its project, that the project is not
     a bought copy nor someone else's remix, and that the price is within the
     limits the site's owner set (economy/config · MARKET_* variables);
   • a purchase is ONE Firestore commit — all of it or none of it: the
     buyer's wallet −price (only while the balance read covers it), the
     seller's wallet +(price − fee), both ledgers, the purchase
     (purchases/<buyer>_<game>: create-only — a project is bought once), the
     transaction (market_tx/<transactionId>: create-only — the same click
     sent twice is ONE purchase), the listing's counters. A wallet that
     changed meanwhile → read again and decide again;
   • the buyer's copy (projects/<id>, purchasedFrom) is made from the
     seller's project right after — or from the published build when that
     project is gone — and again whenever the buyer opens a purchase whose
     copy is missing: the licence is the purchase, the copy follows it.
   • the economy's numbers: GET /config for everyone; POST /config for the
     site's owner only (ADMIN_EMAILS, or the owner of the AI key box).
   Netlify: FIREBASE_SERVICE_ACCOUNT (as for the points) ·
   MARKET_ENABLED · MARKET_MIN_PRICE · MARKET_MAX_PRICE · MARKET_PRICE_PRESETS ·
   MARKET_FEE_PERCENT · MARKET_MIN_BUYER_AGE_HOURS (and PLAY_* for Play Rewards).
   ============================================================ */
import { aiWho, aiOwner } from './ai.js';
import { ready as fsReady, getDoc, commit, put, create, preOf, wallet, coded, fsBase, docName, accessToken, econ, ECON, rid, fsFields } from './points.js';

const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const fail = (status, code, message, extra = {}) => json(status, Object.assign({ ok: false, error: { code, message } }, extra));
const cleanId = v => String(v || '').replace(/[^\w-]/g, '').slice(0, 64);
const cleanTx = v => String(v || '').replace(/[^\w-]/g, '').slice(0, 64);
const short = (t, n) => String(t || '').slice(0, n);

/* what anyone may know about the economy — the numbers a page shows, never a secret */
const pubEcon = e => ({ market: !!e.marketOn, minPrice: e.minPrice, maxPrice: e.maxPrice, pricePresets: e.pricePresets, feePercent: e.feePercent, sellerPercent: 100 - e.feePercent,
  buyerMinAgeHours: e.buyerMinAgeHours, currency: 'NEXUS_POINTS',
  play: { intervalMinutes: e.playIntervalMinutes, points: e.playPoints, playerGameMinutes: e.playerGameMinutes, playerDayMinutes: e.playerDayMinutes,
    gameDayPoints: e.gameDayPoints, creatorDayPoints: e.creatorDayPoints, heartbeatSeconds: e.heartbeatSeconds, sessionMaxMinutes: e.sessionMaxMinutes,
    minAccountAgeHours: e.minAccountAgeHours, verifiedOnly: !!e.verifiedOnly } });

/* a display name: the public profile (users/<uid>.name) */
async function nameOf(uid) { const u = await getDoc('users/' + uid, ['name']).catch(() => ({ exists: false })); return short(u.exists && u.data.name || 'player', 60); }

/* ================================================================ selling: the owner lists (or stops listing) a project */
async function list(me, b) {
  const e = await econ();
  const gid = cleanId(b.gameId);
  const g = await getDoc('games/' + gid, ['ownerId', 'visibility', 'title', 'projectId', 'creatorName', 'coverURL', 'thumbURL', 'genre', 'description']);
  if (!g.exists || g.data.ownerId !== me.uid) throw coded(403, 'not_owner', 'تستطيع بيع مشروع لعبة تملكها فقط.');
  const L = await getDoc('market/' + gid);
  const now = Date.now();
  if (b.forSale === false) {
    if (L.exists && L.data.isForSale) { const r = await commit([put('market/' + gid, { isForSale: false, updatedAt: now }, { pre: preOf(L) })]); if (!r.ok) throw coded(409, 'busy', 'حاول مرة أخرى'); }
    return { isForSale: false };
  }
  if (!e.marketOn) throw coded(403, 'market_off', 'سوق المشاريع متوقف الآن على هذا الموقع.');
  if (g.data.visibility === 'private') throw coded(409, 'private', 'انشر اللعبة (عامة أو برابط) قبل بيع مشروعها.');
  const pid = cleanId(g.data.projectId);
  const pr = pid ? await getDoc('projects/' + pid, ['ownerId', 'purchasedFrom', 'remixedFrom']) : { exists: false };
  if (!pr.exists || pr.data.ownerId !== me.uid) throw coded(403, 'not_owner', 'مشروع هذه اللعبة ليس لك (أو حُذف) — لا يُباع إلا مشروعك.');
  if (pr.data.purchasedFrom) throw coded(403, 'bought_copy', 'هذا المشروع نسخة اشتريتها — لا تُعاد بيعها.');
  if (pr.data.remixedFrom && pr.data.remixedFrom.ownerId && pr.data.remixedFrom.ownerId !== me.uid) throw coded(403, 'remix', 'هذا المشروع Remix للعبة شخص آخر — لا يُباع.');
  const price = +b.price;
  if (!Number.isInteger(price) || price < e.minPrice || price > e.maxPrice) throw coded(400, 'price', 'السعر عدد صحيح بين ' + e.minPrice + ' و' + e.maxPrice + ' نقطة.', { min: e.minPrice, max: e.maxPrice });
  const f = { gameId: gid, projectId: pid, ownerId: me.uid, ownerUid: me.uid, creatorName: short(g.data.creatorName || await nameOf(me.uid), 60),
    title: short(g.data.title, 120), description: short(g.data.description, 300), genre: short(g.data.genre || 'Other', 40),
    coverURL: g.data.coverURL || null, thumbURL: g.data.thumbURL || null, price, currency: 'NEXUS_POINTS', isForSale: true, updatedAt: now };
  if (!L.exists) Object.assign(f, { createdAt: now, sales: 0, revenue: 0 });
  /* a paid project is not given away by Remix at the same time */
  const r = await commit([put('market/' + gid, f, { pre: preOf(L) }), put('games/' + gid, { allowRemix: false })]);
  if (!r.ok) throw coded(409, 'busy', 'حاول مرة أخرى بعد لحظة');
  return { isForSale: true, price, gameId: gid };
}

/* ================================================================ buying: one commit, once */
async function buy(me, b) {
  const e = await econ();
  if (!e.marketOn) throw coded(403, 'market_off', 'سوق المشاريع متوقف الآن على هذا الموقع.');
  const gid = cleanId(b.gameId), tid = cleanTx(b.transactionId);
  if (!gid || tid.length < 8) throw coded(400, 'bad_request', 'طلب شراء غير صالح');
  const buyerName = await nameOf(me.uid);
  for (let i = 0; i < 5; i++) {
    /* the same click again (or a second tab): the purchase already made, never a second charge */
    const seen = await getDoc('market_tx/' + tid);
    if (seen.exists) {
      if (seen.data.buyerUid !== me.uid || seen.data.gameId !== gid) throw coded(409, 'tx_taken', 'رقم العملية مستعمل — أعد المحاولة');
      return Object.assign({ already: true }, await purchaseOf(me.uid, gid));
    }
    const prior = await getDoc('purchases/' + me.uid + '_' + gid);
    if (prior.exists) return Object.assign({ already: true }, outOf(prior.data));
    const L = await getDoc('market/' + gid);
    if (!L.exists || !L.data.isForSale || !(L.data.price > 0)) throw coded(404, 'not_for_sale', 'هذا المشروع ليس للبيع الآن.');
    const price = L.data.price, seller = L.data.ownerUid;
    if (seller === me.uid) throw coded(409, 'own', 'هذا مشروعك — لا تشتريه.');
    if (b.expectedPrice != null && +b.expectedPrice !== price) throw coded(409, 'price_changed', 'تغيّر السعر إلى ' + price + ' نقطة — أكّد الشراء من جديد.', { price });
    const g = await getDoc('games/' + gid, ['ownerId', 'visibility']);
    if (!g.exists || g.data.ownerId !== seller || g.data.visibility === 'private') throw coded(404, 'not_for_sale', 'هذا المشروع ليس للبيع الآن.');
    await wallet(me.uid); await wallet(seller);                   // both wallets exist (a first visit: its welcome gift first)
    const [wb, ws] = await Promise.all([getDoc('wallets/' + me.uid), getDoc('wallets/' + seller)]);
    const now = Date.now(), have = wb.data.points || 0;
    if (e.buyerMinAgeHours && (now - (wb.data.createdAt || now)) / 3600e3 < e.buyerMinAgeHours) throw coded(403, 'too_new', 'الحسابات الجديدة تشتري بعد ' + e.buyerMinAgeHours + ' ساعة.');
    if (have < price) throw coded(402, 'not_enough', 'رصيدك ' + have + ' نقطة — تحتاج ' + price + '.', { points: have, need: price });
    const fee = Math.floor(price * e.feePercent / 100), gets = price - fee, title = short(L.data.title, 120);
    const rec = { transactionId: tid, buyerUid: me.uid, buyerName, sellerUid: seller, sellerName: short(L.data.creatorName, 60), gameId: gid, projectId: L.data.projectId || null,
      title, price, fee, sellerGets: gets, currency: 'NEXUS_POINTS', timestamp: now, status: 'done' };
    const writes = [
      put('wallets/' + me.uid, { updatedAt: now }, { pre: preOf(wb), incr: { points: -price } }),
      create('wallets/' + me.uid + '/ledger/' + now + '_' + rid(6), { delta: -price, reason: 'market_buy', note: title, at: now, tx: tid }),
      put('wallets/' + seller, { updatedAt: now }, { pre: preOf(ws), incr: gets ? { points: gets } : null }),
      create('market_tx/' + tid, rec),
      create('purchases/' + me.uid + '_' + gid, Object.assign({ purchaseId: me.uid + '_' + gid, access: 'copy', copyProjectId: null, coverURL: L.data.coverURL || null, thumbURL: L.data.thumbURL || null }, rec)),
      put('market/' + gid, { lastSaleAt: now }, { pre: preOf(L), incr: { sales: 1, revenue: gets } })
    ];
    if (gets) writes.splice(3, 0, create('wallets/' + seller + '/ledger/' + now + '_' + rid(6), { delta: gets, reason: 'market_sale', note: title + ' ← @' + buyerName, at: now, tx: tid }));
    const r = await commit(writes);
    if (r.ok) {
      /* the seller hears of it; the buyer gets their copy (again later if this fails — the licence is kept) */
      const nid = 'n_' + now.toString(36) + rid(6);
      await commit([create('users/' + seller + '/notifications/' + nid, { id: nid, type: 'market', event: 'sale', actorId: me.uid, actorName: buyerName, gameId: gid, title, points: gets, at: now, read: false })]).catch(() => {});
      let copyProjectId = null;
      try { copyProjectId = await makeCopy(me.uid, buyerName, rec); } catch (err) { console.error('[market] copy', err && err.message); }
      return Object.assign(outOf(rec), { copyProjectId, points: have - price });
    }
    if (!r.conflict) throw coded(503, 'store', 'تعذّر إتمام الشراء (' + r.status + ') — لم يُخصم شيء.');
  }
  throw coded(409, 'busy', 'حاول مرة أخرى بعد لحظة — لم يُخصم شيء.');
}
const outOf = p => ({ purchaseId: p.purchaseId || (p.buyerUid + '_' + p.gameId), gameId: p.gameId, projectId: p.projectId || null, title: p.title, price: p.price,
  transactionId: p.transactionId, copyProjectId: p.copyProjectId || null, at: p.timestamp || p.at || 0 });
async function purchaseOf(uid, gid) { const p = await getDoc('purchases/' + uid + '_' + gid); return p.exists ? outOf(p.data) : {}; }

/* ================================================================ the buyer's copy */
async function rawGet(path) {
  const r = await fetch(fsBase() + '/' + path, { headers: { authorization: 'Bearer ' + await accessToken() } });
  if (r.status === 404) return null;
  if (!r.ok) throw coded(503, 'store', 'قاعدة البيانات لا تجيب (' + r.status + ')');
  return r.json();
}
/* what is copied from a project — never its team, its publication, its history or its AI notes */
const NOT_COPIED = ['publishedId', 'showcaseId', 'publishMeta', 'showcase', 'members', 'memberIds', 'memberNames', 'rev', 'lastEdit', 'updatedBy',
  'history', 'aiMemory', 'remixedFrom', 'purchasedFrom', 'claim', 'claimKey', 'checkpoints'];
async function makeCopy(buyerUid, buyerName, p) {
  const id = 'proj_' + Date.now().toString(36) + rid(6).toLowerCase(), now = Date.now();
  const from = { gameId: p.gameId, projectId: p.projectId || null, sellerUid: p.sellerUid, creatorName: short(p.sellerName, 60), title: short(p.title, 120), transactionId: p.transactionId, at: now };
  let fieldsOut = null;
  const src = p.projectId ? await rawGet('projects/' + p.projectId) : null;
  if (src && src.fields) {
    fieldsOut = Object.assign({}, src.fields);
    NOT_COPIED.forEach(k => delete fieldsOut[k]);
  } else {
    /* the seller's project is gone: the published build (what players run) becomes the project */
    const bd = await getDoc('builds/' + p.gameId);
    if (!bd.exists) throw coded(404, 'no_source', 'لم يعد مصدر هذا المشروع موجودًا');
    let snap = bd.data;
    if (snap.snapshotRef && snap.snapshotRef.url) { try { const r = await fetch(snap.snapshotRef.url); if (r.ok) snap = Object.assign({}, snap, await r.json()); } catch { } }
    const a = snap.artifacts || { scripts: snap.scripts || [], components: snap.components || [], ui: [], styles: [] }, used = new Set();
    const path = n => { let q0 = String(n || 'Script.js').replace(/^\/+/, '').replace(/\.ts$/i, '.js'); if (!/\.[a-z0-9]+$/i.test(q0)) q0 += '.js'; let q = q0, i = 2; while (used.has(q)) q = q0.replace(/(\.[^.]+)$/, '_' + (i++) + '$1'); used.add(q); return q; };
    const f = (x, role, n) => ({ id: 'f_' + rid(10), path: path(n), code: String(x.code || ''), role, entityId: role === 'script' ? x.entityId || null : null, enabled: x.enabled !== false });
    const files = (a.scripts || []).map(x => f(x, 'script', x.name)).concat((a.components || []).map(x => f(x, 'component', x.name)),
      (a.ui || []).map(x => f(x, 'ui', x.path || x.name || 'ui.html')), (a.styles || []).map(x => f(x, 'style', x.path || x.name || 'style.css')));
    fieldsOut = fsFields(Object.assign({ scene: snap.scene || { objects: [] }, files, assetRefs: snap.assetRefs || [], settings: snap.settings || {}, deps: snap.deps || [], description: '' }, snap.i18n ? { i18n: snap.i18n } : {}));
  }
  Object.assign(fieldsOut, fsFields({ projectId: id, ownerId: buyerUid, ownerName: buyerName, name: short(p.title, 70) + ' 🛒', createdAt: now, updatedAt: now, purchasedFrom: from }));
  const r = await commit([{ update: { name: docName('projects/' + id), fields: fieldsOut }, currentDocument: { exists: false } },
    put('purchases/' + buyerUid + '_' + p.gameId, { copyProjectId: id, copiedAt: now })]);
  if (!r.ok) throw coded(503, 'store', 'تعذّر إنشاء نسختك (' + r.status + ')');
  return id;
}
/* «open»: the buyer's copy — made now when it is missing (or was deleted) */
async function openCopy(me, b) {
  const gid = cleanId(b.gameId);
  const p = await getDoc('purchases/' + me.uid + '_' + gid);
  if (!p.exists) throw coded(404, 'not_bought', 'لم تشترِ هذا المشروع.');
  if (p.data.copyProjectId) {
    const c = await getDoc('projects/' + p.data.copyProjectId, ['ownerId']);
    if (c.exists && c.data.ownerId === me.uid) return { copyProjectId: p.data.copyProjectId, made: false };
  }
  return { copyProjectId: await makeCopy(me.uid, await nameOf(me.uid), p.data), made: true };
}

/* ================================================================ the economy's numbers — the site's owner only */
async function setConfig(me, b) {
  if (!(await aiOwner(me))) throw coded(403, 'not_owner', 'هذه الإعدادات لصاحب الموقع فقط.');
  const cur = await getDoc('economy/config');
  const v = Object.assign({}, cur.exists ? cur.data : {});
  const patch = b.values || {};
  for (const [k, [, , lo, hi]] of Object.entries(ECON)) {
    if (!(k in patch)) continue;
    if (patch[k] === null || patch[k] === '') { delete v[k]; continue; }             // back to the Netlify variable / the default
    const n = +patch[k];
    if (!Number.isFinite(n) || n < lo || n > hi) throw coded(400, 'value', k + ': بين ' + lo + ' و' + hi, { key: k, min: lo, max: hi });
    v[k] = Math.round(n);
  }
  if ('pricePresets' in patch) {
    const list = Array.isArray(patch.pricePresets) ? patch.pricePresets : String(patch.pricePresets || '').split(/[\s,;]+/);
    v.pricePresets = list.map(Number).filter(n => Number.isInteger(n) && n > 0).slice(0, 8);
    if (!v.pricePresets.length) delete v.pricePresets;
  }
  v.updatedAt = Date.now(); v.updatedBy = me.uid;
  const r = await commit([put('economy/config', v, { whole: true, pre: preOf(cur) })]);
  if (!r.ok) throw coded(409, 'busy', 'حاول مرة أخرى');
  return pubEcon(await econ(true));
}

/* ================================================================ the router */
export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/api\/market/, '') || '/';
  try {
    const origin = req.headers.get('origin');
    if (origin && origin !== url.origin) return fail(403, 'origin', 'غير مسموح');
    if (path === '/config' && req.method === 'GET') {
      const e = await econ();
      let owner = false;
      if (req.headers.get('authorization')) { const me = await aiWho(req); owner = !!(me && !me.error && await aiOwner(me)); }
      return json(200, Object.assign({ ok: true, ready: fsReady(), owner }, pubEcon(e)));
    }
    if (!fsReady()) return fail(503, 'off', 'سوق المشاريع ومكافآت اللعب تحتاج FIREBASE_SERVICE_ACCOUNT في إعدادات Netlify (مثل النقاط).', { ready: false });
    const me = await aiWho(req);
    if (!me || me.error || me.provider === 'anonymous') return fail(401, 'signin', 'السوق لأصحاب الحسابات — سجّل الدخول (Google أو البريد).');
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    if (req.method !== 'POST') return fail(404, 'not_found', 'غير موجود');
    if (path === '/config') return json(200, Object.assign({ ok: true }, await setConfig(me, body)));
    if (path === '/list') return json(200, Object.assign({ ok: true }, await list(me, body)));
    if (path === '/buy') return json(200, Object.assign({ ok: true }, await buy(me, body)));
    if (path === '/open') return json(200, Object.assign({ ok: true }, await openCopy(me, body)));
    return fail(404, 'not_found', 'غير موجود');
  } catch (e) {
    if (e && e.status) return fail(e.status, e.code, e.message, e.extra || {});
    console.error('[market]', e);
    return fail(500, 'error', 'خطأ في الخادم');
  }
};

export const config = { path: '/api/market/*' };
