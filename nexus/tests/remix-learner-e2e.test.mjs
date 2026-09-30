/* ============================================================
   NEXUS tests · 🔁 Remix, 🧩 mechanics, 🧪 NEXUS Learner (Beta) and a
   key of any site given while the site's server is off — in a real
   browser (Chromium), with the Firebase emulators and the real rules:
   • Lina publishes a game (a component with settings, a script bound
     to an object, a style); Omar remixes it from its page and from the
     player: a NEW project of his — same code, same scene — with
     «remixedFrom», the original untouched (+1 remix on its counter),
     his copy sandboxed, the assistant open as «Remix Copilot» (changes
     at once, the preview after each one);
   • the rules: the credit never changes, a remix of a game closed to
     remixes is refused, a published remix names its original;
   • mechanics: copied from one object to another (settings and bound
     scripts), saved to the library (public), added by someone else
     (+1 use);
   • the Learner learns from an answer with code, and when every model
     is exhausted it answers from what it learnt — or from Wikipedia —
     and says it is the Learner (Beta);
   • a reseller key with its Base URL, the site's server off: kept in
     the pool all the same; tested by the server once it answers.
   Run:  node nexus/tests/remix-learner-e2e.test.mjs
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
const KEYS = { gem: 'AIzaGEMINI_TEST_KEY_000000000000000001', groq: 'gsk_GROQTESTKEY0000000000000001', or: 'sk-or-v1-OPENROUTERTESTKEY000000001' };
W.reply = c => /FUEL_LESSON/.test(c.lastUser) ? 'Here is a fuel system:\n```js\n// FUEL_LESSON\nlet fuel = 100;\nfunction update(dt) { fuel -= dt * 2; }\n```' : e2eReply(c);
const env = { FIREBASE_PROJECT_ID: 'demo-nexus', NEXUS_TEST_EMULATOR_TOKENS: '1', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', AI_PER_MINUTE: '500', PRO_AI_PER_DAY: '500', AI_FREE_PER_DAY: '50',
  GEMINI_BASE: W.base + '/gemini', GROQ_BASE: W.base + '/groq', OPENROUTER_BASE: W.base + '/openrouter', ANTHROPIC_BASE: W.base + '/anthropic',
  GEMINI_KEYS: KEYS.gem, GROQ_KEYS: KEYS.groq, OPENROUTER_KEYS: KEYS.or, NEXUS_TEST_CUSTOM_BASE: W.base + '/reseller', POOL_CACHE_MS: '0' };
await resetEmulators();
const HTML = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8').replace('window.NEXUS_FILES = "drive";', 'window.NEXUS_FILES = "firebase";');
const site = await startSite({ env, files: { '/index.html': HTML } });
const browser = await chromium.launch();
const logs = [];
const tests = [];
const test = (name, f) => tests.push({ name, f });
const S = {};
const MOVER = '// Mover — moves its object\nfunction start() { }\nfunction update(dt) { if (self) self.position.x += (props.speed || 1) * dt; }\n';
const SPIN = '// Spin — bound to the car\nfunction update(dt) { if (self) self.rotation.y += dt; }\n';
const CSS = '.hud { color: #ff0; }\n';
const denied = r => /permission|PERMISSION_DENIED|insufficient/i.test(String(r));

/* ================================================================ 🔁 Remix */
test('1 · Lina publishes «Race City»: a component with settings on the car, a script bound to it, a style — remixes allowed', async () => {
  const { page } = S.lina = await newDevice(browser, site, logs);
  S.linaUid = await signUp(page, 'lina@test.io');
  const r = await page.evaluate(async ([MOVER, SPIN, CSS]) => {
    const p = await NX.Platform.createProject('Race City');
    await new Promise(r => setTimeout(r, 300));
    NX.Sheet.closeAll();
    const eng = NX.Studio.engine;
    const car = await eng.addEntity({ name: 'Car', type: 'primitive', props: { shape: 'box', color: '#ff0000' }, position: [0, 0.5, 0] });
    await eng.addEntity({ name: 'Box', type: 'primitive', props: { shape: 'box' }, position: [4, 0.5, 0] });
    car.components = [{ id: 'c1', type: 'Mover', name: 'Mover', data: { speed: 7 }, enabled: true }];
    p.files.push({ id: 'f1', path: 'Mover.js', code: MOVER, role: 'component', entityId: null, enabled: true },
      { id: 'f2', path: 'Spin.js', code: SPIN, role: 'script', entityId: car.id, enabled: true },
      { id: 'f3', path: 'hud.css', code: CSS, role: 'style', entityId: null, enabled: true });
    p.scene = eng.serialize();
    NX.Studio.dirty = true;
    await NX.Studio.save(true);
    const build = await NX.Studio.buildProject({ silent: true });
    const rec = await NX.Games.publish(NX.Studio.project, { title: 'Race City', description: 'drive', genre: 'Racing', visibility: 'public', ageRating: '3', allowRemix: true }, build);
    return { gameId: rec.gameId, ok: build.ok, objects: p.scene.objects.length };
  }, [MOVER, SPIN, CSS]);
  assert.ok(r.ok, 'the game builds');
  S.gameId = r.gameId; S.objects = r.objects;
  const g = await fsGet('games/' + S.gameId);
  assert.equal(g.allowRemix, true); assert.equal(g.remixedFrom, null);
  S.buildAt = (await fsGet('builds/' + S.gameId)).updatedAt;
});

test('2 · Omar, from the game\'s page: «🔁 Remix» → a NEW project of his — same code, same scene, «remixedFrom» — the original untouched (+1 remix)', async () => {
  const { page } = S.omar = await newDevice(browser, site, logs);
  S.omarUid = await signUp(page, 'omar@test.io');
  await page.evaluate(async id => NX.Community.openGamePage(await NX.Games.get(id)), S.gameId);
  await page.locator('.sc-remix').click();
  await until(page, () => NX.Screen.current() === 'studio' && NX.Studio.project && NX.Studio.project.remixedFrom);
  const p = await page.evaluate(() => { const p = NX.Studio.project; return { id: p.projectId, owner: p.ownerId, name: p.name, from: p.remixedFrom, files: p.files.map(f => [f.path, f.role, f.code]), objects: (p.scene.objects || []).length,
    bound: p.files.filter(f => f.entityId).length, carComp: ((p.scene.objects || []).find(o => o.name === 'Car') || {}).components }; });
  assert.equal(p.owner, S.omarUid); assert.match(p.name, /Race City/);
  assert.equal(p.from.gameId, S.gameId); assert.equal(p.from.ownerId, S.linaUid); assert.equal(p.from.title, 'Race City');
  assert.deepEqual(p.files.find(f => f[0] === 'Mover.js'), ['Mover.js', 'component', MOVER]);
  assert.deepEqual(p.files.find(f => f[0] === 'Spin.js'), ['Spin.js', 'script', SPIN]);
  assert.ok(p.files.find(f => f[0] === 'hud.css')[2].includes('.hud') && !p.files.find(f => f[0] === 'hud.css')[2].includes('#game-ui-layer'), 'the style as its author wrote it');
  assert.equal(p.objects, S.objects); assert.equal(p.bound, 1);
  assert.deepEqual(p.carComp.map(c => [c.type, c.data.speed]), [['Mover', 7]]);
  S.remixId = p.id;
  const server = await fsGet('projects/' + p.id);
  assert.equal(server.remixedFrom.gameId, S.gameId);
  const g = await fsGet('games/' + S.gameId);
  assert.equal(g.remixes, 1, 'one remix on the original\'s counter');
  assert.equal((await fsGet('builds/' + S.gameId)).updatedAt, S.buildAt, 'the original build untouched');
});

test('3 · Remix Copilot: the assistant opens by itself — quick changes, applied at once, the preview after each one; the copy runs sandboxed', async () => {
  const { page } = S.omar;
  await until(page, () => !!document.querySelector('.rmx-bar'));
  const r = await page.evaluate(() => ({ chips: [...document.querySelectorAll('.quick button')].map(b => b.textContent), level: NX.Builder.level(), sandboxed: NX.Sandbox.forProject(NX.Studio.project),
    hello: [...document.querySelectorAll('.ai-msg.ai')].map(m => m.textContent).join(' ') }));
  assert.ok(r.chips.includes('غيّر سرعة السيارات') && r.chips.includes('أضف سلاحًا جديدًا') && r.chips.includes('عدّل إضاءة الخريطة'), r.chips.join(' | '));
  assert.equal(r.level, 'auto', 'changes applied at once'); assert.equal(r.sandboxed, true, 'someone else\'s code: sandboxed');
  assert.match(r.hello, /Race City/);
  await page.evaluate(() => NX.Remix.afterChange({ ok: true, created: ['Weapon.js'], edited: [], objects: [], notes: [], warnings: [] }));
  await until(page, () => NX.Studio.playing === true, null, 30000);
  await page.evaluate(() => NX.Studio.stopPlay());
  await page.evaluate(() => NX.Sheet.closeAll());
  assert.equal(await page.evaluate(() => NX.Builder.level()), 'smart', 'back to the usual level once the Copilot is closed');
});

test('4 · From the player too: «🔁 Remix» on the game\'s screen (after the consent to run someone else\'s code)', async () => {
  const { page } = S.omar;
  /* not awaited: the player waits for the consent below */
  await page.evaluate(id => { NX.Games.get(id).then(g => NX.GamePlayer.open(g)); }, S.gameId);
  const run = page.locator('.modal-box .btn', { hasText: 'تشغيل' });
  await run.first().waitFor();
  await run.first().click();
  await until(page, () => { const b = document.getElementById('p-remix'); return !!b && !b.classList.contains('hide') && b.offsetParent !== null; });
  await page.evaluate(() => NX.GamePlayer.close());
});

test('5 · The rules: the credit never changes; no remix of a game closed to remixes; a published remix names its original', async () => {
  const { page } = S.omar;
  const edit = await page.evaluate(async id => { const { F, db } = NX.Backend.fb; try { await F.updateDoc(F.doc(db, 'projects', id), { remixedFrom: null }); return 'ok'; } catch (e) { return e.code; } }, S.remixId);
  assert.ok(denied(edit), 'the credit cannot be removed: ' + edit);
  /* Lina closes her game to remixes */
  await S.lina.page.evaluate(async id => { const { F, db } = NX.Backend.fb; await F.updateDoc(F.doc(db, 'games', id), { allowRemix: false }); }, S.gameId);
  await page.evaluate(async id => NX.Community.openGamePage(await NX.Games.get(id)), S.gameId);
  await page.locator('.sc-actions').waitFor();
  assert.equal(await page.locator('.sc-remix').count(), 0, 'no Remix button any more');
  await page.evaluate(() => NX.Sheet.closeAll());
  const forced = await page.evaluate(async ([gid, owner]) => {
    const { F, db } = NX.Backend.fb, me = NX.Backend.user.uid, id = 'proj_forced';
    try { await F.setDoc(F.doc(db, 'projects', id), { projectId: id, ownerId: me, name: 'x', files: [], remixedFrom: { gameId: gid, ownerId: owner, title: 'Race City' } }); return 'ok'; } catch (e) { return e.code; }
  }, [S.gameId, S.linaUid]);
  assert.ok(denied(forced), 'a remix of a closed game is refused by the rules: ' + forced);
  /* Omar publishes his remix: its page credits Lina's game */
  const pub = await page.evaluate(async id => {
    const p = await NX.Projects.get(id); await NX.Studio.open(p); NX.Sheet.closeAll();
    const build = await NX.Studio.buildProject({ silent: true });
    const rec = await NX.Games.publish(NX.Studio.project, { title: 'Race City Turbo', description: '', genre: 'Racing', visibility: 'public', ageRating: '3', allowRemix: true }, build);
    return rec.gameId;
  }, S.remixId);
  const g2 = await fsGet('games/' + pub);
  assert.equal(g2.remixedFrom.gameId, S.gameId);
  const strip = await page.evaluate(async id => { const { F, db } = NX.Backend.fb; try { await F.updateDoc(F.doc(db, 'games', id), { remixedFrom: null }); return 'ok'; } catch (e) { return e.code; } }, pub);
  assert.ok(denied(strip), 'a published remix keeps its credit: ' + strip);
  await page.evaluate(async id => NX.Community.openGamePage(await NX.Games.get(id)), pub);
  await page.locator('.rmx-credit').waitFor();
  assert.match(await page.locator('.rmx-credit').textContent(), /Race City/);
  await page.evaluate(() => NX.Sheet.closeAll());
});

/* ================================================================ 🧩 mechanics */
test('6 · Mechanics: the car\'s (Mover with speed 7 + the bound Spin script) copied onto the box in one undo step; saved to the library as public', async () => {
  const { page } = S.omar;
  const r = await page.evaluate(async () => {
    const eng = NX.Studio.engine, car = eng.findByName('Car'), box = eng.findByName('Box');
    eng.select(car.id);
    const items = NX.Mechanics.itemsOf(car);
    NX.Mechanics.copy(items, car.name);
    eng.select(box.id);
    NX.Mechanics.paste();
    const p = NX.Studio.project;
    return { items: items.map(i => i.kind + ':' + (i.type || i.name)), box: box.components.map(c => c.type + ':' + c.data.speed), boxScripts: p.files.filter(f => f.entityId === box.id).map(f => f.code), undo: NX.Studio.undoStack.length };
  });
  assert.deepEqual(r.items, ['component:Mover', 'script:Spin']);
  assert.deepEqual(r.box, ['Mover:7']); assert.deepEqual(r.boxScripts, [SPIN]);
  assert.ok(r.undo >= 1);
  /* the object's menu shows its mechanics */
  await page.evaluate(() => NX.Mechanics.open());
  await page.locator('.sheet .mech-row').first().waitFor();
  assert.ok(await page.locator('.sheet .mech-copy').count() === 1);
  await page.evaluate(() => NX.Sheet.closeAll());
  S.mech = await page.evaluate(async () => { const car = NX.Studio.engine.findByName('Car'); const it = NX.Mechanics.itemsOf(car).find(i => i.type === 'Mover'); return (await NX.Mechanics.save(it, { name: 'Mover', description: 'moves along x', visibility: 'public' })).mechId; });
  const m = await fsGet('mechanics/' + S.mech);
  assert.equal(m.visibility, 'public'); assert.equal(m.source, 'human'); assert.equal(m.code, MOVER);
});

test('7 · Lina adds Omar\'s public mechanic to her own object: the component file and its settings arrive, +1 use; she cannot rewrite his', async () => {
  const { page } = S.lina;
  const r = await page.evaluate(async id => {
    const lib = await NX.Mechanics.library('public');
    const m = lib.find(x => x.mechId === id);
    const eng = NX.Studio.engine, box = eng.findByName('Box');
    eng.select(box.id);
    await NX.Mechanics.insert(m, [box]);
    const { F, db } = NX.Backend.fb;
    let over = 'ok';
    try { await F.updateDoc(F.doc(db, 'mechanics', id), { code: 'hacked' }); } catch (e) { over = e.code; }
    return { found: !!m, comps: box.components.map(c => c.type + ':' + c.data.speed), over };
  }, S.mech);
  assert.ok(r.found); assert.deepEqual(r.comps, ['Mover:7']); assert.ok(denied(r.over));
  await new Promise(r => setTimeout(r, 800));
  assert.equal((await fsGet('mechanics/' + S.mech)).uses, 1);
});

/* ================================================================ 🧪 NEXUS Learner (Beta) */
test('8 · The Learner learns from an answer with code (keys and e-mails removed) — then, every model exhausted, it answers from it and says so', async () => {
  const { page } = S.omar;
  await page.evaluate(async id => { const p = await NX.Projects.get(id); await NX.Studio.open(p); NX.Sheet.closeAll(); NX.Studio.engine.select(null); NX.AIConfig.setActive('nexus'); NX.Council.setMode('single'); NX.Studio.openAI(); NX.AIPanel.setMode('chat'); }, S.remixId);
  await page.evaluate(() => NX.Chat.send('FUEL_LESSON: ما الفرق بين let و const في جافاسكربت؟ مفتاحي sk-ABCDEFGHIJKLMNOPQRSTUV و omar@test.io'));
  await until(page, () => !NX.Chat.streaming, null, 60000);
  await new Promise(r => setTimeout(r, 1200));
  let c = null; const seen = [];
  for (let i = 0; i < 12 && !c; i++) { const d = await fsGet('learner/' + S.omarUid + '_' + i); if (d) seen.push(d.kind); if (d && d.kind === 'answer') c = d; }
  assert.ok(c, 'learnt — cases: ' + seen.join(',') + ' · answer: ' + (await page.evaluate(() => { const c = NX.Chat.ensure(); return JSON.stringify(c.messages.slice(-1)[0]).slice(0, 400); }))); assert.equal(c.source, 'ai'); assert.match(c.text, /FUEL_LESSON/);
  assert.ok(!c.prompt.includes('sk-ABCDEFGH') && !c.prompt.includes('omar@test.io'), c.prompt);
  assert.ok(c.tokens.includes('const') && c.tokens.includes('let'), c.tokens.join(','));
  /* every model exhausted */
  Object.values(KEYS).forEach(k => { W.keys[k] = '429'; });
  await page.evaluate(() => NX.Chat.send('ما الفرق بين let و const؟'));
  await until(page, () => !NX.Chat.streaming, null, 90000);
  const a = await page.evaluate(() => { const c = NX.Chat.ensure(); return String(c.messages[c.messages.length - 1].content); });
  assert.match(a, /NEXUS Learner \(Beta\)/); assert.match(a, /FUEL_LESSON/);
});

test('9 · Nothing learnt for this: the Learner looks it up on Wikipedia (in the player\'s language) — and a stranger cannot inflate a lesson\'s score', async () => {
  const { page } = S.omar;
  await page.context().route(/wikipedia\.org\/w\/api\.php/, route => {
    const u = new URL(route.request().url());
    const body = u.searchParams.get('list') === 'search' ? { query: { search: [{ title: 'Pathfinding' }] } } : { query: { pages: { 1: { title: 'Pathfinding', extract: 'Pathfinding is the plotting of the shortest route between two points.' } } } };
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  });
  await page.evaluate(() => NX.Chat.send('ما هي خوارزمية المسار الأقصر في المتاهة؟'));
  await until(page, () => !NX.Chat.streaming, null, 90000);
  const a = await page.evaluate(() => { const c = NX.Chat.ensure(); return String(c.messages[c.messages.length - 1].content); });
  assert.match(a, /NEXUS Learner \(Beta\)/); assert.match(a, /Pathfinding is the plotting/);
  Object.values(KEYS).forEach(k => { delete W.keys[k]; });
  const bump = await S.lina.page.evaluate(async id => { const { F, db } = NX.Backend.fb; try { await F.updateDoc(F.doc(db, 'learner', id), { ok: 9 }); return 'ok'; } catch (e) { return e.code; } }, S.omarUid + '_0');
  assert.ok(denied(bump), 'only +1 at a time: ' + bump);
});

/* ================================================================ 🤝 a key of any site, the server off */
test('10 · A reseller key with its Base URL while the site\'s server is off: «🔗 Any site» — kept in the pool; tested for real once the server answers', async () => {
  const { page } = S.omar;
  /* the reseller as the browser sees it (its /models answers this page) */
  await page.route('https://reseller.test/**', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }] }) }));
  await page.route('**/api/ai/pool/donate', route => route.fulfill({ status: 404, contentType: 'text/html', body: '<h1>Not found</h1>' }));
  await page.evaluate(() => NX.KeyPool.open());
  await page.locator('.sheet .kp-mode button[data-m="site"]').click();
  await page.fill('.sheet .kp-base', 'reseller.test/v1/');
  await page.fill('.sheet .kp input[type=password]', 'sk-reseller-OFFLINE00000000000000001');
  await page.check('#kp-agree');
  await page.locator('.sheet .btn', { hasText: 'تبرّع بالمفتاح' }).click();
  await until(page, () => [...document.querySelectorAll('.toast')].some(t => /المجمّع/.test(t.textContent)), null, 30000);
  await page.unroute('**/api/ai/pool/donate');
  const k = await fsGet('api_keys/' + S.omarUid + '_0');
  assert.equal(k.provider, 'custom'); assert.equal(k.base, 'https://reseller.test/v1', 'https added, the trailing / removed'); assert.deepEqual(k.models, ['gpt-4o', 'gpt-4o-mini']);
  assert.ok(k.tier === undefined || k.tier === 'failed', 'no tier without a real answer: ' + k.tier);
  /* the server runs again (here the reseller lives on this machine): it tests the key and gives the tier */
  W.lists.reseller = ['gpt-4o', 'gpt-4o-mini'];
  await fsSet('api_keys/' + S.omarUid + '_0', { base: W.base + '/reseller/v1' });
  await page.evaluate(() => NX.KeyPool.verify());
  await new Promise(r => setTimeout(r, 1500));
  const k2 = await fsGet('api_keys/' + S.omarUid + '_0');
  assert.equal(k2.tier, 'strong', JSON.stringify(k2)); assert.equal(k2.testedModel, 'gpt-4o');
  assert.equal((await fsGet('donors/' + S.omarUid)).tier, 'strong');
  /* a key that the server cannot get an answer from: «failed», never used, no tier */
  await fsSet('api_keys/' + S.omarUid + '_1', { key: 'sk-reseller-BROKEN000000000000000001', provider: 'custom', base: 'https://reseller.invalid/v1', models: ['gpt-4o'], status: 'active', failCount: 0, donorUid: S.omarUid, keyHash: 'x' });
  await page.evaluate(() => NX.KeyPool.verify());
  await new Promise(r => setTimeout(r, 1500));
  assert.equal((await fsGet('api_keys/' + S.omarUid + '_1')).tier, 'failed');
});

await run(tests, logs, async () => { await browser.close(); await site.close(); await W.close(); });
