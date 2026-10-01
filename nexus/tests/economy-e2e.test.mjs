/* ============================================================
   NEXUS tests · 🛒 NEXUS MARKETPLACE · ⏱ Play Time → 💰 Play Rewards ·
   📊 Project Earnings — in a real browser (Chromium; the seller on a
   computer, the buyer on a phone with touch), with the Firebase emulators
   and the real rules, the site's server functions (points.js, market.js)
   running here. The SERVER's clock is moved by the test, so ten minutes of
   play take seconds — the pages keep the real time.
   The 20 checks asked for: free and paid publishing, the price, buying,
   the points taken and given, not enough points, buying twice, the play
   session and its heartbeats, its duration, several players, time → points,
   the minutes kept between sessions, cheating from DevTools, closing the
   game, losing the connection, another device, reloading the page, and
   everything still there afterwards.
   Run:  node nexus/tests/economy-e2e.test.mjs
   ============================================================ */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startWorld } from './mock-world.mjs';
import { startSite } from './e2e-server.mjs';
import { e2eReply } from './fake-models.mjs';
import { chromium, resetEmulators, newDevice, signUp, signIn, until, run, fsGet, fsSet, fsQuery } from './e2e-kit.mjs';

const W = await startWorld();
W.reply = c => e2eReply(c);
/* the server's clock — moved forward by the test (the functions run in this process) */
const realNow = Date.now.bind(Date);
let skew = 0;
Date.now = () => realNow() + skew;
const later = s => { skew += s * 1000; };
const env = { FIREBASE_PROJECT_ID: 'demo-nexus', NEXUS_TEST_EMULATOR_TOKENS: '1', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', ADMIN_EMAILS: 'boss@test.io',
  MARKET_FEE_PERCENT: '0', AI_PER_MINUTE: '500', GEMINI_BASE: W.base + '/gemini', GROQ_BASE: W.base + '/groq', GROQ_KEYS: 'gsk_GROQTESTKEY0000000000000001' };
await resetEmulators();
const HTML = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8').replace('window.NEXUS_FILES = "drive";', 'window.NEXUS_FILES = "firebase";');
const site = await startSite({ env, files: { '/index.html': HTML } });
const browser = await chromium.launch();
const logs = [];
const tests = [];
const test = (name, f) => tests.push({ name, f });
const S = {};
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const points = async uid => ((await fsGet('wallets/' + uid)) || {}).points || 0;
const denied = r => /permission|PERMISSION_DENIED|insufficient/i.test(String(r));
/* the server's clock is real time plus what the test moved it: a few real seconds pass between beats too */
const about = (v, want, tol = 8, what = '') => assert.ok(Math.abs(v - want) <= tol, (what ? what + ': ' : '') + v + ' ≉ ' + want);
const ledgerOf = async (uid, reason) => {
  const r = await fetch('http://127.0.0.1:8080/v1/projects/demo-nexus/databases/(default)/documents/wallets/' + uid + '/ledger?pageSize=300', { headers: { authorization: 'Bearer owner' } });
  return ((await r.json()).documents || []).map(d => ({ reason: d.fields.reason.stringValue, delta: +(d.fields.delta.integerValue || 0) })).filter(x => !reason || x.reason === reason);
};
const topSheet = '#sheet-root .sheet.in:last-of-type';

/* a game in the Studio, then NEXUS's own Publish dialog — with the marketplace choice */
async function makeGame(page, title) {
  await page.evaluate(async t => {
    await NX.Platform.createProject(t);
    await new Promise(r => setTimeout(r, 300));
    NX.Sheet.closeAll();
    const S = NX.Studio;
    await S.engine.addEntity({ name: 'Car', type: 'primitive', props: { shape: 'box', color: '#e11d48' }, position: [0, 0.5, 0] });
    NX.IDE.project = S.project;
    NX.IDE.addFile('Drive.js', 'function update(dt) { if (self) self.position.z -= 4 * dt; }\n', { silent: true });
    S.dirty = true;
    await S.save(true);
  }, title);
}
async function publish(page, mode, preset) {
  await page.evaluate(() => { NX.Sheet.closeAll(); NX.Studio.openPublish(); });
  await page.locator(topSheet + ' .mk-pub').waitFor();
  await page.locator(topSheet + ' .mk-mode [data-m="' + mode + '"]').click();
  if (preset) await page.locator(topSheet + ' .mk-preset[data-p="' + preset + '"]').click();
  await page.locator('.sheet-foot .btn', { hasText: 'PUBLISH' }).click();
  await page.locator('.modal-box', { hasText: 'تم النشر' }).waitFor({ timeout: 90000 });
  await page.evaluate(() => { document.querySelectorAll('.modal-box').forEach(m => { const s = m.parentElement && m.parentElement.previousElementSibling; if (s) s.click(); }); });
  return page.evaluate(() => NX.Studio.project.publishedId);
}
/* the game on screen in NEXUS's player, its session started by the page */
async function playGame(page, gid) {
  await page.evaluate(async id => { NX.Sheet.closeAll(); const g = await NX.Games.get(id); NX.GamePlayer.open(g); }, gid);
  /* «run another developer's code?» — the player agrees (asked once per game) */
  await until(page, () => NX.Screen.current() === 'player' || !!document.querySelector('.modal-box.in'), null, 30000);
  const consent = page.locator('.modal-box.in .btn', { hasText: 'تشغيل' });
  if (await consent.count()) await consent.first().click();
  try { await until(page, id => NX.PlayTimer && NX.PlayTimer.sid && NX.PlayTimer.gid === id, gid, 30000); }
  catch (e) {
    throw new Error('no play session: ' + JSON.stringify(await page.evaluate(async () => ({ screen: NX.Screen.current(), player: NX.GamePlayer.gameId, sid: NX.PlayTimer.sid, gid: NX.PlayTimer.gid,
      account: NX.Backend.hasAccount(), start: await NX.Points.api('/play/start', { gameId: NX.GamePlayer.gameId }).then(r => 'ok ' + r.sessionId, e => e.code + ' ' + e.message),
      modal: (document.querySelector('.modal-box') || {}).innerText || null, sheets: [...document.querySelectorAll('#sheet-root .sheet.in h3')].map(h => h.textContent) }))));
  }
  /* the test sends the beats itself (with the server's clock moved), not the page's minute timer */
  return page.evaluate(() => { clearInterval(NX.PlayTimer.timer); return NX.PlayTimer.sid; });
}
/* a minute of play for everyone playing now: the server's clock moves a minute, each page sends its heartbeat */
async function minute(pages, n = 1) {
  pages = Array.isArray(pages) ? pages : [pages];
  for (let i = 0; i < n; i++) { later(60); for (const p of pages) await p.evaluate(() => NX.PlayTimer.beat()); }
  const out = [];
  for (const p of pages) out.push(await p.evaluate(() => NX.PlayTimer.last));
  return out.length === 1 ? out[0] : out;
}

/* ================================================================ publishing */
test('1 · Publishing without selling: «🔒 Not offered» — no «Free by Remix» any more (Remix is the creator\'s own); nothing listed; the marketplace has no Free tab', async () => {
  const { page } = S.lina = await newDevice(browser, site, logs);
  S.linaUid = await signUp(page, 'lina@test.io');
  await makeGame(page, 'Free Kart');
  await page.evaluate(() => { NX.Sheet.closeAll(); NX.Studio.openPublish(); });
  await page.locator(topSheet + ' .mk-pub').waitFor();
  assert.equal(await page.locator(topSheet + ' .mk-mode [data-m="free"]').count(), 0, 'no Free (Remix) choice');
  assert.equal(await page.locator(topSheet + ' #pub-remix').count(), 0, 'no «let others remix» switch');
  await page.evaluate(() => NX.Sheet.closeAll());
  await until(page, () => !document.querySelector('#sheet-root .sheet'), null, 10000);
  S.freeGid = await publish(page, 'none');
  const g = await fsGet('games/' + S.freeGid);
  assert.equal(g.allowRemix, false); assert.equal(await fsGet('market/' + S.freeGid), null);
  assert.equal(await page.evaluate(async id => NX.Remix.allowed(await NX.Games.get(id)), S.freeGid), true, 'the creator remixes their own game');
  await page.evaluate(() => NX.Market.open());
  await page.locator(topSheet + ' .mk-tabs').waitFor();
  assert.equal(await page.locator(topSheet + ' .mk-tabs [data-t="free"]').count(), 0);
  assert.equal(await page.locator(topSheet + ' .mk-tabs [data-t="items"]').count(), 1, 'files & code instead');
});

test('2 · Publishing a PAID project: «💰 Paid», a price from the presets (500) — the server lists it (ownerUid · projectId · price · currency · isForSale) and turns Remix off; a price out of the limits is refused before publishing', async () => {
  const { page } = S.lina;
  await makeGame(page, 'Ultimate Racing');
  /* a price the limits refuse: said in the dialog, nothing published */
  await page.evaluate(() => { NX.Sheet.closeAll(); NX.Studio.openPublish(); });
  await page.locator(topSheet + ' .mk-pub').waitFor();
  await page.locator(topSheet + ' .mk-mode [data-m="paid"]').click();
  await page.fill(topSheet + ' .mk-price', '5');
  assert.match(await page.locator(topSheet + ' .mk-note').textContent(), /10/);
  await page.locator('.sheet-foot .btn', { hasText: 'PUBLISH' }).click();
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => NX.Studio.project.publishedId || null), null, 'not published with a refused price');
  S.gid = await publish(page, 'paid', 500);
  await until(page, () => true);
  const L = await fsGet('market/' + S.gid);
  assert.deepEqual([L.ownerUid, L.price, L.currency, L.isForSale, L.title], [S.linaUid, 500, 'NEXUS_POINTS', true, 'Ultimate Racing']);
  assert.equal(L.projectId, await page.evaluate(() => NX.Studio.project.projectId));
  assert.equal((await fsGet('games/' + S.gid)).allowRemix, false);
});

test('3 · The price, changed by the owner from the game\'s page: a custom price (777) within the limits', async () => {
  const { page } = S.lina;
  await page.evaluate(async id => { NX.Sheet.closeAll(); NX.Community.openGamePage(await NX.Games.get(id)); }, S.gid);
  await page.locator(topSheet + ' .mk-box .mk-edit').click();
  await page.fill('.modal .mk-price', '777');
  await page.locator('.modal .mk-save-price').click();
  await until(page, () => /777/.test((document.querySelector('#sheet-root .sheet.in .mk-box') || {}).textContent || ''), null, 20000);
  assert.equal((await fsGet('market/' + S.gid)).price, 777);
  await page.locator(topSheet + ' .mk-box .mk-edit').click();
  await page.locator('.modal .mk-preset[data-p="500"]').click();
  await page.locator('.modal .mk-save-price').click();
  await until(page, () => /500/.test((document.querySelector('#sheet-root .sheet.in .mk-box') || {}).textContent || ''), null, 20000);
  await page.evaluate(() => NX.Sheet.closeAll());
});

/* ================================================================ buying (a phone) */
test('4 · On a phone: the marketplace → «💰 Paid» → «🛒 Buy project — 500 points» → one confirmation → the purchase, the copy opened in the Studio', async () => {
  const { page } = S.omar = await newDevice(browser, site, logs, PHONE);
  S.omarUid = await signUp(page, 'omar@test.io');
  await fsSet('wallets/' + S.omarUid, { points: 800 });
  S.linaBefore = await points(S.linaUid);
  await page.evaluate(() => NX.Market.open({ tab: 'paid' }));
  const card = page.locator(topSheet + ' .mk-card[data-game="' + S.gid + '"]');
  await card.waitFor({ timeout: 20000 });
  assert.match(await card.textContent(), /500/);
  await card.locator('.mk-buy').tap();
  await page.locator('.modal .mk-yes').waitFor();
  assert.match(await page.locator('.modal-box').textContent(), /800/, 'the balance before buying');
  await page.locator('.modal .mk-yes').tap();
  await page.locator('.modal-box', { hasText: await page.evaluate(() => NX.T('MK_OPEN_NOW_Q')) }).waitFor({ timeout: 30000 });
  await page.locator('.modal .btn.danger').tap();                                   // «افتح»
  await until(page, () => NX.Screen.current() === 'studio' && NX.Studio.project && NX.Studio.project.purchasedFrom, null, 30000);
  const p = await page.evaluate(() => ({ owner: NX.Studio.project.ownerId, from: NX.Studio.project.purchasedFrom, files: NX.Studio.project.files.map(f => f.path) }));
  assert.equal(p.owner, S.omarUid); assert.equal(p.from.gameId, S.gid); assert.equal(p.from.sellerUid, S.linaUid);
  assert.ok(p.files.includes('Drive.js'), p.files.join(','));
  S.copyId = await page.evaluate(() => NX.Studio.project.projectId);
});

test('5 + 6 · The points: −500 from the buyer, +500 to the seller — and the transaction recorded once (buyerUid · sellerUid · projectId · price · timestamp · transactionId)', async () => {
  assert.equal(await points(S.omarUid), 300);
  assert.equal(await points(S.linaUid), S.linaBefore + 500);
  const tx = await fsQuery('market_tx', 'buyerUid', S.omarUid);
  assert.equal(tx.length, 1);
  const f = tx[0].fields;
  assert.equal(f.sellerUid.stringValue, S.linaUid); assert.equal(+f.price.integerValue, 500); assert.ok(f.projectId.stringValue && f.transactionId.stringValue && +f.timestamp.integerValue > 0);
  assert.deepEqual((await ledgerOf(S.omarUid, 'market_buy')).map(x => x.delta), [-500]);
  assert.deepEqual((await ledgerOf(S.linaUid, 'market_sale')).map(x => x.delta), [500]);
});

test('7 · Not enough points: «النقاط لا تكفي» — nothing taken, nothing given', async () => {
  const { page } = S.sam = await newDevice(browser, site, logs);
  S.samUid = await signUp(page, 'sam@test.io');
  await fsSet('wallets/' + S.samUid, { points: 120 });
  const linaNow = await points(S.linaUid);
  await page.evaluate(async id => NX.Community.openGamePage(await NX.Games.get(id)), S.gid);
  await page.locator(topSheet + ' .mk-box .mk-buy').click();
  await page.locator('.modal .mk-yes').click();
  await page.locator('.modal-box', { hasText: await page.evaluate(() => NX.T('MK_NOT_ENOUGH')) }).waitFor({ timeout: 20000 });
  assert.equal(await points(S.samUid), 120); assert.equal(await points(S.linaUid), linaNow);
  assert.equal(await fsGet('purchases/' + S.samUid + '_' + S.gid), null);
  await page.evaluate(() => { NX.Sheet.closeAll(); document.querySelectorAll('.modal-box').forEach(m => m.parentElement.previousElementSibling.click()); });
});

test('8 · Never bought twice: the game\'s page says «✓ bought» with «Open your copy»; the same request again — the same purchase, no second charge', async () => {
  const { page } = S.omar;
  await page.evaluate(async id => { NX.Sheet.closeAll(); NX.Community.openGamePage(await NX.Games.get(id)); }, S.gid);
  await page.locator(topSheet + ' .mk-box .mk-open').waitFor({ timeout: 20000 });
  const again = await page.evaluate(async id => { try { return await NX.Market.api('/buy', { gameId: id, transactionId: 'tx_again_000000001' }); } catch (e) { return { err: e.code }; } }, S.gid);
  assert.equal(again.already, true);
  assert.equal(await points(S.omarUid), 300);
  assert.equal((await ledgerOf(S.omarUid, 'market_buy')).length, 1);
  /* 🛒 Purchased Projects: the purchase, in «My projects» */
  await page.evaluate(() => { NX.Sheet.closeAll(); NX.Platform.go('projects'); });
  await until(page, gid => !!document.querySelector('.mk-purchased .mk-card[data-game="' + gid + '"]'), S.gid, 30000);
});

/* ================================================================ ⏱ play time */
test('9 + 10 + 11 · A play session: the page starts it when the game is on screen; a heartbeat a minute; the duration is the server\'s own count', async () => {
  const { page } = S.omar;
  S.omarSid = await playGame(page, S.gid);
  const s0 = await fsGet('play_sessions/' + S.omarSid);
  assert.deepEqual([s0.gameId, s0.playerUid, s0.state, s0.duration], [S.gid, S.omarUid, 'active', 0]);
  const last = await minute(page, 3);
  about(last.credited, 60);
  const s1 = await fsGet('play_sessions/' + S.omarSid);
  about(s1.duration, 180, 15); assert.equal(s1.beats, 3); assert.ok(s1.lastHeartbeat > s1.startedAt);
  /* a page sending its beats faster than real time: nothing counted */
  const fast = await page.evaluate(async sid => NX.Points.api('/play/beat', { sessionId: sid, token: NX.PlayTimer.seal }), S.omarSid);
  assert.equal(fast.why, 'early'); assert.equal(fast.credited, 0);
});

test('12 · Several players add up: another player on another device — the game\'s play time is the sum, two players, two sessions', async () => {
  await playGame(S.sam.page, S.gid);
  await minute([S.omar.page, S.sam.page], 2);                          // both playing: omar 5 min, sam 2
  const pt = await fsGet('playtime/' + S.gid);
  about(pt.seconds, 300 + 120, 25); assert.equal(pt.players, 2); assert.equal(pt.sessions, 2);
});

test('13 · Play time earns no points (Play Rewards removed): more minutes by two players → more play time, the creator\'s balance unchanged, likes untouched', async () => {
  const before = await points(S.linaUid), likes = (await fsGet('games/' + S.gid)).likes, t0 = (await fsGet('playtime/' + S.gid)).seconds;
  await minute([S.omar.page, S.sam.page], 2);
  about((await fsGet('playtime/' + S.gid)).seconds, t0 + 240, 20);
  assert.equal(await points(S.linaUid), before);
  assert.equal((await ledgerOf(S.linaUid, 'play')).length, 0);
  assert.equal((await fsGet('games/' + S.gid)).likes, likes, 'likes untouched by play time');
});

test('14 · 🛡 Sealed heartbeats in the page: each beat carries the server\'s latest token; an old token replayed from DevTools is refused, the page carries on', async () => {
  const { page } = S.sam;
  const first = await page.evaluate(() => NX.PlayTimer.seal);
  assert.match(first, /^[\w-]+\.[\w-]+$/);
  await minute(page, 1);
  const second = await page.evaluate(() => NX.PlayTimer.seal);
  assert.notEqual(second, first, 'a new token every beat');
  later(60);
  const replay = await page.evaluate(async t => { try { await NX.Points.api('/play/beat', { sessionId: NX.PlayTimer.sid, token: t }); return 'counted'; } catch (e) { return e.code; } }, first);
  assert.equal(replay, 'play_replay');
  const ok = await page.evaluate(async () => { await NX.PlayTimer.beat(); return NX.PlayTimer.last; });
  about(ok.credited, 60, 8, 'the latest token still counts');
  /* both leave the game (the next scenarios start their own sessions) */
  for (const p of [S.omar.page, S.sam.page]) { await p.evaluate(() => NX.GamePlayer.close()); await until(p, () => !NX.PlayTimer.sid, null, 20000); }
});

test('15 · Cheating from DevTools: points, play time, a price, an owner, a listing — refused by the rules; a duration sent by the page — ignored; a price of 1 — refused', async () => {
  const { page } = S.omar;
  S.omarSid = await playGame(page, S.gid);
  const r = await page.evaluate(async ([uid, gid, lina]) => {
    const { F, db } = NX.Backend.fb, out = {};
    const tryIt = async (k, f) => { try { await f(); out[k] = 'ok'; } catch (e) { out[k] = e.code || String(e); } };
    await tryIt('points', () => F.updateDoc(F.doc(db, 'wallets', uid), { points: 999999 }));
    await tryIt('playtime', () => F.setDoc(F.doc(db, 'playtime', gid), { seconds: 1000000 }, { merge: true }));
    await tryIt('price', () => F.updateDoc(F.doc(db, 'market', gid), { price: 1 }));
    await tryIt('owner', () => F.updateDoc(F.doc(db, 'market', gid), { ownerUid: uid }));
    await tryIt('purchase', () => F.setDoc(F.doc(db, 'purchases', uid + '_other'), { buyerUid: uid, gameId: 'other' }));
    await tryIt('session', () => F.setDoc(F.doc(db, 'play_sessions', 'fake'), { playerUid: uid, duration: 99999 }));
    await tryIt('sale_note', () => F.setDoc(F.doc(db, 'users', lina, 'notifications', 'n1'), { type: 'market', actorId: uid, read: false }));
    await tryIt('copy', () => F.setDoc(F.doc(db, 'projects', 'proj_fake_copy'), { projectId: 'proj_fake_copy', ownerId: uid, purchasedFrom: { gameId: gid } }));
    try { await NX.Market.api('/list', { gameId: gid, price: 10 }); out.list = 'ok'; } catch (e) { out.list = e.code; }
    return out;
  }, [S.omarUid, S.gid, S.linaUid]);
  ['points', 'playtime', 'price', 'owner', 'purchase', 'session', 'sale_note', 'copy'].forEach(k => assert.ok(denied(r[k]), k + ': ' + r[k]));
  assert.equal(r.list, 'not_owner');
  later(60);
  assert.equal(await page.evaluate(async sid => { try { await NX.Points.api('/play/beat', { sessionId: sid, duration: 9999999 }); return 'ok'; } catch (e) { return e.code; } }, S.omarSid), 'play_token', 'no sealed token: refused');
  const b = await page.evaluate(async sid => { const r = await NX.Points.api('/play/beat', { sessionId: sid, token: NX.PlayTimer.seal, duration: 9999999, seconds: 9999999 }); NX.PlayTimer.seal = r.token; return r; }, S.omarSid);
  about(b.credited, 60, 8, 'the server\'s minute, not the page\'s number');
  const cheap = await S.sam.page.evaluate(async gid => { try { await NX.Market.api('/buy', { gameId: gid, transactionId: 'tx_cheap_0000000001', expectedPrice: 1 }); return 'ok'; } catch (e) { return e.code; } }, S.gid);
  assert.equal(cheap, 'price_changed');
});

test('16 · Closing the game during a session: the session ends with its last stretch (endedAt · duration)', async () => {
  const { page } = S.omar;
  later(30);
  await page.evaluate(() => NX.GamePlayer.close());
  await until(page, () => !NX.PlayTimer.sid, null, 20000);
  await new Promise(r => setTimeout(r, 800));
  const s = await fsGet('play_sessions/' + S.omarSid);
  assert.equal(s.state, 'ended'); assert.ok(s.endedAt > 0); about(s.duration, 60 + 30, 15, 'its minute and the last 30 seconds');
});

test('17 · The connection lost: the beats cannot leave; when they come back the silence is not counted', async () => {
  const { page, ctx } = S.omar;
  const sid = await playGame(page, S.gid);
  await minute(page, 1);
  await ctx.setOffline(true);
  later(60); await page.evaluate(() => NX.PlayTimer.beat());
  later(60); await page.evaluate(() => NX.PlayTimer.beat());
  later(60);
  await ctx.setOffline(false);
  later(60);
  const back = await minute(page, 1);
  assert.equal(back.credited, 0, 'four minutes without a beat: not counted'); assert.equal(back.why, 'gap');
  const ok = await minute(page, 1);
  about(ok.credited, 60);
  about((await fsGet('play_sessions/' + sid)).duration, 120, 15);
  S.omarSid2 = sid;
});

test('18 · The same account on another device: the new session takes over, the first one stops counting', async () => {
  const d2 = S.omar2 = await newDevice(browser, site, logs);
  await signIn(d2.page, 'omar@test.io');
  await playGame(d2.page, S.gid);
  const old = await minute(S.omar.page, 1);
  assert.equal(old.stop, true); assert.equal(old.state, 'replaced');
  await until(S.omar.page, () => !NX.PlayTimer.sid, null, 20000);
  const fresh = await minute(d2.page, 1);
  assert.ok(fresh.credited > 0);
  assert.equal((await fsGet('play_sessions/' + S.omarSid2)).state, 'replaced');
});

test('19 · Reloading the page: the session closes (keepalive), a new one starts after the reload; nothing counted twice', async () => {
  const { page } = S.omar2;
  const sid = await page.evaluate(() => NX.PlayTimer.sid);
  later(20);
  await page.reload();
  await page.waitForFunction(() => window.NX && NX.Backend && NX.Backend.user && NX.PlayTimer, null, { timeout: 90000 });
  await until(page, sid => false || true, sid);
  await new Promise(r => setTimeout(r, 1500));
  const s = await fsGet('play_sessions/' + sid);
  assert.equal(s.state, 'ended', 'ended by the page as it closed');
  await until(page, () => NX.Backend.hasAccount(), null, 30000);
  const sid2 = await playGame(page, S.gid);
  assert.notEqual(sid2, sid);
});

test('20 · Everything is still there — kept by the server: the marketplace, the purchase, play time; 📊 Project Earnings shows each apart (players · play time · sessions · likes · sales · tips) and the transactions', async () => {
  const { page } = S.lina;
  await page.reload();
  await page.waitForFunction(() => window.NX && NX.Backend && NX.Backend.user && NX.Market && NX.Backend.hasAccount(), null, { timeout: 90000 });
  await page.evaluate(() => NX.Market.earnings());
  await page.locator(topSheet + ' .mk-kpis').waitFor({ timeout: 30000 });
  const k = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#sheet-root .sheet.in .mk-kpi')].map(x => [x.className.split(' ').find(c => c.startsWith('k-')), x.querySelector('b').textContent])));
  const pt = await fsGet('playtime/' + S.gid);
  assert.equal(k['k-players'], String(pt.players)); assert.equal(k['k-sessions'], String(pt.sessions));
  assert.equal(k['k-rewards'], undefined, 'no Play Rewards any more'); assert.equal(k['k-sales'], '1'); assert.equal(k['k-tips'], '0');
  const tot = await page.locator(topSheet + ' .mk-total').textContent();
  assert.ok(tot.includes('500'), tot);
  const tx = await page.locator(topSheet + ' .mk-log').textContent();
  assert.ok(tx.includes('+500'), tx);
  /* the buyer's side, after a reload: still bought, still theirs */
  assert.ok(await fsGet('purchases/' + S.omarUid + '_' + S.gid));
  assert.equal((await fsGet('projects/' + S.copyId)).ownerId, S.omarUid);
});

test('21 · The site\'s owner (and only the owner) sets the economy: «⚙️ NEXUS economy» → the lowest price 20 — read by everyone', async () => {
  const { page } = S.boss = await newDevice(browser, site, logs);
  const bossUid = await signUp(page, 'boss@test.io');
  /* the owner's e-mail is verified (as a Google account's is): the emulator is told so, the token renewed */
  await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-nexus/accounts:update', { method: 'POST', headers: { authorization: 'Bearer owner', 'content-type': 'application/json' }, body: JSON.stringify({ localId: bossUid, emailVerified: true }) });
  await page.evaluate(() => NX.Backend.fb.auth.currentUser.getIdToken(true));
  await page.evaluate(() => NX.Market.config(true));
  assert.equal(await page.evaluate(() => NX.Market.isOwner()), true, 'the site\'s owner');
  await page.evaluate(() => NX.Market.openEconomy());
  assert.equal(await page.locator(topSheet + ' [data-k="playPoints"]').count(), 0, 'no Play Rewards setting');
  await page.locator(topSheet + ' [data-k="minPrice"]').fill('20');
  await page.locator(topSheet + ' .mk-eco-save').click();
  await until(page, () => [...document.querySelectorAll('.toast')].some(t => /✓/.test(t.textContent)), null, 20000);
  const c = await S.omar.page.evaluate(async () => (await NX.Market.config(true)).minPrice);
  assert.equal(c, 20);
  assert.equal(await S.omar.page.evaluate(() => NX.Market.isOwner()), false);
  const refused = await S.omar.page.evaluate(async () => { try { await NX.Market.api('/config', { values: { minPrice: 1 } }); return 'ok'; } catch (e) { return e.code; } });
  assert.equal(refused, 'not_owner');
});

test('22 · In हिन्दी: the marketplace, the project box and 📊 Project Earnings with no Arabic left', async () => {
  const { page } = S.lina;
  const ARABIC = /[\u0600-\u06FF]/;
  await page.evaluate(() => { NX.Sheet.closeAll(); return NX.setLanguage('hi'); });
  const texts = {};
  await page.evaluate(() => NX.Market.open({ tab: 'featured' }));
  await page.locator(topSheet + ' .mk-card').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  texts.market = await page.locator(topSheet).innerText();
  await page.evaluate(() => NX.Sheet.closeAll());
  await page.evaluate(() => NX.Market.earnings());
  await page.locator(topSheet + ' .mk-kpis').waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  texts.earnings = await page.locator(topSheet).innerText();
  await page.evaluate(async id => { NX.Sheet.closeAll(); NX.Community.openGamePage(await NX.Games.get(id)); }, S.gid);
  await page.locator(topSheet + ' .mk-box b').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  texts.box = await page.locator(topSheet + ' .mk-box').innerText();
  for (const [k, v] of Object.entries(texts)) {
    const bad = v.split('\n').filter(l => ARABIC.test(l));
    assert.deepEqual(bad, [], k);
  }
  await page.evaluate(() => { NX.Sheet.closeAll(); return NX.setLanguage('ar'); });
});

test('23 · No errors on any page', async () => {
  const bad = logs.filter(l => !/serviceWorker|service worker|ServiceWorker|ERR_INTERNET_DISCONNECTED|Failed to fetch|net::/.test(l));
  assert.deepEqual(bad, []);
});

await run(tests, logs, async () => { Date.now = realNow; await browser.close(); await site.close(); await W.close(); });
