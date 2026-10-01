/* ============================================================
   NEXUS tests · rewards on the server (points.js, market.js — PART 44):
   🔥 daily login streak · 🎡 lucky spin (free, after an ad, VIP) · 🎁 invite &
   earn (paid after the friend's real play) · 👑 VIP (tokens, Stripe, ×2 only on
   what the site gives) · 💝 tips · 🧩 files & code marketplace (15 %) ·
   🛡 sealed heartbeat tokens · 📊 the owner's dashboard — and Play Rewards gone
   (play time earns no points). Against the Firebase emulator's Firestore, a fake
   Stripe, and the server's clock moved by the test.
   Needs:  firebase emulators:start --project demo-nexus --only auth,firestore,storage
   Run:    node nexus/tests/rewards-server.test.mjs
   ============================================================ */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { token, fakeStripe } from './mock-world.mjs';
import { importChallenges } from './e2e-server.mjs';
import { fsSet, fsGet, fsQuery, resetEmulators } from './e2e-kit.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let ENV = {}, version = 0;
globalThis.Netlify = { env: { get: k => ENV[k] } };
const realNow = Date.now.bind(Date);
let skew = 0;
Date.now = () => realNow() + skew;
const later = s => { skew += s * 1000; };
const DAY = 864e5, M6 = 1000000;
const S = await fakeStripe('whsec_rewards');

let H = {};
async function fresh(env = {}) {
  ENV = Object.assign({ FIREBASE_PROJECT_ID: 'demo-nexus', NEXUS_TEST_EMULATOR_TOKENS: '1', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', ADMIN_EMAILS: 'owner@example.com',
    STRIPE_SECRET_KEY: 'sk_test_rw', STRIPE_WEBHOOK_SECRET: 'whsec_rewards', STRIPE_API_BASE: S.base, ADS_WEB: '1' }, env);
  await resetEmulators();
  const v = 'v=' + (++version);
  H.market = await importChallenges(v, 'market');
  H.points = (await import(pathToFileURL(path.join(ROOT, 'netlify/edge-functions/points.js')).href + '?' + v)).default;
  S.deliver = (raw, headers) => H.points(new Request('http://nexus.test/api/points/stripe', { method: 'POST', headers, body: raw }));
  S.calls.length = 0;
}
const call = (h, base) => async (p, { uid = null, body, method = 'POST', email, verified } = {}) => {
  const r = await h(new Request('http://nexus.test/api/' + base + p, { method, headers: Object.assign({ 'content-type': 'application/json' },
    uid ? { authorization: 'Bearer ' + token(uid, Object.assign(email ? { email } : {}, verified === false ? { verified: false } : {})) } : {}), body: body ? JSON.stringify(body) : undefined }));
  const j = await r.json(); return Object.assign(j, { status: r.status });
};
const M = (p, o) => call(H.market, 'market')(p, o), P = (p, o) => call(H.points, 'points')(p, o);
const OWNER = { uid: 'owner', email: 'owner@example.com' };
const wal = async uid => (await fsGet('wallets/' + uid)) || {};
const pts = async uid => (await wal(uid)).points || 0;
const docs = async col => {
  const r = await fetch('http://127.0.0.1:8080/v1/projects/demo-nexus/databases/(default)/documents/' + col + '?pageSize=300', { headers: { authorization: 'Bearer owner' } });
  return ((await r.json()).documents || []).map(d => Object.assign({ id: d.name.split('/').pop() }, Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, v.integerValue != null ? +v.integerValue : v.stringValue != null ? v.stringValue : v.doubleValue != null ? v.doubleValue : v.booleanValue != null ? v.booleanValue : v.mapValue ? v.mapValue : null]))));
};
const ledger = async (uid, reason) => (await docs('wallets/' + uid + '/ledger')).filter(x => !reason || x.reason === reason);
const give = (uid, points, extra = {}) => fsSet('wallets/' + uid, Object.assign({ points, welcomed: true, createdAt: Date.now() - 30 * DAY, updatedAt: Date.now() }, extra));
async function game(owner, gid = 'game_' + owner, title = owner + "'s Game") {
  await fsSet('projects/proj_' + gid, { projectId: 'proj_' + gid, ownerId: owner, name: title, scene: { objects: [] }, files: [], createdAt: 1, updatedAt: 1 });
  await fsSet('games/' + gid, { gameId: gid, projectId: 'proj_' + gid, ownerId: owner, creatorName: owner, title, visibility: 'public', plays: 0, likes: 0, createdAt: 1, updatedAt: 1 });
  return gid;
}
/* a play session on the server's clock: n minutes, a beat a minute, each with the latest sealed token */
async function play(uid, gid, minutes, opts = {}) {
  const st = await P('/play/start', { uid, body: { gameId: gid } });
  assert.equal(st.ok, true, JSON.stringify(st));
  let tok = st.token, last = null;
  for (let i = 0; i < minutes; i++) { later(60); last = await P('/play/beat', { uid, body: { sessionId: st.sessionId, token: tok } }); assert.equal(last.ok, true, JSON.stringify(last)); tok = last.token; }
  if (opts.end !== false) await P('/play/end', { uid, body: { sessionId: st.sessionId, token: tok } });
  return { sid: st.sessionId, token: tok, last, first: st.token };
}

const tests = [];
const test = (name, f) => tests.push({ name, f });

/* ================================================================ Play Rewards removed · 🛡 sealed heartbeats */
test('1 · Play Rewards are gone: 25 minutes of someone else\'s play → play time counted, ZERO points to the creator (no «play» line)', async () => {
  await fresh();
  const gid = await game('lina');
  await give('lina', 0); await give('omar', 0);
  await play('omar', gid, 25);
  const pt = await fsGet('playtime/' + gid);
  assert.equal(pt.seconds, 1500); assert.equal(pt.sessions, 1); assert.equal(pt.players, 1);
  assert.equal(pt.rewardPoints, undefined); assert.equal(await pts('lina'), 0);
  assert.equal((await ledger('lina', 'play')).length, 0);
  const cfg = await P('/config', { method: 'GET' });
  assert.equal(cfg.playMinutes, undefined); assert.equal(cfg.playPoints, undefined);
  const mk = await M('/config', { method: 'GET' });
  assert.deepEqual(Object.keys(mk.play).sort(), ['heartbeatSeconds', 'sessionMaxMinutes']);
});

test('2 · 🛡 Sealed heartbeats: no token / a forged one / another session\'s → refused; an old one replayed (or a copy in a 2nd tab) → refused; only the latest counts', async () => {
  await fresh();
  const gid = await game('lina');
  const st = await P('/play/start', { uid: 'omar', body: { gameId: gid } });
  assert.match(st.token, /^[\w-]+\.[\w-]+$/, 'AES-GCM: iv.ciphertext');
  later(60);
  assert.equal((await P('/play/beat', { uid: 'omar', body: { sessionId: st.sessionId } })).error.code, 'play_token');
  assert.equal((await P('/play/beat', { uid: 'omar', body: { sessionId: st.sessionId, token: 'AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' } })).error.code, 'play_token');
  const tampered = st.token.slice(0, -3) + (st.token.slice(-3) === 'AAA' ? 'BBB' : 'AAA');
  assert.equal((await P('/play/beat', { uid: 'omar', body: { sessionId: st.sessionId, token: tampered } })).error.code, 'play_token', 'one changed letter: the seal does not open');
  assert.equal((await P('/play/beat', { uid: 'sara', body: { sessionId: st.sessionId, token: st.token } })).error.code, 'play_token', 'someone else\'s session');
  const b1 = await P('/play/beat', { uid: 'omar', body: { sessionId: st.sessionId, token: st.token } });
  assert.equal(b1.credited, 60); assert.notEqual(b1.token, st.token);
  later(60);
  const replay = await P('/play/beat', { uid: 'omar', body: { sessionId: st.sessionId, token: st.token } });
  assert.equal(replay.error.code, 'play_replay', 'the first token again');
  const b2 = await P('/play/beat', { uid: 'omar', body: { sessionId: st.sessionId, token: b1.token } });
  assert.equal(b2.credited, 60);
  assert.equal((await P('/play/beat', { uid: 'omar', body: { sessionId: st.sessionId, token: b1.token } })).error.code, 'play_replay', 'the token before the last');
  const soon = await P('/play/beat', { uid: 'omar', body: { sessionId: st.sessionId, token: b2.token } });
  assert.deepEqual([soon.credited, soon.why, soon.token], [0, 'early', b2.token], 'too soon: nothing written, the same token back');
  assert.equal((await fsGet('playtime/' + gid)).seconds, 120);
  /* another session's token for this session */
  const other = await P('/play/start', { uid: 'sara', body: { gameId: gid } });
  later(60);
  assert.equal((await P('/play/beat', { uid: 'omar', body: { sessionId: st.sessionId, token: other.token } })).error.code, 'play_token');
  assert.equal((await P('/play', { uid: 'omar', body: { gameId: gid } })).counted, false, 'the old token-less call counts nothing');
});

/* ================================================================ 🔥 streak */
test('3 · 🔥 Daily login streak: day 1 → +5, again today → nothing, next day → +10 … day 8 → 50 (the last again), a missed day → day 1; VIP ×2; the owner\'s list', async () => {
  await fresh();
  const d1 = await P('/daily', { uid: 'lina', body: {} });
  assert.deepEqual([d1.claimed, d1.streak, d1.points], [true, 1, 5]);
  assert.equal(await pts('lina'), 55, 'welcome 50 + 5');
  const again = await P('/daily', { uid: 'lina', body: {} });
  assert.deepEqual([again.claimed, again.state.today, again.state.streak], [false, true, 1]);
  const got = [];
  for (let day = 2; day <= 8; day++) { later(DAY / 1000); got.push((await P('/daily', { uid: 'lina', body: {} })).points); }
  assert.deepEqual(got, [10, 15, 20, 25, 30, 50, 50]);
  later(2 * DAY / 1000);
  const back = await P('/daily', { uid: 'lina', body: {} });
  assert.deepEqual([back.streak, back.points], [1, 5], 'a missed day: day 1 again');
  assert.equal((await wal('lina')).streakBest, 8);
  /* 👑 VIP: ×2 */
  await give('vip', 0, { vipUntil: Date.now() + 10 * DAY });
  assert.deepEqual([(await P('/daily', { uid: 'vip', body: {} })).points], [10]);
  /* the owner's list */
  await M('/config', Object.assign({ body: { values: { streakRewards: '1,2,3' } } }, OWNER));
  assert.equal((await P('/daily', { uid: 'newbie', body: {} })).points, 1);
  assert.equal((await ledger('lina', 'streak')).length, 9);
});

/* ================================================================ 🎡 spin */
test('4 · 🎡 Lucky spin: one free a day (the prize drawn by the server, in the wallet at once), then only after a rewarded ad (3 a day); tomorrow free again', async () => {
  await fresh();
  const s1 = await P('/spin', { uid: 'lina', body: {} });
  assert.equal(s1.ok, true, JSON.stringify(s1));
  assert.ok([1, 2, 5, 10, 20, 50, 100].includes(s1.prize)); assert.equal(s1.state.prizes[s1.index], s1.base);
  assert.equal(await pts('lina'), 50 + s1.prize);
  assert.equal((await P('/spin', { uid: 'lina', body: {} })).error.code, 'spin_none');
  /* an ad for a spin: the reward is a spin, not points */
  for (let i = 0; i < 3; i++) {
    const t = await P('/ad/start', { uid: 'lina', body: { via: 'web', purpose: 'spin' } });
    assert.equal(t.spin, true, JSON.stringify(t));
    later(16);
    const c = await P('/ad/claim', { uid: 'lina', body: { nonce: t.nonce } });
    assert.deepEqual([c.spin, c.added], [true, 0]);
    const before = await pts('lina');
    const s = await P('/spin', { uid: 'lina', body: {} });
    assert.equal(s.from, 'ad'); assert.equal(await pts('lina'), before + s.prize);
    later(61);
  }
  assert.equal((await P('/ad/start', { uid: 'lina', body: { via: 'web', purpose: 'spin' } })).error.code, 'spin_ads', 'three ad spins a day');
  later(DAY / 1000);
  assert.equal((await P('/spin', { uid: 'lina', body: {} })).from, 'free');
  assert.equal((await ledger('lina', 'spin')).length, 5);
});

test('5 · 🎡 The draw follows the owner\'s prizes and weights; 👑 VIP: a 2nd free spin (no ad) and ×2 prizes', async () => {
  await fresh();
  await M('/config', Object.assign({ body: { values: { spinPrizes: '7:1000000,9:1' } } }, OWNER));
  const s = await P('/spin', { uid: 'lina', body: {} });
  assert.deepEqual([s.base, s.prize], [7, 7]);
  await give('vip', 0, { vipUntil: Date.now() + DAY });
  const v1 = await P('/spin', { uid: 'vip', body: {} }), v2 = await P('/spin', { uid: 'vip', body: {} });
  assert.deepEqual([v1.prize, v2.prize, v2.from], [14, 14, 'free']);
  assert.equal((await P('/spin', { uid: 'vip', body: {} })).error.code, 'spin_none');
  assert.equal(await pts('vip'), 28);
});

/* ================================================================ 🎁 referrals */
test('6 · 🎁 Invite & earn: a link per person; a NEW verified account claims it once (not your own, not an old account, not unverified); paid only after the friend\'s real play — once', async () => {
  await fresh({ REFERRAL_PLAY_MINUTES: '3' });
  const info = await P('/referral', { uid: 'lina', method: 'GET' });
  assert.match(info.code, /^[a-z0-9]{6,8}$/);
  assert.equal((await P('/referral', { uid: 'lina', method: 'GET' })).code, info.code, 'the same link every time');
  assert.equal((await P('/referral/claim', { uid: 'lina', body: { code: info.code } })).error.code, 'ref_self');
  assert.equal((await P('/referral/claim', { uid: 'omar', body: { code: 'zzzzzzz' } })).error.code, 'ref_code');
  assert.equal((await P('/referral/claim', { uid: 'omar', body: { code: info.code }, verified: false })).error.code, 'ref_verify');
  await give('old', 0, { createdAt: Date.now() - 10 * DAY });
  assert.equal((await P('/referral/claim', { uid: 'old', body: { code: info.code } })).error.code, 'ref_late');
  const c = await P('/referral/claim', { uid: 'omar', body: { code: info.code } });
  assert.equal(c.joined, true, JSON.stringify(c));
  assert.equal((await P('/referral/claim', { uid: 'omar', body: { code: info.code } })).already, true);
  /* omar plays his own game: not counted; then 3 minutes in sara's game: both paid */
  const own = await game('omar'), gid = await game('sara');
  await play('omar', own, 5);
  assert.equal((await fsGet('referrals/omar')).playedSeconds, 0);
  const lina0 = await pts('lina'), omar0 = await pts('omar');
  const p = await play('omar', gid, 3);
  assert.deepEqual(p.last.referral, { referrer: 100, friend: 50 });
  assert.equal(await pts('lina'), lina0 + 100); assert.equal(await pts('omar'), omar0 + 50);
  const rf = await fsGet('referrals/omar');
  assert.deepEqual([rf.status, rf.referrerPoints, rf.friendPaid], ['rewarded', 100, true]);
  await play('omar', gid, 4);
  assert.equal(await pts('lina'), lina0 + 100, 'once');
  const n = (await docs('users/lina/notifications')).filter(x => x.type === 'referral');
  assert.equal(n.length, 1);
  const mine = await P('/referral', { uid: 'lina', method: 'GET' });
  assert.deepEqual([mine.count, mine.rewarded, mine.earned, mine.invited[0].status], [1, 1, 100, 'rewarded']);
  assert.equal((await P('/me', { uid: 'omar', method: 'GET' })).referral.status, 'rewarded');
});

test('7 · 🎁 The day\'s limit for the one who invites (REFERRAL_MAX_PER_DAY): over it the friend is still paid, the inviter is not', async () => {
  await fresh({ REFERRAL_PLAY_MINUTES: '1', REFERRAL_MAX_PER_DAY: '1' });
  const { code } = await P('/referral', { uid: 'lina', method: 'GET' });
  const gid = await game('sara');
  for (const f of ['f1', 'f2']) { await P('/referral/claim', { uid: f, body: { code } }); await play(f, gid, 1); }
  assert.deepEqual([(await fsGet('referrals/f1')).status, (await fsGet('referrals/f2')).status], ['rewarded', 'capped']);
  assert.equal(await pts('lina'), 150, 'welcome + one invitation');
  assert.equal(await pts('f2'), 100, 'welcome + the friend\'s 50');
});

/* ================================================================ 👑 VIP */
test('8 · 👑 VIP with tokens: −499, 30 days; ×2 on ads, streak and spins — never on a tip or a sale', async () => {
  await fresh();
  await give('lina', 1000);
  const v = await P('/vip/tokens', { uid: 'lina', body: {} });
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.equal(await pts('lina'), 501);
  assert.equal(v.vip.active, true); assert.ok(Math.abs(v.vip.until - (Date.now() + 30 * DAY)) < 5000);
  const ad = await P('/ad/start', { uid: 'lina', body: { via: 'web' } });
  assert.equal(ad.points, 10, 'the ad shows ×2');
  later(16);
  assert.equal((await P('/ad/claim', { uid: 'lina', body: { nonce: ad.nonce } })).added, 10);
  assert.equal((await P('/daily', { uid: 'lina', body: {} })).points, 10);
  /* a tip from a VIP and to a VIP: the amount, never doubled */
  const gid = await game('omar');
  await M('/tip', { uid: 'lina', body: { gameId: gid, amount: 20, tipId: 'tip_vip_00001' } }).then(r => assert.equal(r.ok, true, JSON.stringify(r)));
  assert.equal(await pts('omar'), 70, 'welcome 50 + the 20');
  const me = await P('/me', { uid: 'lina', method: 'GET' });
  assert.equal(me.vip.active, true); assert.equal(me.spin.free, 2);
  /* Pro includes VIP */
  await give('pro', 0, { proUntil: Date.now() + DAY });
  assert.equal((await P('/me', { uid: 'pro', method: 'GET' })).vip.active, true);
  assert.equal((await P('/vip/tokens', { uid: 'poor', body: {} })).error.code, 'not_enough');
});

test('9 · 👑 VIP through Stripe: a monthly subscription for VIP_PRICE_USD (no fixed Stripe price needed); the signed webhook turns it on, renews, cancels — Pro untouched', async () => {
  await fresh();
  const r = await P('/vip/checkout', { uid: 'lina', body: { back: '/index.html' } });
  assert.equal(r.ok, true, JSON.stringify(r));
  const c = S.calls.at(-1).params;
  assert.deepEqual([c.mode, c['line_items[0][price_data][unit_amount]'], c['line_items[0][price_data][recurring][interval]'], c['metadata[plan]'], c['subscription_data[metadata][plan]']], ['subscription', '499', 'month', 'vip', 'vip']);
  await S.send('checkout.session.completed', { id: 'cs_vip', object: 'checkout.session', mode: 'subscription', subscription: 'sub_vip1', customer: 'cus_1', client_reference_id: 'lina', metadata: { uid: 'lina', plan: 'vip' } });
  let w = await wal('lina');
  assert.deepEqual([w.vipStatus, w.vipSub, w.proUntil], ['active', 'sub_vip1', undefined]);
  const end = Math.floor(Date.now() / 1000) + 40 * 86400;
  await S.send('invoice.paid', { id: 'in_1', object: 'invoice', subscription: 'sub_vip1', lines: { data: [{ period: { end } }] } });
  assert.equal((await wal('lina')).vipUntil, end * 1000 + 2 * DAY);
  await S.send('customer.subscription.deleted', { id: 'sub_vip1', object: 'subscription', status: 'canceled' });
  w = await wal('lina');
  assert.equal(w.vipStatus, 'canceled'); assert.ok(w.vipUntil <= Date.now());
  /* a Pro subscription still works as before */
  await S.send('checkout.session.completed', { id: 'cs_pro', object: 'checkout.session', mode: 'subscription', subscription: 'sub_pro1', customer: 'cus_2', client_reference_id: 'omar', metadata: { uid: 'omar' } });
  w = await wal('omar');
  assert.equal(w.proStatus, 'active'); assert.equal(w.vipStatus, undefined);
  assert.equal((await fsGet('economy/stats')).vipSubs, 1);
});

/* ================================================================ 💝 tips */
test('10 · 💝 Tipping a developer: exact, once per click, never yourself, not more than you have; the developer is told; a tip is earned (may be withdrawn)', async () => {
  await fresh();
  const gid = await game('dev');
  await give('fan', 300); await give('dev', 0);
  const t = await M('/tip', { uid: 'fan', body: { gameId: gid, amount: 120, tipId: 'tip_000000001', note: 'love it' } });
  assert.equal(t.ok, true, JSON.stringify(t));
  assert.deepEqual([await pts('fan'), await pts('dev')], [180, 120]);
  assert.equal((await M('/tip', { uid: 'fan', body: { gameId: gid, amount: 120, tipId: 'tip_000000001' } })).already, true);
  await Promise.all([1, 2, 3].map(() => M('/tip', { uid: 'fan', body: { gameId: gid, amount: 10, tipId: 'tip_000000002' } })));
  assert.equal(await pts('fan'), 170, 'three clicks at once, one tip');
  assert.equal((await M('/tip', { uid: 'dev', body: { gameId: gid, amount: 5, tipId: 'tip_000000003' } })).error.code, 'tip_self');
  assert.equal((await M('/tip', { uid: 'fan', body: { gameId: gid, amount: 1000, tipId: 'tip_000000004' } })).error.code, 'not_enough');
  assert.equal((await M('/tip', { uid: 'fan', body: { gameId: gid, amount: 0, tipId: 'tip_000000005' } })).error.code, 'tip_amount');
  assert.equal((await M('/tip', { uid: 'fan', body: { gameId: gid, amount: 2.5, tipId: 'tip_000000006' } })).error.code, 'tip_amount');
  const w = await wal('dev');
  assert.deepEqual([w.micro, w.earnMicro], [130 * M6, 130 * M6], 'tips received are earned');
  assert.deepEqual((await ledger('fan', 'tip_sent')).map(x => x.micro).sort(), [-120 * M6, -10 * M6].sort());
  assert.equal((await docs('users/dev/notifications')).filter(x => x.type === 'tip').length, 2);
  assert.deepEqual([(await fsGet('game_tips/' + gid)).count, (await fsGet('game_tips/' + gid)).totalMicro], [2, 130 * M6]);
  /* a fee for the site, when the owner sets one */
  await M('/config', Object.assign({ body: { values: { tipFeePercent: 10 } } }, OWNER));
  await M('/tip', { uid: 'fan', body: { gameId: gid, amount: 100, tipId: 'tip_000000007' } });
  assert.equal(await pts('dev'), 220);
  assert.equal((await fsGet('economy/stats')).tipFeeMicro, 10 * M6);
});

/* ================================================================ 🧩 files & code · 15 % */
test('11 · 🧩 Files & code: a Vault object sold at 200 → the seller gets 170 (15 % to the site), the buyer a PRIVATE copy in their Vault (purchasedFrom); never resold; once', async () => {
  await fresh();
  await give('maker', 0); await give('buyer', 500);
  await fsSet('vault/vault_car', { vaultId: 'vault_car', ownerId: 'maker', name: 'Drift Car', note: 'a car that drifts', scene: '{"objects":[{"id":"car"}]}', scripts: [{ path: 'Drift.js', code: 'drift()' }],
    components: [], assetRefs: ['asset_pub'], size: [1, 1, 2], counts: { objects: 1 }, uses: 0, v: 1, createdAt: 1, updatedAt: 1 });
  await fsSet('assets/asset_pub', { ownerId: 'maker', visibility: 'public', name: 'wheel' });
  assert.equal((await M('/item/list', { uid: 'buyer', body: { kind: 'vault', sourceId: 'vault_car', price: 200 } })).error.code, 'not_owner');
  const l = await M('/item/list', { uid: 'maker', body: { kind: 'vault', sourceId: 'vault_car', price: 200, title: 'Drift Car Pack' } });
  assert.equal(l.ok, true, JSON.stringify(l));
  const L = await fsGet('market_items/vault_vault_car');
  assert.deepEqual([L.price, L.isForSale, L.title, L.kind, L.scene], [200, true, 'Drift Car Pack', 'vault', undefined], 'the listing never holds the content');
  assert.ok(await fsGet('market_item_content/vault_vault_car'), 'the content is kept apart');
  const b = await M('/item/buy', { uid: 'buyer', body: { itemId: 'vault_vault_car', transactionId: 'tx_item_000001', expectedPrice: 200 } });
  assert.equal(b.ok, true, JSON.stringify(b));
  assert.deepEqual([await pts('buyer'), await pts('maker')], [300, 170]);
  const copy = await fsGet('vault/' + b.copyId);
  assert.deepEqual([copy.ownerId, copy.name, copy.purchasedFrom.itemId, copy.scripts.length], ['buyer', 'Drift Car', 'vault_vault_car', 1]);
  assert.equal((await M('/item/buy', { uid: 'buyer', body: { itemId: 'vault_vault_car', transactionId: 'tx_item_000002' } })).already, true, 'bought once');
  assert.equal(await pts('buyer'), 300);
  assert.equal((await M('/item/list', { uid: 'buyer', body: { kind: 'vault', sourceId: b.copyId, price: 50 } })).error.code, 'bought_copy');
  assert.equal((await M('/item/buy', { uid: 'maker', body: { itemId: 'vault_vault_car', transactionId: 'tx_item_000003' } })).error.code, 'own');
  const st = await fsGet('economy/stats');
  assert.deepEqual([st.sales, st.salesMicro, st.feeMicro], [1, 200 * M6, 30 * M6]);
  /* deleted by the buyer → «open» makes it again */
  await fetch('http://127.0.0.1:8080/v1/projects/demo-nexus/databases/(default)/documents/vault/' + b.copyId, { method: 'DELETE', headers: { authorization: 'Bearer owner' } });
  const o = await M('/item/open', { uid: 'buyer', body: { itemId: 'vault_vault_car' } });
  assert.equal(o.made, true); assert.ok(await fsGet('vault/' + o.copyId));
});

test('12 · 🧩 A Mechanic (code) for sale only while private; an object with the seller\'s PRIVATE assets is refused; the bought mechanic is private; a project sale also pays 85 %', async () => {
  await fresh();
  await give('maker', 0); await give('buyer', 1000);
  await fsSet('mechanics/mech_jump', { mechId: 'mech_jump', ownerId: 'maker', creatorName: 'Maker', name: 'Double Jump', description: 'jump twice', kind: 'script', type: 'DoubleJump', path: 'DoubleJump.js',
    code: 'let n = 0;\nfunction update() {}\n', data: {}, visibility: 'public', source: 'human', uses: 0, createdAt: 1, updatedAt: 1 });
  assert.equal((await M('/item/list', { uid: 'maker', body: { kind: 'mechanic', sourceId: 'mech_jump', price: 100 } })).error.code, 'item_public');
  await fsSet('mechanics/mech_jump', { visibility: 'private' });
  assert.equal((await M('/item/list', { uid: 'maker', body: { kind: 'mechanic', sourceId: 'mech_jump', price: 100 } })).ok, true);
  const b = await M('/item/buy', { uid: 'buyer', body: { itemId: 'mechanic_mech_jump', transactionId: 'tx_mech_000001', expectedPrice: 100 } });
  const copy = await fsGet('mechanics/' + b.copyId);
  assert.deepEqual([copy.ownerId, copy.visibility, copy.code.includes('function update'), copy.purchasedFrom.sellerUid], ['buyer', 'private', true, 'maker']);
  assert.equal(await pts('maker'), 85);
  await fsSet('vault/vault_secret', { vaultId: 'vault_secret', ownerId: 'maker', name: 'Secret', note: '', scene: '{"o":1}', scripts: [], components: [], assetRefs: ['asset_priv'], size: [1, 1, 1], counts: {}, uses: 0, v: 1, createdAt: 1, updatedAt: 1 });
  await fsSet('assets/asset_priv', { ownerId: 'maker', visibility: 'private', name: 'secret model' });
  assert.equal((await M('/item/list', { uid: 'maker', body: { kind: 'vault', sourceId: 'vault_secret', price: 100 } })).error.code, 'item_assets');
  /* the project marketplace: the same 15 % */
  const gid = await game('maker', 'game_kart', 'Kart');
  assert.equal((await M('/list', { uid: 'maker', body: { gameId: gid, price: 100 } })).ok, true);
  const pb = await M('/buy', { uid: 'buyer', body: { gameId: gid, transactionId: 'tx_proj_000001', expectedPrice: 100 } });
  assert.equal(pb.ok, true, JSON.stringify(pb));
  assert.equal(await pts('maker'), 170);
  assert.equal((await fsGet('market/' + gid)).revenueMicro, 85 * M6);
  assert.equal((await M('/config', { method: 'GET' })).feePercent, 15);
});

/* ================================================================ 📊 the owner's dashboard */
test('13 · 📊 The owner\'s dashboard: totals (sales, commissions, tips, gifts), pending withdrawals, every transaction; give or take tokens by hand — the owner only', async () => {
  await fresh();
  await give('buyer', 1000); await give('maker', 0);
  await P('/me', { uid: 'newcomer', method: 'GET' });                     // a first visit: the welcome gift
  const gid = await game('maker');
  await M('/list', { uid: 'maker', body: { gameId: gid, price: 200 } });
  await M('/buy', { uid: 'buyer', body: { gameId: gid, transactionId: 'tx_dash_00001' } });
  await M('/tip', { uid: 'buyer', body: { gameId: gid, amount: 40, tipId: 'tip_dash_00001' } });
  assert.equal((await P('/admin/summary', { uid: 'buyer', method: 'GET' })).error.code, 'not_owner');
  const a = await P('/admin/adjust', Object.assign({ body: { uid: 'maker', amount: '25.5', note: 'support' } }, OWNER));
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.equal(await pts('maker'), 170 + 40 + 25.5);
  assert.equal((await P('/admin/adjust', Object.assign({ body: { uid: 'maker', amount: '-1000' } }, OWNER))).error.code, 'not_enough');
  assert.equal((await P('/admin/adjust', Object.assign({ body: { uid: 'nobody_here', amount: '5' } }, OWNER))).error.code, 'adjust_user');
  await P('/admin/adjust', Object.assign({ body: { uid: 'maker', amount: '-10.5', note: 'mistake' } }, OWNER));
  assert.equal(await pts('maker'), 225);
  const s = await P('/admin/summary', Object.assign({ method: 'GET' }, OWNER));
  assert.deepEqual([s.stats.sales, s.stats.salesMicro, s.stats.feeMicro, s.stats.tips, s.stats.tipsMicro, s.stats.adjusts, s.stats.adjustMicro], [1, 200 * M6, 30 * M6, 1, 40 * M6, 2, 15 * M6]);
  assert.ok(s.stats.giftMicro >= 50 * M6, 'welcome gifts counted');
  assert.deepEqual(s.recent.map(t => [t.type, t.tokens]), [['adjust', '-10.5'], ['adjust', '25.5']]);
  const tx = await P('/admin/transactions?type=adjust', Object.assign({ method: 'GET' }, OWNER));
  assert.equal(tx.transactions.length, 2);
  assert.equal(tx.transactions[0].uid, 'maker');
  const mine = await P('/transactions', { uid: 'maker', method: 'GET' });
  assert.equal(mine.transactions.filter(t => t.type === 'adjust').length, 2, 'the person sees it too');
});

let pass = 0, failN = 0;
for (const t of tests) {
  const t0 = realNow();
  try { await t.f(); pass++; console.log('✓ ' + t.name + '  (' + ((realNow() - t0) / 1000).toFixed(1) + 's)'); }
  catch (e) { failN++; console.log('✗ ' + t.name + '\n    ' + String(e && e.stack || e).split('\n').slice(0, 6).join('\n    ')); }
}
console.log('\n' + pass + ' passed, ' + failN + ' failed');
await S.close();
process.exit(failN ? 1 : 0);
