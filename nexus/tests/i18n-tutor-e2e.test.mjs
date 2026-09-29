/* ============================================================
   NEXUS tests · 🌐 the interface in العربية · English · हिन्दी, and
   🎓 «كيف أبرمج؟» — the AI live tutor — in a real browser (Chromium),
   on the Firebase emulators, with fake AI providers (mock-world.mjs).
   • a first visit follows the browser's language (hi-IN → हिन्दी, en-US
     and others → English, ar → العربية); the choice is kept;
   • the top bar's 🌐 changes every text at once — no reload — the
     direction too, and Arabic comes back exactly; code and a game's own
     interface are never touched;
   • the tutor asks first; then opens the menus, types a real NEXUS script
     live into its own lesson file, explains each step in the interface's
     language; pause · play · replay · next · speed · exit & practice;
     the script it wrote runs in NEXUS; NEXUS AI makes a lesson on a
     question; the bar and the menu fit a phone.
   Needs the emulators (firebase emulators:start --project demo-nexus
   --only auth,firestore,storage) and Playwright + Chromium.
   Run:  node nexus/tests/i18n-tutor-e2e.test.mjs
   ============================================================ */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startWorld } from './mock-world.mjs';
import { startSite } from './e2e-server.mjs';
import { e2eReply } from './fake-models.mjs';
import { chromium, resetEmulators, newDevice, signUp, until, run } from './e2e-kit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const box = {};
vm.runInNewContext(fs.readFileSync(path.join(here, '..', 'translations.js'), 'utf8'), { window: box });
const K = box.NX_I18N.keys, AR = k => K[k][0], EN = k => K[k][1], HI = k => K[k][2];

/* NEXUS AI, when it is asked for a lesson (the tutor's own prompt) */
const AI_LESSON = { title: 'القفز', steps: [
  { say: 'نصنع قفزة: متغير يحفظ قوة القفز.', code: '// قوة القفز\nlet force = 6;' },
  { say: 'عند الضغط على الزر يقفز اللاعب.', code: 'function start() {\n  UI.button("JUMP", pressed => { if (pressed) Player.jump(force); }, { id: "jump", right: 24, bottom: 40 });\n}' }] };
const W = await startWorld();
W.reply = c => /friendly programming teacher/.test(c.system) ? JSON.stringify(AI_LESSON) : e2eReply(c);
const env = { FIREBASE_PROJECT_ID: 'demo-nexus', NEXUS_TEST_EMULATOR_TOKENS: '1', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', AI_PER_MINUTE: '500', PRO_AI_PER_DAY: '500', AI_FREE_PER_DAY: '50',
  GEMINI_BASE: W.base + '/gemini', GROQ_BASE: W.base + '/groq', OPENROUTER_BASE: W.base + '/openrouter', ANTHROPIC_BASE: W.base + '/anthropic',
  GEMINI_KEYS: 'AIzaGEMINI_TEST_KEY_000000000000000001', GROQ_KEYS: 'gsk_GROQTESTKEY0000000000000001', OPENROUTER_KEYS: 'sk-or-v1-OPENROUTERTESTKEY000000001' };
await resetEmulators();
const site = await startSite({ env });
const browser = await chromium.launch();
const logs = [];
const tests = [];
const test = (name, f) => tests.push({ name, f });
const S = {};
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, locale: 'ar',
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' };

/* what the page shows: the language, the direction, the bottom tabs, a top-bar caption */
const shell = page => page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, saved: localStorage.getItem('nx.lang'),
  tabs: [...document.querySelectorAll('#p-tabs button span')].map(s => s.textContent), search: (document.querySelector('#btn-search .ib-cap') || {}).textContent,
  langCap: (document.querySelector('#btn-lang .ib-cap') || {}).textContent, title: document.title }));
const tutor = page => page.evaluate(() => ({ on: !!document.querySelector('.tt-root'), i: NX.Tutor.i, bubble: (document.querySelector('.tt-bubble p') || {}).textContent || '',
  code: NX.Tutor.file ? NX.Tutor.file.code : '', labels: [...document.querySelectorAll('.tt-bar button')].map(b => b.getAttribute('aria-label')) }));
const codeLen = page => page.evaluate(() => NX.Tutor.file ? NX.Tutor.file.code.length : -1);
async function studio(page, name) {
  await page.evaluate(n => NX.Platform.createProject(n), name);
  await until(page, () => NX.Screen.current() === 'studio' && NX.Studio.project && NX.Studio.engine);
  await page.evaluate(() => NX.Sheet.closeAll());
}

/* ================================================================ 🌐 the language */
test('1 · First visit, a browser in Hindi: हिन्दी at once — the tabs, the top bar, the title, left-to-right, the Devanagari font, the choice kept', async () => {
  const { page } = S.hi = await newDevice(browser, site, logs, { locale: 'hi-IN' });
  await until(page, () => document.querySelectorAll('#p-tabs button').length === 5);
  const s = await shell(page);
  assert.equal(s.lang, 'hi'); assert.equal(s.dir, 'ltr'); assert.equal(s.saved, '"hi"');
  assert.deepEqual(s.tabs, ['Home', 'बनाएँ', 'मेरे Projects', 'Community', 'Profile']);
  assert.equal(s.search, 'खोजें'); assert.equal(s.langCap, 'हि'); assert.equal(s.title, HI('APP_TITLE'));
  assert.ok(await page.evaluate(() => !!document.getElementById('nx-font-hi')), 'Hind (Devanagari) is loaded for Hindi only');
});

test('2 · First visit elsewhere: en-US → English · fr-FR → English (the closest) · ar-SA → العربية (right-to-left)', async () => {
  for (const [locale, lang, dir, home] of [['en-US', 'en', 'ltr', 'Home'], ['fr-FR', 'en', 'ltr', 'Home'], ['ar-SA', 'ar', 'rtl', 'الرئيسية']]) {
    const d = await newDevice(browser, site, logs, { locale });
    await until(d.page, () => document.querySelectorAll('#p-tabs button').length === 5);
    const s = await shell(d.page);
    assert.equal(s.lang, lang, locale); assert.equal(s.dir, dir, locale); assert.equal(s.tabs[0], home, locale);
    assert.equal(await d.page.evaluate(() => !!document.getElementById('nx-font-hi')), false);
    if (locale === 'ar-SA') S.ar = d; else await d.ctx.close();
  }
});

test('3 · The 🌐 in the top bar: three languages; English — every text at once, NO reload, left-to-right; what opens next is English too', async () => {
  const { page } = S.ar;
  S.arText = await shell(page);
  await page.evaluate(() => { window.__sameVisit = 1; });
  await page.click('#btn-lang');
  const opts = await page.locator('.lang-menu .lang-opt').allTextContents();
  assert.equal(opts.length, 3); assert.ok(opts[0].includes('العربية') && opts[0].includes('✓') && opts[1].includes('English') && opts[2].includes('हिन्दी'), opts.join(' | '));
  await page.locator('.lang-menu .lang-opt[lang="en"]').click();
  const s = await shell(page);
  assert.equal(await page.evaluate(() => window.__sameVisit), 1, 'the page was not reloaded');
  assert.equal(s.lang, 'en'); assert.equal(s.dir, 'ltr'); assert.deepEqual(s.tabs, ['Home', 'Create', 'My projects', 'Community', 'Profile']);
  assert.equal(s.search, 'Search'); assert.equal(s.langCap, 'EN'); assert.equal(await page.locator('.lang-menu').count(), 0);
  await until(page, t => [...document.querySelectorAll('.toast')].some(x => x.textContent.includes(t)), EN('LANG_CHANGED'));
  /* a sheet opened now: translated as it appears */
  await page.click('#btn-settings');
  await page.locator('.sheet', { hasText: 'Language and appearance' }).waitFor();
  const seg = await page.locator('.sheet .seg[data-no-i18n] button').allTextContents();
  assert.deepEqual(seg, ['العربية', 'English', 'हिन्दी'], 'each language by its own name');
  await page.evaluate(() => NX.Sheet.closeAll());
});

test('4 · हिन्दी, then back to العربية: every Arabic text comes back exactly; the choice survives a reload', async () => {
  const { page } = S.ar;
  await page.evaluate(() => NX.setLanguage('hi'));
  assert.equal((await shell(page)).tabs[2], 'मेरे Projects');
  await page.evaluate(() => NX.setLanguage('ar'));
  const back = await shell(page);
  assert.deepEqual(back.tabs, S.arText.tabs); assert.equal(back.search, S.arText.search); assert.equal(back.dir, 'rtl'); assert.equal(back.title, AR('APP_TITLE'));
  await page.evaluate(() => NX.setLanguage('hi'));
  await page.reload();
  await page.waitForFunction(() => window.NX && NX.Platform && document.querySelectorAll('#p-tabs button').length === 5, null, { timeout: 90000 });
  assert.equal((await shell(page)).lang, 'hi', 'kept (localStorage)');
  await page.evaluate(() => NX.setLanguage('ar'));
});

test('5 · Never translated: code in the editor, and a game\'s own interface (its own data-i18n); data-i18n of NEXUS itself is', async () => {
  const { page } = S.ar;
  S.arUid = await signUp(page, 'lina@test.io', { free: true });
  await studio(page, 'Code stays');
  await page.evaluate(() => { NX.IDE.open(NX.Studio.project); NX.IDE.addFile('Words.js', '// حذف\nconst label = "إلغاء";\n'); });
  await page.evaluate(() => {
    const g = Object.assign(document.createElement('div'), { id: 'game-ui-layer' });
    g.innerHTML = '<b>حذف</b><span data-i18n="PLAY_BUTTON">إلغاء</span>';
    document.body.append(g, NX.el('span', { id: 'mine', 'data-i18n': 'TUTOR', text: '🎓 كيف أبرمج؟' }));
    NX.setLanguage('en');
  });
  try {
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ code: NX.IDE.editor.ta.value, pre: document.querySelector('.ed-wrap').textContent.includes('إلغاء'),
      game: document.getElementById('game-ui-layer').textContent, mine: document.getElementById('mine').textContent, empty: (document.querySelector('#vp-empty b') || {}).textContent }));
    assert.equal(r.code, '// حذف\nconst label = "إلغاء";\n'); assert.ok(r.pre, 'the highlighted code too');
    assert.equal(r.game, 'حذفإلغاء', 'a game\'s interface is the game\'s');
    assert.equal(r.mine, EN('TUTOR'), 'data-i18n="KEY" of NEXUS');
    assert.equal(r.empty, 'Empty world', 'a text the code built in Arabic, translated where it appears');
  } finally {
    await page.evaluate(() => { document.getElementById('game-ui-layer').remove(); document.getElementById('mine').remove(); NX.setLanguage('ar'); NX.Sheet.closeAll(); });
  }
});

/* ================================================================ 🎓 the live tutor */
test('6 · «كيف أبرمج؟» (the studio\'s «المزيد»): the tutor ASKS first — «إلغاء» leaves everything as it was, the guide stays', async () => {
  const { page } = S.ar;
  await studio(page, 'Tutor');
  /* the player's project as it is (the code editor gives an empty project its Main.js) */
  S.files = await page.evaluate(() => { NX.IDE.open(NX.Studio.project); NX.Sheet.closeAll(); return NX.Studio.project.files.map(f => f.path + ':' + f.code.length); });
  await until(page, () => !document.querySelector('#sheet-root .sheet'));
  await page.click('#s-more');
  await page.locator('.opt-row', { hasText: 'كيف أبرمج؟' }).click();
  const modal = page.locator('.modal-box', { hasText: AR('TUTOR_ASK') });
  await modal.waitFor();
  assert.deepEqual(await modal.locator('.btn').allTextContents(), ['إلغاء', 'موافق']);
  await modal.locator('.btn.tt-no').click();
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.tt-root').count(), 0, 'no tutor without a yes');
  assert.deepEqual(await page.evaluate(() => NX.Studio.project.files.map(f => f.path + ':' + f.code.length)), S.files, 'nothing written');
  const guide = await page.textContent('.tt-howto');
  for (const k of ['TUTOR_B1', 'TUTOR_B2', 'TUTOR_B3']) assert.ok(guide.includes(AR(k)), k);
});

test('7 · «موافق»: NEXUS AI\'s pointer opens «الأصول», adds the Player cube, opens the code editor and TYPES live into its own lesson file — the bubble explains each step', async () => {
  const { page } = S.ar;
  await page.locator('.tt-go').click();
  await page.locator('.modal-box .tt-yes').click();
  await page.locator('.tt-root .tt-bar').waitFor();
  let t = await tutor(page);
  assert.deepEqual(t.labels, [AR('TUTOR_PAUSE'), AR('TUTOR_REPLAY'), AR('TUTOR_NEXT'), AR('TUTOR_SPEED') + ' 1x', AR('TUTOR_EXIT')]);
  assert.equal(t.bubble, AR('TL1_1'));
  await page.locator('.tt-speed').click();
  assert.equal(await page.textContent('.tt-speed'), '2x');
  await until(page, s => document.querySelector('.tt-bubble p').textContent === s && document.querySelector('.tt-ring.on') && document.querySelector('#sheet-root .sheet'), AR('TL1_2'));
  await until(page, () => NX.Studio.engine.findByName('Player'));
  await until(page, () => NX.IDE.current && NX.IDE.current.path === 'Tutor_Lesson.js' && document.querySelector('.ide-editor'));
  await until(page, () => NX.Tutor.i === 4 && NX.Tutor.file.code.length > 5);
  const a = await codeLen(page); await page.waitForTimeout(500); const b = await codeLen(page);
  assert.ok(b > a, 'typed live: ' + a + ' → ' + b);
  assert.equal(await page.evaluate(() => NX.IDE.editor.ta.value === NX.Tutor.file.code), true, 'in the editor, in front of the player');
});

test('8 · The control bar: pause stops the typing, ▶ goes on, «أعد الخطوة» takes the step back and types it again, «الخطوة التالية» finishes it at once', async () => {
  const { page } = S.ar;
  await until(page, () => NX.Tutor.i === 5 && NX.Tutor.file.code.length > 40);
  await page.locator('.tt-pp').click();
  await until(page, s => document.querySelector('.tt-bubble p').textContent.startsWith(s), AR('TUTOR_PAUSED'));
  const p1 = await codeLen(page); await page.waitForTimeout(700); const p2 = await codeLen(page);
  assert.equal(p2, p1, 'paused: nothing typed');
  assert.equal(await page.getAttribute('.tt-pp', 'aria-label'), AR('TUTOR_PLAY'));
  await page.locator('.tt-pp').click();
  await until(page, n => NX.Tutor.file.code.length > n, p2);
  const before = await page.evaluate(() => NX.Tutor.lesson.steps[5].before.length);
  await page.locator('.tt-replay').click();
  assert.ok(await codeLen(page) <= before + 2, 'the step taken back');
  await until(page, n => NX.Tutor.file.code.length > n + 5, before);
  await page.locator('.tt-next').click();
  await until(page, () => NX.Tutor.file.code.includes('label.set("Score: " + score);') && NX.Tutor.file.code.includes('}, { id: "jump", right: 24, bottom: 40 });\n}'));
});

test('9 · The language follows: English now → the bubble and the bar in English at once; the step replayed is typed with English comments; back to Arabic', async () => {
  const { page } = S.ar;
  await page.locator('.tt-pp').click();                                   // paused: the step stays where it is
  await page.evaluate(() => NX.setLanguage('en'));
  const t = await tutor(page);
  assert.ok(t.bubble.startsWith(EN('TUTOR_PAUSED')) && (t.bubble.includes(EN('TL1_6')) || t.bubble.includes(EN('TL1_7'))), t.bubble);
  assert.equal(t.labels[0], EN('TUTOR_PLAY')); assert.equal(t.labels[1], EN('TUTOR_REPLAY')); assert.equal(t.labels[4], EN('TUTOR_EXIT'));
  if ((await tutor(page)).i === 5) await page.locator('.tt-next').click();
  await page.locator('.tt-replay').click();
  await until(page, c => NX.Tutor.file.code.includes(c), '// 4) ' + EN('TL1_C4'));
  assert.ok(!(await tutor(page)).code.includes('// 4) ' + AR('TL1_C4')), 'the step was taken back, then typed again');
  await page.evaluate(() => NX.setLanguage('ar'));
  assert.equal((await tutor(page)).labels[0], AR('TUTOR_PAUSE'));
});

/* the game's own screen: what the script's UI.text / UI.button drew (#play-ui over the studio's viewport) */
async function gameUI(page) {
  let out = '';
  for (const f of page.frames()) out += ' ' + await f.evaluate(() => [...document.querySelectorAll('#play-ui *, #player-ui *, #game-ui-layer *')]
    .filter(n => !n.childElementCount).map(n => n.textContent.trim()).join(' ')).catch(() => '');
  return out;
}
test('10 · It runs: the script the tutor wrote is valid and plays in NEXUS — the JUMP button and the score on the game\'s screen', async () => {
  const { page } = S.ar;
  await until(page, () => NX.Studio.playing, null, 90000);
  let ui = '';
  for (const t0 = Date.now(); Date.now() - t0 < 30000 && !/JUMP/.test(ui); await page.waitForTimeout(300)) ui = await gameUI(page);
  assert.match(ui, /JUMP/); assert.match(ui, /Score: 0/);
  const code = await page.evaluate(() => NX.Tutor.file.code);
  assert.doesNotThrow(() => new Function(code), 'valid JavaScript');
  for (const s of ['let speed = 5;', 'function start() {', 'UI.button("JUMP"', 'function update(dt) {', 'Input.axis("horizontal")']) assert.ok(code.includes(s), s);
  assert.deepEqual(await page.evaluate(() => (NX.IDE.logs || []).filter(l => l.type === 'error').map(l => l.m)), [], 'built without an error');
});

test('11 · «خروج وتجربة الكود بنفسي»: the tutor leaves, the game stops, the lesson\'s code is open in the editor for the player — their own files untouched', async () => {
  const { page } = S.ar;
  await page.locator('.tt-exit').click();
  await until(page, () => !document.querySelector('.tt-root') && !NX.Studio.playing && NX.IDE.current && NX.IDE.current.path === 'Tutor_Lesson.js');
  await until(page, s => [...document.querySelectorAll('.toast')].some(x => x.textContent.includes(s)), AR('TUTOR_PRACTICE'));
  const files = await page.evaluate(() => NX.Studio.project.files.map(f => f.path + ':' + f.code.length));
  assert.deepEqual(files.filter(f => !f.startsWith('Tutor_Lesson.js')), S.files, 'the player\'s own files are as they were');
  assert.ok(files.some(f => f.startsWith('Tutor_Lesson.js')));
  await page.evaluate(() => NX.Sheet.closeAll());
});

test('12 · A lesson from NEXUS AI on the player\'s own question: asked through NEXUS\'s AI, played the same way — its explanations, its code typed live', async () => {
  const { page } = S.ar;
  const asked = W.calls.length;
  await page.evaluate(() => NX.Tutor.openHowTo());
  await page.locator('.modal-box .tt-no').click();
  await page.fill('.tt-topic', 'كيف أجعل اللاعب يقفز؟');
  await page.locator('.tt-aimake').click();
  await page.locator('.modal-box .tt-yes').click();
  await page.locator('.tt-root .tt-bar').waitFor();
  const call = W.calls.slice(asked).find(c => /friendly programming teacher/.test(c.system));
  assert.ok(call && /كيف أجعل اللاعب يقفز/.test(call.lastUser) && /Arabic|العربية/.test(call.system), 'the question and the language went to NEXUS AI');
  await page.locator('.tt-speed').click();
  await until(page, s => document.querySelector('.tt-bubble p').textContent === s, AI_LESSON.steps[0].say, 60000);
  await until(page, () => NX.Tutor.file && NX.Tutor.file.path === 'Tutor_Lesson_2.js' && NX.Tutor.file.code.includes('Player.jump(force)'), null, 60000);
  assert.ok((await tutor(page)).code.startsWith('// قوة القفز\nlet force = 6;'));
  await page.locator('.tt-exit').click();
  await until(page, () => !document.querySelector('.tt-root'));
  await page.evaluate(() => NX.Sheet.closeAll());
});

test('13 · Phone (390×844): the 🌐 menu and the tutor\'s bar fit the screen, their buttons big enough for a finger; no page error anywhere', async () => {
  const { page } = await newDevice(browser, site, logs, PHONE);
  await signUp(page, 'omar@test.io', { free: false });
  await until(page, () => document.querySelectorAll('#p-tabs button').length === 5);
  await page.locator('#btn-lang').tap();
  const fits = sel => page.evaluate(sel => [...document.querySelectorAll(sel)].map(n => { const r = n.getBoundingClientRect(); return { l: r.left, r: r.right, w: r.width, h: r.height }; }), sel);
  for (const r of await fits('.lang-menu, .lang-opt')) assert.ok(r.l >= 0 && r.r <= 390, JSON.stringify(r));
  for (const r of await fits('.lang-opt')) assert.ok(r.h >= 44);
  await page.locator('.lang-menu .lang-opt[lang="hi"]').tap();
  assert.equal((await shell(page)).lang, 'hi');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scrolling in Hindi');
  await studio(page, 'Phone tutor');
  await page.evaluate(() => NX.Tutor.openHowTo());
  await page.locator('.modal-box .tt-yes').tap();
  await page.locator('.tt-bar').waitFor();
  for (const r of await fits('.tt-bar, .tt-bar button, .tt-bubble')) assert.ok(r.l >= 0 && r.r <= 390, JSON.stringify(r));
  for (const r of await fits('.tt-bar button')) assert.ok(r.h >= 40 && r.w >= 40, JSON.stringify(r));
  assert.equal(await page.getAttribute('.tt-pp', 'aria-label'), HI('TUTOR_PAUSE'));
  await page.locator('.tt-exit').tap();
  assert.deepEqual(logs.filter(l => /pageerror/.test(l)), []);
});

await run(tests, logs, async () => { await browser.close(); await site.close(); await W.close(); });
