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
   • the site's commission: MARKET_FEE_PERCENT (15 %) of every sale stays with the site (economy/stats).
   • 💝 tips (/tip) and 🧩 files & code (/item/*: Vault objects and Mechanics sold as private copies) —
     PART 44, below; every move of tokens between two people goes through transfer().
   Netlify: FIREBASE_SERVICE_ACCOUNT (as for the points) ·
   MARKET_ENABLED · MARKET_MIN_PRICE · MARKET_MAX_PRICE · MARKET_PRICE_PRESETS ·
   MARKET_FEE_PERCENT · MARKET_MIN_BUYER_AGE_HOURS (and PLAY_* for Play Rewards).
   ============================================================ */
import { aiWho, aiOwner } from './ai.js';
import { ready as fsReady, getDoc, commit, put, create, preOf, wallet, coded, fsBase, docName, accessToken, econ, ECON, rid, fsFields,
  MICRO, microOf, earnedOf, walletAfter, fmtFixed, moneyPub, statsWrite, fromFs, rewardsPub } from './points.js';

const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const fail = (status, code, message, extra = {}) => json(status, Object.assign({ ok: false, error: { code, message } }, extra));
const cleanId = v => String(v || '').replace(/[^\w-]/g, '').slice(0, 64);
const cleanTx = v => String(v || '').replace(/[^\w-]/g, '').slice(0, 64);
const short = (t, n) => String(t || '').slice(0, n);

/* what anyone may know about the economy — the numbers a page shows, never a secret */
const pubEcon = e => ({ market: !!e.marketOn, minPrice: e.minPrice, maxPrice: e.maxPrice, pricePresets: e.pricePresets, feePercent: e.feePercent, sellerPercent: 100 - e.feePercent,
  buyerMinAgeHours: e.buyerMinAgeHours, currency: 'NEXUS_POINTS',
  play: { heartbeatSeconds: e.heartbeatSeconds, sessionMaxMinutes: e.sessionMaxMinutes },
  money: moneyPub(e), rewards: rewardsPub(e), streakRewards: e.streakRewards, spinPrizes: e.spinPrizes,
  /* every number as a person writes it (dollars as dollars) — for the owner's panel */
  values: Object.fromEntries(Object.entries(ECON).map(([k, [, , , , scale = 1]]) => [k, e[k] / scale])) });

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

/* ================================================================ tokens between two people — ONE commit
   Both wallets read and written whole under their preconditions (points.js · EXACT AMOUNTS), both ledgers, the
   site's commission (MARKET_FEE_PERCENT — 15 %: it stays with the site, counted in the owner's totals), and the
   caller's own writes (the purchase, the tip, the counters) — all of it or none of it. A wallet or a listing that
   changed meanwhile → step() reads and decides again. step() → { micro, fee, out, into, note, noteTo, tx, writes, stats } */
async function transfer(from, to, step) {
  await wallet(from); await wallet(to);                          // both wallets exist (a first visit: its welcome gift first)
  for (let i = 0; i < 5; i++) {
    const [wb, ws] = await Promise.all([getDoc('wallets/' + from), getDoc('wallets/' + to)]);
    const p = await step(wb, ws), have = microOf(wb.data);
    if (have < p.micro) throw coded(402, 'not_enough', 'رصيدك ' + fmtFixed(have, 6) + ' نقطة — تحتاج ' + fmtFixed(p.micro, 6) + '.', { points: have / MICRO, need: p.micro / MICRO });
    const [eb, es] = await Promise.all([earnedOf(from, wb.data), earnedOf(to, ws.data)]);
    const now = Date.now(), gets = p.micro - (p.fee || 0);
    const writes = [
      put('wallets/' + from, Object.assign({ updatedAt: now }, walletAfter(wb.data, eb, -p.micro, p.out)), { pre: preOf(wb) }),
      create('wallets/' + from + '/ledger/' + now + '_' + rid(6), { delta: -p.micro / MICRO, micro: -p.micro, reason: p.out, note: short(p.note, 120), at: now, tx: p.tx }),
      put('wallets/' + to, Object.assign({ updatedAt: now }, gets ? walletAfter(ws.data, es, gets, p.into) : {}), { pre: preOf(ws) })];
    if (gets) writes.push(create('wallets/' + to + '/ledger/' + now + '_' + rid(6), { delta: gets / MICRO, micro: gets, reason: p.into, note: short(p.noteTo || p.note, 120), at: now, tx: p.tx }));
    writes.push(...(p.writes || []));
    if (p.stats) writes.push(statsWrite(p.stats));
    const r = await commit(writes);
    if (r.ok) return { points: (have - p.micro) / MICRO, gets };
    if (!r.conflict) throw coded(503, 'store', 'تعذّر الحفظ (' + r.status + ') — لم يُخصم شيء.');
  }
  throw coded(409, 'busy', 'حاول مرة أخرى بعد لحظة — لم يُخصم شيء.');
}
const ALREADY = () => coded(200, 'already', 'already');
const cut = (micro, pct) => Math.floor(micro * pct / 100);

/* ================================================================ buying a project: one commit, once */
async function buy(me, b) {
  const e = await econ();
  if (!e.marketOn) throw coded(403, 'market_off', 'سوق المشاريع متوقف الآن على هذا الموقع.');
  const gid = cleanId(b.gameId), tid = cleanTx(b.transactionId);
  if (!gid || tid.length < 8) throw coded(400, 'bad_request', 'طلب شراء غير صالح');
  /* the same click again (or a second tab): the purchase already made, never a second charge */
  const done = async () => {
    const seen = await getDoc('market_tx/' + tid);
    if (seen.exists && (seen.data.buyerUid !== me.uid || seen.data.gameId !== gid)) throw coded(409, 'tx_taken', 'رقم العملية مستعمل — أعد المحاولة');
    const prior = await getDoc('purchases/' + me.uid + '_' + gid);
    return prior.exists ? Object.assign({ already: true }, outOf(prior.data)) : null;
  };
  const before = await done();
  if (before) return before;
  const L0 = await getDoc('market/' + gid);
  if (!L0.exists || !L0.data.isForSale || !(L0.data.price > 0)) throw coded(404, 'not_for_sale', 'هذا المشروع ليس للبيع الآن.');
  const seller = L0.data.ownerUid;
  if (seller === me.uid) throw coded(409, 'own', 'هذا مشروعك — لا تشتريه.');
  const buyerName = await nameOf(me.uid);
  let rec;
  try {
    const r = await transfer(me.uid, seller, async wb => {
      if (await done()) throw ALREADY();
      const L = await getDoc('market/' + gid);
      if (!L.exists || !L.data.isForSale || !(L.data.price > 0) || L.data.ownerUid !== seller) throw coded(404, 'not_for_sale', 'هذا المشروع ليس للبيع الآن.');
      const price = L.data.price, now = Date.now();
      if (b.expectedPrice != null && +b.expectedPrice !== price) throw coded(409, 'price_changed', 'تغيّر السعر إلى ' + price + ' نقطة — أكّد الشراء من جديد.', { price });
      const g = await getDoc('games/' + gid, ['ownerId', 'visibility']);
      if (!g.exists || g.data.ownerId !== seller || g.data.visibility === 'private') throw coded(404, 'not_for_sale', 'هذا المشروع ليس للبيع الآن.');
      if (e.buyerMinAgeHours && (now - (wb.data.createdAt || now)) / 3600e3 < e.buyerMinAgeHours) throw coded(403, 'too_new', 'الحسابات الجديدة تشتري بعد ' + e.buyerMinAgeHours + ' ساعة.');
      const micro = price * MICRO, fee = cut(micro, e.feePercent), title = short(L.data.title, 120);
      rec = { transactionId: tid, buyerUid: me.uid, buyerName, sellerUid: seller, sellerName: short(L.data.creatorName, 60), gameId: gid, projectId: L.data.projectId || null,
        title, price, fee: fee / MICRO, sellerGets: (micro - fee) / MICRO, currency: 'NEXUS_POINTS', timestamp: now, status: 'done' };
      return { micro, fee, out: 'market_buy', into: 'market_sale', note: title, noteTo: title + ' ← @' + buyerName, tx: tid, stats: { sales: 1, salesMicro: micro, feeMicro: fee },
        writes: [create('market_tx/' + tid, rec),
          create('purchases/' + me.uid + '_' + gid, Object.assign({ purchaseId: me.uid + '_' + gid, access: 'copy', copyProjectId: null, coverURL: L.data.coverURL || null, thumbURL: L.data.thumbURL || null }, rec)),
          put('market/' + gid, { lastSaleAt: now }, { pre: preOf(L), incr: { sales: 1, revenueMicro: micro - fee } })] };
    });
    /* the seller hears of it; the buyer gets their copy (again later if this fails — the licence is kept) */
    const nid = 'n_' + Date.now().toString(36) + rid(6);
    await commit([create('users/' + seller + '/notifications/' + nid, { id: nid, type: 'market', event: 'sale', actorId: me.uid, actorName: buyerName, gameId: gid, title: rec.title, points: rec.sellerGets, at: Date.now(), read: false })]).catch(() => {});
    let copyProjectId = null;
    try { copyProjectId = await makeCopy(me.uid, buyerName, rec); } catch (err) { console.error('[market] copy', err && err.message); }
    return Object.assign(outOf(rec), { copyProjectId, points: r.points });
  } catch (err) { if (err.code === 'already') return await done(); throw err; }
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

/* ================================================================ 💝 TIPS — a player supports a game's developer
   From the game's page: points from the player's wallet to the developer's, in ONE commit (transfer), once per
   tipId (the same click twice = one tip); TIP_MIN … TIP_MAX; TIP_FEE_PERCENT (0) for the site. A tip received is
   EARNED (it may be withdrawn); never multiplied by VIP. The developer hears of it. */
async function tip(me, b) {
  const e = await econ();
  const gid = cleanId(b.gameId), tid = cleanTx(b.tipId), amount = +b.amount;
  if (!gid || tid.length < 8) throw coded(400, 'bad_request', 'طلب غير صالح');
  if (!Number.isInteger(amount) || amount < e.tipMin || amount > e.tipMax) throw coded(400, 'tip_amount', 'الدعم بين ' + e.tipMin + ' و' + e.tipMax + ' نقطة.', { min: e.tipMin, max: e.tipMax });
  const seen = await getDoc('tips/' + tid);
  if (seen.exists) { if (seen.data.fromUid !== me.uid) throw coded(409, 'tx_taken', 'رقم العملية مستعمل — أعد المحاولة'); return { already: true, tipId: tid, amount: seen.data.amount }; }
  const g = await getDoc('games/' + gid, ['ownerId', 'visibility', 'title']);
  if (!g.exists || g.data.visibility === 'private') throw coded(404, 'game', 'اللعبة غير موجودة');
  const dev = g.data.ownerId;
  if (dev === me.uid) throw coded(409, 'tip_self', 'هذه لعبتك — الدعم يُرسل لمطوّرين آخرين.');
  const fromName = await nameOf(me.uid), title = short(g.data.title, 120), note = short(b.note, 140);
  let rec;
  try {
    const r = await transfer(me.uid, dev, async () => {
      if ((await getDoc('tips/' + tid)).exists) throw ALREADY();
      const micro = amount * MICRO, fee = cut(micro, e.tipFeePercent), now = Date.now();
      rec = { tipId: tid, fromUid: me.uid, fromName, toUid: dev, gameId: gid, title, amount, fee: fee / MICRO, gets: (micro - fee) / MICRO, note, at: now };
      return { micro, fee, out: 'tip_sent', into: 'tip_received', note: '💝 ' + title, noteTo: '💝 ' + title + ' ← @' + fromName, tx: tid, stats: { tips: 1, tipsMicro: micro, tipFeeMicro: fee },
        writes: [create('tips/' + tid, rec), put('game_tips/' + gid, { gameId: gid, ownerId: dev, updatedAt: now }, { incr: { count: 1, totalMicro: micro - fee } })] };
    });
    const nid = 'n_' + Date.now().toString(36) + rid(6);
    await commit([create('users/' + dev + '/notifications/' + nid, { id: nid, type: 'tip', actorId: me.uid, actorName: fromName, gameId: gid, title, points: rec.gets, note, at: Date.now(), read: false })]).catch(() => {});
    return { tipId: tid, amount, gets: rec.gets, points: r.points };
  } catch (err) { if (err.code === 'already') return { already: true, tipId: tid, amount }; throw err; }
}

/* ================================================================ 🧩 FILES & CODE — developers sell to developers
   A 🗄 Vault object (a model or shape with its scripts, components and physics) or a 🧩 Mechanic (a script or a
   component) is sold as COPIES, with the same commission (MARKET_FEE_PERCENT — 15 %). The listing
   (market_items/<kind>_<id>) shows what it is; what is sold is snapshotted into market_item_content/ (no page can
   read it) and copied into the BUYER's own Vault / Mechanics — private, purchasedFrom kept for good (firestore.rules:
   never made public, never resold). Only the owner lists; a public mechanic (free for all already), an object using
   the seller's private assets (the buyer could not load them) or a bought copy cannot be listed. */
const ITEM_COL = { vault: 'vault', mechanic: 'mechanics' };
const itemOut = p => ({ purchaseId: p.purchaseId || (p.buyerUid + '_' + p.itemId), itemId: p.itemId, kind: p.kind, title: p.title, price: p.price, transactionId: p.transactionId,
  copyId: p.copyId || null, at: p.timestamp || 0 });
async function itemList(me, b) {
  const e = await econ();
  if (!e.marketOn) throw coded(403, 'market_off', 'السوق متوقف الآن على هذا الموقع.');
  const kind = ITEM_COL[b.kind] ? b.kind : null, sid = cleanId(b.sourceId);
  if (!kind || !sid) throw coded(400, 'bad_request', 'طلب غير صالح');
  const itemId = kind + '_' + sid, now = Date.now();
  const L = await getDoc('market_items/' + itemId);
  if (b.forSale === false) {
    if (L.exists && L.data.isForSale) {
      if (L.data.ownerUid !== me.uid) throw coded(403, 'not_owner', 'ليس عنصرك.');
      const r = await commit([put('market_items/' + itemId, { isForSale: false, updatedAt: now }, { pre: preOf(L) })]);
      if (!r.ok) throw coded(409, 'busy', 'حاول مرة أخرى');
    }
    return { itemId, isForSale: false };
  }
  const src = await rawGet(ITEM_COL[kind] + '/' + sid);
  const data = src && src.fields ? fromFs({ mapValue: { fields: src.fields } }) : null;
  if (!data || data.ownerId !== me.uid) throw coded(403, 'not_owner', 'تبيع ما في خزنتك أو ميكانيكياتك فقط.');
  if (data.purchasedFrom) throw coded(403, 'bought_copy', 'هذه نسخة اشتريتها — لا تُعاد بيعها.');
  if (kind === 'mechanic' && data.visibility === 'public') throw coded(409, 'item_public', 'هذه الميكانيكية عامة (مجانية للجميع) — اجعلها خاصة أولًا ثم بِعها.');
  if (kind === 'vault') for (const a of (data.assetRefs || []).slice(0, 60)) {
    const as = await getDoc('assets/' + cleanId(a), ['visibility']).catch(() => ({ exists: false }));
    if (as.exists && as.data.visibility === 'private') throw coded(409, 'item_assets', 'هذا العنصر يستعمل أصولًا خاصة بك لن يراها المشتري — اجعلها عامة أو استبدلها.');
  }
  const price = +b.price;
  if (!Number.isInteger(price) || price < e.minPrice || price > e.maxPrice) throw coded(400, 'price', 'السعر عدد صحيح بين ' + e.minPrice + ' و' + e.maxPrice + ' نقطة.', { min: e.minPrice, max: e.maxPrice });
  const f = { itemId, kind, sourceId: sid, ownerId: me.uid, ownerUid: me.uid, creatorName: short(await nameOf(me.uid), 60), title: short(b.title || data.name, 60),
    description: short(b.description != null ? b.description : data.description || data.note || '', 300),
    thumb: kind === 'vault' && typeof data.thumb === 'string' && data.thumb.length <= 60000 ? data.thumb : null,
    info: kind === 'vault' ? { scripts: (data.scripts || []).length, components: (data.components || []).length } : { type: short(data.type, 60), lines: String(data.code || '').split('\n').length },
    price, currency: 'NEXUS_POINTS', isForSale: true, updatedAt: now };
  if (!L.exists) Object.assign(f, { createdAt: now, sales: 0 });
  const r = await commit([put('market_items/' + itemId, f, { pre: preOf(L) }), { update: { name: docName('market_item_content/' + itemId), fields: Object.assign({}, src.fields) } }]);
  if (!r.ok) throw coded(409, 'busy', 'حاول مرة أخرى بعد لحظة');
  return { itemId, isForSale: true, price };
}
async function itemBuy(me, b) {
  const e = await econ();
  if (!e.marketOn) throw coded(403, 'market_off', 'السوق متوقف الآن على هذا الموقع.');
  const itemId = cleanId(b.itemId), tid = cleanTx(b.transactionId);
  if (!itemId || tid.length < 8) throw coded(400, 'bad_request', 'طلب شراء غير صالح');
  const done = async () => {
    const seen = await getDoc('market_tx/' + tid);
    if (seen.exists && (seen.data.buyerUid !== me.uid || seen.data.itemId !== itemId)) throw coded(409, 'tx_taken', 'رقم العملية مستعمل — أعد المحاولة');
    const prior = await getDoc('item_purchases/' + me.uid + '_' + itemId);
    return prior.exists ? Object.assign({ already: true }, itemOut(prior.data)) : null;
  };
  const before = await done();
  if (before) return before;
  const L0 = await getDoc('market_items/' + itemId);
  if (!L0.exists || !L0.data.isForSale || !(L0.data.price > 0)) throw coded(404, 'not_for_sale', 'هذا العنصر ليس للبيع الآن.');
  const seller = L0.data.ownerUid;
  if (seller === me.uid) throw coded(409, 'own', 'هذا عنصرك — لا تشتريه.');
  const buyerName = await nameOf(me.uid);
  let rec;
  try {
    const r = await transfer(me.uid, seller, async () => {
      if (await done()) throw ALREADY();
      const L = await getDoc('market_items/' + itemId);
      if (!L.exists || !L.data.isForSale || !(L.data.price > 0) || L.data.ownerUid !== seller) throw coded(404, 'not_for_sale', 'هذا العنصر ليس للبيع الآن.');
      const price = L.data.price, now = Date.now();
      if (b.expectedPrice != null && +b.expectedPrice !== price) throw coded(409, 'price_changed', 'تغيّر السعر إلى ' + price + ' نقطة — أكّد الشراء من جديد.', { price });
      const micro = price * MICRO, fee = cut(micro, e.feePercent), title = short(L.data.title, 60);
      rec = { transactionId: tid, buyerUid: me.uid, buyerName, sellerUid: seller, sellerName: short(L.data.creatorName, 60), itemId, kind: L.data.kind, title, price,
        fee: fee / MICRO, sellerGets: (micro - fee) / MICRO, currency: 'NEXUS_POINTS', timestamp: now, status: 'done' };
      return { micro, fee, out: 'market_buy', into: 'market_sale', note: '🧩 ' + title, noteTo: '🧩 ' + title + ' ← @' + buyerName, tx: tid, stats: { sales: 1, salesMicro: micro, feeMicro: fee },
        writes: [create('market_tx/' + tid, rec), create('item_purchases/' + me.uid + '_' + itemId, Object.assign({ purchaseId: me.uid + '_' + itemId, copyId: null, thumb: L.data.thumb || null }, rec)),
          put('market_items/' + itemId, { lastSaleAt: now }, { pre: preOf(L), incr: { sales: 1, revenueMicro: micro - fee } })] };
    });
    const nid = 'n_' + Date.now().toString(36) + rid(6);
    await commit([create('users/' + seller + '/notifications/' + nid, { id: nid, type: 'market', event: 'sale', actorId: me.uid, actorName: buyerName, itemId, title: rec.title, points: rec.sellerGets, at: Date.now(), read: false })]).catch(() => {});
    let copyId = null;
    try { copyId = await itemCopy(me.uid, rec); } catch (err) { console.error('[market] item copy', err && err.message); }
    return Object.assign(itemOut(rec), { copyId, points: r.points });
  } catch (err) { if (err.code === 'already') return await done(); throw err; }
}
/* the buyer's own copy: in their Vault / Mechanics, private, purchasedFrom kept */
async function itemCopy(buyerUid, p) {
  const src = await rawGet('market_item_content/' + p.itemId);
  if (!src || !src.fields) throw coded(404, 'item_gone', 'محتوى هذا العنصر غير موجود');
  const vault = p.kind === 'vault', id = (vault ? 'vault_' : 'mech_') + Date.now().toString(36) + rid(6).toLowerCase(), now = Date.now();
  const fields = Object.assign({}, src.fields, fsFields(Object.assign({ [vault ? 'vaultId' : 'mechId']: id, ownerId: buyerUid, uses: 0, createdAt: now, updatedAt: now,
    purchasedFrom: { itemId: p.itemId, sellerUid: p.sellerUid, creatorName: short(p.sellerName, 60), title: short(p.title, 60), transactionId: p.transactionId, at: now } }, vault ? {} : { visibility: 'private' })));
  const r = await commit([{ update: { name: docName(ITEM_COL[p.kind] + '/' + id), fields }, currentDocument: { exists: false } },
    put('item_purchases/' + buyerUid + '_' + p.itemId, { copyId: id, copiedAt: now })]);
  if (!r.ok) throw coded(503, 'store', 'تعذّر إنشاء نسختك (' + r.status + ')');
  return id;
}
async function itemOpen(me, b) {
  const itemId = cleanId(b.itemId);
  const p = await getDoc('item_purchases/' + me.uid + '_' + itemId);
  if (!p.exists) throw coded(404, 'not_bought', 'لم تشترِ هذا العنصر.');
  if (p.data.copyId) {
    const c = await getDoc(ITEM_COL[p.data.kind] + '/' + p.data.copyId, ['ownerId']);
    if (c.exists && c.data.ownerId === me.uid) return { kind: p.data.kind, copyId: p.data.copyId, made: false };
  }
  return { kind: p.data.kind, copyId: await itemCopy(me.uid, p.data), made: true };
}

/* ================================================================ the economy's numbers — the site's owner only */
async function setConfig(me, b) {
  if (!(await aiOwner(me))) throw coded(403, 'not_owner', 'هذه الإعدادات لصاحب الموقع فقط.');
  const cur = await getDoc('economy/config');
  const v = Object.assign({}, cur.exists ? cur.data : {});
  const patch = b.values || {};
  for (const [k, [, , lo, hi, scale = 1]] of Object.entries(ECON)) {
    if (!(k in patch)) continue;
    if (patch[k] === null || patch[k] === '') { delete v[k]; continue; }             // back to the Netlify variable / the default
    const n = Math.round(+patch[k] * scale);                                         // dollars → cents · micro-dollars (the 5th number)
    if (!Number.isFinite(n) || n < lo || n > hi) throw coded(400, 'value', k + ': بين ' + lo / scale + ' و' + hi / scale, { key: k, min: lo / scale, max: hi / scale });
    v[k] = n;
  }
  if ('streakRewards' in patch) {
    const list = (Array.isArray(patch.streakRewards) ? patch.streakRewards : String(patch.streakRewards || '').split(/[\s,;]+/)).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 1000000).slice(0, 14);
    if (list.length) v.streakRewards = list; else delete v.streakRewards;
  }
  if ('spinPrizes' in patch) {
    const list = (Array.isArray(patch.spinPrizes) ? patch.spinPrizes : String(patch.spinPrizes || '').split(/[\s,;]+/)).map(String).filter(x => /^\d{1,7}:\d{1,7}$/.test(x) && +x.split(':')[1] > 0).slice(0, 12);
    if (list.length >= 2) v.spinPrizes = list; else delete v.spinPrizes;
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
    if (path === '/tip') return json(200, Object.assign({ ok: true }, await tip(me, body)));
    if (path === '/item/list') return json(200, Object.assign({ ok: true }, await itemList(me, body)));
    if (path === '/item/buy') return json(200, Object.assign({ ok: true }, await itemBuy(me, body)));
    if (path === '/item/open') return json(200, Object.assign({ ok: true }, await itemOpen(me, body)));
    return fail(404, 'not_found', 'غير موجود');
  } catch (e) {
    if (e && e.status) return fail(e.status, e.code, e.message, e.extra || {});
    console.error('[market]', e);
    return fail(500, 'error', 'خطأ في الخادم');
  }
};

export const config = { path: '/api/market/*' };
