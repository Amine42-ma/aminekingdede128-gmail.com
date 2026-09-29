/* ============================================================
   NEXUS tests · NEXUS CHALLENGES end to end, in a real browser (Chromium):
   the page (PART 37) and the Studio's own «Publish», the site's server
   functions (challenges.js · ai.js · points.js) on the Firebase emulators —
   the real firestore.rules apply to every page — and fake AI providers
   that answer like the challenge creator, its reviewer and the judges
   (fake-models.mjs — test doubles of MODELS: NEXUS itself keeps no list
   of challenge ideas).
   Four players (one on a phone), the site's owner, and a device whose
   clock is 3 hours behind: a public challenge NEXUS AI invents, judged,
   ranked and paid; the next one invented; then a challenge between
   friends — an idea, an invite, START with the prize held from the
   creator's points, two games, the winner and the runner-up paid.
   What is checked is what each person SEES and what the SERVER keeps
   (read back from the emulator as its admin).
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
import { chromium, FS, fsSet, fsGet, fsQuery, resetEmulators, newDevice, open, signUp, signIn, until, run } from './e2e-kit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
/* the site configured for Firebase Storage (window.NEXUS_FILES = "firebase", one of its two documented
   settings): a published game's cover and icon go to the Storage emulator instead of Google Drive */
const HTML = fs.readFileSync(path.join(here, '..', 'index.html'), 'utf8').replace('window.NEXUS_FILES = "drive";', 'window.NEXUS_FILES = "firebase";');
assert.ok(HTML.includes('window.NEXUS_FILES = "firebase";'));

const KEYS = { gem: 'AIzaGEMINI_TEST_KEY_000000000000000001', groq: 'gsk_GROQTESTKEY0000000000000001', or: 'sk-or-v1-OPENROUTERTESTKEY000000001' };
const W = await startWorld();
/* the «model» that invents the public challenges answers with W.ideas first when a test wants a particular idea
   (the first challenge: a small car race, so the players' racing games answer it) — then with its own ideas */
W.ideas = [];
W.reply = c => (/Create ONE fresh public game-development challenge/.test(c.system) && W.ideas.length ? JSON.stringify(W.ideas.shift()) : e2eReply(c));
const RACE_IDEA = {
  title: 'ثلاث لفات فوق السطوح', emoji: '🏎️', tagline: 'سباق ليلي قصير فوق مدينة نائمة',
  description: 'اصنع سباق سيارات قصيرًا: سيارة يقودها اللاعب، حلبة، خط نهاية، وعدّاد لفات — ورسالة فوز في النهاية.',
  story: 'في منتصف الليل تتحول سطوح المدينة إلى حلبة سرية، ومن يُنهي ثلاث لفات أولًا يأخذ مفتاح المدينة.',
  concept: 'a short car race on a small track: a drivable car, laps and a finish line', deliverable: 'full-game', inspiration: 'original', gameReference: null, trendIndex: null,
  objective: 'أنهِ ثلاث لفات على الحلبة بأسرع وقت', rules: ['سيارة يتحكم بها اللاعب', 'ثلاث لفات وخط نهاية', 'رسالة فوز عند النهاية'],
  mechanics: ['قيادة بالأسهم أو باللمس', 'عدّاد لفات'], winCondition: 'أعلى درجة من NEXUS AI JUDGE — وأهمها أن تُقاد السيارة فعلًا', interactive: true,
  durationMinutes: 180, complexity: { score: 5, estimatedBuildMinutes: 120, gameplayComplexity: 'a car, a track, laps' }, rewardSuggestion: 1500,
  judgingCriteria: [
    { name: 'Gameplay', nameAr: 'اللعب', kind: 'gameplay', weight: 25, what: 'a real race loop: laps, a finish, a win' },
    { name: 'Controls', nameAr: 'التحكم', kind: 'controls', weight: 20, what: 'the car answers the keyboard and touch' },
    { name: 'Creativity', nameAr: 'الإبداع', kind: 'creativity', weight: 15, what: 'own ideas beyond a bare track' },
    { name: 'Visual Quality', nameAr: 'الجودة البصرية', kind: 'visual', weight: 15, what: 'the track and the city' },
    { name: 'Challenge Fit', nameAr: 'مطابقة التحدي', kind: 'fit', weight: 10, what: 'a car race with laps and a finish line' },
    { name: 'Completeness', nameAr: 'الاكتمال', kind: 'completeness', weight: 10, what: 'a start, a finish, a restart' },
    { name: 'Performance', nameAr: 'الأداء', kind: 'performance', weight: 5, what: 'light every frame' }],
  keywords: ['car', 'race', 'lap', 'finish', 'track', 'سيارة', 'سباق', 'لفة'], tone: 'playful'
};
const FRIEND_IDEA = 'سباق سيارات بين الأصدقاء: ثلاث لفات على حلبة صغيرة';
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
async function publishAndSubmit(page, { viaMenu = false, pick = null } = {}) {
  if (viaMenu) {
    await page.click('#s-more');
    await page.locator('.opt-row', { hasText: 'تسليم اللعبة للتحدي' }).click();
  } else await page.evaluate(() => { NX.Challenges.submitFromStudio(); });      // not awaited: it may be waiting for «which challenge?»
  /* the player is in more than one challenge: «لأي تحدٍّ تسلّم؟» */
  if (pick) await page.locator('.sheet', { hasText: 'لأي تحدٍّ تسلّم؟' }).locator('.opt-row', { hasText: pick }).click();
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
/* a question for the server, asked from the page until its answer is yes (waitForFunction takes a promise for a yes) */
async function untilServer(page, fn, arg, timeout = 90000) {
  for (const t0 = Date.now(); !(await page.evaluate(fn, arg)); await page.waitForTimeout(400)) if (Date.now() - t0 > timeout) throw new Error('the server never answered yes: ' + fn);
}
const home = async page => { await page.evaluate(() => { NX.Sheet.closeAll(); if (NX.Screen.current() !== 'platform') NX.Screen.show('platform'); NX.Platform.go('home'); }); await page.locator('.chg-home .chg-card').waitFor(); };
const secsOf = t => { const m = /(?:(\d+)d )?(\d\d):(\d\d):(\d\d)/.exec(t); return m ? (+m[1] || 0) * 86400 + +m[2] * 3600 + +m[3] * 60 + +m[4] : NaN; };
const judgeCalls = () => W.calls.filter(c => /NEXUS AI JUDGE/.test(c.system));
const entry = async (uid, cid = S.cid) => fsGet('challengeEntries/' + cid + '_' + uid);
const wallet = async uid => { const w = await fsGet('wallets/' + uid); return w ? w.points || 0 : null; };
const denied = r => assert.ok(/permission-denied|PERMISSION_DENIED/i.test(r), 'refused by the rules: ' + r);
/* the order of the server (challenges.js · rankKeys): the AI score, then the challenge's «fit» criteria, its heaviest
   criterion, its «completeness» criteria — then the earlier submission (an exact tie on a prize: one more AI review) */
const r2 = v => Math.round(v * 100) / 100;
function rankCmpFor(c) {
  const rub = c.judgingCriteria, ids = k => rub.filter(x => x.kind === k).map(x => x.id);
  const fit = ids('fit'), comp = ids('completeness'), heavy = rub.slice().sort((a, b) => b.weight - a.weight)[0].id;
  const sum = (e, list) => r2(list.reduce((t, id) => t + (e.criteria[id] || 0), 0));
  const key = e => [r2(e.total100), sum(e, fit), r2(e.criteria[heavy] || 0), sum(e, comp)];
  return (a, b) => { const ka = key(a), kb = key(b); for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i]; return (a.submittedAt - b.submittedAt) || (a.uid < b.uid ? -1 : 1); };
}
/* a sub-collection as the emulator's admin reads it (the points ledger, the notifications) */
const decode = f => { const [t, v] = Object.entries(f || {})[0] || []; return t === 'integerValue' ? +v : t === 'mapValue' ? Object.fromEntries(Object.entries(v.fields || {}).map(([k, x]) => [k, decode(x)])) : t === 'arrayValue' ? (v.values || []).map(decode) : t === 'nullValue' ? null : v; };
async function sub(path) {
  const r = await fetch(FS + '/' + path + '?pageSize=300', { headers: { authorization: 'Bearer owner' } });
  return ((await r.json()).documents || []).map(d => Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, decode(v)])));
}
const ledgerOf = uid => sub('wallets/' + uid + '/ledger');
const noticesOf = async uid => (await sub('users/' + uid + '/notifications')).sort((a, b) => a.at - b.at);
const creatorCalls = () => W.calls.filter(c => /NEXUS Challenge Creator/.test(c.system));
const NO_DIFFICULTY = /سهل|متوسط|صعب|خبير|\bEasy\b|\bMedium\b|\bHard\b|\bExpert\b/;

/* ================================================================ 1 · the challenge NEXUS AI invents */
test('1 · Create: no challenge yet — the home page says NEXUS AI is inventing one; the server asks the AI (no list, no difficulty), a reviewer approves, and it opens with the AI\'s own title, story, rules, criteria and duration', async () => {
  W.ideas.push(RACE_IDEA);
  for (const p of ['gemini', 'groq', 'openrouter', 'anthropic']) W.delay[p] = 1500;          // the idea takes a moment: the page shows it being made
  const { page } = S.maya = await newDevice(browser, site, logs);
  S.mayaUid = await signUp(page, 'maya@test.io', { free: false });
  await page.evaluate(() => { NX.Sheet.closeAll(); if (NX.Screen.current() !== 'platform') NX.Screen.show('platform'); NX.Platform.go('home'); });
  await page.locator('.chg-home .chg-mini-gen').waitFor();
  assert.match(await page.textContent('.chg-home'), /NEXUS AI يبتكر التحدي التالي/);
  await page.locator('.chg-home .chg-card').waitFor({ timeout: 60000 });
  for (const p of Object.keys(W.delay)) W.delay[p] = 0;
  /* what the AI was asked: invent (no list), no difficulty labels, the previous challenges (none), no trend claimed without data */
  const made = creatorCalls();
  assert.equal(made.length, 1, 'one idea, approved at once');
  assert.match(made[0].system, /Do not select from a fixed challenge list/); assert.match(made[0].system, /never label the challenge easy, medium or hard/);
  assert.match(made[0].lastUser, /PREVIOUS CHALLENGES[^\n]*\n\(none yet\)/); assert.match(made[0].lastUser, /NO CURRENT TREND DATA/);
  assert.equal(W.calls.filter(c => /NEXUS Challenge Reviewer/.test(c.system)).length, 1, 'one reviewer for an ordinary idea (several only for a complex one)');
  /* what the server keeps */
  S.cid = (await fsGet('challenges_meta/state')).currentId;
  const c = await fsGet('challenges/' + S.cid);
  S.title = c.title;
  assert.equal(c.title, RACE_IDEA.title); assert.equal(c.seq, 1); assert.equal(c.status, 'open'); assert.equal(c.kind, 'public');
  assert.equal(c.endTime - c.startTime, 3 * 3600e3, 'the duration the AI chose (180 minutes)'); assert.equal(c.durationHours, 3);
  assert.equal(c.judgingCriteria.length, 7); assert.equal(c.judgingCriteria.reduce((n, x) => n + x.weight, 0), 100);
  assert.equal(c.difficulty, undefined, 'no difficulty level'); assert.equal(c.complexity.score, 5, 'an internal complexity score instead');
  assert.equal(c.reward.first, 1500); assert.equal(c.generation.attempts, 1); assert.equal(c.generation.fallback, false);
  assert.deepEqual(c.rules, RACE_IDEA.rules); assert.equal(c.story, RACE_IDEA.story);
  const card = await page.textContent('.chg-home');
  for (const t of ['NEXUS CHALLENGES', RACE_IDEA.title, RACE_IDEA.tagline, 'ينتهي بعد', 'المشاركون', '1,500', 'شارك في التحدي', 'ابتكره وحكّمه NEXUS AI']) assert.ok(card.includes(t), 'the card shows «' + t + '»: ' + card);
  assert.doesNotMatch(card, NO_DIFFICULTY);
  /* the challenge's page: the story, the objective, the rules, the mechanics, how the winner is decided, the AI's criteria */
  await openCh(page);
  const text = await page.textContent('.chg-p');
  for (const t of ['📖 القصة', RACE_IDEA.story, '🎯 الهدف', RACE_IDEA.objective, '📜 القواعد', RACE_IDEA.rules[1], '⚙️ الميكانيكيات', RACE_IDEA.mechanics[0], '🏁 كيف يُحدَّد الفائز',
    '⚖️ معايير NEXUS AI JUDGE لهذا التحدي', 'التحكم', '20%', '✨ فكرة أصلية ابتكرها NEXUS AI', '🧠 ابتكره NEXUS AI', 'لا يوجد في NEXUS أي قائمة تحديات جاهزة']) assert.ok(text.includes(t), 'the page shows «' + t + '»');
  assert.doesNotMatch(text, NO_DIFFICULTY);
  await page.evaluate(() => NX.Sheet.closeAll());
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
  await until(page, t => NX.Screen.current() === 'studio' && NX.Studio.project && NX.Studio.project.name.includes(t) && NX.AIPanel.input && NX.AIPanel.input.value, S.title);
  const p = await page.evaluate(() => ({ id: NX.Studio.project.projectId, name: NX.Studio.project.name, ask: NX.AIPanel.input.value, cid: NX.Studio.project.settings.challengeId }));
  assert.ok(p.ask.includes(S.title) && p.ask.includes(RACE_IDEA.objective), 'the assistant is ready with the challenge\'s idea: ' + p.ask); assert.equal(p.cid, S.cid);
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

test('6 · AI Judge: NEXUS AI JUDGE scores THIS challenge\'s criteria (the AI chose them) from the evidence the server read (never «I liked it») — 7 criteria and their weights, a reason for each, an AI Judge Summary', async () => {
  const { page } = S.maya;
  const calls = judgeCalls().slice(S.before);
  assert.equal(calls.length, 1, 'complexity 5: one judge (two from 7, three from 9)');
  const c = calls[0];
  assert.match(c.system, /CRITERIA — score each/); assert.match(c.system, /- gameplay \(Gameplay, 25%\)/); assert.match(c.system, /- controls \(Controls, 20%\)/);
  assert.match(c.system, /You did NOT play the game/); assert.ok(c.system.includes(RACE_IDEA.objective), 'the challenge itself is in the judge\'s prompt');
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
  const sum = c.judgingCriteria.reduce((t, x) => t + e.criteria[x.id] * x.weight, 0) / 10;
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
      await t(() => F.setDoc(F.doc(db, 'challenges_meta', 'config'), { rewardMax: 99999, autoCreate: false })),
      await t(() => F.setDoc(F.doc(db, 'challenges_meta', 'state'), { currentId: 'mine' })),
      await t(() => F.setDoc(F.doc(db, 'challenges_meta', 'gen'), { best: { candidate: { title: 'my idea' } } })),
      await t(() => F.setDoc(F.doc(db, 'challenges', 'ch_99999_mine'), { title: 'my own challenge', status: 'open', reward: { first: 99999 } })),
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
test('16 · End: the owner\'s «end now» closes submissions — the page says so, a late entry is refused — and NEXUS AI invents the NEXT challenge: another idea, with the previous one in its prompt', async () => {
  const { page } = S.owner = await newDevice(browser, site, logs);
  S.ownerUid = await signUp(page, 'owner@test.io', { free: false });
  await openCh(page);
  assert.equal(await page.locator('.chg-tabs button', { hasText: 'الإدارة' }).count(), 0, 'an unverified sign-up with the owner\'s address is not the owner');
  await verifyEmail(page, S.ownerUid);
  await openCh(page);
  S.before = {};
  for (const u of [S.mayaUid, S.omarUid, S.linaUid, S.samiUid]) S.before[u] = await wallet(u);       // before anything is paid
  const asked = creatorCalls().length;
  await page.locator('.chg-tabs button', { hasText: 'الإدارة' }).click();
  /* the owner may steer the next idea (NEXUS AI still invents it) — kept on the server for the next round */
  await page.locator('.chg-hint-in').fill('شيء عن المطر');
  await page.locator('.chg-admin .btn', { hasText: 'احفظه للتحدي التالي' }).click();
  await until(page, () => /سيقرأ NEXUS AI طلبك/.test(document.body.innerText));
  assert.equal((await fsGet('challenges_meta/state')).nextHint, 'شيء عن المطر');
  await page.locator('.chg-admin .btn', { hasText: 'أنهِ التحدي الحالي الآن' }).click();
  await page.locator('.modal-box .btn.danger').click();
  /* no challenge on: the owner's page asks the server to move along — NEXUS AI invents the next one */
  await untilServer(page, cid => fetch('/api/challenges/current').then(r => r.json()).then(j => !!j.challenge && j.challenge.challengeId !== cid), S.cid);
  const c = await fsGet('challenges/' + S.cid);
  assert.ok(['judging', 'final'].includes(c.status), 'closed: ' + c.status); assert.ok(c.closedAt > 0);
  S.next = (await fsGet('challenges_meta/state')).currentId;
  assert.notEqual(S.next, S.cid);
  const n = await fsGet('challenges/' + S.next);
  assert.equal(n.status, 'open'); assert.equal(n.seq, 2); assert.notEqual(n.title, S.title);
  assert.equal(n.difficulty, undefined);
  const made = creatorCalls().slice(asked);
  assert.ok(made.length >= 1);
  assert.ok(made[0].lastUser.includes('#1 «' + S.title + '»'), 'the previous challenge is in the creator\'s prompt: do not repeat it');
  assert.ok(made[0].lastUser.includes('THE SITE OWNER ASKS FOR THIS ONE: «شيء عن المطر»'), 'the owner\'s wish reached the AI');
  assert.equal(n.generation.hint, 'شيء عن المطر'); assert.equal((await fsGet('challenges_meta/state')).nextHint, null, 'used once');
  S.nextTitle = n.title;
  /* too late */
  const late = await S.lina.page.evaluate(async ([cid, pid, gid]) => {
    const tok = await NX.Backend.fb.auth.currentUser.getIdToken();
    const r = await fetch('/api/challenges/submit', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: JSON.stringify({ challengeId: cid, projectId: pid, gameId: gid }) });
    return (await r.json()).error.code;
  }, [S.cid, (await entry(S.linaUid)).projectId, (await entry(S.linaUid)).gameId]);
  assert.equal(late, 'closed');
  /* the players' pages: the new challenge */
  await home(S.maya.page);
  await until(S.maya.page, t => document.querySelector('.chg-home').textContent.includes(t), n.title);
  /* a player's page on the ended challenge: closed — «judging», or already announced when a visit moved it along */
  await openCh(S.maya.page, S.cid);
  await S.maya.page.locator('.chg-wait, .chg-winner').first().waitFor();
  const shown = await S.maya.page.textContent('.chg-p');
  assert.ok(/انتهى التسليم/.test(shown) || /الفائز/.test(shown), shown.slice(0, 300));
  assert.equal(await S.maya.page.locator('.chg-p .btn', { hasText: 'تسليم اللعبة للتحدي' }).count(), 0, 'no submit button on an ended challenge');
});

test('17 · Winner: chosen by the AI score alone (ties → the challenge\'s fit criterion…): the server\'s round («حرّك المستحق الآن», or a page\'s visit) ranks, announces and pays; the past challenge shows the Winner and the Runner-up, and «▶ Play Winner Game» opens the game', async () => {
  const { page } = S.owner;
  await page.locator('.chg-admin .btn', { hasText: 'حرّك المستحق الآن' }).click();
  await until(page, () => /✓ حُكّم/.test(document.querySelector('.chg-tick-log').textContent));
  const c = await fsGet('challenges/' + S.cid);
  assert.equal(c.status, 'final');
  const all = (await fsQuery('challengeEntries', 'challengeId', S.cid)).map(d => Object.fromEntries(Object.entries(d.fields).map(([k]) => [k, null])) && d.name.split('/').pop());
  const entries = [];
  for (const id of all) entries.push(await fsGet('challengeEntries/' + id));
  const order = entries.filter(e => e.status === 'judged').sort(rankCmpFor(c)).map(e => e.uid);
  S.order = order;
  assert.equal(c.winner.uid, order[0]); assert.equal(c.runnerUp.uid, order[1]); assert.deepEqual(c.podium.map(p => p.uid), order.slice(0, 3));
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
  assert.ok(win.includes('Runner-up') && win.includes(c.runnerUp.name), 'the runner-up too: ' + win);
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
  await S.owner.page.locator('.chg-admin .btn', { hasText: 'حرّك المستحق الآن' }).click();
  await until(S.owner.page, () => (document.querySelector('.chg-tick-log').textContent.match(/✓ حُكّم/g) || []).length >= 1 && !document.querySelector('.chg-admin .btn[disabled]'));
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

/* ================================================================ 4 · a challenge between friends */
test('21 · Friends: an idea → NEXUS AI makes it a challenge (story, rules, criteria, a duration it suggests); the creator picks the time, a prize from her OWN points (10…1000) and who plays — created with NOTHING taken yet, the cost shown first', async () => {
  const { page } = S.maya;
  await page.evaluate(uid => NX.Follows.toggle(uid), S.omarUid);          // maya follows omar: he is in her list to invite
  S.fw = {};
  for (const u of [S.mayaUid, S.omarUid, S.linaUid]) S.fw[u] = await wallet(u);
  const asked = creatorCalls().length;
  await openCh(page);
  await page.locator('.chg-tabs button', { hasText: 'الأصدقاء' }).click();
  await page.locator('.chg-fnew').click();
  await page.locator('.chg-idea').fill(FRIEND_IDEA);
  await page.locator('.chg-make').click();
  await page.locator('.chg-draft').waitFor();
  const made = creatorCalls().slice(asked);
  assert.equal(made.length, 1);
  assert.match(made[0].system, /private challenge a player will send to their friends/);
  assert.ok(made[0].lastUser.includes("THE PLAYER'S IDEA: «" + FRIEND_IDEA + '»'), 'the player\'s own idea, given to the AI');
  const draft = await page.textContent('.chg-draft');
  for (const t of [FRIEND_IDEA, '📜 القواعد', '⚖️ المعايير', 'مطابقة التحدي']) assert.ok(draft.includes(t), 'the draft shows «' + t + '»: ' + draft);
  assert.doesNotMatch(draft, NO_DIFFICULTY);
  /* the time (NEXUS AI suggests one), the prize, the split, who plays */
  assert.match(await page.locator('.chg-dur option:checked').textContent(), /اقتراح NEXUS AI/);
  assert.deepEqual(await page.locator('button.chg-chip').allTextContents(), ['بلا جائزة', '10', '50', '100', '500', '1,000']);
  await page.locator('button.chg-chip', { hasText: /^50$/ }).click();
  await page.selectOption('.chg-split', '70-30');
  await page.locator('.chg-friend input[value="' + S.omarUid + '"]').check();
  const cost = await page.textContent('.chg-cost');
  for (const t of ['لن يُخصم أي شيء الآن', '50 نقطة', 'تكلفة الإنشاء: 0']) assert.ok(cost.includes(t), 'the cost, before confirming: ' + cost);
  await page.locator('.chg-create').click();
  await page.locator('.chg-invite input').waitFor();
  S.fc = await page.evaluate(() => NX.Challenges.view.arg);
  const f = await fsGet('friendChallenges/' + S.fc);
  assert.equal(f.status, 'lobby'); assert.equal(f.kind, 'friend'); assert.equal(f.ownerId, S.mayaUid); assert.equal(f.title, FRIEND_IDEA);
  assert.equal(f.reward.total, 50); assert.equal(f.reward.split, '70-30'); assert.equal(f.escrow, null);
  assert.deepEqual(f.players, [S.mayaUid]); assert.deepEqual(f.invited, [S.omarUid]); assert.equal(f.duration, 180 * 60);
  assert.equal(await wallet(S.mayaUid), S.fw[S.mayaUid], 'nothing taken at creation');
  assert.ok(!(await ledgerOf(S.mayaUid)).some(l => l.reason === 'challenge-escrow'));
  S.fLink = await page.inputValue('.chg-invite input');
  assert.ok(S.fLink.endsWith('/fc/' + S.fc), S.fLink);
  assert.match(await page.textContent('.chg-p'), /في الانتظار/);
});

test('22 · Invite: the friend she invited gets a notification (written by the server) that opens the challenge, and joins; another friend opens the invite link …/fc/<id> and joins; the creator is told; a «challenge» notification written by a browser is refused', async () => {
  /* omar, on his phone: the notification */
  const o = S.omar.page;
  await o.evaluate(() => { NX.Sheet.closeAll(); NX.Community.openNotifications(); });
  const row = o.locator('.sheet .comp-row', { hasText: 'يدعوك إلى تحدٍّ' });
  await row.waitFor();
  assert.ok((await row.textContent()).includes(FRIEND_IDEA));
  await row.tap();
  await o.locator('.chg-fjoin').waitFor();
  await o.locator('.chg-fjoin').tap();
  await until(o, () => document.querySelectorAll('.chg-players .chg-pl').length === 2);
  /* lina: the link, opened in her browser */
  const l = S.lina.page;
  await l.evaluate(() => { if (NX.Studio) NX.Studio.dirty = false; });
  await l.goto(S.fLink + '?emulators=1');
  await l.waitForFunction(() => window.NX && NX.Challenges && NX.Backend.user && !NX.Backend.user.anon, null, { timeout: 90000 });
  assert.ok(l.url().endsWith('#fc/' + S.fc), 'the pretty link became the app\'s own route: ' + l.url());
  await l.locator('.chg-fjoin').waitFor();
  await l.locator('.chg-fjoin').click();
  await until(l, () => document.querySelectorAll('.chg-players .chg-pl').length === 3);
  const f = await fsGet('friendChallenges/' + S.fc);
  assert.deepEqual(f.players.slice().sort(), [S.mayaUid, S.omarUid, S.linaUid].sort());
  /* maya was told, by the server */
  const told = (await noticesOf(S.mayaUid)).filter(n => n.type === 'challenge' && n.event === 'joined' && n.fcId === S.fc);
  assert.deepEqual(told.map(n => n.actorId).sort(), [S.omarUid, S.linaUid].sort());
  /* a browser cannot write a challenge notice (an invite, a result…) — a follow notice still can, as before */
  const tries = await l.evaluate(async ([to, fc, me]) => {
    const { F, db } = NX.Backend.fb;
    const t = async fn => { try { await fn(); return 'ALLOWED'; } catch (e) { return String(e.code || e.message); } };
    return [await t(() => F.setDoc(F.doc(db, 'users', to, 'notifications', 'n_fake1'), { id: 'n_fake1', type: 'challenge', event: 'result', fcId: fc, title: 'x', winnerName: 'lina', actorId: me, at: Date.now(), read: false })),
      await t(() => F.setDoc(F.doc(db, 'users', to, 'notifications', 'n_fake2'), { id: 'n_fake2', type: 'follow', actorId: me, actorName: 'lina', at: Date.now(), read: false }))];
  }, [S.mayaUid, S.fc, S.linaUid]);
  denied(tries[0]);
  assert.equal(tries[1], 'ALLOWED');
});

test('23 · START: only the creator starts it (two players at least); the prize leaves her points in that same step — once, «🔒 جائزة تحدٍّ محجوزة» in her history — and the time starts for everyone', async () => {
  const { page } = S.maya;
  const notOwner = await S.lina.page.evaluate(async fc => { try { await NX.Challenges.call('/friend/start', { id: fc }); return 'STARTED'; } catch (e) { return e.code; } }, S.fc);
  assert.equal(notOwner, 'owner');
  await openCh(page, S.fc);
  await page.locator('.chg-start').click();
  const msg = await page.textContent('.modal-box');
  assert.ok(msg.includes('تُحجز الآن 50 نقطة'), msg);
  await page.locator('.modal-box .btn.danger').click();
  await page.locator('.chg-p .chg-clock').waitFor();
  const f = await fsGet('friendChallenges/' + S.fc);
  assert.equal(f.status, 'running'); assert.equal(f.escrow.amount, 50); assert.equal(f.endTime - f.startTime, 180 * 60e3);
  assert.equal(await wallet(S.mayaUid), S.fw[S.mayaUid] - 50);
  const held = (await ledgerOf(S.mayaUid)).filter(l => l.reason === 'challenge-escrow');
  assert.equal(held.length, 1); assert.equal(held[0].delta, -50);
  /* START again: nothing more is taken */
  const again = await page.evaluate(async fc => { try { await NX.Challenges.call('/friend/start', { id: fc }); return 'STARTED'; } catch (e) { return e.code; } }, S.fc);
  assert.equal(again, 'started');
  assert.equal(await wallet(S.mayaUid), S.fw[S.mayaUid] - 50);
  for (const u of [S.omarUid, S.linaUid]) assert.ok((await noticesOf(u)).some(n => n.event === 'started' && n.fcId === S.fc), 'the players are told');
  /* her wallet's history says why */
  await page.evaluate(() => { NX.Sheet.closeAll(); NX.Points.open(); });
  await until(page, () => /🔒 جائزة تحدٍّ محجوزة/.test(document.body.innerText));
});

test('24 · Play: in the studio, «🏆 تسليم اللعبة للتحدي» asks WHICH challenge (the public one and the friends\' one are both open) — the games go to the friends\' challenge and NEXUS AI JUDGE scores them on its own criteria', async () => {
  const fcTitle = (await fsGet('friendChallenges/' + S.fc)).title;
  for (const [who, code, name] of [[S.lina, RACE, 'Lina Laps'], [S.omar, RACE_ENEMY, 'Omar Laps']]) {
    const page = who.page;
    await page.evaluate(() => NX.Sheet.closeAll());
    await until(page, () => !document.querySelector('.sheet'));
    await makeGame(page, name, code);
    const text = await publishAndSubmit(page, { viaMenu: true, pick: fcTitle });
    assert.ok(text.includes('NEXUS AI JUDGE SCORE'), text);
    await page.evaluate(() => NX.Sheet.closeAll());
  }
  const f = await fsGet('friendChallenges/' + S.fc);
  assert.equal(f.submissions, 2); assert.equal(f.judged, 2);
  for (const u of [S.linaUid, S.omarUid]) {
    const e = await entry(u, S.fc);
    assert.equal(e.status, 'judged'); assert.equal(e.kind, 'friend');
    assert.deepEqual(Object.keys(e.criteria).sort(), f.judgingCriteria.map(x => x.id).sort(), 'the friends\' challenge\'s own criteria');
  }
  assert.equal(await entry(S.linaUid, S.next), null, 'nothing handed to the public challenge');
});

test('25 · The end: when the time is up the page asks the server to finish — NEXUS AI JUDGE\'s scores rank the games: Winner, Runner-up, Participants; the prize is split 70/30 from what was held — paid once — and everyone is told', async () => {
  const wb = {};
  for (const u of [S.mayaUid, S.omarUid, S.linaUid]) wb[u] = await wallet(u);
  await fsSet('friendChallenges/' + S.fc, { endTime: Date.now() - 1000 });          // three hours later
  const { page } = S.maya;
  await openCh(page, S.fc);
  await page.locator('.chg-winner').waitFor({ timeout: 90000 });
  const f = await fsGet('friendChallenges/' + S.fc);
  assert.equal(f.status, 'final'); assert.equal(f.rewardsPaid, true); assert.equal(f.active, false);
  const es = [await entry(S.linaUid, S.fc), await entry(S.omarUid, S.fc)].sort(rankCmpFor(f));
  assert.equal(f.winner.uid, es[0].uid); assert.equal(f.runnerUp.uid, es[1].uid);
  assert.equal(await wallet(es[0].uid), wb[es[0].uid] + 35, 'the winner: 70% of 50');
  assert.equal(await wallet(es[1].uid), wb[es[1].uid] + 15, 'the runner-up: 30%');
  assert.equal(await wallet(S.mayaUid), wb[S.mayaUid], 'all of it was won: nothing comes back to her');
  assert.equal(f.refundDue || 0, 0);
  const text = await page.textContent('.chg-p');
  for (const t of ['الفائز', 'Runner-up', 'Winner · Runner-up · Participants', f.winner.name, f.runnerUp.name]) assert.ok(text.includes(t), '«' + t + '»');
  /* paid once: another round pays nothing */
  await page.evaluate(() => NX.Challenges.stream('/tick', {}, () => {}));
  assert.equal(await wallet(es[0].uid), wb[es[0].uid] + 35);
  assert.equal(await wallet(es[1].uid), wb[es[1].uid] + 15);
  /* everyone is told — the notification opens the results */
  for (const u of [S.linaUid, S.omarUid, S.mayaUid]) assert.ok((await noticesOf(u)).some(n => n.event === 'result' && n.fcId === S.fc && n.winnerName === f.winner.name), 'told: ' + u);
  const l = S.lina.page;
  await l.evaluate(() => { NX.Sheet.closeAll(); NX.Community.openNotifications(); });
  await l.locator('.sheet .comp-row', { hasText: 'أُعلنت نتائج' }).first().click();
  await l.locator('.chg-winner').waitFor();
});

test('26 · Tamper: a friends\' challenge, its result, its prize markers or the daily limits written from a browser — refused; a prize bigger than the creator\'s points — refused before anything exists; a stranger cannot read it', async () => {
  const o = S.omar.page;
  const tries = await o.evaluate(async fc => {
    const { F, db } = NX.Backend.fb, me = NX.Backend.user.uid;
    const t = async fn => { try { await fn(); return 'ALLOWED'; } catch (e) { return String(e.code || e.message); } };
    return [
      await t(() => F.updateDoc(F.doc(db, 'friendChallenges', fc), { winner: { uid: me } })),
      await t(() => F.setDoc(F.doc(db, 'friendChallenges', 'fc_mine00000000'), { ownerId: me, reward: { total: 99999 }, players: [me], status: 'final' })),
      await t(() => F.setDoc(F.doc(db, 'challengeEntries', fc + '_' + me), { score10: 10, rank: 1, reward: 999 }, { merge: true })),
      await t(() => F.setDoc(F.doc(db, 'challengeRewards', fc + '__refund'), { points: 999 })),
      await t(() => F.setDoc(F.doc(db, 'friendUsage', me), { drafts: 0, creates: 0 }))];
  }, S.fc);
  tries.forEach(denied);
  /* a player reads it; sami, who is not in it, cannot — through the database or the server */
  const read = async (page, fc) => page.evaluate(async fc => { try { await NX.Backend.fb.F.getDoc(NX.Backend.fb.F.doc(NX.Backend.fb.db, 'friendChallenges', fc)); return 'READ'; } catch (e) { return e.code; } }, fc);
  assert.equal(await read(o, S.fc), 'READ');
  denied(await read(S.sami.page, S.fc));
  assert.equal(await S.sami.page.evaluate(async fc => { try { await NX.Challenges.call('/friend/' + fc); return 'READ'; } catch (e) { return e.code; } }, S.fc), 'private');
  /* a prize bigger than his points: refused at «create» — nothing created, nothing taken */
  const before = await wallet(S.omarUid);
  const res = await o.evaluate(async () => {
    const d = await NX.Challenges.call('/friend/draft', { idea: 'لعبة قفز صغيرة' });
    try { await NX.Challenges.call('/friend/create', { draftId: d.draftId, reward: 999999, split: 'winner', durationMinutes: 60 }); return 'CREATED'; } catch (e) { return e.code; }
  });
  assert.equal(res, 'not_enough');
  assert.equal(await wallet(S.omarUid), before);
  assert.equal((await fsQuery('friendChallenges', 'ownerId', S.omarUid)).length, 0);
});

/* ================================================================ and the rest of NEXUS */
test('27 · Nothing else changed: «نشر اللعبة · Publish» without a challenge still ends with its own report; no page error anywhere', async () => {
  const { page } = S.lina;
  await page.evaluate(() => { NX.Sheet.closeAll(); NX.Studio.openPublish(); });
  assert.equal(await page.locator('.chg-pubnote').count(), 0);
  await page.locator('.sheet-foot .btn', { hasText: 'PUBLISH' }).click();
  await page.locator('.modal-box', { hasText: 'تم النشر' }).waitFor();
  assert.deepEqual(logs.filter(l => /pageerror/.test(l)), []);
});

await run(tests, logs, async () => { await browser.close(); await site.close(); await W.close(); });
