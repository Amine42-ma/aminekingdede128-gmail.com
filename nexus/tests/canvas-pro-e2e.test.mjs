/* ============================================================
   NEXUS tests · 🎯 Canvas pro — the 3D viewport, in a real browser
   (Chromium), with the Firebase emulators and the real rules:
   • a glowing outline around what is selected (a box for a light) and a
     quick bar beside it: ✎ Code · ⤢ Size · 🗄 Save to my files ·
     ⧉ Duplicate · 🗑 Delete — never saved with the scene;
   • ⤢ Size: X, Y, Z on their own or together (proportions kept), its real
     size, ONE undo step; the assistant does it too (SCALE_OBJECT [x,y,z],
     ROTATE_OBJECT [x,y,z] in degrees);
   • ⧉ Duplicate: an exact copy — physics, components, and its own copy of
     the script bound to it (one undo step takes both away);
   • 🗄 My vault: the object with its physics, components, bound script and
     the code of its components in vault/{id} — nobody else can read it,
     list it or write it; back in another project by a tap (the middle of
     the view) or dragged onto the scene with a mouse or a finger — it
     stands where it is let go;
   • taps: two on the ground = the selected object goes there (on a ramp =
     on the ramp); two on the object itself = the camera comes to it; one
     on nothing = deselect a moment later; four = the object's code in a
     quick editor — by hand, or changed by NEXUS AI; a new script when it
     has none;
   • in Hindi: no Arabic left in the quick bar or the size panel.
   Run:  node nexus/tests/canvas-pro-e2e.test.mjs
   ============================================================ */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startWorld } from './mock-world.mjs';
import { startSite } from './e2e-server.mjs';
import { e2eReply } from './fake-models.mjs';
import { chromium, resetEmulators, newDevice, signUp, signIn, until, run, fsGet, fsQuery } from './e2e-kit.mjs';

const W = await startWorld();
const KEYS = { gem: 'AIzaGEMINI_TEST_KEY_000000000000000001', groq: 'gsk_GROQTESTKEY0000000000000001', or: 'sk-or-v1-OPENROUTERTESTKEY000000001' };
const AI_EDIT = '// CarDrive — faster\nfunction update(dt) { if (self) self.position.z += 9 * dt; } // AI_EDITED\n';
W.reply = c => /You edit ONE script of a NEXUS game/.test(c.system + '\n' + c.lastUser)
  ? 'Here it is:\n```js\n' + AI_EDIT + '```\nThe car is three times faster now.' : e2eReply(c);
const env = { FIREBASE_PROJECT_ID: 'demo-nexus', NEXUS_TEST_EMULATOR_TOKENS: '1', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', AI_PER_MINUTE: '500', PRO_AI_PER_DAY: '500', AI_FREE_PER_DAY: '50',
  GEMINI_BASE: W.base + '/gemini', GROQ_BASE: W.base + '/groq', OPENROUTER_BASE: W.base + '/openrouter', ANTHROPIC_BASE: W.base + '/anthropic',
  GEMINI_KEYS: KEYS.gem, GROQ_KEYS: KEYS.groq, OPENROUTER_KEYS: KEYS.or, POOL_CACHE_MS: '0' };
await resetEmulators();
const HTML = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8').replace('window.NEXUS_FILES = "drive";', 'window.NEXUS_FILES = "firebase";');
const site = await startSite({ env, files: { '/index.html': HTML } });
const browser = await chromium.launch();
const logs = [];
const tests = [];
const test = (name, f) => tests.push({ name, f });
const S = {};
const DRIVE = '// CarDrive — drives the car\nfunction update(dt) { if (self) self.position.z += 3 * dt; }\n';
const BOB = '// Bobber — floats up and down\nfunction update(dt) { }\n';
const denied = r => /permission|PERMISSION_DENIED|insufficient/i.test(String(r));
const near = (a, b, tol, what) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) <= tol, (what || '') + ' [' + a.map(x => x.toFixed(3)) + '] ≠ [' + b + ']'));
const ARABIC = /[؀-ۿ]/;

/* ---------------- in the page ---------------- */
/* a new project, the Studio open on it, the camera where the test expects it */
async function studio(page, name) {
  await page.evaluate(n => NX.Platform.createProject(n), name);
  await until(page, n => NX.Screen.current() === 'studio' && NX.Studio.project && NX.Studio.project.name === n && NX.Studio.engine && NX.Studio.engine.__canvasPro, name);
  await page.evaluate(() => { NX.Sheet.closeAll(); view(); });
}
const VIEW = () => {
  window.view = () => { const o = NX.Studio.engine.orbit; o.target.set(0, 0, 0); o.radius = 13; o.theta = 0; o.phi = Math.PI * 0.32; o.apply(); NX.Studio.engine.editorCam.updateMatrixWorld(true); };
  /* a world point → where it is on the screen */
  window.scr = p => { const eng = NX.Studio.engine, r = eng.canvas.getBoundingClientRect(); eng.activeCamera.updateMatrixWorld(true); const v = new NX.THREE.Vector3(p[0], p[1], p[2]).project(eng.activeCamera); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; };
  window.onCanvas = ([x, y]) => document.elementFromPoint(x, y) === NX.Studio.engine.canvas;
  /* where an object stands: the bottom middle of its box */
  window.foot = id => { const b = new NX.THREE.Box3().setFromObject(NX.Studio.engine.getEntity(id).object3D), c = b.getCenter(new NX.THREE.Vector3()); return [c.x, b.min.y, c.z]; };
  window.ent = name => NX.Studio.engine.findByName(name);
};
async function screenOf(page, p) {
  await until(page, () => !document.querySelector('#sheet-root .scrim, #modal-root .scrim'), null, 5000);   // (a sheet that just closed fades out)
  const xy = await page.evaluate(p => scr(p), p);
  const at = await page.evaluate(xy => { if (onCanvas(xy)) return ''; const h = document.elementFromPoint(xy[0], xy[1]); return h ? h.tagName + '#' + h.id + '.' + h.className + ' ' + (h.textContent || '').slice(0, 60) : 'nothing'; }, xy);
  assert.equal(at, '', 'the point ' + p + ' is on the scene, not under a bar: ' + xy);
  return xy;
}
async function taps(page, [x, y], n, gap = 70) {
  for (let i = 0; i < n; i++) { await page.mouse.click(x, y); if (i < n - 1) await page.waitForTimeout(gap); }
}
const lastUndo = page => page.evaluate(() => (NX.Studio.peekUndo() || {}).label || '');
const undo = page => page.evaluate(() => NX.Studio.undo());
const barIn = page => page.evaluate(() => { const b = document.getElementById('qk-bar'); return !!(b && b.classList.contains('in')); });

/* ================================================================ outline + the quick bar */
test('1 · Sara selects her car: a glowing outline around it, the quick bar beside it (Code · Size · Save · Duplicate · Delete); a light keeps a box; nothing is saved with the scene', async () => {
  const { page } = S.sara = await newDevice(browser, site, logs);
  S.saraUid = await signUp(page, 'sara@test.io');
  await page.evaluate(VIEW);
  await studio(page, 'Canvas Lab');
  S.carId = await page.evaluate(async ([DRIVE, BOB]) => {
    const st = NX.Studio;
    const r = await NX.EditorOps.create({ name: 'Car', type: 'primitive', position: [2, 0.5, 0], props: { shape: 'box', color: '#ff2020', metalness: 0.3 },
      components: [{ id: 'k1', type: 'Rigidbody', name: 'Rigidbody', data: { type: 'dynamic', mass: 3 }, enabled: true }, { id: 'k2', type: 'Bobber', name: 'Bobber', data: { amp: 0.3 }, enabled: true }] });
    st.project.files.push({ id: 'f1', path: 'CarDrive.js', code: DRIVE, role: 'script', entityId: r.entity.id, enabled: true },
      { id: 'f2', path: 'Bobber.js', code: BOB, role: 'component', entityId: null, enabled: true });
    NX.Studio.engine.select(null);
    view();
    return r.entity.id;
  }, [DRIVE, BOB]);
  /* a tap on the car selects it */
  const xy = await screenOf(page, await page.evaluate(id => { const f = foot(id); return [f[0], f[1] + 0.5, f[2]]; }, S.carId));
  await page.mouse.click(xy[0], xy[1]);
  await until(page, id => NX.Studio.engine.selection === id, S.carId, 5000);
  await until(page, () => document.getElementById('qk-bar').classList.contains('in'), null, 5000);
  const r = await page.evaluate(() => {
    const eng = NX.Studio.engine, car = eng.getEntity(eng.selection), bar = document.getElementById('qk-bar'), br = bar.getBoundingClientRect(), cr = eng.canvas.getBoundingClientRect();
    const glow = eng.outlineGlow.parts.map(o => [o.userData.src === car.object3D, o.parent.parent === eng.helpers]);
    let within = 0; car.object3D.traverse(n => { if (n.userData && n.userData.nxOutline) within++; });
    const top = scr([car.object3D.position.x, 1, car.object3D.position.z]);
    return { glow, within, box: eng.selBox.visible, keys: [...bar.querySelectorAll('[data-qk]')].map(b => b.dataset.qk), labels: [...bar.querySelectorAll('small')].map(s => s.textContent),
      inside: br.left >= cr.left - 1 && br.right <= cr.right + 1 && br.top >= cr.top - 1, above: br.bottom <= top[1] + 2, T: ['QB_CODE', 'QB_SIZE', 'QB_VAULT', 'QB_DUP', 'QB_DEL'].map(k => NX.T(k)) };
  });
  assert.deepEqual(r.glow, [[true, true]], 'one outline around the car, in the helpers\' layer');
  assert.equal(r.within, 0, 'nothing added inside the object itself');
  assert.equal(r.box, false, 'the outline instead of the box');
  assert.deepEqual(r.keys, ['QB_CODE', 'QB_SIZE', 'QB_VAULT', 'QB_DUP', 'QB_DEL']);
  assert.deepEqual(r.labels, r.T); assert.ok(r.labels.every(l => ARABIC.test(l)), r.labels.join(' | '));
  assert.ok(r.inside, 'the bar stays on the scene'); assert.ok(r.above, 'the bar sits above the car');
  /* a light has no shape: a box around it */
  const l = await page.evaluate(() => { const eng = NX.Studio.engine; eng.select('sun'); return { glow: eng.outlineGlow.parts.length, box: eng.selBox.visible }; });
  assert.deepEqual(l, { glow: 0, box: true });
  /* the outline follows the view settings; none when nothing is selected; never saved */
  const v = await page.evaluate(async id => {
    const eng = NX.Studio.engine, count = () => eng.outlineGlow.parts.length;
    eng.select(id);
    const on = count();
    /* recoloured while selected (the assistant, the inspector…): the glow keeps its own colour */
    await NX.GameOps.run('SET_PROPERTY', { name: 'Car', key: 'color', value: '#00ff00' });
    const kept = eng.outlineGlow.parts[0].material.color.getHex() === 0xb49bff && eng.getEntity(id).object3D.material.color.getHex() === 0x00ff00;
    await NX.GameOps.run('SET_PROPERTY', { name: 'Car', key: 'color', value: '#ff2020' });
    eng.applyView({ outline: false }); const off = count();
    eng.applyView({ outline: true }); const back = count();
    const saved = JSON.stringify(eng.serialize());
    eng.select(null); await new Promise(r => setTimeout(r, 200));
    return { on, kept, off, back, saved: saved.includes('__outline') || saved.includes('nxOutline'), none: count(), bar: document.getElementById('qk-bar').classList.contains('in') };
  }, S.carId);
  assert.deepEqual(v, { on: 1, kept: true, off: 0, back: 1, saved: false, none: 0, bar: false });
});

test('2 · A long press (here a right click) on the car: its menu opens with the same five — Code · Size · Save to my files · Duplicate · Delete', async () => {
  const { page } = S.sara;
  const xy = await page.evaluate(id => { NX.Studio.engine.select(null); view(); const f = foot(id); return scr([f[0], f[1] + 0.5, f[2]]); }, S.carId);
  await page.mouse.click(xy[0], xy[1], { button: 'right' });
  await page.locator('#sheet-root .sheet.in .ed-tile').first().waitFor({ timeout: 5000 });
  const r = await page.evaluate(() => ({ five: [...document.querySelectorAll('#sheet-root .sheet.in .ed-tile small')].slice(0, 5).map(s => s.textContent),
    T: [NX.T('QB_CODE'), NX.T('SZ_TITLE'), NX.T('VAULT_SAVE')], title: document.querySelector('#sheet-root .sheet.in h3').textContent }));
  assert.deepEqual(r.five, r.T.concat(['تكرار', 'حذف'])); assert.equal(r.title, 'Car');
  /* ✎ from the menu: the car's code */
  await page.locator('#sheet-root .sheet.in .cp-code-tile').click();
  await page.locator('.sheet .qc-ed textarea').waitFor({ timeout: 5000 });
  assert.equal(await page.locator('.sheet .qc-ed textarea').inputValue(), DRIVE);
  await page.evaluate(() => NX.Sheet.closeAll());
});

/* ================================================================ ⤢ size */
test('3 · ⤢ Size from the quick bar: X alone (proportions unlocked) → [2,1,1]; locked, Y = 3 → all three ×3; its real size in metres; ONE undo step takes it back', async () => {
  const { page } = S.sara;
  await page.evaluate(id => NX.Studio.engine.select(id), S.carId);
  await until(page, () => document.getElementById('qk-bar').classList.contains('in'), null, 5000);
  const undos = await page.evaluate(() => NX.Studio.undoStack.length);
  await page.locator('#qk-bar [data-qk="QB_SIZE"]').click();
  await page.locator('.sheet .sz-in[data-axis="x"]').waitFor();
  assert.equal(await page.evaluate(() => NX.Studio.engine.gizmo), 'scale', 'the scale handles on the object');
  if (await page.locator('.sheet [data-lock]').evaluate(n => n.classList.contains('on'))) await page.locator('.sheet [data-lock]').click();
  await page.fill('.sheet .sz-in[data-axis="x"]', '2');
  await page.locator('.sheet .sz-in[data-axis="x"]').dispatchEvent('change');
  near(await page.evaluate(id => NX.Studio.engine.getEntity(id).object3D.scale.toArray(), S.carId), [2, 1, 1], 1e-6, 'X alone');
  await page.locator('.sheet [data-lock]').click();
  await page.fill('.sheet .sz-in[data-axis="y"]', '3');
  await page.locator('.sheet .sz-in[data-axis="y"]').dispatchEvent('change');
  near(await page.evaluate(id => NX.Studio.engine.getEntity(id).object3D.scale.toArray(), S.carId), [6, 3, 3], 1e-6, 'proportions kept');
  const dims = await page.locator('.sheet .sz-dims').textContent();
  assert.ok(dims.includes('6.00') && dims.includes('3.00'), dims);
  assert.equal(await page.locator('.sheet .sz-in[data-axis="z"]').inputValue(), '3');
  await page.evaluate(() => NX.Sheet.closeAll());
  await until(page, n => NX.Studio.undoStack.length === n + 1, undos, 5000);
  assert.match(await lastUndo(page), /Car/);
  await undo(page);
  near(await page.evaluate(id => NX.Studio.engine.getEntity(id).object3D.scale.toArray(), S.carId), [1, 1, 1], 1e-6, 'undone');
});

test('4 · The assistant sizes and turns each axis on its own: SCALE_OBJECT [2, 1, 0.5], ROTATE_OBJECT [0, 90, 0] degrees — a zero size is refused', async () => {
  const { page } = S.sara;
  const r = await page.evaluate(async () => {
    const MA = NX.ModelActions;
    const good = await MA.check([{ op: 'SCALE_OBJECT', object: 'Car', scale: [2, 1, 0.5] }, { op: 'ROTATE_OBJECT', object: 'Car', rotation: [0, 90, 0] }]);
    const bad = await MA.check([{ op: 'SCALE_OBJECT', object: 'Car', scale: [0, 1, 1] }, { op: 'SCALE_OBJECT', object: 'Car', scale: [1, 'x', 1] }]);
    const ui = new Proxy({}, { get: () => () => {} });
    await MA.execute({ ops: good.ok, text: 'wider, flatter, turned', ui });
    const o = ent('Car').object3D;
    const out = { ok: good.ok.length, bad: bad.ok.length, badWhy: bad.bad, scale: o.scale.toArray(), rot: [o.rotation.x, o.rotation.y, o.rotation.z], said: good.ok.map(x => MA.describe(x)) };
    await NX.Studio.undo();
    const o2 = ent('Car').object3D;             // (a whole-scene step: the scene is loaded again)
    out.after = o2.scale.toArray().concat([o2.rotation.y]);
    return out;
  });
  assert.equal(r.ok, 2); assert.equal(r.bad, 0, r.badWhy.join(' | '));
  near(r.scale, [2, 1, 0.5], 1e-6, 'per axis'); near(r.rot, [0, Math.PI / 2, 0], 1e-6, 'degrees → radians');
  assert.match(r.said[0], /X 2 · Y 1 · Z 0.5/); assert.match(r.said[1], /90°/);
  near(r.after, [1, 1, 1, 0], 1e-6, 'one undo step');
});

/* ================================================================ ⧉ duplicate */
test('5 · ⧉ Duplicate: an exact copy — the same shape, colour, physics and components, and its own CarDrive_2.js bound to it; one undo step removes both', async () => {
  const { page } = S.sara;
  await page.evaluate(id => NX.Studio.engine.select(id), S.carId);
  await until(page, () => document.getElementById('qk-bar').classList.contains('in'), null, 5000);
  await page.locator('#qk-bar [data-qk="QB_DUP"]').click();
  await until(page, id => NX.Studio.engine.selection && NX.Studio.engine.selection !== id, S.carId, 5000);
  const r = await page.evaluate(id => {
    const eng = NX.Studio.engine, a = eng.getEntity(id), b = eng.getEntity(eng.selection), files = NX.Studio.project.files;
    return { name: b.name, props: [a.props, b.props].map(p => JSON.stringify(p)), comps: [a, b].map(e => JSON.stringify(e.components.map(c => [c.type, c.data]))),
      script: files.filter(f => f.entityId === b.id).map(f => [f.path, f.code, f.role]), total: files.length, copyId: b.id, x: [a.object3D.position.x, b.object3D.position.x] };
  }, S.carId);
  assert.match(r.name, /^Car/); assert.equal(r.props[0], r.props[1]); assert.equal(r.comps[0], r.comps[1]);
  assert.match(r.comps[1], /Rigidbody.*dynamic.*mass":3.*Bobber.*amp":0.3/);
  assert.deepEqual(r.script, [['CarDrive_2.js', DRIVE, 'script']]);
  assert.notEqual(r.x[0], r.x[1], 'beside the original');
  assert.equal(r.total, 3);
  await undo(page);
  const after = await page.evaluate(id => ({ gone: !NX.Studio.engine.getEntity(id), files: NX.Studio.project.files.map(f => f.path) }), r.copyId);
  assert.deepEqual(after, { gone: true, files: ['CarDrive.js', 'Bobber.js'] });
});

/* ================================================================ 🗄 my vault */
test('6 · 🗄 Save to my files: a name, what goes with it (1 object · 1 script · 1 component) → vault/{id}: the shape, physics, components, the script\'s code, the component\'s code, a picture', async () => {
  const { page } = S.sara;
  await page.evaluate(id => NX.Studio.engine.select(id), S.carId);
  await until(page, () => document.getElementById('qk-bar').classList.contains('in'), null, 5000);
  await page.locator('#qk-bar [data-qk="QB_VAULT"]').click();
  const inp = page.locator('.modal .vt-save input');
  await inp.waitFor();
  assert.equal(await inp.inputValue(), 'Car');
  const counts = await page.locator('.modal .vt-counts').textContent();
  assert.equal(counts, await page.evaluate(() => NX.T('VAULT_COUNTS', { o: 1, s: 1, c: 1 })));
  await inp.fill('Red Car');
  await page.locator('.modal .btn.primary').click();
  await until(page, () => [...document.querySelectorAll('.toast')].some(t => /Red Car/.test(t.textContent)), null, 20000);
  const docs = await fsQuery('vault', 'ownerId', S.saraUid);
  assert.equal(docs.length, 1);
  S.vaultId = docs[0].name.split('/').pop();
  const v = await fsGet('vault/' + S.vaultId);
  assert.equal(v.name, 'Red Car'); assert.equal(v.vaultId, S.vaultId); assert.equal(v.uses, 0); assert.equal(v.v, 1);
  assert.deepEqual(v.counts, { objects: 1, scripts: 1, components: 1 });
  const scene = JSON.parse(v.scene);
  assert.equal(scene.entities.length, 1); assert.deepEqual(scene.roots, ['n0']);
  const e = scene.entities[0];
  assert.equal(e.props.shape, 'box'); assert.equal(e.props.color, '#ff2020');
  assert.deepEqual(e.components.map(c => [c.type, c.data]), [['Rigidbody', { type: 'dynamic', mass: 3 }], ['Bobber', { amp: 0.3 }]]);
  near(e.position, [0, 0.5, 0], 1e-3, 'kept relative to where it stands');
  assert.deepEqual(v.scripts, [{ path: 'CarDrive.js', code: DRIVE, role: 'script', entity: 'n0', enabled: true }]);
  assert.deepEqual(v.components, [{ type: 'Bobber', path: 'Bobber.js', code: BOB }]);
  near(v.size, [1, 1, 1], 1e-3, 'its size');
  assert.match(v.thumb || '', /^data:image\/jpeg;base64,/);
});

test('7 · The vault is private: Omar cannot read Sara\'s object, list her vault, write one in her name or delete hers; his own vault is empty — even on a page where Sara was signed in before', async () => {
  const { page } = S.omar = await newDevice(browser, site, logs);
  /* the same page, Sara first then Omar: what was read for her is not shown to him */
  await signIn(page, 'sara@test.io');
  assert.equal(await page.evaluate(async () => (await NX.CanvasPro.Vault.list()).length), 1);
  S.omarUid = await signUp(page, 'omar@test.io');
  assert.equal(await page.evaluate(async () => (await NX.CanvasPro.Vault.list()).length), 0, 'another account: its own vault, read again');
  const r = await page.evaluate(async ([id, owner]) => {
    const { F, db } = NX.Backend.fb, out = {};
    const tryIt = async (k, f) => { try { await f(); out[k] = 'ok'; } catch (e) { out[k] = e.code || String(e); } };
    await tryIt('get', () => F.getDoc(F.doc(db, 'vault', id)));
    await tryIt('list', () => F.getDocs(F.query(F.collection(db, 'vault'), F.where('ownerId', '==', owner))));
    const now = Date.now();
    await tryIt('create', () => F.setDoc(F.doc(db, 'vault', 'fake1'), { vaultId: 'fake1', ownerId: owner, name: 'x', note: '', scene: '{"roots":[]}', scripts: [], components: [], assetRefs: [], size: [1, 1, 1], counts: {}, uses: 0, v: 1, createdAt: now, updatedAt: now }));
    await tryIt('update', () => F.updateDoc(F.doc(db, 'vault', id), { name: 'mine now', updatedAt: now }));
    await tryIt('del', () => F.deleteDoc(F.doc(db, 'vault', id)));
    out.mine = (await NX.CanvasPro.Vault.list(true)).length;
    return out;
  }, [S.vaultId, S.saraUid]);
  ['get', 'list', 'create', 'update', 'del'].forEach(k => assert.ok(denied(r[k]), k + ': ' + r[k]));
  assert.equal(r.mine, 0);
  assert.equal((await fsGet('vault/' + S.vaultId)).name, 'Red Car', 'untouched');
});

test('8 · In another project: «➕ Create» shows her vault — a tap puts «Red Car» in the middle of the view with its physics, components, script and component code; one undo step takes it all away', async () => {
  const { page } = S.sara;
  await studio(page, 'Second Game');
  await page.evaluate(() => NX.EditorUI.openCreate());
  const tile = page.locator('.sheet .vt-tile[data-vault="' + S.vaultId + '"]');
  await tile.waitFor({ timeout: 20000 });
  assert.match(await tile.textContent(), /Red Car/);
  assert.ok(await tile.locator('img').count(), 'with its picture');
  const centre = await page.evaluate(() => NX.CanvasPro.Canvas.centre().toArray());
  await tile.click();
  await until(page, () => !!ent('Car'), null, 20000);
  const r = await page.evaluate(() => {
    const eng = NX.Studio.engine, car = ent('Car'), files = NX.Studio.project.files;
    return { sel: eng.selection === car.id, comps: car.components.map(c => [c.type, c.data]), props: car.props.color, foot: foot(car.id),
      files: files.map(f => [f.path, f.role, f.entityId === car.id, f.code]), sheet: !!document.querySelector('#sheet-root .sheet.in') };
  });
  assert.ok(r.sel, 'selected'); assert.equal(r.props, '#ff2020'); assert.equal(r.sheet, false, 'the sheet closed');
  assert.deepEqual(r.comps, [['Rigidbody', { type: 'dynamic', mass: 3 }], ['Bobber', { amp: 0.3 }]]);
  near(r.foot, centre, 0.05, 'in the middle of the view');
  assert.deepEqual(r.files, [['CarDrive.js', 'script', true, DRIVE], ['Bobber.js', 'component', false, BOB]]);
  assert.match(await lastUndo(page), /Red Car/);
  await undo(page);
  assert.deepEqual(await page.evaluate(() => ({ car: !!ent('Car'), files: NX.Studio.project.files.length })), { car: false, files: 0 });
  await new Promise(r => setTimeout(r, 800));
  assert.equal((await fsGet('vault/' + S.vaultId)).uses, 1, '+1 use');
});

test('9 · Dragged with the mouse from «➕ Create» onto the scene: it lands standing where it was let go', async () => {
  const { page } = S.sara;
  const target = [-3, 0, 2];
  const to = await screenOf(page, target);
  await page.evaluate(() => NX.EditorUI.openCreate());
  const tile = page.locator('.sheet .vt-tile[data-vault="' + S.vaultId + '"]');
  await tile.waitFor({ timeout: 20000 });
  await tile.hover();                              // (once the sheet has finished sliding in)
  const b = await tile.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(b.x + b.width / 2 + (to[0] - b.x - b.width / 2) * i / 12, b.y + b.height / 2 + (to[1] - b.y - b.height / 2) * i / 12);
  const over = await page.evaluate(to => { const h = document.elementFromPoint(to[0], to[1]); return { ok: document.body.classList.contains('vt-dragging') && document.querySelector('.vt-ghost.ok') !== null,
    why: document.body.className + ' | ghost ' + !!document.querySelector('.vt-ghost') + ' | at ' + (h && (h.tagName + '#' + h.id + '.' + h.className)) }; }, to);
  assert.ok(over.ok, 'the ghost over the scene: ' + over.why);
  await page.mouse.up();
  await until(page, () => !!ent('Car'), null, 20000);
  near(await page.evaluate(() => foot(ent('Car').id)), target, 0.08, 'where it was let go');
  assert.equal(await page.evaluate(() => document.body.classList.contains('vt-dragging') || !!document.querySelector('.vt-ghost')), false, 'the ghost is gone');
  assert.equal(await page.evaluate(() => NX.Studio.project.files.filter(f => f.path === 'CarDrive.js').length), 1);
});

/* ================================================================ taps */
test('10 · Two quick taps on the ground: the selected car goes there (standing on it); on a ramp = on top of the ramp; on the car itself = the camera comes to it; one undo step each', async () => {
  const { page } = S.sara;
  const id = await page.evaluate(async () => {
    const r = await NX.EditorOps.create({ name: 'Ramp', type: 'primitive', position: [3, 0.5, -2], scale: [2, 1, 2], props: { shape: 'box', color: '#3050ff' } });
    view();
    const car = ent('Car'); NX.Studio.engine.select(car.id);
    return car.id;
  });
  S.car2 = id;
  const before = await page.evaluate(id => foot(id), id);
  /* on the ground */
  const g = [1, 0, 3];
  await taps(page, await screenOf(page, g), 2);
  assert.equal(await page.evaluate(id => NX.Studio.engine.selection, id), id, 'still selected between the taps');
  await until(page, g => { const f = foot(ent('Car').id); return Math.hypot(f[0] - g[0], f[2] - g[2]) < 0.1; }, g, 5000);
  near(await page.evaluate(id => foot(id), id), g, 0.08, 'on the ground where it was tapped');
  assert.ok([...await page.locator('.toast').allTextContents()].some(t => /Car/.test(t)), 'said');
  assert.match(await lastUndo(page), /Car/);
  /* on the ramp: on its top */
  const top = await page.evaluate(() => { const b = new NX.THREE.Box3().setFromObject(ent('Ramp').object3D); return [(b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2]; });
  await taps(page, await screenOf(page, top), 2);
  await until(page, y => Math.abs(foot(ent('Car').id)[1] - y) < 0.05, top[1], 5000);
  near(await page.evaluate(id => foot(id), id), top, 0.1, 'on the ramp');
  /* one undo step each */
  await undo(page);
  near(await page.evaluate(id => foot(id), id), g, 0.08, 'back on the ground');
  await undo(page);
  near(await page.evaluate(id => foot(id), id), before, 0.08, 'back where it was');
  /* on itself: the camera comes to it, the car stays */
  const onCar = await page.evaluate(id => { view(); const f = foot(id); return scr([f[0], f[1] + 0.5, f[2]]); }, id);
  await taps(page, onCar, 2);
  await until(page, id => { const t = NX.Studio.engine.orbit.target, f = foot(id); return Math.hypot(t.x - f[0], t.z - f[2]) < 0.05; }, id, 5000);
  near(await page.evaluate(id => foot(id), id), before, 0.08, 'the car did not move');
  assert.equal(await page.evaluate(id => NX.Studio.engine.selection === id, id), true);
});

test('11 · One tap on nothing: the selection stays a moment (it may be a double tap), then goes — a locked object never moves', async () => {
  const { page } = S.sara;
  await page.evaluate(id => { view(); NX.Studio.engine.select(id); }, S.car2);
  const empty = await screenOf(page, [-4, 0, -3]);
  await page.mouse.click(empty[0], empty[1]);
  assert.equal(await page.evaluate(id => NX.Studio.engine.selection === id, S.car2), true, 'not at once');
  await until(page, () => NX.Studio.engine.selection === null, null, 3000);
  /* locked: it stays, it says so */
  const before = await page.evaluate(id => { const e = NX.Studio.engine.getEntity(id); e.locked = true; NX.Studio.engine.select(id); return foot(id); }, S.car2);
  await taps(page, empty, 2);
  await page.waitForTimeout(700);
  near(await page.evaluate(id => foot(id), S.car2), before, 1e-6, 'locked');
  const said = await page.evaluate(() => NX.T('TAP_LOCKED', { name: 'Car' }));
  assert.ok((await page.locator('.toast').allTextContents()).some(t => t.includes(said)), 'said: ' + said);
  await page.evaluate(id => { NX.Studio.engine.getEntity(id).locked = false; }, S.car2);
});

test('12 · Four quick taps on the car: its code in a quick editor — its own script and its component (shared); saved by hand (one undo step); «🤖» changes it with NEXUS AI, saved only when she saves', async () => {
  const { page } = S.sara;
  await page.evaluate(() => { view(); NX.Studio.engine.select(null); });
  const onCar = await page.evaluate(id => { const f = foot(id); return scr([f[0], f[1] + 0.5, f[2]]); }, S.car2);
  await taps(page, onCar, 4, 60);
  await page.locator('#sheet-root .sheet.in .qc-ed textarea').waitFor({ timeout: 5000 });
  const r = await page.evaluate(() => ({ chips: [...document.querySelectorAll('.sheet .qc-chip')].map(c => c.textContent), on: (document.querySelector('.sheet .qc-chip.on') || {}).textContent,
    code: document.querySelector('.sheet .qc-ed textarea').value, sel: NX.Studio.engine.selection === ent('Car').id, title: document.querySelector('#sheet-root .sheet.in h3').textContent }));
  assert.deepEqual(r.chips, ['📜 CarDrive.js', '⚙ Bobber.js']); assert.equal(r.on, '📜 CarDrive.js');
  assert.equal(r.code, DRIVE); assert.ok(r.sel, 'the car is selected'); assert.match(r.title, /Car/);
  /* the component: shared with every object that uses it */
  await page.locator('.sheet .qc-chip', { hasText: 'Bobber.js' }).click();
  assert.equal(await page.locator('.sheet .qc-ed textarea').inputValue(), BOB);
  assert.equal(await page.locator('.sheet .qc-note').textContent(), await page.evaluate(() => NX.T('QC_SHARED', { n: 1 })));
  await page.locator('.sheet .qc-chip', { hasText: 'CarDrive.js' }).click();
  /* by hand */
  const edited = DRIVE.replace('3 * dt', '5 * dt');
  await page.locator('.sheet .qc-ed textarea').fill(edited);
  await page.locator('.sheet .qc-ed [aria-label="save"]').click();
  assert.equal(await page.evaluate(() => NX.Studio.project.files.find(f => f.path === 'CarDrive.js').code), edited);
  assert.match(await lastUndo(page), /CarDrive\.js/);
  /* NEXUS AI */
  await page.fill('.sheet .qc-ai input', 'make it three times faster');
  await page.locator('.sheet .qc-ai .btn').click();
  await until(page, () => /AI_EDITED/.test(document.querySelector('.sheet .qc-ed textarea').value), null, 30000);
  assert.equal(await page.locator('.sheet .qc-ed textarea').inputValue(), AI_EDIT);
  assert.equal(await page.evaluate(() => NX.Studio.project.files.find(f => f.path === 'CarDrive.js').code), edited, 'not saved before she saves');
  assert.match(await page.locator('.sheet .qc-out').textContent(), /three times faster/);
  await page.locator('.sheet .qc-ed [aria-label="save"]').click();
  assert.equal(await page.evaluate(() => NX.Studio.project.files.find(f => f.path === 'CarDrive.js').code), AI_EDIT);
  await undo(page);
  assert.equal(await page.evaluate(() => NX.Studio.project.files.find(f => f.path === 'CarDrive.js').code), edited, 'one undo step');
  await page.evaluate(() => NX.Sheet.closeAll());
});

test('13 · Four taps on the ramp (no code yet): «create its script» → Ramp.js bound to it, a starting template in the editor', async () => {
  const { page } = S.sara;
  await page.evaluate(() => { NX.Sheet.closeAll(); view(); NX.Studio.engine.select(null); });
  await page.waitForTimeout(400);
  const onRamp = await screenOf(page, await page.evaluate(() => { const b = new NX.THREE.Box3().setFromObject(ent('Ramp').object3D); return [(b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2]; }));
  await taps(page, onRamp, 4, 60);
  await page.locator('.sheet .qc-empty .btn').waitFor({ timeout: 5000 });
  await page.locator('.sheet .qc-empty .btn').click();
  await page.locator('.sheet .qc-ed textarea').waitFor();
  const r = await page.evaluate(() => { const ramp = ent('Ramp'), f = NX.Studio.project.files.find(x => x.entityId === ramp.id); return { f: f && [f.path, f.role], code: document.querySelector('.sheet .qc-ed textarea').value, same: f && f.code === document.querySelector('.sheet .qc-ed textarea').value }; });
  assert.deepEqual(r.f, ['Ramp.js', 'script']); assert.ok(r.same);
  assert.match(r.code, /function start\(\)[\s\S]*function update\(dt\)/); assert.match(r.code, /Ramp/);
  await page.evaluate(() => NX.Sheet.closeAll());
});

/* ================================================================ a finger */
test('14 · On a phone, with a finger: dragged up from «➕ Create» onto the scene — it lands where the finger lets go', async () => {
  const { page } = S.phone = await newDevice(browser, site, logs, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await signIn(page, 'sara@test.io');
  await page.evaluate(VIEW);
  await studio(page, 'Phone Game');
  const target = [0.5, 0, -1.5];
  const to = await screenOf(page, target);
  await page.evaluate(() => NX.EditorUI.openCreate());
  const tile = page.locator('.sheet .vt-tile[data-vault="' + S.vaultId + '"]');
  await tile.waitFor({ timeout: 20000 });
  await tile.scrollIntoViewIfNeeded();
  const b = await tile.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const x0 = b.x + b.width / 2, y0 = b.y + b.height / 2;
  await touch('touchStart', x0, y0);
  for (let i = 1; i <= 14; i++) { await touch('touchMove', x0 + (to[0] - x0) * i / 14, y0 + (to[1] - y0) * i / 14); await page.waitForTimeout(16); }
  await touch('touchEnd');
  await until(page, () => !!ent('Car'), null, 20000);
  near(await page.evaluate(() => foot(ent('Car').id)), target, 0.1, 'where the finger let go');
  assert.equal(await page.evaluate(() => NX.Studio.project.files.filter(f => f.path === 'CarDrive.js').length), 1);
});

/* ================================================================ Hindi */
test('15 · In Hindi: the quick bar and the size panel with no Arabic left', async () => {
  const { page } = S.sara;
  await page.evaluate(() => NX.setLanguage('hi'));
  await page.evaluate(id => { view(); NX.Studio.engine.select(id); }, S.car2);
  await until(page, () => document.getElementById('qk-bar').classList.contains('in'), null, 5000);
  const bar = await page.evaluate(() => ({ labels: [...document.querySelectorAll('#qk-bar small')].map(s => s.textContent), aria: [...document.querySelectorAll('#qk-bar [data-qk]')].map(b => b.getAttribute('aria-label')), T: NX.T('QB_CODE') }));
  assert.ok(bar.labels.every(l => l && !ARABIC.test(l)), bar.labels.join(' | ')); assert.ok(bar.aria.every(l => !ARABIC.test(l)), bar.aria.join(' | '));
  assert.equal(bar.labels[0], bar.T);
  await page.locator('#qk-bar [data-qk="QB_SIZE"]').click();
  await page.locator('.sheet .sz-in[data-axis="x"]').waitFor();
  await page.waitForTimeout(400);
  const txt = await page.evaluate(() => document.querySelector('#sheet-root .sheet.in').innerText);
  assert.ok(!ARABIC.test(txt), txt);
  await page.evaluate(() => NX.Sheet.closeAll());
  await page.evaluate(() => NX.setLanguage('ar'));
});

test('16 · No errors on any page', async () => {
  const bad = logs.filter(l => !/serviceWorker|service worker|ServiceWorker/i.test(l));
  assert.deepEqual(bad, []);
});

await run(tests, logs, async () => { await browser.close(); await site.close(); await W.close(); });
