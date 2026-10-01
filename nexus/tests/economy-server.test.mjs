/* ============================================================
   NEXUS tests · the economy on the server — 🛒 the project marketplace
   (netlify/edge-functions/market.js) and ⏱ play sessions (points.js — timed by
   the server, sealed tokens; play time earns no points since PART 44) — against the Firebase emulator's Firestore (the real
   database the server writes). The server's clock is moved by the test
   (Date.now), so ten minutes of play take no time.
   Needs:  firebase emulators:start --project demo-nexus --only auth,firestore,storage
   Run:    node nexus/tests/economy-server.test.mjs
   ============================================================ */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { token } from './mock-world.mjs';
import { importChallenges } from './e2e-server.mjs';
import { fsSet, fsGet, fsQuery, resetEmulators } from './e2e-kit.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let ENV = {}, version = 0;
globalThis.Netlify = { env: { get: k => ENV[k] } };
/* the server's clock: the real one plus what the test moved it by */
const realNow = Date.now.bind(Date);
let skew = 0;
Date.now = () => realNow() + skew;
const later = s => { skew += s * 1000; };
const DAY = 864e5;

let H = {};
async function fresh(env = {}) {
  ENV = Object.assign({ FIREBASE_PROJECT_ID: 'demo-nexus', NEXUS_TEST_EMULATOR_TOKENS: '1', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', ADMIN_EMAILS: 'owner@example.com', MARKET_FEE_PERCENT: '0' }, env);
  await resetEmulators();
  const v = 'v=' + (++version);
  H.market = await importChallenges(v, 'market');
  H.points = (await import(pathToFileURL(path.join(ROOT, 'netlify/edge-functions/points.js')).href + '?' + v)).default;
}
const call = (h, base) => async (p, { uid = null, body, method = 'POST', email } = {}) => {
  const r = await h(new Request('http://nexus.test/api/' + base + p, { method, headers: Object.assign({ 'content-type': 'application/json' },
    uid ? { authorization: 'Bearer ' + token(uid, email ? { email } : {}) } : {}), body: body ? JSON.stringify(body) : undefined }));
  const j = await r.json(); return Object.assign(j, { status: r.status });
};
const M = (p, o) => call(H.market, 'market')(p, o), P = (p, o) => call(H.points, 'points')(p, o);
const balance = async uid => ((await fsGet('wallets/' + uid)) || {}).points || 0;
const ledger = async (uid, reason) => (await fsQueryDeep('wallets/' + uid + '/ledger')).filter(x => !reason || x.reason === reason);
async function fsQueryDeep(col) {
  const r = await fetch('http://127.0.0.1:8080/v1/projects/demo-nexus/databases/(default)/documents/' + col + '?pageSize=300', { headers: { authorization: 'Bearer owner' } });
  const j = await r.json();
  return (j.documents || []).map(d => Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, v.integerValue != null ? +v.integerValue : v.stringValue != null ? v.stringValue : v.booleanValue != null ? v.booleanValue : v.doubleValue])));
}

/* a published game and its project, as NEXUS's «Publish» leaves them */
async function game(owner, { gid = 'game_race', pid = 'proj_race', title = 'Ultimate Racing', visibility = 'public', project = {} } = {}) {
  await fsSet('projects/' + pid, Object.assign({ projectId: pid, ownerId: owner, ownerName: owner, name: title, publishedId: gid,
    scene: { objects: [{ id: 'car', name: 'Car', type: 'primitive', props: { shape: 'box' } }] },
    files: [{ id: 'f1', path: 'Drive.js', code: 'function update(dt) { self.position.z += dt; }', role: 'script', entityId: 'car', enabled: true }],
    assetRefs: ['asset_tire'], settings: { physics: true }, history: [{ at: 1 }], members: {}, memberIds: [], createdAt: 1, updatedAt: 1 }, project));
  await fsSet('games/' + gid, { gameId: gid, projectId: pid, ownerId: owner, creatorName: owner + 'Name', title, description: 'drive fast', genre: 'Racing',
    visibility, plays: 0, likes: 3, allowRemix: true, createdAt: 1, updatedAt: 1, coverURL: null });
  await fsSet('builds/' + gid, { gameId: gid, ownerId: owner, scene: { objects: [] }, artifacts: { scripts: [{ name: 'Drive.js', code: 'built();' }], components: [] }, assetRefs: [], settings: {}, updatedAt: 1 });
  return { gid, pid };
}
const give = (uid, points, extra = {}) => fsSet('wallets/' + uid, Object.assign({ points, welcomed: true, createdAt: Date.now() - 30 * DAY, updatedAt: Date.now() }, extra));

const tests = [];
const test = (name, f) => tests.push({ name, f });

/* ================================================================ 🛒 selling */
test('1 · Free or Paid: the owner lists the project at a price within the limits; nobody else can; out of limits → refused; the remix of a paid project is turned off', async () => {
  await fresh();
  const { gid } = await game('lina');
  const cfg = await M('/config', { method: 'GET' });
  assert.equal(cfg.ok, true); assert.deepEqual(cfg.pricePresets, [100, 500, 1000, 5000]); assert.equal(cfg.minPrice, 10); assert.equal(cfg.currency, 'NEXUS_POINTS');
  assert.equal((await M('/list', { uid: 'omar', body: { gameId: gid, price: 500 } })).error.code, 'not_owner');
  assert.equal((await M('/list', { uid: 'lina', body: { gameId: gid, price: 5 } })).error.code, 'price');
  assert.equal((await M('/list', { uid: 'lina', body: { gameId: gid, price: 2.5 } })).error.code, 'price');
  assert.equal((await M('/list', { uid: 'lina', body: { gameId: gid, price: 100000000 } })).error.code, 'price');
  const r = await M('/list', { uid: 'lina', body: { gameId: gid, price: 500 } });
  assert.equal(r.ok, true, JSON.stringify(r));
  const L = await fsGet('market/' + gid);
  assert.deepEqual([L.ownerUid, L.projectId, L.price, L.currency, L.isForSale, L.sales], ['lina', 'proj_race', 500, 'NEXUS_POINTS', true, 0]);
  assert.equal((await fsGet('games/' + gid)).allowRemix, false, 'not free by Remix at the same time');
  /* a custom price; then not for sale */
  await M('/list', { uid: 'lina', body: { gameId: gid, price: 777 } });
  assert.equal((await fsGet('market/' + gid)).price, 777);
  await M('/list', { uid: 'lina', body: { gameId: gid, forSale: false } });
  assert.equal((await fsGet('market/' + gid)).isForSale, false);
  /* a private game, a bought copy, someone else\'s remix: never listed */
  await game('lina', { gid: 'g_priv', pid: 'p_priv', visibility: 'private' });
  assert.equal((await M('/list', { uid: 'lina', body: { gameId: 'g_priv', price: 100 } })).error.code, 'private');
  await game('lina', { gid: 'g_bought', pid: 'p_bought', project: { purchasedFrom: { gameId: 'x', sellerUid: 'sam' } } });
  assert.equal((await M('/list', { uid: 'lina', body: { gameId: 'g_bought', price: 100 } })).error.code, 'bought_copy');
  await game('lina', { gid: 'g_rmx', pid: 'p_rmx', project: { remixedFrom: { gameId: 'y', ownerId: 'sam' } } });
  assert.equal((await M('/list', { uid: 'lina', body: { gameId: 'g_rmx', price: 100 } })).error.code, 'remix');
});

/* ================================================================ 🛒 buying */
test('2 · Buying «Ultimate Racing» for 500: −500 from the buyer, +500 to the seller, both ledgers, the purchase and its transaction (buyerUid · sellerUid · projectId · price · timestamp · transactionId), the buyer\'s own copy, the seller told', async () => {
  await fresh();
  const { gid } = await game('lina');
  await M('/list', { uid: 'lina', body: { gameId: gid, price: 500 } });
  await give('omar', 800); await give('lina', 20);
  const r = await M('/buy', { uid: 'omar', body: { gameId: gid, transactionId: 'tx_omar_000001', expectedPrice: 500 } });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(await balance('omar'), 300); assert.equal(await balance('lina'), 520);
  const tx = await fsGet('market_tx/tx_omar_000001');
  assert.deepEqual([tx.buyerUid, tx.sellerUid, tx.projectId, tx.gameId, tx.price, tx.sellerGets, tx.currency, tx.status], ['omar', 'lina', 'proj_race', gid, 500, 500, 'NEXUS_POINTS', 'done']);
  assert.ok(tx.timestamp > 0);
  const pu = await fsGet('purchases/omar_' + gid);
  assert.equal(pu.transactionId, 'tx_omar_000001'); assert.ok(pu.copyProjectId);
  const copy = await fsGet('projects/' + pu.copyProjectId);
  assert.equal(copy.ownerId, 'omar'); assert.equal(copy.purchasedFrom.gameId, gid); assert.equal(copy.purchasedFrom.sellerUid, 'lina');
  assert.deepEqual(copy.files.map(f => [f.path, f.code]), [['Drive.js', 'function update(dt) { self.position.z += dt; }']]);
  assert.deepEqual(copy.assetRefs, ['asset_tire']);
  assert.ok(!copy.publishedId && !copy.history && !copy.members, 'not the original\'s publication, history or team');
  const orig = await fsGet('projects/proj_race');
  assert.equal(orig.ownerId, 'lina', 'the original stays the seller\'s');
  assert.deepEqual((await ledger('omar', 'market_buy')).map(x => x.delta), [-500]);
  assert.deepEqual((await ledger('lina', 'market_sale')).map(x => x.delta), [500]);
  const L = await fsGet('market/' + gid);
  assert.deepEqual([L.sales, L.revenueMicro], [1, 500 * 1e6], 'revenue in exact millionths');
  const notes = await fsQueryDeep('users/lina/notifications');
  assert.ok(notes.some(n => n.type === 'market' && n.event === 'sale' && n.points === 500), JSON.stringify(notes));
});

test('3 · Not enough points: refused, nothing changes; the seller cannot buy their own; a changed price must be confirmed again', async () => {
  await fresh();
  const { gid } = await game('lina');
  await M('/list', { uid: 'lina', body: { gameId: gid, price: 500 } });
  await give('omar', 499); await give('lina', 1000);
  const r = await M('/buy', { uid: 'omar', body: { gameId: gid, transactionId: 'tx_poor_00001', expectedPrice: 500 } });
  assert.equal(r.status, 402); assert.equal(r.error.code, 'not_enough'); assert.equal(r.need, 500);
  assert.equal(await balance('omar'), 499); assert.equal(await balance('lina'), 1000);
  assert.equal(await fsGet('purchases/omar_' + gid), null); assert.equal(await fsGet('market_tx/tx_poor_00001'), null);
  assert.equal((await M('/buy', { uid: 'lina', body: { gameId: gid, transactionId: 'tx_self_00001' } })).error.code, 'own');
  await give('omar', 2000);
  await M('/list', { uid: 'lina', body: { gameId: gid, price: 900 } });
  const c = await M('/buy', { uid: 'omar', body: { gameId: gid, transactionId: 'tx_chg_000001', expectedPrice: 500 } });
  assert.equal(c.error.code, 'price_changed'); assert.equal(c.price, 900); assert.equal(await balance('omar'), 2000);
});

test('4 · Pressed again and again: the same transaction once; another click, another tab, five at the same moment — ONE purchase, ONE charge', async () => {
  await fresh();
  const { gid } = await game('lina');
  await M('/list', { uid: 'lina', body: { gameId: gid, price: 100 } });
  await give('omar', 1000); await give('lina', 0);
  const a = await M('/buy', { uid: 'omar', body: { gameId: gid, transactionId: 'tx_same_00001' } });
  const b = await M('/buy', { uid: 'omar', body: { gameId: gid, transactionId: 'tx_same_00001' } });
  assert.equal(a.ok, true); assert.equal(b.already, true);
  const c = await M('/buy', { uid: 'omar', body: { gameId: gid, transactionId: 'tx_other_0001' } });
  assert.equal(c.already, true); assert.equal(c.transactionId, 'tx_same_00001');
  assert.equal(await balance('omar'), 900); assert.equal(await balance('lina'), 100);
  /* a fresh buyer: five requests at once */
  await give('sara', 1000);
  const all = await Promise.all([1, 2, 3, 4, 5].map(i => M('/buy', { uid: 'sara', body: { gameId: gid, transactionId: 'tx_rush_0000' + i } })));
  assert.equal(all.filter(x => x.ok && !x.already).length, 1, JSON.stringify(all.map(x => x.error || x.already)));
  assert.equal(await balance('sara'), 900); assert.equal(await balance('lina'), 200);
  assert.equal((await ledger('sara', 'market_buy')).length, 1); assert.equal((await fsGet('market/' + gid)).sales, 2);
});

test('5 · The buyer opens a purchase: their copy (made again if they deleted it); nobody else can open it; a fee keeps a share when the owner sets one', async () => {
  await fresh({ MARKET_FEE_PERCENT: '10' });
  const { gid } = await game('lina');
  await M('/list', { uid: 'lina', body: { gameId: gid, price: 500 } });
  await give('omar', 600); await give('lina', 0);
  const r = await M('/buy', { uid: 'omar', body: { gameId: gid, transactionId: 'tx_fee_000001' } });
  assert.equal(await balance('lina'), 450, 'the seller gets 90%');
  assert.equal((await fsGet('market_tx/tx_fee_000001')).fee, 50);
  const o = await M('/open', { uid: 'omar', body: { gameId: gid } });
  assert.equal(o.copyProjectId, r.copyProjectId); assert.equal(o.made, false);
  await fetch('http://127.0.0.1:8080/v1/projects/demo-nexus/databases/(default)/documents/projects/' + r.copyProjectId, { method: 'DELETE', headers: { authorization: 'Bearer owner' } });
  const o2 = await M('/open', { uid: 'omar', body: { gameId: gid } });
  assert.equal(o2.made, true); assert.equal((await fsGet('projects/' + o2.copyProjectId)).ownerId, 'omar');
  assert.equal((await M('/open', { uid: 'sam', body: { gameId: gid } })).error.code, 'not_bought');
  /* the seller deleted their project: the copy comes from the published build */
  await fetch('http://127.0.0.1:8080/v1/projects/demo-nexus/databases/(default)/documents/projects/proj_race', { method: 'DELETE', headers: { authorization: 'Bearer owner' } });
  await give('sara', 600);
  const s = await M('/buy', { uid: 'sara', body: { gameId: gid, transactionId: 'tx_build_0001' } });
  const sc = await fsGet('projects/' + s.copyProjectId);
  assert.deepEqual(sc.files.map(f => [f.path, f.code, f.role]), [['Drive.js', 'built();', 'script']]);
});

/* ================================================================ ⏱ play time */
/* every beat carries the server's latest sealed token (🛡) and gets the next one */
async function beat(uid, s, extra = {}, path = '/play/beat') {
  const r = await P(path, { uid, body: Object.assign({ sessionId: s.sid, token: s.token }, extra) });
  if (r.token) s.token = r.token;
  return r;
}
async function play(uid, gid, beats, { every = 60, hidden = 0, idle = false } = {}) {
  const st = await P('/play/start', { uid, body: { gameId: gid } });
  assert.equal(st.ok, true, JSON.stringify(st));
  const s = { sid: st.sessionId, token: st.token, last: null };
  for (let i = 0; i < beats; i++) { later(every); s.last = await beat(uid, s, { hidden, idle }); }
  return s;
}
test('6 · A play session timed by the server: start, a heartbeat a minute, the credited time = the real time; a beat sent too soon counts nothing; the session\'s record', async () => {
  await fresh();
  const { gid } = await game('lina');
  await give('omar', 0);
  const S = await play('omar', gid, 3), sid = S.sid;
  const ps = await fsGet('play_sessions/' + sid);
  assert.deepEqual([ps.gameId, ps.playerUid, ps.projectId, ps.state, ps.duration, ps.beats], [gid, 'omar', 'proj_race', 'active', 180, 3]);
  assert.ok(ps.startedAt > 0 && ps.lastHeartbeat > ps.startedAt && ps.endedAt === null);
  later(5);
  const early = await beat('omar', S);
  assert.equal(early.why, 'early'); assert.equal(early.credited, 0);
  later(25);
  const end = await beat('omar', S, {}, '/play/end');
  assert.equal(end.credited, 30);
  const done = await fsGet('play_sessions/' + sid);
  assert.equal(done.state, 'ended'); assert.equal(done.duration, 210); assert.ok(done.endedAt > 0);
  assert.equal((await beat('omar', S)).stop, true, 'an ended session counts nothing more');
  const pt = await fsGet('playtime/' + gid);
  assert.deepEqual([pt.seconds, pt.sessions, pt.players], [210, 1, 1]);
  assert.equal((await beat('sam', S)).error.code, 'play_token', 'nobody beats someone else\'s session');
});

test('7 · Closed, offline, in the background, idle: not counted; the creator\'s own play never counts; three players add up', async () => {
  await fresh();
  const { gid } = await game('lina');
  for (const u of ['a', 'b', 'c', 'lina']) await give(u, 0);
  const a = await play('a', gid, 2);                                   // 120 s
  later(600);                                                          // the tab closed / the phone offline 10 min
  const gap = await beat('a', a);
  assert.equal(gap.credited, 0); assert.equal(gap.why, 'gap');
  later(60);
  const back = await beat('a', a);
  assert.equal(back.credited, 60, 'counted again once beats come back');
  later(60);
  const hid = await beat('a', a, { hidden: 45 });
  assert.equal(hid.credited, 15, 'minus the seconds the page was hidden');
  await play('b', gid, 3, { idle: true });                             // nobody touched the game
  await play('c', gid, 5);                                             // 300 s
  await play('lina', gid, 5);                                          // the creator: no
  const pt = await fsGet('playtime/' + gid);
  assert.equal(pt.seconds, 120 + 60 + 15 + 300);
  assert.equal(pt.sessions, 3); assert.equal(pt.players, 3);
});

test('8 · One counted session per account: a second tab or device takes over, the first stops; the game opened again counts as the same player', async () => {
  await fresh();
  const { gid } = await game('lina');
  await game('lina', { gid: 'g_two', pid: 'p_two' });
  await give('omar', 0);
  const s1 = await P('/play/start', { uid: 'omar', body: { gameId: gid } });
  later(3);
  const s2 = await P('/play/start', { uid: 'omar', body: { gameId: 'g_two' } });
  later(60);
  const b1 = await beat('omar', { sid: s1.sessionId, token: s1.token });
  assert.equal(b1.stop, true); assert.equal(b1.state, 'replaced');
  const b2 = await beat('omar', { sid: s2.sessionId, token: s2.token });
  assert.equal(b2.credited, 60, 'from its own start');
  later(3);
  await P('/play/start', { uid: 'omar', body: { gameId: gid } });
  const pt = await fsGet('playtime/' + gid);
  assert.equal(pt.players, 1, 'the same player once'); assert.equal(pt.sessions, 2);
});

/* ================================================================ play time earns no points (PART 44) */
test('9 · Play time is a number of its own: 97 minutes of play → 97 minutes counted, ZERO points to the creator, likes untouched; the old Play Rewards settings are gone', async () => {
  await fresh();
  const { gid } = await game('lina');
  await give('omar', 0); await give('lina', 0);
  await play('omar', gid, 10);
  await play('omar', gid, 87);
  const pt = await fsGet('playtime/' + gid);
  assert.equal(pt.seconds, 97 * 60);
  assert.equal(await balance('lina'), 0); assert.equal((await ledger('lina', 'play')).length, 0);
  assert.equal(pt.rewardPoints, undefined); assert.equal(pt.pendingSeconds, undefined);
  assert.equal((await fsGet('games/' + gid)).likes, 3, 'likes are never touched by play time');
  await M('/config', { uid: 'owner', email: 'owner@example.com', body: { values: { playPoints: 2, playIntervalMinutes: 1 } } });
  await play('omar', gid, 3);
  assert.equal(await balance('lina'), 0, 'no setting brings them back');
});

test('10 · The page cannot send a duration (or seconds), nor beat without the server\'s token; a brand-new account\'s play is play time all the same', async () => {
  await fresh();
  const { gid } = await game('lina');
  await fsSet('wallets/fresh1', { points: 0, welcomed: true, createdAt: Date.now() - 3600e3, updatedAt: Date.now() });   // an hour old
  await play('fresh1', gid, 12);
  assert.equal((await fsGet('playtime/' + gid)).seconds, 720);
  await give('cheat', 0);
  const s = await P('/play/start', { uid: 'cheat', body: { gameId: gid } });
  later(60);
  assert.equal((await P('/play/beat', { uid: 'cheat', body: { sessionId: s.sessionId, duration: 1000000 } })).error.code, 'play_token');
  const b = await beat('cheat', { sid: s.sessionId, token: s.token }, { duration: 1000000, seconds: 999999 });
  assert.equal(b.credited, 60);
});

test('11 · The economy\'s numbers: anyone reads them; only the site\'s owner changes them (out of range refused); the old minute-by-minute page counts nothing', async () => {
  await fresh();
  assert.equal((await M('/config', { uid: 'omar', body: { values: { feePercent: 50 } } })).error.code, 'not_owner');
  assert.equal((await M('/config', { uid: 'owner', email: 'owner@example.com', body: { values: { feePercent: 95 } } })).error.code, 'value');
  const r = await M('/config', { uid: 'owner', email: 'owner@example.com', body: { values: { heartbeatSeconds: 30, minPrice: 50, pricePresets: '50,250' } } });
  assert.equal(r.ok, true, JSON.stringify(r));
  const c = await M('/config', { method: 'GET' });
  assert.equal(c.play.heartbeatSeconds, 30); assert.equal(c.minPrice, 50); assert.deepEqual(c.pricePresets, [50, 250]);
  const { gid } = await game('lina');
  assert.equal((await M('/list', { uid: 'lina', body: { gameId: gid, price: 20 } })).error.code, 'price');
  /* an older page: one call a minute with the game's id, no token — nothing counted (it reloads) */
  await give('omar', 0);
  const a = await P('/play', { uid: 'omar', body: { gameId: gid } });
  assert.equal(a.ok, true); assert.equal(a.counted, false);
  later(60);
  assert.equal((await P('/play', { uid: 'omar', body: { gameId: gid } })).counted, false);
  assert.equal(await fsGet('playtime/' + gid), null);
});

let pass = 0, failN = 0;
for (const t of tests) {
  const t0 = realNow();
  try { await t.f(); pass++; console.log('✓ ' + t.name + '  (' + ((realNow() - t0) / 1000).toFixed(1) + 's)'); }
  catch (e) { failN++; console.log('✗ ' + t.name + '\n    ' + String(e && e.stack || e).split('\n').slice(0, 6).join('\n    ')); }
}
console.log('\n' + pass + ' passed, ' + failN + ' failed');
process.exit(failN ? 1 : 0);
