/* ============================================================
   NEXUS tests · 🎁 rewards in a real browser (Chromium: a computer and a phone
   with touch), with the Firebase emulators and the real rules, the site's server
   (points.js, market.js) running here — its clock moved by the test:
   the points always at the top (home, Studio, over a game), 🔥 the daily streak
   claiming itself, 🎡 the wheel landing on the server's prize, 🎁 an invitation
   paid after the friend's real play, 🔁 Remix only for one's own game,
   💝 a tip from the game's page, 👑 VIP with tokens (×2, one more spin),
   🧩 an object sold from the Vault and bought on the phone (15 %), 📊 the
   owner's dashboard (totals, a hand adjustment) — and English, Hindi.
   Run:  node nexus/tests/rewards-e2e.test.mjs
   ============================================================ */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startWorld } from './mock-world.mjs';
import { startSite } from './e2e-server.mjs';
import { e2eReply } from './fake-models.mjs';
import { chromium, resetEmulators, newDevice, signUp, until, run, fsGet, fsSet } from './e2e-kit.mjs';

const W = await startWorld();
W.reply = c => e2eReply(c);
const realNow = Date.now.bind(Date);
let skew = 0;
Date.now = () => realNow() + skew;
const later = s => { skew += s * 1000; };
const env = { FIREBASE_PROJECT_ID: 'demo-nexus', NEXUS_TEST_EMULATOR_TOKENS: '1', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', ADMIN_EMAILS: 'boss@test.io', REFERRAL_PLAY_MINUTES: '2',
  AI_PER_MINUTE: '500', GEMINI_BASE: W.base + '/gemini', GROQ_BASE: W.base + '/groq', GROQ_KEYS: 'gsk_GROQTESTKEY0000000000000001' };
await resetEmulators();
const HTML = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8').replace('window.NEXUS_FILES = "drive";', 'window.NEXUS_FILES = "firebase";');
const site = await startSite({ env, files: { '/index.html': HTML } });
const browser = await chromium.launch();
const logs = [];
const tests = [];
const test = (name, f) => tests.push({ name, f });
const S = {};
const M6 = 1e6;
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const top = '#sheet-root .sheet.in:last-of-type';
const pts = async uid => ((await fsGet('wallets/' + uid)) || {}).points || 0;
const ledger = async (uid, reason) => {
  const r = await fetch('http://127.0.0.1:8080/v1/projects/demo-nexus/databases/(default)/documents/wallets/' + uid + '/ledger?pageSize=300', { headers: { authorization: 'Bearer owner' } });
  return ((await r.json()).documents || []).map(d => ({ reason: d.fields.reason.stringValue, micro: +(d.fields.micro ? d.fields.micro.integerValue : 0), note: d.fields.note ? d.fields.note.stringValue : '' })).filter(x => !reason || x.reason === reason);
};
const notes = async uid => {
  const r = await fetch('http://127.0.0.1:8080/v1/projects/demo-nexus/databases/(default)/documents/users/' + uid + '/notifications?pageSize=100', { headers: { authorization: 'Bearer owner' } });
  return ((await r.json()).documents || []).map(d => d.fields.type.stringValue);
};
async function verify(uid, page) {
  await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-nexus/accounts:update', { method: 'POST', headers: { authorization: 'Bearer owner', 'content-type': 'application/json' }, body: JSON.stringify({ localId: uid, emailVerified: true }) });
  await page.evaluate(() => NX.Backend.fb.auth.currentUser.getIdToken(true));
}
const toast = (page, re) => until(page, r => [...document.querySelectorAll('.toast')].some(t => new RegExp(r).test(t.textContent)), re.source, 30000);
const wallet = async (page, rewards = true) => {
  await page.evaluate(() => { NX.Sheet.closeAll(); NX.Points.me = null; return NX.Points.open(); });
  await page.locator(top + (rewards ? ' .rw-card' : ' .pts-head')).waitFor({ timeout: 30000 });
};
/* a game in the Studio, published with NEXUS's own dialog */
async function makeGame(page, title) {
  await page.evaluate(async t => {
    await NX.Platform.createProject(t);
    await new Promise(r => setTimeout(r, 300));
    NX.Sheet.closeAll();
    const St = NX.Studio;
    await St.engine.addEntity({ name: 'Car', type: 'primitive', props: { shape: 'box', color: '#e11d48' }, position: [0, 0.5, 0] });
    NX.IDE.project = St.project;
    NX.IDE.addFile('Drive.js', 'function update(dt) { if (self) self.position.z -= 4 * dt; }\n', { silent: true });
    St.dirty = true;
    await St.save(true);
  }, title);
}
async function publish(page) {
  await page.evaluate(() => { NX.Sheet.closeAll(); NX.Studio.openPublish(); });
  await page.locator(top + ' .mk-pub').waitFor();
  await page.locator('.sheet-foot .btn', { hasText: 'PUBLISH' }).click();
  await page.locator('.modal-box', { hasText: 'تم النشر' }).waitFor({ timeout: 90000 });
  await page.evaluate(() => { document.querySelectorAll('.modal-box').forEach(m => { const s = m.parentElement && m.parentElement.previousElementSibling; if (s) s.click(); }); });
  return page.evaluate(() => NX.Studio.project.publishedId);
}
async function playGame(page, gid) {
  await page.evaluate(async id => { NX.Sheet.closeAll(); const g = await NX.Games.get(id); NX.GamePlayer.open(g); }, gid);
  await until(page, () => NX.Screen.current() === 'player' || !!document.querySelector('.modal-box.in'), null, 30000);
  const consent = page.locator('.modal-box.in .btn', { hasText: 'تشغيل' });
  if (await consent.count()) await consent.first().click();
  await until(page, id => NX.PlayTimer && NX.PlayTimer.sid && NX.PlayTimer.gid === id, gid, 30000);
  return page.evaluate(() => { clearInterval(NX.PlayTimer.timer); return NX.PlayTimer.sid; });
}
async function minute(page, n = 1) { for (let i = 0; i < n; i++) { later(60); await page.evaluate(() => NX.PlayTimer.beat()); } return page.evaluate(() => NX.PlayTimer.last); }

/* ================================================================ the points at the top · 🔥 the streak */
test('1 · The points always at the top: a visitor sees «💰 0»; signing in, 🔥 the day\'s streak claims itself (+5, a toast, nothing in the way) → «55» at the top', async () => {
  const { page } = S.lina = await newDevice(browser, site, logs, { daily: true });
  await page.locator('#btn-points').waitFor();
  assert.equal(await page.locator('#btn-points').isVisible(), true);
  assert.equal(await page.locator('#pts-val').textContent(), '0', 'a visitor: 0');
  S.linaUid = await signUp(page, 'lina@test.io');
  await toast(page, /🔥/);
  await until(page, () => document.getElementById('pts-val').textContent === '55', null, 30000);
  assert.deepEqual((await ledger(S.linaUid, 'streak')).map(x => x.micro), [5 * M6]);
  assert.equal(await page.locator('.modal-box.in').count(), 0, 'no modal in the way');
});

test('2 · 🔥 In the wallet: day 1 ✓ (tomorrow +10) · 🎡 the wheel: one tap — it turns and lands on the prize the SERVER drew; the prize is in the wallet; then «watch an ad» or «tomorrow»', async () => {
  const { page } = S.lina;
  await wallet(page);
  assert.equal(await page.locator(top + ' .rw-streak .rw-done').count(), 1);
  assert.match(await page.locator(top + ' .rw-streak').textContent(), /\+10/);
  await page.locator(top + ' .rw-spin-open').click();
  await page.locator(top + ' .rw-stage').waitFor();
  const before = await pts(S.linaUid);
  await page.locator(top + ' .rw-go').click();
  await page.locator(top + ' .rw-stage[data-state="done"]').waitFor({ timeout: 15000 });
  const shown = await page.evaluate(() => { const s = document.querySelector('#sheet-root .sheet.in .rw-stage'); return { index: +s.dataset.index, prize: +s.dataset.prize, rot: getComputedStyle(s.querySelector('.rw-wheel')).transform }; });
  const spin = await ledger(S.linaUid, 'spin');
  assert.equal(spin.length, 1); assert.equal(spin[0].micro, shown.prize * M6, 'the wheel shows the server\'s prize');
  assert.equal(await pts(S.linaUid), before + shown.prize);
  assert.notEqual(shown.rot, 'none');
  assert.match(await page.locator(top + ' .rw-result').textContent(), new RegExp(String(shown.prize)));
  const go = await page.locator(top + ' .rw-go').getAttribute('data-do');
  assert.ok(['ad', 'none'].includes(go), go);
  S.spinPrize = shown.prize;
});

/* ================================================================ 🎁 invite & earn · 🔁 Remix · 💝 tips */
test('3 · 🎁 Invite: Lina\'s link (…?ref=code) opened on Omar\'s phone — kept until he signs up with a new account; claimed once his e-mail is verified', async () => {
  const { page } = S.lina;
  await page.evaluate(() => { NX.Sheet.closeAll(); return NX.Rewards.invite(); });
  await page.locator(top + ' .rw-link-in').waitFor({ timeout: 20000 });
  const link = await page.locator(top + ' .rw-link-in').inputValue();
  assert.match(link, /\/index\.html\?ref=[a-z0-9]{6,8}$/);
  S.code = link.split('ref=')[1];
  const { page: phone } = S.omar = await newDevice(browser, site, logs, PHONE);
  await phone.goto(site.base + '/index.html?emulators=1&ref=' + S.code);
  await phone.waitForFunction(() => window.NX && NX.Backend && NX.Backend.isOnline && NX.Backend.isOnline() && NX.Backend.user && NX.Rewards, null, { timeout: 90000 });
  assert.equal(await phone.evaluate(() => JSON.parse(localStorage.getItem('nx.ref')).code), S.code);
  assert.ok(!/ref=/.test(phone.url()), 'the code leaves the address bar');
  S.omarUid = await signUp(phone, 'omar@test.io');
  await toast(phone, /🎁/);                                                      // «verify your e-mail first»
  assert.ok(await phone.evaluate(() => !!localStorage.getItem('nx.ref')), 'kept for later');
  await verify(S.omarUid, phone);
  await phone.evaluate(() => NX.Rewards.claimRef());
  const rf = await fsGet('referrals/' + S.omarUid);
  assert.deepEqual([rf.referrer, rf.status], [S.linaUid, 'joined']);
  assert.equal(await phone.evaluate(() => localStorage.getItem('nx.ref')), null);
});

test('4 · 🎁 Paid only after the friend\'s real play: Omar plays Lina\'s game 2 minutes (server-timed, sealed beats) → Lina +100, Omar +50, Lina is told', async () => {
  const { page } = S.lina;
  await makeGame(page, 'Spin Kart');
  S.gid = await publish(page);
  const lina0 = await pts(S.linaUid), omar0 = await pts(S.omarUid);
  await playGame(S.omar.page, S.gid);
  await minute(S.omar.page, 1);
  assert.equal(await pts(S.linaUid), lina0, 'not yet');
  const last = await minute(S.omar.page, 1);
  assert.deepEqual(last.referral, { referrer: 100, friend: 50 });
  await toast(S.omar.page, /🎁 \+50/);
  assert.equal(await pts(S.linaUid), lina0 + 100); assert.equal(await pts(S.omarUid), omar0 + 50);
  assert.ok((await notes(S.linaUid)).includes('referral'));
  await S.omar.page.evaluate(() => NX.GamePlayer.close());
});

test('5 · 🔁 Remix is for one\'s own game: Lina may remix «Spin Kart»; on Omar\'s phone its page has no Remix, and the rules refuse a remix of it', async () => {
  assert.equal(await S.lina.page.evaluate(async id => NX.Remix.allowed(await NX.Games.get(id)), S.gid), true);
  const phone = S.omar.page;
  assert.equal(await phone.evaluate(async id => NX.Remix.allowed(await NX.Games.get(id)), S.gid), false);
  await phone.evaluate(async id => { NX.Sheet.closeAll(); NX.Community.openGamePage(await NX.Games.get(id)); }, S.gid);
  await phone.locator(top + ' .mk-box').waitFor({ timeout: 20000 });
  assert.equal(await phone.locator(top + ' .sc-remix, ' + top + ' .rmx-btn').count(), 0);
  const r = await phone.evaluate(async ([gid, owner, me]) => {
    const { F, db } = NX.Backend.fb;
    try { await F.setDoc(F.doc(db, 'projects', 'proj_steal'), { projectId: 'proj_steal', ownerId: me, name: 'x', remixedFrom: { gameId: gid, ownerId: owner }, members: {}, memberIds: [], createdAt: 1, updatedAt: 1 }); return 'written'; }
    catch (e) { return e.code || e.message; }
  }, [S.gid, S.linaUid, S.omarUid]);
  assert.match(r, /permission/);
});

test('6 · 💝 From the game\'s page on the phone: «Tip the developer» → 50 → Lina +50 exactly, Omar −50, Lina is told; the page counts the tip', async () => {
  const phone = S.omar.page;
  const lina0 = await pts(S.linaUid), omar0 = await pts(S.omarUid);
  await phone.locator(top + ' .mk-tip').tap();
  await phone.locator('.modal .rw-tip-preset[data-p="50"]').tap();
  await phone.locator('.modal .rw-tip-note').fill('great game');
  await phone.locator('.modal .rw-tip-go').tap();
  await toast(phone, /💝/);
  assert.equal(await pts(S.linaUid), lina0 + 50); assert.equal(await pts(S.omarUid), omar0 - 50);
  assert.ok((await notes(S.linaUid)).includes('tip'));
  await until(phone, () => /💝 1/.test((document.querySelector('#sheet-root .sheet.in .mk-tips-n') || {}).textContent || ''), null, 20000);
});

/* ================================================================ 👑 VIP · 🧩 files & code */
test('7 · 👑 VIP with tokens: 499 → VIP 30 days; one more free spin today (no ad) and its prize ×2', async () => {
  const { page } = S.lina;
  await fsSet('wallets/' + S.linaUid, { points: 2000 });
  await wallet(page);
  await page.locator(top + ' .rw-vip-open').click();
  await page.locator(top + ' .rw-vip-tokens').click();
  await page.locator('.modal-box.in .btn.danger').click();
  await toast(page, /👑/);
  const w = await fsGet('wallets/' + S.linaUid);
  assert.equal(w.points, 1501); assert.ok(w.vipUntil > Date.now() + 29 * 864e5);
  await page.evaluate(() => { NX.Sheet.closeAll(); return NX.Rewards.spinWheel(); });
  await page.locator(top + ' .rw-go[data-do="spin"]').waitFor({ timeout: 20000 });
  await page.locator(top + ' .rw-go').click();
  await page.locator(top + ' .rw-stage[data-state="done"]').waitFor({ timeout: 15000 });
  const spins = await ledger(S.linaUid, 'spin');
  assert.equal(spins.length, 2);
  const vipSpin = spins.find(x => /×2/.test(x.note));
  assert.ok(vipSpin, JSON.stringify(spins));
  assert.equal((vipSpin.micro / M6) % 2, 0, 'doubled');
});

test('8 · 🧩 Files & code: Lina sells an object from her 🗄 Vault (100); on the phone Omar buys it in «Files & code» → his own private copy; Lina gets 85 (the site keeps 15 %)', async () => {
  const { page } = S.lina;
  await fsSet('vault/vault_drift', { vaultId: 'vault_drift', ownerId: S.linaUid, name: 'Drift Car', note: '', scene: '{"objects":[{"id":"c"}]}', scripts: [{ path: 'Drift.js', code: 'drift()' }],
    components: [], assetRefs: [], size: [1, 1, 2], counts: { objects: 1 }, uses: 0, v: 1, createdAt: 1, updatedAt: 1 });
  await page.evaluate(() => { NX.Sheet.closeAll(); return NX.CanvasPro.openVault(); });
  await page.locator(top + ' .vt-sell').first().waitFor({ timeout: 20000 });
  await page.locator(top + ' .vt-sell').first().click();
  await page.locator('.modal .mk-price').fill('100');
  await page.locator('.modal .mk-save-price').click();
  await toast(page, /💰/);
  assert.deepEqual([(await fsGet('market_items/vault_vault_drift')).price, (await fsGet('market_items/vault_vault_drift')).isForSale], [100, true]);
  const phone = S.omar.page;
  await fsSet('wallets/' + S.omarUid, { points: 500 });
  const lina0 = await pts(S.linaUid);
  await phone.evaluate(() => { NX.Sheet.closeAll(); return NX.Market.open({ tab: 'items' }); });
  const card = phone.locator(top + ' .mk-item[data-item="vault_vault_drift"]');
  await card.waitFor({ timeout: 20000 });
  assert.match(await card.textContent(), /Drift Car/);
  await card.locator('.mk-buy').tap();
  await phone.locator('.modal .mk-yes').tap();
  await toast(phone, /✓/);
  assert.equal(await pts(S.omarUid), 400); assert.equal(await pts(S.linaUid), lina0 + 85);
  const p = await fsGet('item_purchases/' + S.omarUid + '_vault_vault_drift');
  const copy = await fsGet('vault/' + p.copyId);
  assert.deepEqual([copy.ownerId, copy.name, copy.purchasedFrom.sellerUid], [S.omarUid, 'Drift Car', S.linaUid]);
  /* his copy is his — he cannot sell it on, nor read Lina's original or the content kept for sale */
  const r = await phone.evaluate(async ([orig]) => { const { F, db } = NX.Backend.fb; const out = {};
    for (const [k, ref] of [['orig', F.doc(db, 'vault', orig)], ['content', F.doc(db, 'market_item_content', 'vault_vault_drift')]]) { try { await F.getDoc(ref); out[k] = 'read'; } catch (e) { out[k] = e.code; } }
    return out; }, ['vault_drift']);
  assert.match(r.orig, /permission/); assert.match(r.content, /permission/);
});

/* ================================================================ 📊 the owner */
test('9 · 📊 The owner\'s dashboard: sales 1 · commission 15 · tips 1 · gifts; «Give or take tokens» +10.5 to Omar → his balance and his transactions show it', async () => {
  const { page } = S.boss = await newDevice(browser, site, logs);
  S.bossUid = await signUp(page, 'boss@test.io');
  await verify(S.bossUid, page);
  await page.evaluate(() => NX.Market.config(true));
  await wallet(page);
  await page.locator(top + ' .rw-admin-open').click();
  await page.locator(top + ' .rw-akpis').waitFor({ timeout: 20000 });
  const k = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#sheet-root .sheet.in .rw-akpis .mk-kpi')].map(x => [x.className.split(' ').find(c => c.startsWith('k-')), x.textContent])));
  assert.match(k['k-sales'], /\(1\)/); assert.match(k['k-fees'], /^15/); assert.match(k['k-tips'], /^50/);
  const omar0 = await pts(S.omarUid);
  await page.locator(top + ' .rw-a-uid').fill(S.omarUid);
  await page.locator(top + ' .rw-a-amount').fill('10.5');
  await page.locator(top + ' .rw-a-note').fill('support');
  await page.locator(top + ' .rw-a-go').click();
  await toast(page, /✓/);
  assert.equal(await pts(S.omarUid), omar0 + 10.5);
  await until(page, () => /\+10\.5/.test((document.querySelector('#sheet-root .sheet.in .rw-a-list') || {}).textContent || ''), null, 20000);
  const mine = await S.omar.page.evaluate(() => NX.Points.api('/transactions'));
  assert.equal(mine.transactions.filter(t => t.type === 'adjust' && t.tokens === '10.5').length, 1);
  /* not the owner: no dashboard */
  assert.equal(await S.omar.page.evaluate(async () => { try { await NX.Points.api('/admin/summary'); return 'open'; } catch (e) { return e.code; } }), 'not_owner');
});

test('10 · The points at the top of every screen: the home bar, the Studio\'s bar and over a game — the same number as the wallet', async () => {
  const { page } = S.lina;
  const n = await page.evaluate(() => NX.fmtNum(NX.Points.wallet.points));
  await page.evaluate(async id => { NX.Sheet.closeAll(); const p = await NX.Projects.get((await NX.Games.get(id)).projectId); await NX.Studio.open(p); }, S.gid);
  await until(page, () => NX.Screen.current() === 'studio', null, 30000);
  assert.equal(await page.locator('#s-points').isVisible(), true);
  assert.equal(await page.locator('#s-points .pts-num').textContent(), n);
  await S.omar.page.evaluate(async id => { NX.Sheet.closeAll(); const g = await NX.Games.get(id); NX.GamePlayer.open(g); }, S.gid);
  await until(S.omar.page, () => NX.Screen.current() === 'player', null, 30000);
  assert.equal(await S.omar.page.locator('#pl-points').isVisible(), true);
  assert.equal(await S.omar.page.locator('#pl-points .pts-num').textContent(), await S.omar.page.evaluate(() => NX.fmtNum(NX.Points.wallet.points)));
  await S.omar.page.evaluate(() => NX.GamePlayer.close());
  await page.evaluate(() => NX.Platform.go('home'));
});

test('11 · English and हिन्दी: the rewards card, the wheel, invitations, VIP — no Arabic', async () => {
  const ARABIC = /[؀-ۿ]/;
  const { page } = S.lina;
  for (const lang of ['en', 'hi']) {
    await page.evaluate(l => { NX.Sheet.closeAll(); return NX.setLanguage(l); }, lang);
    const texts = {};
    await wallet(page);
    await page.waitForTimeout(500);
    texts.card = await page.locator(top + ' .rw-card').innerText();
    await page.evaluate(() => { NX.Sheet.closeAll(); return NX.Rewards.spinWheel(); });
    await page.locator(top + ' .rw-spinbox').waitFor({ timeout: 20000 });
    texts.wheel = await page.locator(top + ' .rw-spinbox').innerText();
    await page.evaluate(() => { NX.Sheet.closeAll(); return NX.Rewards.invite(); });
    await page.locator(top + ' .rw-link-in').waitFor({ timeout: 20000 });
    texts.invite = await page.locator(top + ' .rw-invite').innerText();
    await page.evaluate(() => { NX.Sheet.closeAll(); return NX.Rewards.vipSheet(); });
    await page.locator(top + ' .rw-vip').waitFor({ timeout: 20000 });
    texts.vip = await page.locator(top + ' .rw-vip').innerText();
    for (const [k, v] of Object.entries(texts)) assert.deepEqual(v.split('\n').filter(l => ARABIC.test(l)), [], lang + ' ' + k);
  }
  await page.evaluate(() => { NX.Sheet.closeAll(); return NX.setLanguage('ar'); });
});

test('12 · No errors on any page', async () => {
  const bad = logs.filter(l => !/serviceWorker|service worker|ServiceWorker|ERR_INTERNET_DISCONNECTED|Failed to fetch|net::|status of 4\d\d/.test(l));
  assert.deepEqual(bad, []);
});

await run(tests, logs, async () => { Date.now = realNow; await browser.close(); await site.close(); await W.close(); });
