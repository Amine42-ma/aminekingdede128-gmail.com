/**
 * Project assembly: config, bootstrap, HTML shell, stylesheet, manifest, README.
 *
 * The bootstrap exposes a small `window.__LAB__` test surface. That is not
 * decoration: it is how the lab's headless sandbox drives the game, presses
 * keys and reads state back, which is what makes "generate -> run -> test ->
 * fix" a real loop instead of a claim.
 */
import { round } from '../core/util.js';

export function emitConfig(design, policy) {
  const t = design.traits;
  const p = design.parameters;
  // Policy-controlled difficulty bias: <1 is gentler, >1 is harsher. It changes
  // real numbers in the emitted config (hazard density, spawn pressure, enemy
  // health), which is what makes it measurable on the benchmark.
  const bias = Number.isFinite(policy?.options?.difficultyBias) ? policy.options.difficultyBias : 1;
  const enemy = design.entities.find((e) => e.role === 'enemy') || {};
  const player = design.entities.find((e) => e.role === 'player') || {};
  const twistCfg = twistConfig(design);

  const cfg = {
    meta: {
      name: design.name,
      designId: design.id,
      seed: design.seed,
      ruleset: design.ruleset,
      generatedAt: new Date().toISOString(),
      generator: 'AI Evolution Game Lab',
      agentVersion: policy?.version || 'v1',
    },
    seed: hashSeed(design.seed),
    palette: design.visual.palette,
    physics: p,
    world: { ...design.world, hazardChance: round(0.28 * bias, 3), obstacleDensity: round((design.world.obstacleDensity ?? 0.5) * bias, 3) },
    player: {
      hp: player.hp || 4,
      radius: player.radius || 12,
      cooldown: round(0.18 + (t.genre === 'twin-stick-shooter' ? 0 : 0.08), 3),
      projectileSpeed: 520,
      projectileLife: 1.1,
      damage: 1,
      invulnSeconds: 0.8,
      dashSpeed: 620,
      dashSeconds: 0.18,
    },
    enemy: {
      radius: enemy.radius || 12,
      hp: Math.max(1, Math.round((enemy.hp || 2) * bias)),
      speed: round((p.maxSpeed || 240) * (enemy.speedFactor || 0.6), 1),
      contactDamage: 1,
      shotDamage: 1,
      shotSpeed: 260,
      fireInterval: 1.4,
      preferredRange: 220,
      visionRange: 260,
      visionAngle: 0.7,
      maxAlive: 28,
      nestInterval: 2.6,
      diesOnContact: t.enemies === 'chasers',
    },
    core: { hp: (design.entities.find((e) => e.role === 'objective') || {}).hp || 12 },
    pickups: { initial: 5, minimum: 3, dropChance: 0.28 },
    scoring: { kill: 10, pickup: 25, lap: 150, level: 200, survive: 1 },
    waveSeconds: 22,
    difficultyBias: bias,
    progression: {
      ...design.progression,
      stages: (design.progression.stages || []).map((st) => ({
        ...st,
        spawnInterval: round(Math.max(0.25, st.spawnInterval / Math.max(0.4, bias)), 2),
        enemyCount: Math.max(1, Math.round(st.enemyCount * bias)),
      })),
    },
    twist: twistCfg,
    winCondition: design.winCondition,
    loseCondition: design.loseCondition,
    ui: { elements: design.ui.elements },
    controls: design.controls,
    limits: { maxEntities: 1200, maxParticles: 600 },
  };

  return `/* game/config.js - tuned constants for "${design.name}"
 * Values come from the design document: genre defaults blended with parameter
 * priors learned from the imported corpus (see manifest.json -> parameterSources).
 */
(function (global) {
  'use strict';
  var LAB = global.LAB = global.LAB || {};
  LAB.CONFIG = ${JSON.stringify(cfg, null, 2).replace(/\n/g, '\n  ')};
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

function twistConfig(design) {
  const m = design.twist.mechanic;
  const base = { id: design.traits.twist, mechanic: m };
  switch (m) {
    case 'shrink-bounds': return { ...base, shrinkRate: 3.2, maxShrink: Math.min(design.world.width || 900, design.world.height || 700) * 0.32, outsideDamage: 0.06 };
    case 'resource-drain': return { ...base, drainPerSecond: 0.035, pickupRestore: 0.22 };
    case 'light-radius': return { ...base, drainPerSecond: 0.028, pickupRestore: 0.25, lightBase: 90, lightRange: 190 };
    case 'time-scale': return { ...base, slowFactor: 0.42, drainPerSecond: 0.35, rechargePerSecond: 0.18 };
    case 'combo': return { ...base, comboStep: 0.25, comboMax: 6, comboWindow: 2.4 };
    case 'charge': return { ...base, chargeSeconds: 0.55 };
    case 'beat-window': return { ...base, beatSeconds: 0.6, beatWindow: 0.12 };
    case 'terrain-mutation': return { ...base, mutateInterval: 6.5 };
    case 'one-hit': return { ...base, scoreMultiplier: 2.5 };
    case 'flip-gravity': return { ...base, flipCooldown: 0.35 };
    case 'ghost-replay': return { ...base, sampleHz: 20 };
    default: return base;
  }
}

function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function emitMain(design, policy) {
  const modules = new Set(design.architecture.modules);
  const has = (m) => modules.has(m);
  const twist = design.twist.mechanic;
  return `/* game/main.js - bootstrap: wires engine modules, screens and the loop */
(function (global) {
  'use strict';
  var LAB = global.LAB;
  var cfg = LAB.CONFIG;

  function boot() {
    var doc = global.document;
    var canvas = doc.getElementById('stage');
    var uiRoot = doc.getElementById('ui');
    var rng = new LAB.Rng(cfg.seed);

    var renderer = new LAB.Renderer(canvas, { palette: cfg.palette });
    var input = new LAB.Input({ element: canvas });
    var camera = new LAB.Camera({ width: renderer.width, height: renderer.height });
    var world = new LAB.World({ max: cfg.limits.maxEntities });
${has('collision') ? `    var collision = new LAB.Collision();` : `    var collision = { pairs: function () {}, rebuild: function () {}, resetStats: function () {}, checks: 0, hits: 0 };`}
${has('particles') ? `    var particles = new LAB.Particles(cfg.limits.maxParticles);` : `    var particles = { emit: function () {}, update: function () {}, render: function () {}, clear: function () {}, activeCount: function () { return 0; } };`}
    var audio = new LAB.Audio();
    var save = new LAB.Save();
    var loop = new LAB.Loop({});
    var ui = new LAB.UI(uiRoot, { onAction: onUiAction });

    renderer.onResize = function (w, h) { camera.resize(w, h); };
    camera.resize(renderer.width, renderer.height);

    var ctx = {
      cfg: cfg, rng: rng, renderer: renderer, input: input, camera: camera,
      world: world, collision: collision, particles: particles, audio: audio,
      save: save, ui: ui, loop: loop,
    };

    var game = LAB.createGame(ctx);
    var screen = new LAB.StateMachine('menu');

    screen.define('menu', {
      enter: function () {
        ui.showOverlay(${JSON.stringify(design.name)}, ${JSON.stringify(design.pitch)}, 'Start');
      },
      update: function () {},
    });
    screen.define('playing', {
      enter: function () { ui.hideOverlay(); audio.unlock(); loop.setPaused(false); },
      update: function (dt) {
        game.update(dt);
        if (game.status === 'won') screen.set('won');
        else if (game.status === 'lost') screen.set('lost');
      },
    });
    screen.define('paused', {
      enter: function () { ui.showOverlay('Paused', 'Take a breath.', 'Resume'); },
    });
    screen.define('won', {
      enter: function () {
        save.record('best', game.score, 'max');
        save.record('runs', 1, 'add');
        ui.showOverlay('You win', (game.reason || '') + '  -  score ' + game.score + ' (best ' + save.data.best + ')', 'Play again');
      },
    });
    screen.define('lost', {
      enter: function () {
        save.record('best', game.score, 'max');
        save.record('runs', 1, 'add');
        ui.showOverlay('Run over', (game.reason || '') + '  -  score ' + game.score + ' (best ' + save.data.best + ')', 'Try again');
      },
    });

    function onUiAction(action) {
      if (action === 'primary') {
        if (screen.is('menu') || screen.is('won') || screen.is('lost')) { game.reset(); screen.set('playing'); }
        else if (screen.is('paused')) screen.set('playing');
      } else if (action === 'restart') {
        game.reset();
        screen.set('playing');
      } else if (action === 'pause') {
        if (screen.is('playing')) screen.set('paused');
        else if (screen.is('paused')) screen.set('playing');
        ui.setPaused(screen.is('paused'));
      } else if (action === 'mute') {
        ui.setMuted(audio.toggle());
      }
    }

    loop.update = function (dt) {
      screen.update(dt);
${has('particles') ? `      if (screen.is('playing')) particles.update(dt);` : ''}
      input.update();
      if (input.pressed('pause')) onUiAction('pause');
    };

    loop.render = function (alpha) {
      renderer.begin();
      game.render(renderer, alpha);
      syncHud();
    };

    function syncHud() {
      var values = game.hud();
      for (var k in values) ui.set(k, values[k]);
    }

    LAB.bindLifecycle(loop, function () { if (screen.is('playing')) { screen.set('paused'); ui.setPaused(true); } });

    doc.addEventListener('keydown', function (e) {
      if (e.code === 'Escape') onUiAction('pause');
      if ((e.code === 'Space' || e.code === 'Enter') && !screen.is('playing')) onUiAction('primary');
    });

    ui.setMuted(audio.muted);
    screen.set('menu');
    loop.start();

    /* ---- test surface -------------------------------------------------
       Used by the lab's headless sandbox to drive the game deterministically.
       Harmless in production: it exposes state, it does not change behaviour. */
    global.__LAB__ = {
      version: cfg.meta.agentVersion,
      design: cfg.meta,
      loop: loop, game: game, input: input, world: world, camera: camera,
      renderer: renderer, screen: screen, save: save, audio: audio, ui: ui,
      press: function (action) {
        var codes = (input.bindings[action] || []);
        for (var i = 0; i < codes.length; i++) { input.keys[codes[i]] = true; input.buffer[codes[i]] = LAB.now(); }
      },
      release: function (action) {
        var codes = (input.bindings[action] || []);
        for (var i = 0; i < codes.length; i++) input.keys[codes[i]] = false;
      },
      pointerTo: function (x, y) { input.pointer.x = x; input.pointer.y = y; },
      start: function () { onUiAction('primary'); },
      snapshot: function () {
        return {
          state: screen.state,
          status: game.status,
          score: game.score,
          frame: loop.frame,
          elapsed: loop.elapsed,
          fps: loop.fps,
          entities: world.count(),
          entityStats: world.stats,
          particles: particles.activeCount(),
          drawCalls: renderer.drawCalls,
          collisionChecks: collision.checks,
          player: game.player ? { x: game.player.x, y: game.player.y, hp: game.player.hp, vx: game.player.vx, vy: game.player.vy } : null,
          hud: game.hud(),
        };
      },
    };
  }

  if (global.document && global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

export function emitHtml(design, files) {
  const scripts = files.filter((f) => f.startsWith('src/')).map((f) => `  <script src="${f}"></script>`).join('\n');
  const help = design.controls.bindings
    ? Object.entries(design.controls.bindings).map(([k, v]) => `${k}: ${v.join(' / ')}`)
    : [];
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark light">
<title>${escapeHtml(design.name)}</title>
<meta name="description" content="${escapeHtml(design.pitch.slice(0, 180))}">
<link rel="stylesheet" href="styles/main.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='${encodeURIComponent(design.visual.palette[2])}'/%3E%3C/svg%3E">
</head>
<body>
<main id="app">
  <canvas id="stage" aria-label="${escapeHtml(design.name)} play area" role="img"></canvas>
  <div id="ui"></div>
</main>
<noscript>This game needs JavaScript enabled.</noscript>
${scripts}
</body>
</html>
`;
}

export function emitCss(design) {
  const [bg, ink, accent, accent2, danger] = design.visual.palette;
  const rtlNote = '';
  return `/* styles/main.css - ${design.visual.label || design.traits.visualStyle}
 * Layout goals: fill the viewport, keep the HUD readable at phone width,
 * never scroll horizontally, and respect safe-area insets on notched screens.
 */
:root {
  --bg: ${bg};
  --ink: ${ink};
  --accent: ${accent};
  --accent-2: ${accent2};
  --danger: ${danger};
  --radius: 14px;
  --pad: clamp(8px, 2vw, 18px);
  color-scheme: dark;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  height: 100%;
  background: var(--bg);
  color: var(--ink);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  overflow: hidden;
  touch-action: none;
  -webkit-text-size-adjust: 100%;
}

#app {
  position: relative;
  width: 100%;
  height: 100%;
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

#stage {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--bg);
}

#ui { position: absolute; inset: 0; pointer-events: none; }
#ui button { pointer-events: auto; }

.hud {
  position: absolute;
  top: calc(var(--pad) + env(safe-area-inset-top, 0px));
  left: var(--pad);
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  max-width: calc(100% - var(--pad) * 2);
}

.hud-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg) 70%, #000 30%);
  border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
  font-size: clamp(11px, 2.6vw, 13px);
  letter-spacing: .04em;
  text-transform: uppercase;
  backdrop-filter: blur(6px);
}

.hud-label { opacity: .65; }
.hud-value { font-variant-numeric: tabular-nums; font-weight: 700; color: var(--accent); }

.hud-bar {
  width: clamp(60px, 18vw, 110px);
  height: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, .14);
  overflow: hidden;
}
.hud-bar-fill {
  height: 100%;
  width: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  transition: width .12s linear;
}

.topbar {
  position: absolute;
  top: calc(var(--pad) + env(safe-area-inset-top, 0px));
  right: var(--pad);
  display: flex;
  gap: 8px;
}

.btn {
  font: inherit;
  font-size: clamp(12px, 2.8vw, 14px);
  padding: 10px 18px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  background: color-mix(in srgb, var(--bg) 60%, #000 40%);
  color: var(--ink);
  cursor: pointer;
  transition: transform .12s ease, background .12s ease;
  min-height: 40px;
}
.btn:hover { transform: translateY(-1px); }
.btn:active { transform: translateY(1px); }
.btn.small { padding: 7px 12px; min-height: 34px; }
.btn.primary { background: var(--accent); color: var(--bg); font-weight: 700; border-color: var(--accent); }
.btn.ghost { opacity: .8; }

.overlay {
  position: absolute;
  inset: 0;
  display: none;
  place-items: center;
  background: color-mix(in srgb, var(--bg) 78%, transparent);
  padding: var(--pad);
}
.overlay.visible { display: grid; }

.overlay-card {
  pointer-events: auto;
  width: min(520px, 100%);
  padding: clamp(20px, 5vw, 34px);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--bg) 55%, #000 45%);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  text-align: center;
}
.overlay-title { margin: 0 0 10px; font-size: clamp(22px, 6vw, 34px); letter-spacing: -.02em; }
.overlay-text { margin: 0 0 14px; opacity: .8; line-height: 1.5; font-size: clamp(13px, 3.4vw, 15px); }
.overlay-help { list-style: none; margin: 0 0 18px; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.overlay-help li {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, .08);
  opacity: .8;
}
.overlay-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }

.toast {
  position: absolute;
  left: 50%;
  bottom: calc(18% + env(safe-area-inset-bottom, 0px));
  transform: translate(-50%, 12px);
  padding: 8px 16px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--bg);
  font-weight: 700;
  font-size: 13px;
  opacity: 0;
  transition: opacity .2s ease, transform .2s ease;
}
.toast.visible { opacity: 1; transform: translate(-50%, 0); }

/* Touch controls: only shown where the primary pointer is coarse. */
.touchpad { display: none; }
@media (pointer: coarse) {
  .touchpad {
    display: block;
    position: absolute;
    inset: auto 0 0 0;
    height: 42%;
    pointer-events: none;
  }
  .stick-zone {
    position: absolute;
    left: var(--pad);
    bottom: calc(var(--pad) + env(safe-area-inset-bottom, 0px));
    width: 124px; height: 124px;
    border-radius: 50%;
    border: 2px solid color-mix(in srgb, var(--accent) 40%, transparent);
    pointer-events: auto;
  }
  .stick-nub {
    position: absolute; left: 50%; top: 50%;
    width: 52px; height: 52px; margin: -26px 0 0 -26px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--accent) 65%, transparent);
  }
  .touch-action {
    position: absolute;
    right: var(--pad);
    bottom: calc(var(--pad) + env(safe-area-inset-bottom, 0px));
    width: 84px; height: 84px;
    border-radius: 50%;
    border: 0;
    background: var(--accent);
    color: var(--bg);
    font-size: 22px; font-weight: 800;
    pointer-events: auto;
  }
}

@media (max-width: 480px) {
  .hud { gap: 6px; }
  .hud-item { padding: 5px 9px; }
  .topbar .btn { padding: 6px 10px; }
}

@media (prefers-reduced-motion: reduce) {
  .btn, .toast, .hud-bar-fill { transition: none; }
}
${rtlNote}`;
}

export function emitManifest(design, extra = {}) {
  return `${JSON.stringify({
    name: design.name,
    designId: design.id,
    seed: design.seed,
    generatedAt: new Date().toISOString(),
    generator: { name: 'AI Evolution Game Lab', agentVersion: extra.agentVersion || 'v1' },
    ruleset: design.ruleset,
    traits: design.traits,
    pitch: design.pitch,
    coreLoop: design.coreLoop,
    winCondition: design.winCondition,
    loseCondition: design.loseCondition,
    controls: design.controls,
    parameters: design.parameters,
    parameterSources: design.parameterSources,
    architecture: design.architecture,
    knowledgeUsed: design.sourceKnowledge,
    novelty: design.novelty,
    diversity: design.diversity,
    assets: design.assets,
    provenance: {
      note: 'Generated by composing the lab\'s own engine emitters against this design document. Concepts were learned from the imported corpus; no source code was copied from it.',
      codeOverlapCheck: extra.codeOverlap || null,
    },
    license: extra.license || {
      code: 'You own this generated project. The lab claims no rights over it.',
      assets: 'No third-party assets are bundled: all art and audio are generated at runtime from code.',
    },
  }, null, 2)}\n`;
}

export function emitReadme(design, extra = {}) {
  const b = design.controls.bindings || {};
  const keys = Object.entries(b).map(([a, list]) => `- **${a}** — ${list.join(' / ')}`).join('\n');
  return `# ${design.name}

${design.pitch}

*Generated by AI Evolution Game Lab (agent ${extra.agentVersion || 'v1'}) from design \`${design.id}\`, seed \`${design.seed}\`.*

## Play it

Open \`index.html\` in a browser. No build step, no server, no dependencies —
the engine is emitted as plain scripts so the game runs straight from the file
system.

${design.ruleset === 'explorer3d' ? `> This is a 3D build. It loads three.js from a CDN on first run, so the first
> launch needs a network connection (or a local copy in \`vendor/\`).\n` : ''}
## Controls

${keys || '- pointer / touch'}

${design.controls.mobile?.virtualStick ? 'On a touch screen, drag anywhere on the left to steer and tap the round button to act.' : 'On a touch screen, tap to act.'}

## Design

| | |
|---|---|
| Genre | ${design.traits.genre} |
| Goal | ${design.playerGoal} |
| World | ${design.traits.world} |
| Camera | ${design.traits.camera} |
| Physics | ${design.traits.physics} |
| Enemies | ${design.traits.enemies} |
| Progression | ${design.traits.progression} |
| Modifier | ${design.twist.id} — ${design.twist.description} |

**Core loop:** ${design.coreLoop.join(' → ')}

**Win:** ${JSON.stringify(design.winCondition)}
**Lose:** ${JSON.stringify(design.loseCondition)}

## Structure

\`\`\`
${design.architecture.files.join('\n')}
\`\`\`

- \`src/engine/*\` — reusable runtime: ${design.architecture.modules.join(', ')}
- \`src/game/config.js\` — every tuned number in one place
- \`src/game/world.js\` — world/level construction for this design
- \`src/game/rules.js\` — the actual gameplay rules
- \`src/game/main.js\` — wiring, screens and the loop

## Where the numbers came from

${Object.entries(design.parameterSources || {}).map(([k, v]) => `- \`${k}\`: ${v}`).join('\n') || '- genre defaults'}

## Provenance

Concepts (not code) were learned from the imported corpus. ${design.sourceKnowledge?.length || 0} knowledge
items informed this build; see \`manifest.json\` for the list with confidence values.
${extra.codeOverlap ? `\nToken-overlap check against the imported corpus: **${(extra.codeOverlap.maxOverlapWithImports * 100).toFixed(2)}%** (threshold 15%).` : ''}
`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
