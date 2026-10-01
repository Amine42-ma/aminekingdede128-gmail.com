/* ============================================================
   NEXUS tests · the WHOLE interface in English and हिन्दी — no Arabic left.
   i18n/en.js and i18n/hi.js hold a translation for every Arabic text of
   index.html. They are static files: they work on any host, also a
   drag-and-drop deploy where no server function runs — so here the
   translation service (/api/i18n) is switched off on every device.
   • a Hindi phone: the account page (the screenshot: «تغيير الاسم»,
     «صفحتي العامة», «مصدر الإعداد», «محتواي (ألعاب · منشورات · بث)»…) and the
     editor's ➕ CREATE sheet (مكعب · كرة · ارسم شكلًا بإصبعك · DRAW ·
     عناصر تقنية · Engine · ضوء شمس · Directional…) show no Arabic letter;
   • the assistant: its input's hint, the suggestion chips, and the bubble of
     a tapped chip are in Hindi — and the chip's command still works;
   • texts made at run time (numbers, names, parts joined by «·») find their
     translation through the templates ({0}…);
   • the same in English; back to العربية every text is exactly as before;
     Arabic → हिन्दी at run time loads the dictionary without a reload.
   Needs the emulators (firebase emulators:start --project demo-nexus
   --only auth,firestore,storage) and Playwright + Chromium.
   Run:  node nexus/tests/i18n-full-e2e.test.mjs
   ============================================================ */
import assert from 'node:assert/strict';
import { startWorld } from './mock-world.mjs';
import { startSite } from './e2e-server.mjs';
import { e2eReply } from './fake-models.mjs';
import { chromium, resetEmulators, newDevice, signUp, until, run } from './e2e-kit.mjs';

const W = await startWorld();
W.reply = c => e2eReply(c);
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
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' };

/* a phone on a host without server functions: /api/i18n answers nothing, no translation kept from before */
async function device(locale, email) {
  const d = await newDevice(browser, site, logs, Object.assign({ locale }, PHONE));
  d.asked = [];
  await d.ctx.route('**/api/i18n**', r => { d.asked.push(r.request().url() + ' ' + (r.request().postData() || '')); return r.fulfill({ status: 404, body: 'no functions on this host' }); });
  await d.page.evaluate(() => Object.keys(localStorage).filter(k => /i18n\.remote/.test(k)).forEach(k => localStorage.removeItem(k)));
  await d.page.reload();
  await until(d.page, () => window.NX && NX.Backend && NX.Backend.isOnline && NX.Backend.isOnline() && NX.Backend.user && NX.Platform && document.querySelectorAll('#p-tabs button').length === 5);
  if (email) await signUp(d.page, email);
  return d;
}

/* every Arabic letter a person can see: texts, and hints (placeholder · title · aria-label) —
   what a player typed, code, and a game's own interface are not the interface's */
const arabicLeft = (page, sel) => page.evaluate(sel => {
  const SKIP = 'script,style,textarea,code,pre,.ed-wrap,[contenteditable="true"],[data-no-i18n],#game-ui-layer,.ai-msg.me:not([data-ui])';
  const NOATTR = 'script,style,.ed-wrap,[contenteditable="true"],[data-no-i18n],#game-ui-layer';
  const AR = /[؀-ۿ]/, out = [];
  const seen = e => e.checkVisibility({ checkVisibilityCSS: true });
  for (const root of sel ? document.querySelectorAll(sel) : [document.body]) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) {
      const p = n.parentElement;
      if (p && AR.test(n.nodeValue) && !p.closest(SKIP) && seen(p)) out.push(n.nodeValue.trim().slice(0, 90));
    }
    root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(e => {
      if (e.closest(NOATTR) || !seen(e)) return;
      for (const a of ['placeholder', 'title', 'aria-label']) { const v = e.getAttribute(a); if (v && AR.test(v)) out.push('@' + a + ' ' + v.slice(0, 90)); }
    });
  }
  return out;
}, sel || null);
const texts = (page, sel) => page.evaluate(s => [...document.querySelectorAll(s)].map(e => e.textContent.trim()), sel);
async function profile(page) {
  await page.evaluate(() => NX.Platform.go('profile'));
  await until(page, () => NX.Screen.current() === 'profile' || !!document.querySelector('.kv'));
  await page.waitForTimeout(600);
}
async function createSheet(page, name) {
  await page.evaluate(n => NX.Platform.createProject(n), name);
  await until(page, () => NX.Screen.current() === 'studio' && NX.Studio.project && NX.Studio.engine);
  await page.evaluate(() => { NX.Sheet.closeAll(); NX.EditorUI.openCreate(); });
  await until(page, () => document.querySelectorAll('#sheet-root .sheet').length > 0);
  await page.waitForTimeout(500);
}

/* ================================================================ हिन्दी */
test('1 · हिन्दी — the account page of the screenshot: no Arabic letter (the translation service is off)', async () => {
  const { page } = S.hi = await device('hi-IN', 'meera@nexus.test');
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'hi');
  assert.ok(await page.evaluate(() => !!(window.NX_I18N_FULL && NX_I18N_FULL.hi && Object.keys(NX_I18N_FULL.hi).length > 3000)), 'i18n/hi.js is loaded with the page');
  await profile(page);
  const left = await arabicLeft(page);
  assert.deepEqual(left, [], 'Arabic still shown: ' + JSON.stringify(left));
  const shown = (await texts(page, 'button, .kv span, h2')).join(' | ');
  for (const t of ['नाम बदलें', 'मेरा सार्वजनिक पेज', 'मेरा कंटेंट (गेम्स · पोस्ट · स्ट्रीम)', 'सेटअप का स्रोत', 'मेरे एसेट', 'सूचनाएँ'])
    assert.ok(shown.includes(t), t + ' — in: ' + shown.slice(0, 600));
});

test('2 · हिन्दी — the editor\'s ➕ CREATE sheet: shapes, drawing, engine items, lights — all in Hindi', async () => {
  const { page } = S.hi;
  await createSheet(page, 'Hindi World');
  const left = await arabicLeft(page);
  assert.deepEqual(left, [], 'Arabic still shown: ' + JSON.stringify(left));
  const sheet = (await texts(page, '#sheet-root .sheet')).join(' ');
  for (const t of ['बनाएँ · CREATE', 'घन', 'गोला', 'सिलेंडर', '✎ उँगली से आकार बनाएँ · DRAW', 'तकनीकी चीज़ें · Engine', 'सूरज की रोशनी · Directional', 'शुरुआती पॉइंट · Spawn'])
    assert.ok(sheet.includes(t), t + ' — in: ' + sheet.slice(0, 500));
  await page.evaluate(() => NX.Sheet.closeAll());
});

test('3 · हिन्दी — the assistant: the input\'s hint, the chips, and a tapped chip\'s bubble; its command still works', async () => {
  const { page } = S.hi;
  await page.evaluate(() => { NX.Studio.engine.select && NX.Studio.engine.select(null); NX.Studio.openAI(); });
  await until(page, () => NX.AIPanel.sheet && document.querySelectorAll('.ea-sugg .chip').length > 0);
  await page.waitForTimeout(500);
  const hint = await page.evaluate(() => NX.AIPanel.input.getAttribute('placeholder') || '');
  assert.ok(hint && !/[؀-ۿ]/.test(hint), 'the input\'s hint: ' + hint);
  const chips = await texts(page, '.ea-sugg .chip');
  assert.ok(chips.includes('सीन में क्या है?') && chips.includes('मेरे गेम का विश्लेषण करो'), JSON.stringify(chips));
  /* the chip's own Arabic command goes to NEXUS (build log, or the chat when a model is connected) — its bubble in Hindi */
  const answers = () => page.evaluate(() => NX.AIPanel.log.querySelectorAll('.ai-msg.ai').length + document.querySelectorAll('.chat-msg.assistant').length);
  const before = await answers();
  await page.locator('.ea-sugg .chip', { hasText: 'मेरे गेम का विश्लेषण करो' }).click();
  await until(page, n => NX.AIPanel.log.querySelectorAll('.ai-msg.ai').length + document.querySelectorAll('.chat-msg.assistant').length > n, before, 30000);
  await page.waitForTimeout(400);
  const seen = await page.evaluate(() => ({ me: [...document.querySelectorAll('.ai-msg.me[data-ui], .chat-msg.user')].map(m => m.textContent.trim()),
    answer: [...document.querySelectorAll('.ai-msg.ai, .chat-msg.assistant')].pop().textContent }));
  assert.ok(seen.me.includes('मेरे गेम का विश्लेषण करो'), JSON.stringify(seen.me));
  assert.ok(/विश्लेषण/.test(seen.answer), 'the analysis ran: ' + seen.answer.slice(0, 300));
  const left = await arabicLeft(page, '#sheet-root');
  assert.deepEqual(left, [], 'Arabic still shown in the assistant: ' + JSON.stringify(left));
  /* what the player types stays exactly as typed */
  await page.evaluate(() => NX.AIPanel.say('me', 'مرحبا يا NEXUS'));
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.ai-msg.me')].pop().textContent), 'مرحبا يا NEXUS');
});

test('4 · Texts made at run time: numbers, names and parts joined by « · » are found through the templates', async () => {
  const { page } = S.hi;
  const out = await page.evaluate(async () => {
    const host = document.createElement('div');
    host.id = 'tpl-test';
    ['تعديل «Main»', '4 عناصر محدّدة', 'غروب · زمرّد', 'حذف المفتاح Gemini …a1b2؟', '🔒 3+ لعمر 12'].forEach(t => { const d = document.createElement('div'); d.textContent = t; host.appendChild(d); });
    document.body.appendChild(host);
    await new Promise(r => setTimeout(r, 300));
    const r = [...host.children].map(d => d.textContent);
    host.remove();
    return r;
  });
  assert.deepEqual(out, ['«Main» एडिट करें', '4 ऑब्जेक्ट चुने गए', 'सूर्यास्त · पन्ना', 'की Gemini …a1b2 हटाएँ?', '🔒 3+ उम्र 12 के लिए']);
});

/* ================================================================ English */
test('5 · English — the same account page and ➕ CREATE sheet: no Arabic letter', async () => {
  const { page } = S.en = await device('en-US', 'john@nexus.test');
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
  await profile(page);
  let left = await arabicLeft(page);
  assert.deepEqual(left, [], 'Arabic still shown: ' + JSON.stringify(left));
  const shown = (await texts(page, 'button, .kv span, h2')).join(' | ');
  for (const t of ['Change name', 'My public page', 'My content (games · posts · streams)', 'Config source', 'My assets']) assert.ok(shown.includes(t), t);
  await createSheet(page, 'English World');
  left = await arabicLeft(page);
  assert.deepEqual(left, [], 'Arabic still shown: ' + JSON.stringify(left));
  const sheet = (await texts(page, '#sheet-root .sheet')).join(' ');
  for (const t of ['➕ CREATE', 'Cube', 'Sphere', '✎ Draw a shape with your finger · DRAW', 'Technical items · Engine', 'Sunlight · Directional']) assert.ok(sheet.includes(t), t);
  await page.evaluate(() => NX.Sheet.closeAll());
});

/* ================================================================ back, and at run time */
test('6 · Back to العربية: every text exactly as before — the sheet, the chips, the tapped chip\'s bubble, the account page', async () => {
  const { page } = S.hi;
  await page.evaluate(() => NX.setLanguage('ar'));
  await until(page, () => document.documentElement.lang === 'ar' && document.documentElement.dir === 'rtl');
  await page.waitForTimeout(400);
  const chips = await texts(page, '.ea-sugg .chip');
  assert.ok(chips.includes('ماذا يوجد في المشهد؟') && chips.includes('حلل لعبتي'), JSON.stringify(chips));
  assert.ok(await page.evaluate(() => [...document.querySelectorAll('.ai-msg.me[data-ui], .chat-msg.user')].some(m => m.textContent.trim() === 'حلل لعبتي')));
  await page.evaluate(() => { NX.AIPanel.close && NX.AIPanel.close(); NX.Sheet.closeAll(); NX.EditorUI.openCreate(); });
  await until(page, () => document.querySelectorAll('#sheet-root .sheet').length > 0);
  await page.waitForTimeout(400);
  const sheet = (await texts(page, '#sheet-root .sheet')).join(' ');
  for (const t of ['➕ إنشاء · CREATE', 'مكعب', 'كرة', '✎ ارسم شكلًا بإصبعك · DRAW', 'عناصر تقنية · Engine', 'ضوء شمس · Directional']) assert.ok(sheet.includes(t), t);
  await page.evaluate(() => NX.Sheet.closeAll());
  await profile(page);
  const shown = (await texts(page, 'button, .kv span, h2')).join(' | ');
  for (const t of ['تغيير الاسم', 'صفحتي العامة', 'محتواي (ألعاب · منشورات · بث)', 'مصدر الإعداد', 'أصولي']) assert.ok(shown.includes(t), t);
});

test('7 · العربية → हिन्दी at run time: the dictionary is loaded then, no reload, no Arabic left; nothing was asked of /api/i18n for these pages', async () => {
  const { page, asked } = S.ar = await device('ar', 'salma@nexus.test');
  assert.equal(await page.evaluate(() => !!(window.NX_I18N_FULL && NX_I18N_FULL.hi)), false, 'an Arabic visit downloads no dictionary');
  await profile(page);
  const nav = await page.evaluate(() => performance.getEntriesByType('navigation').length);
  await page.evaluate(() => NX.setLanguage('hi'));
  await until(page, () => [...document.querySelectorAll('button')].some(b => b.textContent.includes('नाम बदलें')));
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => performance.getEntriesByType('navigation').length), nav);
  const left = await arabicLeft(page);
  assert.deepEqual(left, [], 'Arabic still shown: ' + JSON.stringify(left));
  assert.deepEqual(asked.filter(u => !/\/dict\?/.test(u)), [], 'every text came from the static dictionary');
});

test('8 · Every main screen and sheet — the tabs, settings, AI settings, 🤝 donating a key, 💰 points, 🏆 challenges, diagnostics, NEXUS Learner, the mechanics library, apps, the editor and its menus — in हिन्दी and in English: no Arabic letter', async () => {
  const sweep = page => page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const SKIP = 'script,style,textarea,code,pre,.ed-wrap,[contenteditable="true"],[data-no-i18n],#game-ui-layer,.ai-msg.me:not([data-ui])';
    const NOATTR = 'script,style,.ed-wrap,[contenteditable="true"],[data-no-i18n],#game-ui-layer';
    const AR = /[\u0600-\u06FF]/;
    const left = () => {
      const out = new Set(), seen = e => e.checkVisibility({ checkVisibilityCSS: true });
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = w.nextNode());) { const p = n.parentElement; if (p && AR.test(n.nodeValue) && !p.closest(SKIP) && seen(p)) out.add(n.nodeValue.trim().slice(0, 140)); }
      document.body.querySelectorAll('[placeholder],[title],[aria-label]').forEach(e => { if (e.closest(NOATTR) || !seen(e)) return; for (const a of ['placeholder', 'title', 'aria-label']) { const v = e.getAttribute(a); if (v && AR.test(v)) out.add('@' + a + ' ' + v.slice(0, 140)); } });
      return [...out];
    };
    const R = {};
    const step = async (name, f, ms = 1500) => {
      try { await f(); } catch (e) { R[name] = ['ERR ' + e.message]; }
      await wait(ms);
      const l = left(); if (l.length) R[name] = (R[name] || []).concat(l);
      NX.Sheet.closeAll(); await wait(300);
    };
    NX.Sheet.closeAll();
    for (const tab of ['home', 'create', 'projects', 'community', 'profile', 'apps']) await step('tab:' + tab, () => NX.Platform.go(tab));
    await step('settings', () => NX.openSettings());
    await step('aiSettings', () => NX.openAISettings());
    await step('keypool', () => NX.KeyPool.open());
    await step('points', () => NX.Points.open());
    await step('challenges', () => NX.Challenges.open());
    await step('diagnostics', () => NX.openDiagnostics(), 4000);
    await step('learner', () => NX.Learner.open());
    await step('mechanicsLibrary', () => NX.Mechanics.openLibrary());
    await NX.Platform.createProject('Sweep');
    for (let i = 0; i < 100 && !(NX.Screen.current() === 'studio' && NX.Studio.project && NX.Studio.engine); i++) await wait(200);
    NX.Sheet.closeAll();
    await step('studio', () => {});
    await step('studio:world', () => NX.Studio.openWorld && NX.Studio.openWorld());
    await step('studio:menu', () => NX.EditorUI.openMenu && NX.EditorUI.openMenu());
    await step('studio:ai', () => NX.Studio.openAI());
    await step('studio:aiSettings', () => NX.AIPanel.settings());
    await step('mechanics', () => NX.Mechanics.open());
    return R;
  });
  for (const d of [S.ar, S.en]) {
    const lang = await d.page.evaluate(() => document.documentElement.lang);
    const r = await sweep(d.page);
    assert.deepEqual(r, {}, lang + ': Arabic still shown: ' + JSON.stringify(r));
  }
});

await run(tests, logs, async () => { await browser.close(); await site.close(); await W.close(); });
