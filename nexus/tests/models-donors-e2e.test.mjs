/* ============================================================
   NEXUS tests · a player's own models from a reseller site, «استخدم
   نماذجي», 2D games, donated keys of any OpenAI-compatible site (💎 strong
   donor · ×2 ad points) and the full translation of the interface —
   in a real browser (Chromium), against the site's own server functions:
   • a reseller's gpt-5 model (refuses max_tokens and temperature) and a
     «thinking» model with an unknown name (answers nothing when its budget
     is spent thinking) both answer — the second learns once, then one call;
   • «استخدم نماذجي» switches to the player's model at once — no model asked;
     the Smart Council then uses the player's model only;
   • «اصنع لعبة ثنائية الأبعاد…» → one HTML5 game, saved as the player's own;
   • a reseller key donated with its Base URL is tested by the server for
     real: a strong model → 💎 on the profile and ×2 on ad points; a weak
     site → 🤝 only, ×1;
   • a text of the interface that translations.js lacks is translated once
     by NEXUS AI (Hindi in Devanagari), kept for everyone — a name or a post
     is never sent; back to Arabic, the original words come back.
   Needs the emulators (firebase emulators:start --project demo-nexus
   --only auth,firestore,storage) and Playwright + Chromium.
   Run:  node nexus/tests/models-donors-e2e.test.mjs
   ============================================================ */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startWorld } from './mock-world.mjs';
import { startSite } from './e2e-server.mjs';
import { e2eReply } from './fake-models.mjs';
import { chromium, resetEmulators, newDevice, signUp, until, run, fsGet } from './e2e-kit.mjs';

const W = await startWorld();
const GAME = '```html\n<!doctype html><html><head><meta charset="utf-8"><title>Sky Hopper</title></head><body style="margin:0"><canvas id="c"></canvas><script>\n'
  + 'const c = document.getElementById("c"), x = c.getContext("2d"); let t = 0, best = 0;\ntry { best = +localStorage.getItem("best") || 0; } catch (e) {}\n'
  + 'function loop() { t++; c.width = innerWidth; c.height = innerHeight; x.fillStyle = "#38bdf8"; x.fillRect(t % c.width, 80, 24, 24); requestAnimationFrame(loop); }\nloop();\n</script></body></html>\n```';
const tr = (s, lang) => (lang === 'en' ? 'Translated-' : 'अनुवाद-') + [...s].length + (s.match(/\{\d+\}/g) || []).map(h => ' ' + h).join('');
W.reply = c => {
  if (/translate the user interface of NEXUS/.test(c.system)) { const lang = /to English/.test(c.system) ? 'en' : 'hi'; return JSON.stringify({ t: JSON.parse(c.lastUser).strings.map(s => tr(s, lang)) }); }
  if (/You write complete, polished, fun 2D browser games/.test(c.system)) return GAME;
  if (c.provider === 'reseller') return 'Reseller ' + c.model + ' answers: ' + c.lastUser.slice(0, 30);
  return e2eReply(c);
};
const env = { FIREBASE_PROJECT_ID: 'demo-nexus', NEXUS_TEST_EMULATOR_TOKENS: '1', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', AI_PER_MINUTE: '500', PRO_AI_PER_DAY: '500', AI_FREE_PER_DAY: '50',
  GEMINI_BASE: W.base + '/gemini', GROQ_BASE: W.base + '/groq', OPENROUTER_BASE: W.base + '/openrouter', ANTHROPIC_BASE: W.base + '/anthropic',
  GEMINI_KEYS: 'AIzaGEMINI_TEST_KEY_000000000000000001', GROQ_KEYS: 'gsk_GROQTESTKEY0000000000000001', OPENROUTER_KEYS: 'sk-or-v1-OPENROUTERTESTKEY000000001',
  NEXUS_TEST_CUSTOM_BASE: W.base + '/reseller', ADS_WEB: '1', ADS_MIN_SECONDS: '1', ADS_COOLDOWN_SECONDS: '1', POOL_CACHE_MS: '0' };
await resetEmulators();
/* the site configured for Firebase Storage (one of its two documented settings): a 2D game goes to the Storage emulator, not Google Drive */
const HTML = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8').replace('window.NEXUS_FILES = "drive";', 'window.NEXUS_FILES = "firebase";');
assert.ok(HTML.includes('window.NEXUS_FILES = "firebase";'));
const site = await startSite({ env, files: { '/index.html': HTML } });
const browser = await chromium.launch();
const logs = [];
const tests = [];
const test = (name, f) => tests.push({ name, f });
const S = {};
const RESELLER = W.base + '/reseller/v1';
const since = n => W.calls.slice(n);
const trCalls = () => W.calls.filter(c => /translate the user interface of NEXUS/.test(c.system));
const lastAnswer = page => page.evaluate(() => { const c = NX.Chat.ensure(), m = c.messages[c.messages.length - 1]; return m && m.role === 'assistant' ? String(m.content) : ''; });
async function ask(page, q) {
  await page.evaluate(q => NX.Chat.send(q), q);
  await until(page, () => !NX.Chat.streaming, null, 60000);
  return lastAnswer(page);
}
async function useReseller(page, model) {
  await page.evaluate(([base, model]) => {
    NX.AIConfig.set('custom', { apiKey: 'sk-reseller-PLAYER000000000000000001', baseURL: base, model, models: ['gpt-5.5', 'think-5.5', 'gpt-4o-mini'] });
    NX.AIConfig.setActive('custom'); NX.Council.setMode('single');
  }, [RESELLER, model]);
}

/* ================================================================ 🔌 a reseller's models */
test('1 · A reseller\'s gpt-5.5 (refuses max_tokens and temperature): answers at the first call — max_completion_tokens with room to think, no temperature, reasoning_effort low', async () => {
  const { page } = S.a = await newDevice(browser, site, logs, { locale: 'ar' });
  S.aUid = await signUp(page, 'reseller@test.io');
  await page.evaluate(() => NX.Platform.createProject('Reseller'));
  await until(page, () => NX.Screen.current() === 'studio' && NX.Studio.project && NX.Studio.engine);
  await page.evaluate(() => { NX.Sheet.closeAll(); NX.Studio.openAI(); NX.AIPanel.setMode('chat'); });
  await useReseller(page, 'gpt-5.5');
  const n = W.calls.length;
  const a = await ask(page, 'ما هو المتغير في البرمجة؟');
  const calls = since(n).filter(c => c.provider === 'reseller');
  assert.match(a, /Reseller gpt-5\.5 answers/);
  assert.equal(calls.length, 1, calls.map(c => c.status).join(','));
  const raw = calls[0].raw;
  assert.equal(raw.max_tokens, undefined); assert.equal(raw.temperature, undefined);
  assert.ok(raw.max_completion_tokens >= 4096, 'room to think: ' + raw.max_completion_tokens); assert.equal(raw.reasoning_effort, 'low');
});

test('2 · A «thinking» model with an unknown name: its empty answer (budget spent thinking) is not the end — once more with room, it answers; learnt: the next question is ONE call', async () => {
  const { page } = S.a;
  W.thinking['think-5.5'] = 6000;
  await useReseller(page, 'think-5.5');
  let n = W.calls.length;
  const a = await ask(page, 'اشرح الحلقة for باختصار');
  let calls = since(n).filter(c => c.provider === 'reseller');
  assert.match(a, /Reseller think-5\.5 answers/);
  assert.deepEqual(calls.map(c => c.empty), [true, false], 'an empty answer, then the answer');
  n = W.calls.length;
  assert.match(await ask(page, 'وما هي الدالة؟'), /Reseller think-5\.5 answers/);
  calls = since(n).filter(c => c.provider === 'reseller');
  assert.equal(calls.length, 1); assert.ok((calls[0].raw.max_completion_tokens || 0) >= 6000);
});

test('3 · «استخدم نماذجي» while NEXUS AI answers: the player\'s own model at once — no model asked, no token; the council keeps only their models', async () => {
  const { page } = S.a;
  await page.evaluate(() => { NX.AIConfig.setActive('nexus'); NX.Council.setPicks([{ pid: 'nexus', model: 'auto' }, { pid: 'custom', model: 'think-5.5' }]); });
  const n = W.calls.length, l = site.log.length;
  await page.evaluate(() => NX.AIPanel.send('استخدم نماذجي'));
  const r = await page.evaluate(() => ({ active: NX.AIConfig.active(), picks: NX.Council.picks().map(p => p.pid), text: [...document.querySelectorAll('.ai-msg.ai')].pop().textContent }));
  assert.equal(r.active, 'custom'); assert.ok(!r.picks.includes('nexus'), r.picks.join());
  assert.ok(r.text.startsWith('✓'), r.text);
  assert.equal(W.calls.length, n, 'no model was asked'); assert.equal(site.log.slice(l).filter(x => /\/api\/ai/.test(x.path)).length, 0);
});

test('4 · Smart Council with the player\'s own model: only their model answers — no NEXUS model mixed in', async () => {
  const { page } = S.a;
  await page.evaluate(() => NX.Council.setMode('smart'));
  const n = W.calls.length, l = site.log.length;
  const a = await ask(page, 'اكتب لي خطة كاملة ومفصلة للعبة سباق فيها سيارات وطرق ونظام نقاط ومستويات ومتجر وقائمة إعدادات، مع شرح كل جزء من الكود ولماذا نحتاجه');
  assert.match(a, /Reseller think-5\.5 answers/);
  assert.deepEqual([...new Set(since(n).map(c => c.provider))], ['reseller']);
  assert.equal(site.log.slice(l).filter(x => x.path === '/api/ai/council').length, 0);
  await page.evaluate(() => NX.Council.setMode('single'));
});

/* ================================================================ 🕹 2D games */
test('5 · «اصنع لعبة ثنائية الأبعاد…»: the player\'s model writes ONE complete HTML5 game — checked, saved as their own (private), ▶ to play', async () => {
  const { page } = S.a;
  await useReseller(page, 'gpt-5.5');
  const n = W.calls.length;
  await page.evaluate(() => { NX.AIPanel.setMode('build'); NX.AIPanel.send('اصنع لعبة ثنائية الأبعاد عن طائر يقفز بين الغيوم'); });
  await until(page, () => !!document.querySelector('.g2d-play') || [...document.querySelectorAll('.ai-msg.ai')].some(m => /^✕/.test(m.textContent)), null, 60000);
  assert.ok(await page.evaluate(() => !!document.querySelector('.g2d-play')), await page.evaluate(() => [...document.querySelectorAll('.ai-msg')].slice(-3).map(m => m.textContent).join(' | ')));
  const call = since(n).find(c => /2D browser games/.test(c.system));
  assert.ok(call && call.provider === 'reseller' && call.raw.max_completion_tokens >= 12000, 'written by the player\'s model, with room for a whole game');
  const msg = await page.evaluate(() => document.querySelector('.g2d-play').closest('.ai-msg').textContent);
  assert.match(msg, /Sky Hopper/);
  const apps = await page.evaluate(async () => (await NX.HtmlApps.mine()).map(a => ({ name: a.name, visibility: a.visibility })));
  assert.ok(apps.some(a => a.name === 'Sky Hopper' && a.visibility === 'private'), JSON.stringify(apps));
});

/* ================================================================ 🤝 donations */
async function donate(page, key, models) {
  W.lists.reseller = models;
  await page.evaluate(() => NX.KeyPool.open());
  await page.fill('.sheet .kp input[type=password]', key);
  await page.fill('.sheet .kp-base', RESELLER);
  await page.check('#kp-agree');
  await page.locator('.sheet .btn', { hasText: 'تبرّع بالمفتاح' }).click();
  await until(page, () => [...document.querySelectorAll('.toast')].some(t => /نجح اختبار/.test(t.textContent)), null, 60000);
  const toast = await page.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).find(t => /نجح اختبار/.test(t)));
  await page.evaluate(() => NX.Sheet.closeAll());
  return toast;
}
async function adPoints(page) {
  return page.evaluate(async () => {
    const t = await NX.Points.api('/ad/start', { via: 'web' });
    await new Promise(r => setTimeout(r, 1300));
    const c = await NX.Points.api('/ad/claim', { nonce: t.nonce });
    return { shown: t.points, strong: t.strongDonor, added: c.added };
  });
}

test('6 · A reseller key donated with its Base URL: tested by the server for real → 💎 strong donor — the badge on the profile, ×2 on an ad\'s points; the key never comes back', async () => {
  const { page } = S.a;
  const n = W.calls.length;
  const toast = await donate(page, 'sk-reseller-DONATED00000000000000001', ['gpt-4o', 'gpt-4o-mini']);
  assert.match(toast, /💎/);
  const tc = since(n).filter(c => c.provider === 'reseller');
  assert.ok(tc.length >= 1 && tc[0].model === 'gpt-4o' && tc[0].status === 200, 'a real completion, the strong model first');
  const d = await fsGet('donors/' + S.aUid), k = await fsGet('api_keys/' + S.aUid + '_0');
  assert.equal(d.tier, 'strong'); assert.equal(k.provider, 'custom'); assert.equal(k.tier, 'strong'); assert.equal(k.base, RESELLER);
  assert.deepEqual(await adPoints(page), { shown: 10, strong: true, added: 10 });
  await page.evaluate(uid => NX.Community.openCreator(uid), S.aUid);
  await until(page, () => /💎/.test((document.querySelector('.donor-badge.strong') || {}).textContent || ''), null, 30000);
  const html = await page.content();
  assert.ok(!html.includes('DONATED00000000000000001'), 'the donated key is nowhere in the page');
  await page.evaluate(() => NX.Sheet.closeAll());
});

test('7 · A weak site (no strong model): 🤝 donor, thanked — no 💎, an ad\'s points stay ×1', async () => {
  const { page } = S.b = await newDevice(browser, site, logs, { locale: 'ar' });
  S.bUid = await signUp(page, 'weak@test.io');
  const toast = await donate(page, 'sk-reseller-WEAKDONOR000000000000001', ['mini-helper-1']);
  assert.match(toast, /🤝/); assert.doesNotMatch(toast, /💎 متبرّع قوي —/);
  assert.equal((await fsGet('donors/' + S.bUid)).tier, 'normal');
  assert.deepEqual(await adPoints(page), { shown: 5, strong: false, added: 5 });
});

/* ================================================================ 🌐 the whole interface */
const UI = 'ذاكرة المتصفح امتلأت — حُذفت محادثات قديمة مع المساعد لحفظ إعداداتك', UI_N = 'بقي 7 ثانية حتى يبدأ التحدي', NAME = 'مرحبا يا زكريا الطيب';
const inject = page => page.evaluate(([a, b, c]) => document.body.append(Object.assign(document.createElement('p'), { id: 'rt1', textContent: a }),
  Object.assign(document.createElement('p'), { id: 'rt2', textContent: b }), Object.assign(document.createElement('p'), { id: 'rt3', textContent: c })), [UI, UI_N, NAME]);
const texts = page => page.evaluate(() => ['rt1', 'rt2', 'rt3'].map(id => document.getElementById(id).textContent));

test('8 · हिन्दी: a text translations.js lacks is translated once by NEXUS AI (numbers kept) — a name is never sent; back to العربية: the original words', async () => {
  const { page } = S.hi = await newDevice(browser, site, logs, { locale: 'hi-IN' });
  await until(page, () => document.querySelectorAll('#p-tabs button').length === 5);
  const n = trCalls().length;
  await inject(page);
  await until(page, t => document.getElementById('rt1').textContent === t, tr(UI, 'hi'), 60000);
  const hi = await texts(page);
  assert.deepEqual(hi, [tr(UI, 'hi'), tr('بقي {0} ثانية حتى يبدأ التحدي', 'hi').replace('{0}', '7'), NAME]);
  const asked = trCalls().slice(n).map(c => c.lastUser).join('\n');
  assert.ok(asked.includes('بقي {0} ثانية'), 'numbers as placeholders'); assert.ok(!asked.includes('زكريا'), 'a name never leaves');
  assert.match(trCalls().slice(n)[0].system, /Devanagari/);
  await page.evaluate(() => NX.setLanguage('ar'));
  assert.deepEqual(await texts(page), [UI, UI_N, NAME]);
  await page.evaluate(() => NX.setLanguage('hi'));
  await until(page, t => document.getElementById('rt1').textContent === t, tr(UI, 'hi'));
});

test('9 · Kept for everyone: another visitor in हिन्दी sees it at once — no model asked again; the tabs and the top bar are Devanagari', async () => {
  const d = await newDevice(browser, site, logs, { locale: 'hi-IN' });
  await until(d.page, () => document.querySelectorAll('#p-tabs button').length === 5);
  const n = trCalls().length;
  await d.page.waitForTimeout(1500);
  await inject(d.page);
  await until(d.page, t => document.getElementById('rt1').textContent === t, tr(UI, 'hi'), 30000);
  await d.page.waitForTimeout(1200);
  assert.equal(trCalls().length, n, 'from the shared dictionary');
  const tabs = await d.page.evaluate(() => [...document.querySelectorAll('#p-tabs button span')].map(s => s.textContent));
  assert.ok(tabs.every(t => !/[A-Za-z]/.test(t)), tabs.join(' | '));
  await d.ctx.close();
});

await run(tests, logs, async () => { await browser.close(); await site.close(); await W.close(); });
