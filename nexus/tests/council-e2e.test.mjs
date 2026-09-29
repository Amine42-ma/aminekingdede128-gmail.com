/* ============================================================
   NEXUS tests · the Multi-AI Council end to end, in a real browser:
   the page (index.html) → AIClient's council → /api/ai/council (ai.js) →
   fake providers → the final answer → NEXUS's own executors → the project
   really changed (real assets placed, scripts written, edits applied).

   Needs:
   • the Firebase emulators, from nexus/:
       firebase emulators:start --project demo-nexus --only auth,firestore,storage
     (the page runs with ?emulators=1; the real firestore.rules apply)
   • Playwright with Chromium (npm i -D playwright; npx playwright install chromium)
   • where the CDNs cannot be reached (a sandbox): NEXUS_E2E_VENDOR=<dir> with
     three/package (npm pack three@0.162.0) and firebase/package
     (npm pack firebase@10.12.2) — they are served in their place.
   Run:  node nexus/tests/council-e2e.test.mjs
   ============================================================ */
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { startWorld } from './mock-world.mjs';
import { startSite } from './e2e-server.mjs';
import { e2eReply, INVENTED_ID } from './fake-models.mjs';
import { boxGLB } from './glb.mjs';

const require = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const m of [process.env.PLAYWRIGHT_MODULE, 'playwright']) { try { if (m) return require(m); } catch { } }
  return require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
})();
const VENDOR = process.env.NEXUS_E2E_VENDOR || '';
const PROJECT = 'demo-nexus', FS = 'http://127.0.0.1:8080/v1/projects/' + PROJECT + '/databases/(default)/documents';
const KEYS = { gem: 'AIzaGEMINI_TEST_KEY_000000000000000001', groq: 'gsk_GROQTESTKEY0000000000000001', or: 'sk-or-v1-OPENROUTERTESTKEY000000001',
  antDonated: 'sk-ant-api03-DONATEDCLAUDEKEY00000000000001', own: 'sk-OWNOPENAIKEY000000000000000001' };

/* ---------------- the emulators, as the server's admin ---------------- */
const toFs = v => v === null || v === undefined ? { nullValue: null } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : typeof v === 'string' ? { stringValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(toFs) } } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFs(x)])) } };
const admin = { authorization: 'Bearer owner', 'content-type': 'application/json' };
async function fsSet(doc, obj) {
  const mask = Object.keys(obj).map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
  const r = await fetch(FS + '/' + doc + '?' + mask, { method: 'PATCH', headers: admin, body: JSON.stringify({ fields: toFs(obj).mapValue.fields }) });
  if (!r.ok) throw new Error('fsSet ' + doc + ' ' + r.status + ' ' + await r.text());
}
async function fsQuery(col, field, value) {
  const r = await fetch(FS + ':runQuery', { method: 'POST', headers: admin, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: col }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } } } }) });
  return (await r.json()).filter(x => x.document).map(x => x.document);
}
async function resetEmulators() {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/' + PROJECT + '/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/' + PROJECT + '/accounts', { method: 'DELETE' });
}

/* ---------------- the public library: real .glb files, real records ---------------- */
const LIB = [
  { id: 'asset_e2e_road', name: 'City Road', file: 'road.glb', size: [8, 0.1, 24], color: [0.2, 0.2, 0.22], category: 'Environment', tags: ['road', 'street'], type: 'road' },
  { id: 'asset_e2e_house', name: 'Small House', file: 'house.glb', size: [6, 5, 6], color: [0.8, 0.6, 0.4], category: 'Buildings', tags: ['house', 'building', 'home'], type: 'building' },
  { id: 'asset_e2e_tree', name: 'Pine Tree', file: 'tree.glb', size: [1.6, 5, 1.6], color: [0.1, 0.5, 0.2], category: 'Nature', tags: ['tree', 'pine'], type: 'tree' },
  { id: 'asset_e2e_car', name: 'Sports Car', file: 'car.glb', size: [2, 1.3, 4.4], color: [0.9, 0.1, 0.1], category: 'Vehicles', tags: ['car', 'vehicle', 'sports'], type: 'vehicle' },
  { id: 'asset_e2e_lamp', name: 'Street Lamp', file: 'lamp.glb', size: [0.4, 4, 0.4], color: [0.9, 0.9, 0.5], category: 'Props', tags: ['lamp', 'streetlight', 'light'], type: 'prop' },
  { id: 'asset_e2e_hero', name: 'Hero Character', file: 'hero.glb', size: [0.6, 1.8, 0.6], color: [0.3, 0.4, 0.9], category: 'Characters', tags: ['character', 'person', 'player'], type: 'character' }
];
const files = Object.fromEntries(LIB.map(a => ['/e2e-assets/' + a.file, boxGLB(a.name, a.size, a.color)]));

/* ---------------- the world ---------------- */
const W = await startWorld();
W.reply = e2eReply;
const env = { FIREBASE_PROJECT_ID: PROJECT, NEXUS_TEST_EMULATOR_TOKENS: '1', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', AI_PER_MINUTE: '500', PRO_AI_PER_DAY: '500', AI_FREE_PER_DAY: '50',
  GEMINI_BASE: W.base + '/gemini', GROQ_BASE: W.base + '/groq', OPENROUTER_BASE: W.base + '/openrouter', ANTHROPIC_BASE: W.base + '/anthropic',
  GEMINI_KEYS: KEYS.gem, GROQ_KEYS: KEYS.groq, OPENROUTER_KEYS: KEYS.or };
await resetEmulators();
const site = await startSite({ env, files });
const browser = await chromium.launch();
const pageLogs = [];

async function newPage() {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  await ctx.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') return route.continue();
    if (VENDOR && u.hostname === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/10.12.2/'))
      return route.fulfill({ path: path.join(VENDOR, 'firebase/package', u.pathname.split('/').pop()), contentType: 'text/javascript' });
    if (VENDOR && u.hostname === 'cdn.jsdelivr.net' && u.pathname.startsWith('/npm/three@0.162.0/'))
      return route.fulfill({ path: path.join(VENDOR, 'three/package', u.pathname.replace('/npm/three@0.162.0/', '')), contentType: 'text/javascript' });
    return VENDOR ? route.abort() : route.continue();
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => pageLogs.push('pageerror: ' + String(e.stack || e).slice(0, 500)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) pageLogs.push('console: ' + m.text().slice(0, 400)); });
  await page.addInitScript(() => { try { localStorage.setItem('nx.mode', '"pro"'); } catch { } });
  await page.goto(site.base + '/index.html?emulators=1');
  await page.waitForFunction(() => window.NX && NX.Backend && NX.Backend.isOnline && NX.Backend.isOnline() && NX.Backend.user && NX.Council && NX.CouncilUI && NX.Platform, null, { timeout: 90000 });
  return { ctx, page };
}
async function signUp(page, email) {
  const uid = await page.evaluate(async e => (await NX.Backend.auth.signInEmail(e, 'secret123', true)).uid, email);
  await page.waitForFunction(() => NX.FreeAI.ready(), null, { timeout: 30000 });
  return uid;
}
const until = (page, fn, arg, timeout = 90000) => page.waitForFunction(fn, arg, { timeout, polling: 250 });
const callsSince = n => W.calls.slice(n);
const roleOf = c => /REVIEW & SYNTHESIS/.test(c.system) ? 'synthesis' : ((/YOUR ROLE: ([^.\n]+)/.exec(c.system) || [])[1] || 'single').trim();

const tests = [];
const test = (name, f) => tests.push({ name, f });
const S = {};    // what the steps share

/* ================================================================ a Pro account */
test('Pro account: the server reads Pro from the wallet — 4 models allowed', async () => {
  const { page } = S.pro = await newPage();
  S.proUid = await signUp(page, 'pro@test.io');
  await fsSet('wallets/' + S.proUid, { proUntil: Date.now() + 864e5 });
  const caps = await page.evaluate(() => NX.Council.config(true));
  assert.equal(caps.pro, true); assert.equal(caps.maxModels, 4); assert.equal(caps.verified, true);
  /* the library everyone can use */
  const toks = await page.evaluate(lib => lib.map(a => NX.buildSearchTokens({ name: a.name, tags: a.tags, category: a.category, creatorName: 'Library' })), LIB);
  for (let i = 0; i < LIB.length; i++) {
    const a = LIB[i];
    await fsSet('assets/' + a.id, { assetId: a.id, ownerId: 'library-bot', creatorName: 'Library', name: a.name, description: '', category: a.category, tags: a.tags,
      assetType: a.type, typeSource: 'name', processing: 'ready', usable: true, projectId: null, storagePath: 'assets/library-bot/' + a.id + '/source.glb',
      downloadURL: site.base + '/e2e-assets/' + a.file, thumbnail: null, thumbnailURL: null, fileType: 'glb', kind: 'model', bytes: files['/e2e-assets/' + a.file].length,
      license: 'CC0', hash: 'h_' + a.id, originalBytes: null, visibility: 'public', stats: { size: a.size, triangles: 12 }, createdAt: Date.now() - i * 1000, updatedAt: Date.now(), usageCount: 0, searchTokens: toks[i] });
  }
  const found = await page.evaluate(async () => (await NX.Assets.search({ q: 'car', kind: 'model', scope: 'public', limit: 10 })).items.map(a => a.assetId));
  assert.ok(found.includes('asset_e2e_car'), 'Assets.search finds the library: ' + found);
});

test('Council settings: Pro unlocks the modes; the server\'s limits are shown, not set', async () => {
  const { page } = S.pro;
  await page.evaluate(() => NX.CouncilUI.open());
  await until(page, () => document.querySelector('.cc-mode[data-mode="full"]') && !document.querySelector('.cc-mode[data-mode="full"]').disabled);
  const txt = await page.evaluate(() => document.querySelector('.cc-sheet').innerText);
  assert.match(txt, /حتى 4 نماذج/); assert.match(txt, /maxParallelRequests/); assert.match(txt, /ليس نموذجًا جديدًا/);
  await page.click('.cc-mode[data-mode="full"]');
  assert.equal(await page.evaluate(() => NX.Council.mode()), 'full');
  await page.click('.cc-mode[data-mode="smart"]');
  assert.equal(await page.evaluate(() => NX.Council.mode()), 'smart');
  await page.evaluate(() => NX.Sheet.closeAll());
});

/* ================================================================ Game Builder + Assets.search + Council */
/* ================================================================ Smart Council's analysis, in the page, with the server's points */
test('Smart Council decides from the task (not its length): 1 · 2 · 4 models for the examples, thresholds from the server', async () => {
  const { page } = S.pro;
  const r = await page.evaluate(() => {
    const a = (kind, text, extra) => { const x = NX.Council.analyze(Object.assign({ kind }, extra || {}), text); return { n: x.n, why: NX.Council.why(x) }; };
    return { th: NX.Council.caps.smart.thresholds,
      color: a('act', 'غير لون الزر إلى أزرق'),
      save: a('act', 'أضف نظام حفظ للعبة'),
      medium: a('act', 'أضف عدوًا يطارد اللاعب مع شريط صحة ونظام نقاط'),
      city: a('act', 'ابنِ مدينة كاملة، استخدم Assets، أضف NPCs وسيارات وطرق ونظام مهام.'),
      builder: a('plan', 'أنشئ مدينة كاملة في لعبتي', { origin: 'builder', assets: 6 }),
      hello: a('ask', 'مرحبا'),
      fix: a('fix', 'TypeError: x is undefined\nReferenceError: y\nSyntaxError', { errors: 3, files: 1 }) };
  });
  assert.deepEqual(r.th, [2, 4, 6], 'the thresholds the server sent');
  assert.equal(r.color.n, 1, 'a colour change: one model — ' + r.color.why); assert.match(r.color.why, /تعديل صغير/);
  assert.ok(r.save.n >= 1 && r.save.n <= 2, 'a save system: one or two — ' + r.save.n);
  assert.ok(r.medium.n >= 2 && r.medium.n <= 3, 'a medium task: 2–3 — ' + r.medium.n + ' ' + r.medium.why);
  assert.equal(r.city.n, 4, 'a whole city with assets, NPCs, cars, roads, quests: 4 — ' + r.city.why);
  assert.equal(r.builder.n, 4); assert.equal(r.hello.n, 1); assert.equal(r.fix.n, 2, 'a repair never needs more than two');
});

test('Game Builder + Asset search + AI Council: «ابنِ مدينة كاملة، استخدم Assets، أضف NPCs وسيارات وطرق ونظام مهام.» → 4 models, a real city in the project', async () => {
  const { page } = S.pro;
  await page.evaluate(async () => { await NX.Platform.createProject('E2E City'); });
  await until(page, () => NX.Studio.project && NX.Studio.engine);
  await page.evaluate(() => { NX.Studio.openAI(); NX.AIPanel.setMode('build'); });
  const n0 = W.calls.length;
  await page.evaluate(() => NX.AIPanel.send('ابنِ مدينة كاملة، استخدم Assets، أضف NPCs وسيارات وطرق ونظام مهام.'));
  await until(page, () => !NX.Builder.running && NX.AIPanel.log && NX.AIPanel.log.querySelector('.report-card'), null, 180000);
  const calls = callsSince(n0).filter(c => /You plan and write changes inside the NEXUS/.test(c.system));
  const roles = calls.map(roleOf);
  assert.deepEqual(roles.filter(r => r !== 'synthesis').sort(), ['المبرمج · Coder', 'المخطّط · Planner', 'المراجع · Reviewer', 'الأصول · Assets'].sort(), 'Smart → 4 members: ' + roles);
  assert.equal(roles.filter(r => r === 'synthesis').length, 1);
  /* the members saw REAL assets found with Assets.search */
  assert.match(calls[0].system, /"assetId":"asset_e2e_road"[^}]*"forConcept":"road"/);
  assert.match(calls[0].system, /REAL ASSETS FOUND FOR THIS REQUEST with Assets\.search[\s\S]*asset_e2e_house · «Small House»/);
  /* the reviewer worked after the lead and the planner */
  const t = r => calls.find(c => roleOf(c) === r);
  assert.ok(t('المراجع · Reviewer').t0 >= t('المبرمج · Coder').t1 && t('المراجع · Reviewer').t0 >= t('المخطّط · Planner').t1);
  const log = await page.evaluate(() => NX.AIPanel.log.innerText);
  assert.match(log, /Final result ready/);
  assert.match(log, /لماذا 4؟[^\n]*لعبة \/ مدينة \/ عالم كامل/, 'the panel says why Smart chose four');
  const r = await page.evaluate(() => ({ assets: Array.from(NX.Studio.engine.entities.values()).map(e => e.assetId).filter(Boolean), files: NX.Studio.project.files.map(f => f.path) }));
  ['asset_e2e_road', 'asset_e2e_house', 'asset_e2e_tree', 'asset_e2e_car'].forEach(id => assert.ok(r.assets.includes(id), id + ' placed: ' + r.assets));
  assert.ok(r.assets.includes('asset_e2e_lamp'), 'the invented lamp id was replaced by a real lamp found with Assets.search');
  assert.ok(!r.assets.includes(INVENTED_ID), 'never an invented id');
  assert.ok(r.files.includes('CityLife.js') && r.files.includes('DrivingController.js'), 'the code was written: ' + r.files);
  assert.ok(await page.evaluate(() => NX.Studio.project.assetRefs.includes('asset_e2e_house')));
  S.pro.carId = await page.evaluate(() => { const e = Array.from(NX.Studio.engine.entities.values()).find(x => x.assetId === 'asset_e2e_car'); return e && e.id; });
});

/* ================================================================ the chat, acting on the selected object (Editor Agent) */
test('Editor Agent + AI Council: the selected car gets a script and a real tree — preview, APPLY, done', async () => {
  const { page } = S.pro;
  await page.evaluate(id => { NX.Studio.engine.select(id); NX.AIPanel.setMode('chat'); }, S.pro.carId);
  const n0 = W.calls.length;
  await page.evaluate(() => NX.Chat.send('هل يمكنك أن تضيف زر بوق للسيارة المحددة وتضع شجرة بجانبها؟'));
  await until(page, () => !NX.Chat.streaming, null, 120000);
  const calls = callsSince(n0).filter(c => /ACTING ON THE PROJECT/.test(c.system));
  assert.ok(calls.length >= 3, 'a council ran: ' + calls.map(roleOf));
  assert.match(calls[0].system, /SCENE OBJECTS[\s\S]*Sports Car/);
  const m = await page.evaluate(() => { const c = NX.Chat.ensure(); return c.messages[c.messages.length - 1]; });
  assert.ok(m.council && m.council.members.length >= 2, 'council details kept with the answer');
  assert.ok(m.cards && m.cards.some(c => c.type === 'preview'), 'one final answer, with a preview of its changes');
  assert.match(m.content, /\(council\)/, 'the text is the synthesis\' final answer, not the members\'');
  const bubble = await page.evaluate(() => NX.Chat.log.lastElementChild.innerText);
  assert.match(bubble, /AI Council Details/);
  assert.ok(!/Coder by|Planner by/.test(bubble.split('AI Council Details')[0]), 'the members\' answers are not shown unless opened');
  await page.click('.chat-log .chat-msg:last-child .agent-card .btn.primary');       // APPLY
  await until(page, () => (NX.Studio.project.files || []).some(f => f.path === 'Horn.js'), null, 60000);
  /* the execution's own report (saved, play-tested) comes last */
  await until(page, () => { const c = NX.Chat.ensure(), m = c.messages[c.messages.length - 1]; return m && m.cards && m.cards.some(x => x.type === 'result'); }, null, 60000);
  const r = await page.evaluate(id => ({ horn: NX.Studio.project.files.find(f => f.path === 'Horn.js'), trees: Array.from(NX.Studio.engine.entities.values()).filter(e => e.assetId === 'asset_e2e_tree').length }), S.pro.carId);
  assert.equal(r.horn.entityId, S.pro.carId, 'attached to the selected car');
  assert.ok(r.trees >= 5, 'a real tree was added (4 from the city + 1)');
});

/* ================================================================ the code agent */
test('Code agent + AI Council: the final edit is a real diff, applied to the file', async () => {
  const { page } = S.pro;
  await page.evaluate(() => NX.Council.setMode('full'));
  const n0 = W.calls.length;
  await page.evaluate(() => NX.CodeAgent.edit('عدّل رسالة البدء في CityLife.js لتطبع الثواني', NX.Agent.chatUI()));
  const calls = callsSince(n0).filter(c => /You edit the code of a game made with NEXUS/.test(c.system));
  assert.equal(calls.filter(c => roleOf(c) !== 'synthesis').length, 4, 'Full Council: 4 members');
  await until(page, () => { const c = NX.Chat.ensure(); const m = c.messages[c.messages.length - 1]; return m && m.cards && m.cards.some(x => x.type === 'diff'); });
  const m = await page.evaluate(() => { const c = NX.Chat.ensure(); return c.messages[c.messages.length - 1]; });
  assert.ok(m.council, 'the diff message carries the council details');
  await page.click('.chat-log .chat-msg:last-child .agent-card .btn.primary');
  await until(page, () => /city ready: /.test((NX.Studio.project.files.find(f => f.path === 'CityLife.js') || {}).code || ''));
  await until(page, () => { const c = NX.Chat.ensure(), m = c.messages[c.messages.length - 1]; return m && /طُبّق التعديل/.test(m.content || ''); }, null, 60000);
  await page.evaluate(() => NX.Council.setMode('smart'));
});

/* ================================================================ AI MODE, inside the assistant panel */
test('AI MODE in the assistant panel: Single AI · Smart Council · Full Council — Pro + Single AI runs ONE model', async () => {
  const { page } = S.pro;
  await page.evaluate(() => { NX.Sheet.closeAll(); NX.Studio.engine.select(null); NX.Studio.openAI(); });
  await until(page, () => document.querySelectorAll('.cc-inline').length === 1);
  await page.click('.cc-inline > summary');
  await until(page, () => document.querySelectorAll('.cc-inline .cc-radio').length === 3);
  const txt = await page.evaluate(() => document.querySelector('.cc-inline').innerText);
  assert.match(txt, /Single AI/); assert.match(txt, /Smart Council/); assert.match(txt, /Full Council/);
  assert.match(txt, /يختار NEXUS عدد النماذج تلقائيًا حسب تعقيد المهمة/); assert.match(txt, /اختر حتى 4 نماذج/);
  assert.ok(await page.evaluate(() => document.querySelector('.cc-inline .cc-radio[data-mode="smart"] input').checked), 'Smart is the default for Pro');
  await page.click('.cc-inline .cc-radio[data-mode="single"] input');
  try {
    assert.equal(await page.evaluate(() => NX.Council.mode()), 'single');
    const n0 = W.calls.length;
    await page.evaluate(() => NX.CodeAgent.edit('أضف عدوًا يطارد اللاعب مع شريط صحة ونظام نقاط', NX.Agent.panelUI()));
    const calls = callsSince(n0).filter(c => /You edit the code of a game made with NEXUS/.test(c.system));
    assert.equal(calls.length, 1, 'Single AI: one call — ' + calls.map(roleOf)); assert.ok(!/YOUR ROLE|REVIEW & SYNTHESIS/.test(calls[0].system));
  } finally {
    await page.click('.cc-inline .cc-radio[data-mode="smart"] input');
  }
  assert.equal(await page.evaluate(() => NX.Council.mode()), 'smart');
});

/* the same two sentences to the code agent (a model always writes its edit): what Smart decides */
test('Pro + Smart Council: «غير لون الزر إلى أزرق» → one model; a medium task → 2–3 models — and it says why', async () => {
  const { page } = S.pro;
  const seen = [];
  await page.exposeFunction('__smartSeen', ev => seen.push(ev));
  await page.evaluate(() => window.addEventListener('nx:council', e => { if (e.detail && (e.detail.type === 'single' || e.detail.type === 'start')) window.__smartSeen(JSON.parse(JSON.stringify(e.detail))); }));
  const code = c => /You edit the code of a game made with NEXUS/.test(c.system);
  let n0 = W.calls.length;
  await page.evaluate(() => NX.CodeAgent.edit('غير لون الزر إلى أزرق', NX.Agent.panelUI()));
  let calls = callsSince(n0).filter(code);
  assert.equal(calls.length, 1, 'one model: ' + calls.map(roleOf)); assert.ok(!/YOUR ROLE/.test(calls[0].system));
  const single = seen.find(e => e.type === 'single');
  assert.ok(single && single.analysis && single.analysis.n === 1, 'Smart said: one model');
  assert.ok(single.analysis.factors.some(f => f.id === 'simple'), 'because it is one small change: ' + JSON.stringify(single.analysis.factors));
  n0 = W.calls.length;
  await page.evaluate(() => NX.CodeAgent.edit('أضف عدوًا يطارد اللاعب مع شريط صحة ونظام نقاط', NX.Agent.panelUI()));
  calls = callsSince(n0).filter(code);
  const members = calls.filter(c => roleOf(c) !== 'synthesis');
  assert.ok(members.length >= 2 && members.length <= 3, 'a medium task: 2–3 members — ' + calls.map(roleOf));
  assert.equal(calls.filter(c => roleOf(c) === 'synthesis').length, 1, 'then ONE synthesis');
  const start = seen.filter(e => e.type === 'start').pop();
  assert.ok(start && start.analysis && start.analysis.factors.some(f => f.id === 'systems'), 'the reasons travel with the council: ' + JSON.stringify(start && start.analysis));
  assert.match(await page.evaluate(() => NX.AIPanel.log.innerText), /لماذا [23]؟/);
});

/* ================================================================ Smart: one model when that is enough */
test('Smart Council: a short question stays ONE model (no council, no extra cost)', async () => {
  const { page } = S.pro;
  const n0 = W.calls.length;
  await page.evaluate(() => NX.Chat.send('ما هو update(dt)؟'));
  await until(page, () => !NX.Chat.streaming);
  const calls = callsSince(n0);
  assert.equal(calls.length, 1); assert.ok(!/YOUR ROLE|REVIEW & SYNTHESIS/.test(calls[0].system));
  const m = await page.evaluate(() => { const c = NX.Chat.ensure(); return c.messages[c.messages.length - 1]; });
  assert.equal(m.smartSingle, true); assert.ok(!m.council);
});

/* ================================================================ a member fails: the others go on, and the page says so */
test('Provider failure + 429 during a Full Council: shown live, the result still comes', async () => {
  const { page } = S.pro;
  await page.evaluate(() => NX.Council.setMode('full'));
  W.keys[KEYS.groq] = '500';
  W.keys[KEYS.or] = '429';
  const seen = [];
  await page.exposeFunction('__ccSeen', ev => seen.push(ev));
  await page.evaluate(() => window.addEventListener('nx:council', e => window.__ccSeen(JSON.parse(JSON.stringify(e.detail)))));
  await page.evaluate(() => NX.Chat.send('هل يمكنك أن تضيف زر بوق للسيارة المحددة وتضع شجرة بجانبها؟'));
  await until(page, () => !NX.Chat.streaming, null, 120000);
  W.keys = {};
  assert.ok(seen.some(e => e.type === 'member' && e.state === 'retrying' && /500|429/.test(e.note || '')), 'a retry was shown: ' + JSON.stringify(seen.filter(e => e.type === 'member').map(e => e.state + ':' + (e.note || e.error || ''))));
  assert.ok(seen.some(e => e.type === 'final'));
  const txt = await page.evaluate(() => NX.Chat.log.lastElementChild.innerText);
  assert.match(txt, /AI Council Details/);
  const html = await page.evaluate(() => { const d = NX.Chat.log.lastElementChild.querySelector('.cc-det'); d.open = true; d.dispatchEvent(new Event('toggle')); return d.innerText; });
  assert.ok(!/AIza|gsk_|sk-or-|sk-ant-/.test(html + txt), 'no key is ever shown');
  await page.evaluate(() => NX.Council.setMode('smart'));
});

/* ================================================================ a donated Claude key, used by the council */
test('Key Pool: a donated Claude key (sk-ant-) is accepted by the rules and serves a council member', async () => {
  const { page } = S.pro;
  const r = await page.evaluate(async k => { try { return await NX.KeyPool.donate(k); } catch (e) { return { err: e.code || e.message }; } }, KEYS.antDonated);
  assert.equal(r.provider, 'anthropic', JSON.stringify(r));
  const docs = await fsQuery('api_keys', 'donorUid', S.proUid);
  assert.equal(docs.length, 1);
  /* a browser can never read it back */
  const read = await page.evaluate(async uid => { const { F, db } = NX.Backend.fb; try { await F.getDoc(F.doc(db, 'api_keys', uid + '_0')); return 'read'; } catch (e) { return e.code; } }, S.proUid);
  assert.equal(read, 'permission-denied');
  await site.reload();                                                            // the server reads the pool afresh
  const models = await page.evaluate(async () => Array.from(await NX.AIClient.listModels('nexus')));
  assert.ok(models.includes('claude-sonnet-test-1'), 'Claude\'s real list appears once a Claude key is in the pool');
  await page.evaluate(() => { NX.Studio.engine.select(null); NX.Council.setPicks([{ pid: 'nexus', model: 'claude-sonnet-test-1' }, { pid: 'nexus', model: 'auto' }]); NX.Council.setMode('full'); });
  const n0 = W.calls.length;
  await page.evaluate(() => NX.Chat.send('اشرح لي بالتفصيل الفرق بين الدالتين start و update في سكربتات NEXUS ولماذا يوجد dt؟'));
  await until(page, () => !NX.Chat.streaming, null, 120000);
  const calls = callsSince(n0);
  const claude = calls.find(c => c.provider === 'anthropic');
  assert.ok(claude && claude.key === KEYS.antDonated, 'the lead ran on the donated Claude key — calls: ' + calls.map(c => c.provider + '/' + roleOf(c) + '/' + c.status).join(', ') + ' · last: ' + JSON.stringify(await page.evaluate(() => { const c = NX.Chat.ensure(), m = c.messages[c.messages.length - 1]; return { content: String(m.content).slice(0, 160), council: m.council && m.council.members.map(x => x.state + ':' + (x.error || '')) }; })));
  assert.ok(calls.some(c => c.provider !== 'anthropic' && roleOf(c) !== 'synthesis'), 'the other member on another provider');
  await page.evaluate(() => { NX.Council.setPicks([]); NX.Council.setMode('smart'); });
});

/* ================================================================ Full Council, chosen in AI MODE's checklist */
test('Full Council from AI MODE: Claude + Gemini + OpenRouter + Groq ticked (maximum 4) → exactly those four, then one synthesis', async () => {
  const { page } = S.pro;
  await page.evaluate(() => { NX.Council.setPicks([]); NX.Sheet.closeAll(); NX.Studio.openAI(); });
  await until(page, () => document.querySelectorAll('.cc-inline').length === 1);            // the closed panel has slid away
  await page.evaluate(() => { const d = document.querySelector('.cc-inline'); if (!d.open) d.querySelector('summary').click(); });
  await until(page, () => document.querySelector('.cc-inline .cc-radio[data-mode="full"] input'));
  /* what is on top of the radio (an open dialog would be) */
  const top = await page.evaluate(() => { const r = document.querySelector('.cc-inline .cc-radio[data-mode="full"] input').getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e ? e.tagName + '.' + e.className + ' · modals: ' + document.querySelectorAll('.modal').length : 'nothing'; });
  await page.click('.cc-inline .cc-radio[data-mode="full"] input', { timeout: 5000 }).catch(e => { throw new Error('cannot click Full (' + top + '): ' + e.message.split('\n')[0]); });
  const want = ['claude-sonnet-test-1', 'gemini-3.6-flash', 'deepseek/deepseek-chat-v3:free', 'llama-3.3-70b-versatile'];
  await until(page, w => w.every(m => document.querySelector('.cc-inline .cc-check[data-pick="nexus|' + m + '"]')), want, 30000)
    .catch(async () => { throw new Error('the checklist shows: ' + JSON.stringify(await page.evaluate(() => ({ mode: NX.Council.mode(), picks: Array.from(document.querySelectorAll('.cc-inline .cc-check')).map(x => x.dataset.pick), body: (document.querySelector('.cc-inline') || {}).innerText })))); });
  for (const m of want) await page.click('.cc-inline .cc-check[data-pick="nexus|' + m + '"] input');
  const ui = await page.evaluate(() => ({ head: document.querySelector('.cc-inline .cc-max').innerText, picks: NX.Council.picks().map(p => p.model),
    fifth: Array.from(document.querySelectorAll('.cc-inline .cc-check input')).filter(i => !i.checked).every(i => i.disabled),
    labels: Array.from(document.querySelectorAll('.cc-inline .cc-check.on .cc-cm')).map(x => x.textContent) }));
  assert.deepEqual(ui.picks, want); assert.match(ui.head, /Maximum: 4 · المختار 4\/4/);
  assert.ok(ui.fifth, 'a fifth model cannot be ticked');
  assert.deepEqual(ui.labels.map(l => l.split(' — ')[0]).sort(), ['Claude', 'Gemini', 'Groq', 'OpenRouter'], 'grouped by the real provider: ' + ui.labels);
  const n0 = W.calls.length;
  await page.evaluate(() => NX.CodeAgent.edit('عدّل رسالة البدء في CityLife.js لتطبع الثواني', NX.Agent.chatUI()));
  const calls = callsSince(n0).filter(c => /You edit the code of a game made with NEXUS/.test(c.system));
  assert.deepEqual(calls.filter(c => roleOf(c) !== 'synthesis').map(c => c.model).sort(), want.slice().sort(), 'the four ticked models: ' + calls.map(c => c.provider + ':' + c.model + '/' + roleOf(c)));
  assert.equal(calls.filter(c => roleOf(c) === 'synthesis').length, 1);
  await page.evaluate(() => { NX.Council.setPicks([]); NX.Council.setMode('smart'); NX.Sheet.closeAll(); });
});

test('maxModels raised in the page, or 8 members sent by hand to the server: at most 4 run (the server\'s maximum)', async () => {
  const { page } = S.pro;
  const r = await page.evaluate(async () => {
    NX.Council.caps = Object.assign({}, NX.Council.caps, { maxModels: 8, proMaxModels: 8 });
    const members = Array.from({ length: 8 }, (_, i) => ({ role: 'r' + i, title: 'M' + i, lead: i === 0, model: 'auto' }));
    const res = await fetch('/api/ai/council', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + await NX.FreeAI.token() },
      body: JSON.stringify({ mode: 'full', system: 'x', messages: [{ role: 'user', content: 'hi' }], members }) });
    const text = await res.text();
    const plan = JSON.parse((/event: plan\ndata: (.*)/.exec(text) || [])[1] || 'null');
    return { status: res.status, members: plan && plan.members.length, allowed: plan && plan.allowed, reduced: plan && plan.reduced, max: (await NX.Council.config(true)).maxModels };
  });
  assert.deepEqual(r, { status: 200, members: 4, allowed: 4, reduced: 'limit', max: 4 });
});

/* ================================================================ the player's own key beside the server's models */
test('Own key + server models: the own-key member runs in the browser (its key never reaches the server)', async () => {
  const { page } = S.pro;
  await page.evaluate(([base, key]) => {
    NX.AIConfig.set('openai', { apiKey: key, baseURL: base + '/groq', model: 'llama-3.3-70b-versatile', models: ['llama-3.3-70b-versatile'] });
    NX.Council.setPicks([{ pid: 'nexus', model: 'auto' }, { pid: 'openai', model: 'llama-3.3-70b-versatile' }]);
    NX.Council.setMode('full');
  }, [W.base, KEYS.own]);
  const n0 = W.calls.length, l0 = site.log.length;
  await page.evaluate(() => NX.Chat.send('اشرح لي بالتفصيل الفرق بين الدالتين start و update في سكربتات NEXUS ولماذا يوجد dt؟'));
  await until(page, () => !NX.Chat.streaming, null, 120000);
  const calls = callsSince(n0);
  assert.ok(calls.some(c => c.key === KEYS.own && roleOf(c) !== 'synthesis'), 'the own-key member was asked directly from the browser — calls: ' + calls.map(c => c.provider + '/' + c.key.slice(0, 8) + '/' + roleOf(c) + '/' + c.status).join(', ') + ' · ' + JSON.stringify(await page.evaluate(() => { const c = NX.Chat.ensure(), m = c.messages[c.messages.length - 1]; return { content: String(m.content).slice(0, 160), council: m.council }; })).slice(0, 900));
  assert.ok(!calls.some(c => c.key === KEYS.own && roleOf(c) === 'synthesis'));
  const councilReqs = site.log.slice(l0).filter(x => x.path === '/api/ai/council');
  assert.equal(councilReqs.length, 2, 'phase members, then phase synthesis');
  const m = await page.evaluate(() => { const c = NX.Chat.ensure(); return c.messages[c.messages.length - 1]; });
  assert.ok(m.council.members.some(x => x.source === 'own' && x.state === 'done'));
  assert.match(m.content, /\(council\)/);
  await page.evaluate(() => { NX.Council.setPicks([]); NX.Council.setMode('smart'); NX.AIConfig.set('openai', { apiKey: '' }); });
});

/* ================================================================ a free account */
test('Free account: one model — the UI says so, and the server enforces it even when the page is tampered with', async () => {
  const { page } = S.free = await newPage();
  const uid = await signUp(page, 'free@test.io');
  const caps = await page.evaluate(() => NX.Council.config(true));
  assert.equal(caps.pro, false); assert.equal(caps.maxModels, 1);
  await page.evaluate(() => NX.CouncilUI.open());
  await until(page, () => document.querySelector('.cc-mode[data-mode="full"]'));
  assert.ok(await page.evaluate(() => document.querySelector('.cc-mode[data-mode="full"]').disabled && document.querySelector('.cc-mode[data-mode="smart"]').disabled));
  assert.match(await page.evaluate(() => document.querySelector('.cc-sheet').innerText), /نموذج واحد/);
  await page.evaluate(() => NX.Sheet.closeAll());
  /* DevTools: Pro «on» in the page, Full Council, four models */
  await page.evaluate(async () => {
    await NX.Platform.createProject('Free project');
    localStorage.setItem('nx.council.mode', '"full"');
    NX.Council.caps = Object.assign({}, NX.Council.caps, { pro: true, maxModels: 4 }); NX.Council._at = Date.now();
    NX.Studio.openAI(); NX.AIPanel.setMode('chat');
  });
  await until(page, () => NX.Studio.project && NX.Chat.log);
  const n0 = W.calls.length, l0 = site.log.length;
  await page.evaluate(() => NX.Chat.send('هل يمكنك أن تضيف شجرة كبيرة في المنتصف وتكتب سكربت يدوّرها؟'));
  await until(page, () => !NX.Chat.streaming, null, 120000);
  const calls = callsSince(n0);
  assert.deepEqual(site.log.slice(l0).filter(x => x.path === '/api/ai/council').map(x => x.status), [403], 'the server refused the council request (Free: one model)');
  assert.equal(calls.length, 1, 'ONE model answered instead: ' + calls.map(roleOf));
  const last = await page.evaluate(() => { const c = NX.Chat.ensure(); return c.messages[c.messages.length - 1]; });
  assert.equal(last.council && last.council.reduced, 'pro_required', 'the server said why: ' + JSON.stringify(last.council || null).slice(0, 400));
  assert.match(await page.evaluate(() => NX.Chat.log.lastElementChild.innerText), /NEXUS Pro/);
  /* nor can the page make itself Pro, reset its counter, or read the key pool */
  const tries = await page.evaluate(async uid => {
    const { F, db } = NX.Backend.fb, out = {};
    const t = async (k, f) => { try { await f(); out[k] = 'written'; } catch (e) { out[k] = e.code; } };
    await t('wallet', () => F.setDoc(F.doc(db, 'wallets', uid), { proUntil: Date.now() + 1e10 }, { merge: true }));
    await t('usage', () => F.setDoc(F.doc(db, 'usage', uid), { used: 0, councilUntil: 0 }, { merge: true }));
    return out;
  }, uid);
  assert.deepEqual(tries, { wallet: 'permission-denied', usage: 'permission-denied' });
  assert.equal((await page.evaluate(() => NX.Council.config(true))).pro, false, 'still free on the server');
});

/* ---------------------------------------------------------------- run */
let pass = 0, failN = 0;
for (const t of tests) {
  const t0 = Date.now();
  try { await t.f(); pass++; console.log('✓ ' + t.name + '  (' + ((Date.now() - t0) / 1000).toFixed(1) + 's)'); }
  catch (e) {
    failN++;
    console.log('✗ ' + t.name + '\n    ' + String(e && e.stack || e).split('\n').slice(0, 5).join('\n    '));
    if (pageLogs.length) console.log('    page: ' + pageLogs.slice(-6).join('\n    page: '));
  }
}
await browser.close(); await site.close(); await W.close();
console.log('\n' + pass + ' passed, ' + failN + ' failed');
process.exit(failN ? 1 : 0);
