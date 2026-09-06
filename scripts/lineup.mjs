/**
 * Species line-up: stand creatures side by side on flat ground and photograph
 * them from a fixed camera, so silhouettes can be compared across a change.
 *
 *   node scripts/lineup.mjs [outfile.png] [ids...]
 *
 * With no ids it shoots the quadrupeds, which are the ones that most need to
 * stop looking like the same animal at different sizes.
 */
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = pathToFileURL(path.join(ROOT, 'ark.html')).href;

const argv = process.argv.slice(2);
const OUT = argv[0] || path.join(ROOT, 'lineup.png');
const IDS = argv.slice(1);

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1500, height: 760 } });
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('ERR', m.text().slice(0, 200)); });

const frames = (n) => page.evaluate((k) => new Promise((r) => {
  let i = 0; const s = () => (++i >= k ? r() : requestAnimationFrame(s)); requestAnimationFrame(s);
}), n);

await page.goto(PAGE, { waitUntil: 'load', timeout: 60_000 });
await page.waitForFunction(() => window.__ark && window.__ark.Game.state === 'menu', null, { timeout: 60_000 });
await page.evaluate(() => { document.querySelector('#optSeed').value = '424242'; window.__ark.Game.startNew(); });
await page.waitForFunction(() => window.__ark.Game.state === 'play', null, { timeout: 180_000 });

/* 1. pick the stage and stand the player on it. Terrain chunks, flora and the
      ocean are all streamed around the PLAYER, so the camera cannot simply be
      teleported somewhere the player has never been — it would look out over
      ungenerated world, which renders as open sea. */
const view = await page.evaluate((ids) => {
  const { Gfx, Sky, Creatures, World, Player, SPECIES, Camera } = window.__ark;
  Gfx.applyQuality('high');
  Sky.time = 10; Sky.weather = 'clear'; Sky.cloud = Sky.targetCloud = .1;
  document.querySelector('#hud').classList.remove('on');
  document.querySelector('#fps').style.display = 'none';
  document.querySelector('#center-msg').style.display = 'none';
  /* An empty, safe stage. Without this the wild population keeps respawning
     while the world streams in, and the player gets eaten before the shot. */
  Creatures.budget = 0;
  for (const c of Creatures.list.slice()) c.remove();

  const list = ids.length ? ids
    : ['trike', 'stego', 'anky', 'bronto', 'parasaur', 'doedic', 'mammoth', 'theri'];
  let span = 0;
  for (const id of list) {
    const sp = SPECIES[id];
    if (sp) span += (sp.model.body[0] * (sp.scale || 1)) * 1.9 + 3;
  }

  let best = null;
  for (let i = 0; i < 6000; i++) {
    const x = (Math.random() - .5) * 1100, z = (Math.random() - .5) * 1100;
    const h = World.heightAt(x, z);
    if (h < 14 || h > 45) continue;
    let hmin = h, hmax = h, flat = true;
    /* check the ground the camera stands on too, not just the row itself */
    for (let j = -10; j <= span + 10 && flat; j += 5) {
      for (let k = 0; k <= span * .3 + 12; k += 6) {
        const hh = World.heightAt(x + j, z + k);
        if (hh < 18) { flat = false; break; }        // no water in frame
        hmin = Math.min(hmin, hh); hmax = Math.max(hmax, hh);
        if (hmax - hmin > 3.0) { flat = false; break; }
      }
    }
    if (flat) { best = { x, z, h }; break; }
  }
  if (!best) best = { x: 0, z: 0, h: World.heightAt(0, 0) };

  const cx = best.x + span / 2, dist = span * 0.19 + 5;
  Player.pos.set(cx, World.heightAt(cx, best.z + dist) + 2, best.z + dist);
  Camera.thirdPerson = false;
  return { list, span, cx, cz: best.z, x0: best.x, h: best.h, dist };
}, IDS);

/* stream the world in around the player, keeping the stage clear and the
   player alive while it happens */
await page.evaluate(() => new Promise((r) => {
  const { Creatures, Player, Game } = window.__ark;
  let i = 0;
  const s = () => {
    for (const c of Creatures.list.slice()) c.remove();
    Player.cur.health = Player.max('health');
    Player.cur.food = Player.max('food');
    Player.cur.water = Player.max('water');
    Player.alive = true;
    return ++i >= 30 ? r() : requestAnimationFrame(s);
  };
  requestAnimationFrame(s);
}));

/* 2. only now place the creatures, so none of them wanders off while the
      chunks are still loading */
const placed = await page.evaluate((v) => {
  const { Creatures, World, SPECIES, Player, Game } = window.__ark;
  const V = Object.getPrototypeOf(Player.pos).constructor;
  const out = [], missing = [];
  let cursor = 0;
  for (const id of v.list) {
    const sp = SPECIES[id];
    if (!sp) { missing.push(id); continue; }
    const w = (sp.model.body[0] * (sp.scale || 1)) * 1.9 + 3;
    cursor += w / 2;
    const x = v.x0 + cursor;
    const c = Creatures.spawn(id, 30, new V(x, World.heightAt(x, v.cz), v.cz));
    /* bodies are built along +X and the camera looks down -Z, so yaw 0 gives a
       side-on profile, which is what a silhouette comparison needs */
    if (c) { c.yaw = 0; if (c.root) c.root.rotation.y = 0; out.push(id); }
    cursor += w / 2;
  }
  Game.paused = true;                   // freeze before anything can walk away
  return { out, missing };
}, view);

console.log('line-up:', placed.out.join(', '));
if (placed.missing.length) console.log('unknown species:', placed.missing.join(', '));

/* 3. frame it, clear everything standing between camera and subject, hold */
await page.evaluate((v) => new Promise((r) => {
  const { Gfx, Flora, ViewModel } = window.__ark;
  const cam = Gfx.camera;
  cam.position.set(v.cx, v.h + v.span * 0.05 + 2.0, v.cz + v.dist);
  cam.lookAt(v.cx, v.h + v.span * 0.028 + 0.9, v.cz);
  cam.updateProjectionMatrix();
  /* a clean stage: trees, grass and the first-person hands all sit between the
     camera and the line-up, and this shot exists to compare silhouettes */
  if (Flora.grass) Flora.grass.count = 0;
  Gfx.scene.traverse((o) => { if (o.isInstancedMesh) o.visible = false; });
  const pos = cam.position.clone(), q = cam.quaternion.clone();
  let i = 0;
  const s = () => {
    cam.position.copy(pos); cam.quaternion.copy(q);
    if (ViewModel.group) ViewModel.group.visible = false;
    return ++i >= 6 ? r() : requestAnimationFrame(s);
  };
  requestAnimationFrame(s);
}), view);

await page.screenshot({ path: OUT, timeout: 180_000, animations: 'disabled' });
console.log('wrote', OUT);
await browser.close();
