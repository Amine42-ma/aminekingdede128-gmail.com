/**
 * Touch-control tests for ark.html.
 *
 * Two halves:
 *   FEEL    — the smoothing maths. Driven by calling Touch.update(dt) directly
 *             rather than waiting on requestAnimationFrame, because this
 *             machine has no GPU and renders at about 1 fps; stepping the
 *             function under test is both faster and exact.
 *   LAYOUT  — no two controls may overlap, run off-screen, or be too small to
 *             hit, at any landscape size a phone browser actually produces.
 *
 * Run:  node scripts/touch.mjs
 */
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = pathToFileURL(path.join(ROOT, 'ark.html')).href;
const SEED = '424242';

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`   ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `   [${detail}]` : ''}`);
};

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

async function boot(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  await page.goto(PAGE, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForFunction(() => window.__ark && window.__ark.Game.state === 'menu', null, { timeout: 60_000 });
  await page.evaluate((s) => { document.querySelector('#optSeed').value = s; window.__ark.Game.startNew(); }, SEED);
  await page.waitForFunction(() => window.__ark.Game.state === 'play', null, { timeout: 180_000 });
  return { ctx, page, errs };
}

/* ------------------------------------------------------------------ FEEL */
console.log('FEEL — stick response and look smoothing');
{
  const { ctx, page, errs } = await boot({ width: 896, height: 414 });
  const r = await page.evaluate(() => {
    const { Touch, Player } = window.__ark;
    const out = {};
    const zoneL = document.querySelector('#tzoneL'), zoneR = document.querySelector('#tzoneR');
    const st = document.querySelector('#tstick');
    const pev = (el, type, x, y, id) => el.dispatchEvent(new PointerEvent(type,
      { pointerId: id, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true }));
    const step = (n, dt) => { for (let i = 0; i < (n || 1); i++) Touch.update(dt || 1 / 60); };

    const zr = zoneL.getBoundingClientRect();
    const cx = zr.left + zr.width * .5, cy = zr.top + zr.height * .6;
    pev(zoneL, 'pointerdown', cx, cy, 1);
    out.spawned = st.classList.contains('on')
      && Math.abs(parseFloat(st.style.left) - cx) < 2
      && Math.abs(parseFloat(st.style.top) - cy) < 2;

    const lim = st.getBoundingClientRect().width * .40;
    const settle = (dx, dy) => { pev(zoneL, 'pointermove', cx + dx, cy + dy, 1); step(240); return Math.hypot(Touch.move.x, Touch.move.y); };
    out.full = settle(0, -lim);
    out.half = settle(0, -lim * .5);
    out.want = (.5 - Touch.deadzone) / (1 - Touch.deadzone);
    out.linear = Math.abs(out.half - out.want) < .03 && Math.abs(out.full - 1) < .02;
    out.dead = settle(0, -lim * .05) === 0;
    settle(0, -lim);
    out.sprint = Touch.down('sprint') && st.classList.contains('sprint');
    pev(zoneL, 'pointerup', cx, cy, 1); step(300);
    out.released = Touch.move.x === 0 && Touch.move.y === 0 && !Touch.down('sprint') && !st.classList.contains('on');

    /* identical finger travel must give identical rotation, whether the device
       reports 4 big moves or 40 small ones, and at any frame rate */
    const rr = zoneR.getBoundingClientRect();
    const lx = rr.left + rr.width * .5, ly = rr.top + rr.height * .5;
    const TRAVEL = 40;
    const unwrap = (d) => { while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
    const drag = (steps, frames, dt) => {
      const y0 = Player.yaw;
      pev(zoneR, 'pointerdown', lx, ly, 9);
      for (let i = 1; i <= steps; i++) {
        pev(zoneR, 'pointermove', lx + i * (TRAVEL / steps), ly, 9);
        if (i % Math.max(1, steps / 8 | 0) === 0) step(1, dt);
      }
      pev(zoneR, 'pointerup', lx + TRAVEL, ly, 9);
      step(frames, dt);
      return unwrap(Player.yaw - y0);
    };
    /* momentum is deliberately velocity-dependent, so it is measured on its
       own rather than polluting the travel-invariance check */
    Touch.glide = false;
    out.coarse = drag(4, 600, 1 / 60);
    out.fine = drag(40, 600, 1 / 60);
    out.fast = drag(4, 1200, 1 / 120);
    out.slow = drag(4, 300, 1 / 30);
    const noGlide = drag(4, 600, 1 / 60);
    Touch.glide = true;
    const y0 = Player.yaw;
    pev(zoneR, 'pointerdown', lx, ly, 11);
    for (let i = 1; i <= 4; i++) { pev(zoneR, 'pointermove', lx + i * 10, ly, 11); step(1, 1 / 60); }
    Touch.velX = 30;
    pev(zoneR, 'pointerup', lx + TRAVEL, ly, 11);
    step(600, 1 / 60);
    out.glided = Math.abs(unwrap(Player.yaw - y0)) > Math.abs(noGlide) * 1.15;

    const rel = (a, b) => Math.abs((b - a) / a);
    out.byEvent = Math.abs(out.coarse) > 1e-4 && rel(out.coarse, out.fine) < .05;
    out.byFrame = rel(out.coarse, out.fast) < .05 && rel(out.coarse, out.slow) < .05;

    const jump = document.querySelector('[data-touch=jump]');
    const jb = jump.getBoundingClientRect();
    pev(jump, 'pointerdown', jb.left + jb.width / 2, jb.top + jb.height / 2, 4);
    const heldNow = Touch.down('jump');
    pev(jump, 'pointerup', 9999, 9999, 4);
    out.noStick = heldNow && !Touch.down('jump');

    pev(zoneL, 'pointerdown', cx, cy, 5); pev(zoneL, 'pointermove', cx, cy - lim, 5); step(60);
    Touch.releaseAll(); step(2);
    out.panic = Touch.move.x === 0 && Touch.move.y === 0 && !Touch.down('sprint');
    return out;
  });

  check('stick spawns under the thumb', r.spawned);
  check('response is linear past the deadzone', r.linear, `full=${r.full.toFixed(3)} half=${r.half.toFixed(3)} want=${r.want.toFixed(3)}`);
  check('deadzone ignores a tiny nudge', r.dead);
  check('pushing to the rim sprints', r.sprint);
  check('release clears stick and sprint', r.released);
  check('look independent of event rate', r.byEvent, `coarse=${r.coarse.toFixed(4)} fine=${r.fine.toFixed(4)}`);
  check('look independent of frame rate', r.byFrame, `30fps=${r.slow.toFixed(4)} 120fps=${r.fast.toFixed(4)}`);
  check('a flick keeps gliding after release', r.glided);
  check('sliding off a button releases it', r.noStick);
  check('releaseAll clears everything', r.panic);
  if (errs.length) check('no console errors', false, errs[0]);
  await ctx.close();
}

/* ---------------------------------------------------------------- LAYOUT */
console.log('\nLAYOUT — nothing overlaps, runs off-screen, or is too small to hit');
for (const [label, viewport] of [
  ['802x293 worst-case landscape', { width: 802, height: 293 }],
  ['896x414 typical landscape', { width: 896, height: 414 }],
  ['740x360 small landscape', { width: 740, height: 360 }],
]) {
  const { ctx, page } = await boot(viewport);
  const out = await page.evaluate(() => {
    const { Touch } = window.__ark;
    /* force every contextual button on, so the densest possible case is the
       one being measured */
    ['interact', 'rotate', 'whistle', 'crouch', 'jump', 'build'].forEach((n) => Touch.show(n, true));
    const sel = ['#tquick .tb', '#tbtns .tb', '#minimap', '#hotbar', '#stats', '#xprow', '#clock', '#compass'];
    const items = [];
    sel.forEach((s) => document.querySelectorAll(s).forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      if (getComputedStyle(e).display === 'none' || e.classList.contains('hidden')) return;
      items.push({ n: e.dataset.touch ? `btn:${e.dataset.touch}` : (e.id || s), r });
    }));
    const bad = [];
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      /* crouch and rotate are the same slot in two different modes and never
         appear together; the forcing above is what puts both on screen */
      const pair = [items[i].n, items[j].n].sort().join('|');
      if (pair === 'btn:crouch|btn:rotate') continue;
      const a = items[i].r, c = items[j].r;
      const ox = Math.min(a.right, c.right) - Math.max(a.left, c.left);
      const oy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
      if (ox > 4 && oy > 4) bad.push(`${items[i].n} over ${items[j].n} by ${Math.round(ox)}x${Math.round(oy)}px`);
    }
    items.forEach((o) => {
      if (o.r.right > innerWidth + 1 || o.r.bottom > innerHeight + 1 || o.r.left < -1 || o.r.top < -1) bad.push(`${o.n} off-screen`);
      if (/^btn:/.test(o.n) && (o.r.width < 38 || o.r.height < 38)) bad.push(`${o.n} only ${Math.round(o.r.width)}x${Math.round(o.r.height)}px`);
    });
    return { bad, count: items.length };
  });
  check(`${label} (${out.count} controls)`, out.bad.length === 0, out.bad.join('; ') || undefined);
  await ctx.close();
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log('');
if (failed.length) { console.error(`TOUCH FAILED — ${failed.length} of ${results.length}`); process.exit(1); }
console.log(`TOUCH PASSED — ${results.length} checks`);
