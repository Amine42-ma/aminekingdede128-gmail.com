/**
 * Headless smoke test for ark.html.
 *
 * Boots the game in Chromium, generates a world, spawns one of every species,
 * runs the simulation for a while and fails on anything that looks like a
 * regression: a console error, an uncaught exception, a NaN that has crept into
 * a transform, or a frame rate that has fallen off a cliff.
 *
 * Run after every change:  node scripts/smoke.mjs
 */
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = pathToFileURL(path.join(ROOT, 'ark.html')).href;

/* This machine has no GPU: Chromium falls back to SwiftShader and renders at
   roughly 1 fps, so the frame count buys correctness, not performance data.
   90 frames is enough for every creature to complete several gait cycles. */
const FRAMES = Number(process.env.SMOKE_FRAMES || 90);
const MAX_SECS = Number(process.env.SMOKE_MAX_SECS || 240);  // catches a hang, not a slowdown
const SEED = process.env.SMOKE_SEED || '424242';

/* Errors we do not control and that say nothing about the game's health. */
const IGNORE = [
  /Failed to load resource/i,
  /favicon/i,
  /GroupMarkerNotSet/i,
  /Automatic fallback to software WebGL/i,
  /SwiftShader/i,
];
const ignorable = (t) => IGNORE.some((re) => re.test(t));

const fail = [];
const note = (m) => console.log(`   ${m}`);

const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-lcd-text',
    '--allow-file-access-from-files',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (!ignorable(t)) fail.push(`console.error: ${t}`);
});
page.on('pageerror', (e) => fail.push(`uncaught: ${e.message}`));

try {
  console.log('1. boot');
  await page.goto(PAGE, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForFunction(() => window.__ark && window.__ark.Game.state === 'menu', null,
    { timeout: 60_000 });
  note('menu reached');

  console.log('2. world generation');
  await page.evaluate((seed) => {
    document.querySelector('#optSeed').value = seed;
    window.__ark.Game.startNew();
  }, SEED);
  await page.waitForFunction(() => window.__ark.Game.state === 'play', null, { timeout: 180_000 });
  note(`world ready (seed ${SEED})`);

  console.log('3. spawn every species');
  const spawned = await page.evaluate(() => {
    const { SPECIES, Creatures, Player, World } = window.__ark;
    const ids = Object.keys(SPECIES);
    const out = { ids: [], failed: [] };
    ids.forEach((id, i) => {
      /* ring the player so nothing spawns inside anything else */
      const a = (i / ids.length) * Math.PI * 2, r = 14 + (i % 3) * 4;
      const x = Player.pos.x + Math.cos(a) * r, z = Player.pos.z + Math.sin(a) * r;
      try {
        const pos = Player.pos.clone();
        pos.set(x, World.heightAt(x, z), z);
        const c = Creatures.spawn(id, 10, pos);
        if (c) out.ids.push(id); else out.failed.push(id);
      } catch (e) {
        out.failed.push(`${id}: ${e.message}`);
      }
    });
    return out;
  });
  note(`${spawned.ids.length} species spawned`);
  if (spawned.failed.length) fail.push(`spawn failed: ${spawned.failed.join(', ')}`);

  console.log(`4. run ${FRAMES} frames`);
  const t0 = Date.now();
  await page.evaluate((n) => new Promise((res) => {
    let i = 0;
    const step = () => (++i >= n ? res() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  }), FRAMES);
  const secs = (Date.now() - t0) / 1000;
  note(`${FRAMES} frames in ${secs.toFixed(1)}s (software GL, ~${(FRAMES / secs).toFixed(1)} fps)`);
  if (secs > MAX_SECS) fail.push(`frame loop stalled: ${secs.toFixed(0)}s for ${FRAMES} frames`);

  console.log('5. integrity');
  const health = await page.evaluate(() => {
    const { Creatures, Player, Game, World } = window.__ark;
    const bad = [];
    const finite = (v) => Number.isFinite(v);
    const okVec = (v) => v && finite(v.x) && finite(v.y) && finite(v.z);
    if (!okVec(Player.pos)) bad.push('Player.pos is NaN');
    for (const c of Creatures.list) {
      if (!okVec(c.root.position)) { bad.push(`${c.speciesId} position NaN`); continue; }
      if (!finite(c.root.rotation.y)) bad.push(`${c.speciesId} rotation NaN`);
      if (!finite(c.cur.health)) bad.push(`${c.speciesId} health NaN`);
    }
    return {
      bad,
      state: Game.state,
      alive: Creatures.list.length,
      biome: World.biomeAt(Player.pos.x, Player.pos.z),
    };
  });
  note(`state=${health.state} creatures=${health.alive} biome=${health.biome}`);
  fail.push(...health.bad);

  console.log('6. render pipeline');
  const gfx = await page.evaluate(async () => {
    const { Gfx, Sky, Camera, Game } = window.__ark;
    const bad = [];
    Gfx.applyQuality('high');
    Sky.time = 10; Camera.thirdPerson = true;
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (let i = 0; i < 6; i++) await frame();
    Game.paused = true;
    await frame();

    const r = Gfx.renderer, gl = r.getContext();

    /* AO must see the WORLD's depth. The viewmodel pass calls clearDepth(),
       so an AO pass ordered after it sees only the player's hands and the
       buffer comes back almost entirely white — which is exactly the bug this
       catches. A real outdoor frame occludes somewhere. */
    const ao = Gfx.rtAO;
    const abuf = new Uint8Array(ao.width * ao.height * 4);
    r.setRenderTarget(ao);
    gl.readPixels(0, 0, ao.width, ao.height, gl.RGBA, gl.UNSIGNED_BYTE, abuf);
    r.setRenderTarget(null);
    let amin = 255, asum = 0;
    for (let i = 0; i < ao.width * ao.height; i++) { const v = abuf[i * 4]; if (v < amin) amin = v; asum += v; }
    const amean = asum / (ao.width * ao.height);
    if (amin > 220) bad.push(`SSAO produced almost no occlusion (min ${amin}, mean ${amean.toFixed(1)})`);

    /* FXAA must measurably soften edges */
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    const grab = () => {
      const buf = new Uint8Array(W * H * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return buf;
    };
    const harsh = (buf) => {
      let s = 0, n = 0;
      for (let y = 0; y < H; y += 2) for (let x = 0; x < W - 1; x++) {
        const i = (y * W + x) * 4, j = i + 4;
        s += Math.abs(buf[i] - buf[j]) + Math.abs(buf[i + 1] - buf[j + 1]) + Math.abs(buf[i + 2] - buf[j + 2]);
        n++;
      }
      return s / n;
    };
    Gfx.setFxaa(false); await frame(); await frame(); const off = harsh(grab());
    Gfx.setFxaa(true); await frame(); await frame(); const on = harsh(grab());
    if (!(on < off * 0.95)) bad.push(`FXAA did not soften edges (${off.toFixed(1)} -> ${on.toFixed(1)})`);

    Game.paused = false; Camera.thirdPerson = false;
    return { bad, amin, amean: +amean.toFixed(1), off: +off.toFixed(1), on: +on.toFixed(1) };
  });
  if (gfx.bad.length) fail.push(...gfx.bad);
  else note(`SSAO min=${gfx.amin} mean=${gfx.amean} · FXAA harshness ${gfx.off} -> ${gfx.on}`);

  console.log('7. controls: keyboard, then touch');
  const controls = await page.evaluate(async () => {
    const { Game, Touch, Input, Inventory, UI } = window.__ark;
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const on = (id) => document.querySelector(id).classList.contains('on');
    const bad = [];

    /* --- keyboard: one press must toggle exactly once ------------------- */
    Touch.forced = false; Touch.apply();
    const key = async (code) => {
      dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
      dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
      await frame();
    };
    await key(Input.binds.inventory);
    if (!on('#inventory')) bad.push('keyboard: inventory did not open');
    await key(Input.binds.inventory);
    if (on('#inventory')) bad.push('keyboard: inventory did not close (double-toggle?)');

    /* --- touch: the buttons that used to be dead wiring ----------------- */
    Touch.forced = true; Touch.apply();
    const tap = async (name) => {
      const b = document.querySelector(`[data-touch=${name}]`);
      if (!b) { bad.push(`touch: no ${name} button`); return; }
      const opt = { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true };
      b.dispatchEvent(new PointerEvent('pointerdown', opt));
      b.dispatchEvent(new PointerEvent('pointerup', opt));
      await frame();
    };
    for (const [name, sel] of [['inventory', '#inventory'], ['pause', '#pause']]) {
      await tap(name);
      if (!on(sel)) bad.push(`touch: ${name} did not open`);
      await tap(name);
      if (on(sel)) bad.push(`touch: ${name} did not close`);
    }

    /* The map has no button of its own: the minimap opens it, and tapping the
       map sets a waypoint that the minimap then shows. */
    if (document.querySelector('[data-touch=map]')) bad.push('touch: map button came back');
    const mm = document.querySelector('#minimap');
    const mr = mm.getBoundingClientRect();
    mm.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: 5, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true,
      clientX: mr.left + mr.width / 2, clientY: mr.top + mr.height / 2,
    }));
    await frame();
    if (!on('#map')) bad.push('touch: tapping the minimap did not open the map');
    const mcv = document.querySelector('#mapcv'), cr = mcv.getBoundingClientRect();
    mcv.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: 6, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true,
      clientX: cr.left + cr.width * .35, clientY: cr.top + cr.height * .6,
    }));
    await frame();
    if (!UI.mapWaypoint) bad.push('touch: tapping the map did not set a waypoint');
    UI.closeMap();
    await frame();

    /* --- hotbar must be reachable by pointer (it is inside a
           pointer-events:none HUD, so this is easy to break again) -------- */
    Inventory.give('stone_pick', 1); UI.refreshHotbar();
    const slot = document.querySelectorAll('#hotbar .slot')[2];
    slot.dispatchEvent(new PointerEvent('pointerdown',
      { pointerId: 9, pointerType: 'touch', isPrimary: true, bubbles: true }));
    await frame();
    if (Inventory.hotbarIndex !== 2) bad.push('hotbar slot is not clickable');

    Touch.forced = null; Touch.apply();
    return bad;
  });
  if (controls.length) fail.push(...controls);
  else note('keyboard and touch toggles both fire exactly once');

  console.log('8. save / load round trip');
  const save = await page.evaluate(() => {
    const { SaveGame } = window.__ark;
    SaveGame.save(2);
    const key = SaveGame.KEY + 2;
    const raw = localStorage.getItem(key);
    if (!raw) return { ok: false };
    /* and read it straight back, so a save that cannot be parsed fails here
       rather than silently on the player's next session */
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { return { ok: false, parse: e.message }; }
    return { ok: true, bytes: raw.length, keys: Object.keys(parsed).length };
  });
  if (!save.ok) fail.push(`save failed${save.parse ? `: ${save.parse}` : ' (nothing written)'}`);
  else note(`saved ${save.bytes.toLocaleString()} bytes, ${save.keys} top-level keys`);
} catch (e) {
  fail.push(`harness: ${e.message}`);
} finally {
  await browser.close();
}

console.log('');
if (fail.length) {
  console.error(`SMOKE FAILED — ${fail.length} problem(s):`);
  for (const f of fail) console.error(`  · ${f}`);
  process.exit(1);
}
console.log('SMOKE PASSED');
