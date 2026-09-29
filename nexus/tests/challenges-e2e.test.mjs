/* ============================================================
   NEXUS tests · NEXUS CHALLENGES end to end, in a real browser (Chromium):
   the page (PART 37) and the Studio's own «Publish», the site's server
   functions (challenges.js · ai.js · points.js) on the Firebase emulators —
   the real firestore.rules apply to every page — and fake AI providers
   that answer like judges (fake-models.mjs · judgeReply).
   Four players (one on a phone), the site's owner, and a device whose
   clock is 3 hours behind. What is checked is what each person SEES and
   what the SERVER keeps (read back from the emulator as its admin).
   Needs the emulators (firebase emulators:start --project demo-nexus
   --only auth,firestore,storage) and Playwright + Chromium.
   Run:  node nexus/tests/challenges-e2e.test.mjs
   ============================================================ */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startWorld } from './mock-world.mjs';
import { startSite } from './e2e-server.mjs';
import { e2eReply } from './fake-models.mjs';
import { chromium, fsSet, fsGet, fsQuery, resetEmulators, newDevice, open, signUp, signIn, until, run } from './e2e-kit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
/* the site configured for Firebase Storage (window.NEXUS_FILES = "firebase", one of its two documented
   settings): a published game's cover and icon go to the Storage emulator instead of Google Drive */
const HTML = fs.readFileSync(path.join(here, '..', 'index.html'), 'utf8').replace('window.NEXUS_FILES = "drive";', 'window.NEXUS_FILES = "firebase";');
assert.ok(HTML.includes('window.NEXUS_FILES = "firebase";'));

const KEYS = { gem: 'AIzaGEMINI_TEST_KEY_000000000000000001', groq: 'gsk_GROQTESTKEY0000000000000001', or: 'sk-or-v1-OPENROUTERTESTKEY000000001' };
const W = await startWorld();
W.reply = e2eReply;
const env = { FIREBASE_PROJECT_ID: 'demo-nexus', NEXUS_TEST_EMULATOR_TOKENS: '1', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', ADMIN_EMAILS: 'owner@test.io',
  AI_PER_MINUTE: '500', PRO_AI_PER_DAY: '500', AI_FREE_PER_DAY: '50', CHALLENGE_TICK_SECONDS: '0',
  GEMINI_BASE: W.base + '/gemini', GROQ_BASE: W.base + '/groq', OPENROUTER_BASE: W.base + '/openrouter', ANTHROPIC_BASE: W.base + '/anthropic',
  GEMINI_KEYS: KEYS.gem, GROQ_KEYS: KEYS.groq, OPENROUTER_KEYS: KEYS.or };
await resetEmulators();
const site = await startSite({ env, files: { '/index.html': HTML } });
const browser = await chromium.launch();
const logs = [];
const tests = [];
const test = (name, f) => tests.push({ name, f });
const S = {};
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' };

/* ---------------- the games the players make (in NEXUS's own editor) ---------------- */
const RACE = `let speed = 0, lap = 0, time = 0;
function start() { UI.text("Lap 0/3", { id: "hud" }); Audio.beep(220, 0.2, "sawtooth"); }
function update(dt) {
  const gas = Input.axis("vertical");
  speed += gas * 12 * dt;
  time += dt;
  if (time > 99) { lap++; }
  if (lap >= 3) { UI.text("You win! finish " + time.toFixed(1), { id: "hud" }); }
}
function restart() { lap = 0; time = 0; }`;
const RACE_ENEMY = RACE.replace('function restart()', 'const opponent = { speed: 10 };\nfunction chase() { return opponent.speed; }\nfunction restart()');
const NO_INPUT = `let t = 0;
function update(dt) { t += dt; }`;                                   // a car that nobody can drive
async function makeGame(page, name, code) {
  await page.evaluate(name => NX.Platform.createProject(name), name);
  await fillGame(page, code);
}
/* what the player builds in the project open in the editor: a car, a track, a finish line and a script */
async function fillGame(page, code) {
  await page.evaluate(async code => {
    const S = NX.Studio;
    await S.engine.addEntity({ name: 'Player Car', type: 'primitive', props: { shape: 'box', color: '#e11d48' }, position: [0, 0.5, 0] });
    await S.engine.addEntity({ name: 'Race Track', type: 'primitive', props: { shape: 'plane', color: '#444444' }, position: [0, 0, -50], scale: [8, 1, 120] });
    await S.engine.addEntity({ name: 'Finish Line', type: 'primitive', props: { shape: 'box', color: '#ffffff' }, position: [0, 0.1, -100] });
    NX.IDE.project = S.project;
    NX.IDE.addFile('CarController.js', code, { silent: true });
    S.dirty = true;
    await S.save(true);
  }, code);
}
/* the Studio's «🏆 تسليم اللعبة للتحدي» → NEXUS's own Publish dialog → PUBLISH → the submission, judged live */
async function publishAndSubmit(page, { viaMenu = false } = {}) {
  if (viaMenu) {
    await page.click('#s-more');
    await page.locator('.opt-row', { hasText: 'تسليم اللعبة للتحدي' }).click();
  } else await page.evaluate(() => NX.Challenges.submitFromStudio());
  await page.locator('.chg-pubnote').waitFor();
  await page.locator('.sheet-foot .btn', { hasText: 'PUBLISH' }).click();
  try { await until(page, () => document.querySelector('.chg-submitting .cc-final, .chg-submitting .chg-step[data-s="bad"]'), null, 60000); }
  catch (e) {
    const why = await page.evaluate(() => ({ sheets: [...document.querySelectorAll('.sheet')].map(s => s.querySelector('h3').textContent + ' :: ' + s.innerText.slice(-400)),
      modal: (document.querySelector('.modal-box') || {}).innerText || null, toasts: [...document.querySelectorAll('.toast')].map(t => t.innerText) }));
    throw new Error('no result after PUBLISH: ' + JSON.stringify(why, null, 1));
  }
  return page.evaluate(() => document.querySelector('.chg-submitting').innerText);
}
/* the «🏆 NEXUS CHALLENGES» sheet, alone on screen (a closing sheet stays in the page for its animation) */
async function openCh(page, cid = null) {
  await page.evaluate(() => NX.Sheet.closeAll());
  await until(page, () => !document.querySelector('.sheet'));
  await page.evaluate(cid => NX.Challenges.open(cid || undefined), cid);
  await page.locator('.chg-p').waitFor();
}
/* the Auth emulator as its admin: this account's e-mail is verified (the server accepts an ADMIN_EMAILS
   address as the owner only when it is verified — a sign-up with someone else's address is not the owner) */
async function verifyEmail(page, uid) {
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-nexus/accounts:update', { method: 'POST',
    headers: { authorization: 'Bearer owner', 'content-type': 'application/json' }, body: JSON.stringify({ localId: uid, emailVerified: true }) });
  if (!r.ok) throw new Error('verify ' + r.status + ' ' + await r.text());
  await page.evaluate(async () => { const u = NX.Backend.fb.auth.currentUser; await u.reload(); await u.getIdToken(true); });
}
const home = async page => { await page.evaluate(() => { NX.Sheet.closeAll(); if (NX.Screen.current() !== 'platform') NX.Screen.show('platform'); NX.Platform.go('home'); }); await page.locator('.chg-home .chg-card').waitFor(); };
const secsOf = t => { const m = /(?:(\d+)d )?(\d\d):(\d\d):(\d\d)/.exec(t); return m ? (+m[1] || 0) * 86400 + +m[2] * 3600 + +m[3] * 60 + +m[4] : NaN; };
const judgeCalls = () => W.calls.filter(c => /NEXUS AI JUDGE/.test(c.system));
const entry = async (uid, cid = S.cid) => fsGet('challengeEntries/' + cid + '_' + uid);
const wallet = async uid => { const w = await fsGet('wallets/' + uid); return w ? w.points || 0 : null; };
const denied = r => assert.ok(/permission-denied|PERMISSION_DENIED/i.test(r), 'refused by the rules: ' + r);
/* the order of the server (challenges.js · rankCmp): the AI score, then Challenge Fit, Completeness, Gameplay, the earlier submission */
const rankCmp = (a, b) => (b.total100 - a.total100) || (b.criteria.fit - a.criteria.fit) || (b.criteria.completeness - a.criteria.completeness) || (b.criteria.gameplay - a.criteria.gameplay) || (a.submittedAt - b.submittedAt);

/* ================================================================ 1 · the challenge */
test('1 · Create: the server creates the challenge on its own (44 h by default) — the home page shows its title, difficulty, time left, players and reward', async () => {
  const { page } = S.maya = await newDevice(browser, site, logs);
  S.mayaUid = await signUp(page, 'maya@test.io', { free: false });
  await home(page);
  const st = await fsGet('challenges_meta/state');
  S.cid = st.currentId;
  const c = await fsGet('challenges/' + S.cid);
  assert.equal(c.status, 'open'); assert.equal(c.endTime - c.startTime, 44 * 3600e3); assert.equal(c.durationHours, 44);
  assert.equal(c.judgingRubric.reduce((n, x) => n + x.weight, 0), 100);
  const card = await page.textContent('.chg-home');
  for (const t of ['NEXUS CHALLENGES', 'تحدي سباق السيارات', 'متوسط', 'ينتهي بعد', 'المشاركون', '1,500', 'شارك في التحدي']) assert.ok(card.includes(t), 'the card shows «' + t + '»: ' + card);
});

test('2 · Countdown: it runs every second, by the SERVER\'s clock — a device whose clock is 3 hours behind shows the same time left', async () => {
  const { page } = S.maya;
  const c = await fsGet('challenges/' + S.cid);
  const a = secsOf(await page.textContent('.chg-home .chg-clock'));
  await page.waitForTimeout(2200);
  const b = secsOf(await page.textContent('.chg-home .chg-clock'));
  assert.ok(a - b >= 1 && a - b <= 4, 'it counts down: ' + a + ' → ' + b);
  assert.ok(Math.abs(b - (c.endTime - Date.now()) / 1000) <= 3, 'the time left is the server\'s');
  const late = S.late = await newDevice(browser, site, logs, { clockShift: -3 * 3600e3 });            // a visitor, its clock 3 h behind
  assert.ok(await late.page.evaluate(() => Math.abs(Date.now() + 3 * 3600e3 - new Date().getTime()) < 5000), 'this device\'s clock is really 3 h behind');
  await home(late.page);
  const d = secsOf(await late.page.textContent('.chg-home .chg-clock'));
  assert.ok(Math.abs(d - (c.endTime - Date.now()) / 1000) <= 3, 'the same time left on the late device: ' + d);
});

/* ================================================================ 2 · taking part */
test('3 · Join: tied to the account\'s uid — the button becomes «submit», the server counts the player once; a visitor is asked to sign in', async () => {
  const { page } = S.maya;
  await page.locator('.chg-home .btn', { hasText: 'شارك في التحدي' }).click();
  await page.locator('.chg-home .btn', { hasText: 'سلّم لعبتك' }).waitFor();
  const e = await entry(S.mayaUid);
  assert.equal(e.uid, S.mayaUid); assert.equal(e.status, 'joined'); assert.equal(e.submissions, 0);
  await page.evaluate(() => NX.Challenges.join());                                              // again: still one
  assert.equal((await fsGet('challenges/' + S.cid)).participants, 1);
  /* a visitor without an account */
  const v = S.late.page;
  await v.locator('.chg-home .btn', { hasText: 'شارك في التحدي' }).click();
  await v.locator('.sheet', { hasText: 'المتابعة مع Google' }).waitFor();
  assert.equal((await fsGet('challenges/' + S.cid)).participants, 1, 'no entry without an account');
  await S.late.ctx.close();
});

test('4 · Create project: «مشروع جديد للتحدي» opens NEXUS\'s own editor with a new project (kept in Firestore for this account) and the assistant ready with the idea — nothing sent to the AI', async () => {
  const { page } = S.maya;
  const calls = W.calls.length;
  await page.locator('.chg-home .sec-head button', { hasText: 'كل التحديات' }).click();
  await page.locator('.chg-tabs button', { hasText: 'التحدي' }).waitFor();
  await page.locator('.chg-actions .btn', { hasText: 'مشروع جديد للتحدي' }).click();
  await until(page, () => NX.Screen.current() === 'studio' && NX.Studio.project && /تحدي سباق السيارات/.test(NX.Studio.project.name) && NX.AIPanel.input && NX.AIPanel.input.value);
  const p = await page.evaluate(() => ({ id: NX.Studio.project.projectId, name: NX.Studio.project.name, ask: NX.AIPanel.input.value, cid: NX.Studio.project.settings.challengeId }));
  assert.match(p.ask, /تحدي سباق السيارات/); assert.equal(p.cid, S.cid);
  const doc = await fsGet('projects/' + p.id);
  assert.equal(doc.ownerId, S.mayaUid, 'the project is the account\'s, on the server');
  assert.equal(W.calls.length, calls, 'nothing asked of any AI until the player presses send');
  S.mayaProject = p.id;
  await page.evaluate(() => NX.Sheet.closeAll());
});

test('5 · Submit: «المزيد ← 🏆 تسليم اللعبة للتحدي» — NEXUS\'s own Publish, a 2-second test run, then the server checks the account, the game and the project and keeps the entry', async () => {
  const { page } = S.maya;
  await page.evaluate(async code => {
    const S = NX.Studio;
    await S.engine.addEntity({ name: 'Player Car', type: 'primitive', props: { shape: 'box', color: '#e11d48' }, position: [0, 0.5, 0] });
    await S.engine.addEntity({ name: 'Race Track', type: 'primitive', props: { shape: 'plane', color: '#444444' }, position: [0, 0, -50], scale: [8, 1, 120] });
    await S.engine.addEntity({ name: 'Finish Line', type: 'primitive', props: { shape: 'box', color: '#ffffff' }, position: [0, 0.1, -100] });
    NX.IDE.project = S.project;
    NX.IDE.addFile('CarController.js', code, { silent: true });
    S.dirty = true;
    await S.save(true);
  }, RACE);
  S.before = judgeCalls().length;
  const text = await publishAndSubmit(page, { viaMenu: true });
  for (const t of ['نُشرت اللعبة', 'التشغيل التجريبي', 'سُلّمت', 'NEXUS AI JUDGE SCORE']) assert.ok(text.includes(t), 'the steps say «' + t + '»:\n' + text);
  const e = S.mayaEntry = await entry(S.mayaUid);
  const g = await fsGet('games/' + e.gameId);
  assert.equal(e.projectId, S.mayaProject); assert.equal(g.projectId, S.mayaProject); assert.equal(g.ownerId, S.mayaUid);
  assert.equal(e.gameVersion, g.version); assert.ok(e.submittedAt > 0 && e.buildAt > 0);
  assert.equal(e.evidence.detected.input, true); assert.equal(e.evidence.preview.buildOk, true); assert.match(e.evidence.preview.source, /UNVERIFIED/);
  assert.equal((await fsGet('challenges/' + S.cid)).submissions, 1);
});

test('6 · AI Judge: NEXUS AI JUDGE scores the RUBRIC from the evidence the server read (never «I liked it») — 7 criteria and their weights, a reason for each, an AI Judge Summary', async () => {
  const { page } = S.maya;
  const calls = judgeCalls().slice(S.before);
  assert.equal(calls.length, 1, 'a medium challenge: one judge');
  const c = calls[0];
  assert.match(c.system, /RUBRIC/); assert.match(c.system, /gameplay \(Gameplay, 25%\)/); assert.match(c.system, /You did NOT play the game/);
  assert.match(c.lastUser, /GAME EVIDENCE/); assert.match(c.lastUser, /CarController\.js[\s\S]*Input\.axis/);
  assert.ok(c.lastUser.length < 30000, 'only what the judge needs: ' + c.lastUser.length + ' characters');
  const ui = await page.evaluate(() => ({ bars: [...document.querySelectorAll('.chg-submitting .chg-bar')].map(b => b.querySelector('.chg-bl b').textContent + '=' + b.querySelector('.chg-bv').textContent),
    notes: document.querySelectorAll('.chg-submitting .chg-note').length, sum: (document.querySelector('.chg-submitting .chg-sum') || {}).innerText || '' }));
  assert.equal(ui.bars.length, 7, ui.bars.join(' '));
  assert.equal(ui.notes, 7, 'a reason for every criterion');
  assert.match(ui.sum, /AI Judge Summary/);
});

test('7 · Save result: kept on the server (challengeEntries) — the page shows exactly what is stored', async () => {
  const { page } = S.maya;
  const e = S.mayaEntry = await entry(S.mayaUid);
  assert.equal(e.status, 'judged'); assert.equal(e.needsJudge, false);
  assert.equal(Object.keys(e.criteria).length, 7); assert.ok(e.summary && e.judges.length === 1 && e.judgedAt > 0);
  const shown = await page.evaluate(() => [document.querySelector('.chg-submitting .chg-big b').textContent, document.querySelector('.chg-submitting .chg-100').textContent]);
  assert.deepEqual(shown, [e.score10.toFixed(1), e.total100.toFixed(1) + ' / 100']);
});

test('8 · /10: the weighted sum of the criteria is the score out of 100, then /10 (e.g. 94/100 → 9.4) — recomputed here from what is stored', async () => {
  const e = S.mayaEntry, c = await fsGet('challenges/' + S.cid);
  const sum = c.judgingRubric.reduce((t, x) => t + e.criteria[x.id] * x.weight, 0) / 10;
  assert.ok(Math.abs(sum - e.total100) < 0.011, sum + ' vs ' + e.total100);
  assert.equal(e.score10, Math.round(e.total100) / 10);
  assert.equal(Math.round(94) / 10, 9.4);
});

test('9 · Tamper (DevTools): a score, a rank, a winner, a prize or the settings written to Firestore — refused by the rules; «score: 10» sent to the server — ignored; the page\'s memory — overwritten by the server', async () => {
  const { page } = S.maya;
  const eid = S.cid + '_' + S.mayaUid;
  const tries = await page.evaluate(async ([cid, eid, uid]) => {
    const { F, db } = NX.Backend.fb;
    const t = async fn => { try { await fn(); return 'ALLOWED'; } catch (e) { return String(e.code || e.message); } };
    return [
      await t(() => F.setDoc(F.doc(db, 'challengeEntries', eid), { score10: 10, total100: 100, rank: 1 }, { merge: true })),
      await t(() => F.setDoc(F.doc(db, 'challengeEntries', cid + '_' + uid + 'x'), { uid, challengeId: cid, score10: 10 })),
      await t(() => F.updateDoc(F.doc(db, 'challenges', cid), { winner: { uid, score10: 10 } })),
      await t(() => F.setDoc(F.doc(db, 'challengeRewards', eid), { points: 99999 })),
      await t(() => F.setDoc(F.doc(db, 'challenges_meta', 'config'), { rewards: { medium: 99999 } })),
      await t(() => F.setDoc(F.doc(db, 'challenges_meta', 'state'), { currentId: 'mine' })),
      await t(() => F.updateDoc(F.doc(db, 'wallets', uid), { points: 999999 }))];
  }, [S.cid, eid, S.mayaUid]);
  tries.forEach(denied);
  /* the server takes three ids and the test run — nothing else the page sends */
  const [status, body] = await page.evaluate(async ([cid, pid, gid]) => {
    const tok = await NX.Backend.fb.auth.currentUser.getIdToken();
    const r = await fetch('/api/challenges/submit', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok },
      body: JSON.stringify({ challengeId: cid, projectId: pid, gameId: gid, score: 10, score10: 10, total100: 100, rank: 1, status: 'judged', uid: 'someone' }) });
    return [r.status, await r.json()];
  }, [S.cid, S.mayaProject, S.mayaEntry.gameId]);
  assert.equal(status, 409); assert.equal(body.error.code, 'already_submitted');
  const calls = judgeCalls().length;
  await page.evaluate(async cid => { await NX.Challenges.stream('/judge', { challengeId: cid }, () => {}); }, S.cid);
  assert.equal(judgeCalls().length, calls, 'judged once — asking again judges nothing');
  const e = await entry(S.mayaUid);
  assert.equal(e.score10, S.mayaEntry.score10); assert.equal(e.rank, null);
  /* the page's own memory and storage */
  await page.evaluate(() => { NX.Challenges.cur.me.score10 = 10; localStorage.setItem('nx.challengeScore', '10'); });
  await openCh(page);
  await page.locator('.chg-entry .chg-big b').waitFor();
  assert.equal(await page.textContent('.chg-entry .chg-big b'), S.mayaEntry.score10.toFixed(1), 'what the server keeps, not what the page was told');
});

test('10 · Page refresh: the entry, its score and its state come back from the server', async () => {
  const { page } = S.maya;
  await page.reload();
  await page.waitForFunction(() => window.NX && NX.Challenges && NX.Backend.user && !NX.Backend.user.anon, null, { timeout: 90000 });
  await page.evaluate(() => { location.hash = 'challenges'; });
  await page.locator('.chg-entry .chg-big b').waitFor();
  assert.equal(await page.textContent('.chg-entry .chg-big b'), S.mayaEntry.score10.toFixed(1));
  assert.ok((await page.textContent('.chg-entry')).includes('حُكّمت'));
});

test('11 · Another device, the same account: the same entry and the same score (nothing is kept on the first device)', async () => {
  const other = S.maya2 = await newDevice(browser, site, logs);
  await signIn(other.page, 'maya@test.io');
  await home(other.page);
  await until(other.page, s => (document.querySelector('.chg-home .chg-my') || {}).textContent === s, '✓ سلّمت · NEXUS AI SCORE ' + S.mayaEntry.score10.toFixed(1) + '/10');
  await openCh(other.page);
  await other.page.locator('.chg-entry .chg-big b').waitFor();
  assert.equal(await other.page.textContent('.chg-entry .chg-big b'), S.mayaEntry.score10.toFixed(1));
  await other.ctx.close();
});

test('12 · Phone (390×844, touch): the card, the countdown and the challenge fit the screen (no sideways scrolling); join by touch, make a game, submit it', async () => {
  const { page } = S.omar = await newDevice(browser, site, logs, PHONE);
  S.omarUid = await signUp(page, 'omar@test.io', { free: false });
  await home(page);
  const fits = () => page.evaluate(() => {
    const w = innerWidth, over = [...document.querySelectorAll('.chg-home, .chg-home *, .chg, .chg *')].filter(n => { const r = n.getBoundingClientRect(); return r.width && (r.right > w + 1 || r.left < -1); });
    return { page: document.documentElement.scrollWidth <= w + 1, over: over.slice(0, 5).map(n => n.className + ' ' + Math.round(n.getBoundingClientRect().right)) };
  });
  let f = await fits();
  assert.ok(f.page && !f.over.length, 'the home card fits: ' + JSON.stringify(f));
  await page.locator('.chg-home .btn', { hasText: 'شارك في التحدي' }).tap();
  await page.locator('.chg-home .btn', { hasText: 'سلّم لعبتك' }).waitFor();
  await page.locator('.chg-home .chg-card').tap({ position: { x: 30, y: 20 } });
  await page.locator('.chg-hero').waitFor();
  f = await fits();
  assert.ok(f.page && !f.over.length, 'the challenge sheet fits: ' + JSON.stringify(f));
  const box = await page.locator('.chg-actions .btn', { hasText: 'تسليم اللعبة للتحدي' }).boundingBox();
  assert.ok(box && box.height >= 36 && box.width >= 120, 'a button big enough for a finger: ' + JSON.stringify(box));
  /* «مشروع جديد للتحدي» → the editor and the assistant (✕ — the player builds it) */
  await page.locator('.chg-actions .btn', { hasText: 'مشروع جديد للتحدي' }).tap();
  await until(page, () => NX.Screen.current() === 'studio' && NX.AIPanel.sheet && !NX.AIPanel.sheet._closed);
  await page.waitForTimeout(400);
  await page.locator('.sheet .sheet-head .icon-btn[aria-label="close"]').last().tap();
  await until(page, () => !document.querySelector('.sheet'));
  await fillGame(page, RACE_ENEMY);
  const text = await publishAndSubmit(page);
  assert.ok(text.includes('NEXUS AI JUDGE SCORE'), text);
  f = await fits();
  assert.ok(f.page, 'still no sideways scrolling after judging');
  assert.equal((await entry(S.omarUid)).status, 'judged');
  /* the phone's back button after it all: ✕, then back — from the editor to NEXUS's home, never out of NEXUS */
  await page.locator('.sheet .sheet-head .icon-btn[aria-label="close"]').last().tap();
  await until(page, () => !document.querySelector('.sheet') && history.state && history.state.nx === 'screen');
  await page.evaluate(() => history.back());
  await until(page, () => NX.Screen.current() === 'platform');
  assert.match(page.url(), /index\.html/, 'still on NEXUS: ' + page.url());
});

test('13 · Several players: each has an own entry and score; the server counts players and games; before the end the others\' scores stay hidden (the rules) and anyone\'s game can be played', async () => {
  const { page } = S.lina = await newDevice(browser, site, logs);
  S.linaUid = await signUp(page, 'lina@test.io', { free: false });
  await openCh(page);
  await page.locator('.chg-actions .btn', { hasText: 'شارك في التحدي' }).click();
  await page.locator('.chg-actions .btn', { hasText: 'تسليم اللعبة للتحدي' }).waitFor();
  await makeGame(page, 'Parked Car', NO_INPUT);
  await publishAndSubmit(page);
  const e = await entry(S.linaUid);
  assert.equal(e.status, 'judged');
  assert.ok(e.criteria.controls <= 3, 'no input handling in the code → Controls ≤ 3: ' + e.criteria.controls);
  assert.equal(e.caps.controls.max, 3, 'the evidence rule, whatever a model answers');
  const c = await fsGet('challenges/' + S.cid);
  assert.equal(c.participants, 3); assert.equal(c.submissions, 3);
  /* maya's view of the entries */
  const m = S.maya.page;
  await openCh(m);
  await m.locator('.chg-tabs button', { hasText: 'المشاركات' }).click();
  await until(m, () => document.querySelectorAll('.chg-board .chg-row').length === 3);
  const rows = await m.evaluate(uid => [...document.querySelectorAll('.chg-board .chg-row')].map(r => ({ me: r.dataset.uid === uid, sc: r.querySelector('.chg-sc').textContent, play: !!r.querySelector('button.chg-play') })), S.mayaUid);
  assert.ok(rows.filter(r => !r.me).every(r => r.sc === '🙈'), 'the others\' scores stay hidden: ' + JSON.stringify(rows));
  assert.equal(rows.find(r => r.me).sc, S.mayaEntry.score10.toFixed(1) + '/10');
  assert.ok(rows.every(r => r.play), 'every game can be played');
  assert.match(await m.textContent('.chg-p'), /الألعاب المسلّمة/);
  /* and the database will not hand one player another's entry */
  const r = await m.evaluate(async id => { try { await NX.Backend.fb.F.getDoc(NX.Backend.fb.F.doc(NX.Backend.fb.db, 'challengeEntries', id)); return 'READ'; } catch (e) { return e.code; } }, S.cid + '_' + S.linaUid);
  denied(r);
});

test('14 · AI failure: every provider down → «Judging Pending» — no score, no 10/10 made up, no prize; the reason and the retry time are shown', async () => {
  const { page } = S.sami = await newDevice(browser, site, logs);
  S.samiUid = await signUp(page, 'sami@test.io', { free: false });
  await makeGame(page, 'Night Race', RACE);
  Object.values(KEYS).forEach(k => { W.keys[k] = '500'; });
  const text = await publishAndSubmit(page);
  assert.match(text, /Judging Pending/);
  assert.doesNotMatch(text, /NEXUS AI JUDGE SCORE/);
  const e = await entry(S.samiUid);
  assert.equal(e.status, 'pending'); assert.equal(e.score10, null); assert.equal(e.total100, null); assert.equal(e.attempts, 1);
  assert.ok(e.nextTryAt > Date.now() + 60e3, 'retried later (backoff), not in a loop');
  assert.ok(e.lastError && !/AIza|gsk_|sk-or/.test(e.lastError), 'the reason, without any key: ' + e.lastError);
  await openCh(page);
  await page.locator('.chg-entry .chg-pending').waitFor();
  const card = await page.textContent('.chg-entry');
  assert.match(card, /Judging Pending/); assert.match(card, /يُعاد تلقائيًا/);
  assert.equal(await page.locator('.chg-entry .btn', { hasText: 'أعد المحاولة الآن' }).isDisabled(), true, 'not before its time');
});

test('15 · Retry: when its time has come, «أعد المحاولة الآن» judges it — through the key pool: the Gemini key at its limit (429) → the next provider', async () => {
  const { page } = S.sami;
  Object.values(KEYS).forEach(k => { W.keys[k] = 'ok'; });
  W.keys[KEYS.gem] = '429';
  await fsSet('challengeEntries/' + S.cid + '_' + S.samiUid, { nextTryAt: Date.now() - 1000 });   // the backoff (2 min) has passed
  const before = W.calls.length;
  await openCh(page);
  await page.locator('.chg-entry .btn', { hasText: 'أعد المحاولة الآن' }).click();
  try { await until(page, () => document.querySelector('.chg-judge .cc-final'), null, 60000); }
  catch (err) {
    console.log('    judge box:', await page.evaluate(() => [...document.querySelectorAll('.chg-judge')].map(b => b.innerText).join(' || ')));
    console.log('    calls:', W.calls.slice(before).map(c => c.provider + ':' + c.status).join(' '), JSON.stringify(await entry(S.samiUid).then(e => ({ s: e.status, a: e.attempts, err: e.lastError }))));
    throw err;
  }
  const e = await entry(S.samiUid);
  assert.equal(e.status, 'judged'); assert.ok(e.score10 > 0);
  const tried = W.calls.slice(before).filter(c => /NEXUS AI JUDGE/.test(c.system)).map(c => c.provider + ':' + c.status);
  assert.equal(tried[0], 'gemini:429', 'the first key was at its limit: ' + tried);
  assert.ok(tried.slice(1).some(t => /:200$/.test(t)) && !/gemini/i.test(e.judges[0].provider), 'another provider judged: ' + tried + ' → ' + e.judges[0].provider);
  assert.match(await page.textContent('.chg-judge'), /NEXUS AI JUDGE SCORE/);
  W.keys[KEYS.gem] = 'ok';
});

/* ================================================================ 3 · the end */
test('16 · End: the owner\'s «end now» closes submissions — the page says so, a late entry is refused — and the next challenge opens', async () => {
  const { page } = S.owner = await newDevice(browser, site, logs);
  S.ownerUid = await signUp(page, 'owner@test.io', { free: false });
  await openCh(page);
  assert.equal(await page.locator('.chg-tabs button', { hasText: 'الإدارة' }).count(), 0, 'an unverified sign-up with the owner\'s address is not the owner');
  await verifyEmail(page, S.ownerUid);
  await openCh(page);
  await page.locator('.chg-tabs button', { hasText: 'الإدارة' }).click();
  await page.locator('.chg-admin .btn', { hasText: 'أنهِ التحدي الحالي الآن' }).click();
  await page.locator('.modal-box .btn.danger').click();
  await until(page, cid => fetch('/api/challenges/current').then(r => r.json()).then(j => window.__next = j.challenge.challengeId !== cid), S.cid);
  S.before = {};
  for (const u of [S.mayaUid, S.omarUid, S.linaUid, S.samiUid]) S.before[u] = await wallet(u);
  const c = await fsGet('challenges/' + S.cid);
  assert.equal(c.status, 'judging'); assert.ok(c.closedAt > 0);
  S.next = (await fsGet('challenges_meta/state')).currentId;
  assert.notEqual(S.next, S.cid);
  assert.equal((await fsGet('challenges/' + S.next)).status, 'open');
  /* too late */
  const late = await S.lina.page.evaluate(async ([cid, pid, gid]) => {
    const tok = await NX.Backend.fb.auth.currentUser.getIdToken();
    const r = await fetch('/api/challenges/submit', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: JSON.stringify({ challengeId: cid, projectId: pid, gameId: gid }) });
    return (await r.json()).error.code;
  }, [S.cid, (await entry(S.linaUid)).projectId, (await entry(S.linaUid)).gameId]);
  assert.equal(late, 'closed');
  /* the players' pages: the new challenge, and the old one «judging» */
  await home(S.maya.page);
  await until(S.maya.page, () => /تحدي البقاء/.test(document.querySelector('.chg-home').textContent));
  /* a player's page on the ended challenge: closed — «judging», or already announced when a visit moved it along */
  await openCh(S.maya.page, S.cid);
  await S.maya.page.locator('.chg-wait, .chg-winner').first().waitFor();
  const shown = await S.maya.page.textContent('.chg-p');
  assert.ok(/انتهى التسليم/.test(shown) || /الفائز/.test(shown), shown.slice(0, 300));
  assert.equal(await S.maya.page.locator('.chg-p .btn', { hasText: 'تسليم اللعبة للتحدي' }).count(), 0, 'no submit button on an ended challenge');
});

test('17 · Winner: chosen by the AI score alone (ties → Challenge Fit…): «حكّم ووزّع المستحق الآن» ranks, announces and pays; the past challenge shows the winner and «▶ Play Winner Game» opens the game', async () => {
  const { page } = S.owner;
  await page.locator('.chg-admin .btn', { hasText: 'حكّم ووزّع المستحق الآن' }).click();
  await until(page, () => /✓ حُكّم/.test(document.querySelector('.chg-log').textContent));
  const c = await fsGet('challenges/' + S.cid);
  assert.equal(c.status, 'final');
  const all = (await fsQuery('challengeEntries', 'challengeId', S.cid)).map(d => Object.fromEntries(Object.entries(d.fields).map(([k]) => [k, null])) && d.name.split('/').pop());
  const entries = [];
  for (const id of all) entries.push(await fsGet('challengeEntries/' + id));
  const order = entries.filter(e => e.status === 'judged').sort(rankCmp).map(e => e.uid);
  S.order = order;
  assert.equal(c.winner.uid, order[0]); assert.deepEqual(c.podium.map(p => p.uid), order.slice(0, 3));
  assert.deepEqual(entries.filter(e => e.rank).sort((a, b) => a.rank - b.rank).map(e => e.uid), order, 'the ranks are the AI scores\' order');
  /* a player sees it: past challenges → the winner → play */
  const m = S.maya.page;
  await openCh(m);
  await m.locator('.chg-tabs button', { hasText: 'السابقة' }).click();
  await m.locator('.chg-past[data-cid="' + S.cid + '"] .chg-win').waitFor();
  await m.locator('.chg-past[data-cid="' + S.cid + '"]').click();
  await m.locator('.chg-winner').waitFor();
  const win = await m.textContent('.chg-winner');
  assert.ok(win.includes(c.winner.name) && win.includes(c.winner.score10.toFixed(1)), win);
  assert.equal(await m.locator('.chg-podium .chg-pod').count(), 3);
  await m.locator('.chg-winner .btn', { hasText: 'Play Winner Game' }).click();
  await until(m, t => [...document.querySelectorAll('.sc')].some(n => n.textContent.includes(t)), c.winner.title);
});

test('18 · Leaderboard after the end: rank, picture, name, AI score, play link and submission time for everyone — in the server\'s order', async () => {
  const m = S.maya.page;
  await openCh(m, S.cid);
  await until(m, () => document.querySelectorAll('.chg-board .chg-row').length === 4);
  const rows = await m.evaluate(() => [...document.querySelectorAll('.chg-board .chg-row')].map(r => ({ uid: r.dataset.uid, rk: r.querySelector('.chg-rk').textContent, av: !!r.querySelector('.chg-av'),
    sc: r.querySelector('.chg-sc').textContent, when: r.querySelector('.chg-who .chg-at').textContent, play: !!r.querySelector('button.chg-play') })));
  assert.deepEqual(rows.map(r => r.uid), S.order);
  assert.deepEqual(rows.map(r => r.rk), ['🥇', '🥈', '🥉', '#4']);
  for (const r of rows) {
    const e = await entry(r.uid);
    assert.equal(r.sc, e.score10.toFixed(1) + '/10'); assert.ok(r.av && r.play); assert.match(r.when, /سُلّمت/);
  }
  assert.match(await m.textContent('.chg-p'), /NEXUS CHALLENGE LEADERBOARD/);
});

test('19 · Points: the prizes land in the winners\' wallets through the points system (ledger «🏆 جائزة تحدٍّ») — once; another round pays nothing twice', async () => {
  const c = await fsGet('challenges/' + S.cid);
  assert.equal(c.rewardsPaid, true);
  const prize = [c.reward.first, c.reward.second, c.reward.third, c.reward.participation];
  const now = {};
  for (const [i, u] of S.order.entries()) {
    now[u] = await wallet(u);
    assert.equal(now[u], (S.before[u] === null ? 50 : S.before[u]) + prize[i], 'rank ' + (i + 1) + ': +' + prize[i]);
    assert.equal((await entry(u)).reward, prize[i]);
    assert.ok(await fsGet('challengeRewards/' + S.cid + '_' + u), 'the marker that pays it once');
  }
  /* again: nothing */
  await S.owner.page.locator('.chg-admin .btn', { hasText: 'حكّم ووزّع المستحق الآن' }).click();
  await until(S.owner.page, () => (document.querySelector('.chg-log').textContent.match(/✓ حُكّم/g) || []).length >= 1 && !document.querySelector('.chg-admin .btn[disabled]'));
  for (const u of S.order) assert.equal(await wallet(u), now[u], 'not paid twice');
  /* the winner's own wallet page says why */
  const winner = { [S.mayaUid]: S.maya, [S.omarUid]: S.omar, [S.linaUid]: S.lina, [S.samiUid]: S.sami }[S.order[0]];
  await winner.page.evaluate(() => { NX.Sheet.closeAll(); NX.Points.open(); });
  await until(winner.page, () => /🏆 جائزة تحدٍّ/.test(document.body.innerText));
});

test('20 · Not in localStorage: nothing of the challenge is kept in the browser — storage cleared, everything is still there, from the server', async () => {
  const { page } = S.maya;
  const keys = await page.evaluate(() => Object.keys(localStorage).concat(Object.keys(sessionStorage)).filter(k => /chall|judge|score|rank|winner/i.test(k) && k !== 'nx.challengeScore'));
  assert.deepEqual(keys, [], 'no challenge data in the browser\'s storage');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await page.waitForFunction(() => window.NX && NX.Challenges && NX.Backend.user && !NX.Backend.user.anon, null, { timeout: 90000 });
  await page.evaluate(cid => { location.hash = 'challenge/' + cid; }, S.cid);
  await page.locator('.chg-entry .chg-big b').waitFor();
  const e = await entry(S.mayaUid);
  assert.equal(await page.textContent('.chg-entry .chg-big b'), e.score10.toFixed(1));
  assert.match(await page.textContent('.chg-entry .chg-rank'), new RegExp('المركز ' + e.rank));
});

/* ================================================================ and the rest of NEXUS */
test('21 · Nothing else changed: «نشر اللعبة · Publish» without a challenge still ends with its own report; no page error anywhere', async () => {
  const { page } = S.lina;
  await page.evaluate(() => { NX.Sheet.closeAll(); NX.Studio.openPublish(); });
  assert.equal(await page.locator('.chg-pubnote').count(), 0);
  await page.locator('.sheet-foot .btn', { hasText: 'PUBLISH' }).click();
  await page.locator('.modal-box', { hasText: 'تم النشر' }).waitFor();
  assert.deepEqual(logs.filter(l => /pageerror/.test(l)), []);
});

await run(tests, logs, async () => { await browser.close(); await site.close(); await W.close(); });
