/**
 * Trait space (spec 4, 35).
 *
 * Every generated game is a point in this space. The dimensions are the things
 * the user listed as "must be able to change": genre, goal, world, progression,
 * UI, controls, camera, characters, win condition, physics, enemies, rewards -
 * plus a twist dimension that exists purely to push combinations into regions
 * the corpus has not visited yet.
 *
 * `requires` lists engine capabilities a trait needs; the generator uses it to
 * decide which modules to emit. `rulesets` constrains which gameplay drivers a
 * trait is compatible with.
 */

export const RULESETS = ['arena', 'platformer', 'puzzle', 'racer', 'defense', 'runner', 'stealth', 'explorer3d'];

export const DIMENSIONS = {
  genre: [
    { id: 'arena-survival', label: 'Arena survival', ruleset: 'arena', tags: ['action', 'waves'], requires: ['entities', 'collision', 'ai', 'particles'] },
    { id: 'twin-stick-shooter', label: 'Twin-stick shooter', ruleset: 'arena', tags: ['action', 'aim'], requires: ['entities', 'collision', 'ai', 'particles'] },
    { id: 'platformer', label: 'Precision platformer', ruleset: 'platformer', tags: ['skill', 'levels'], requires: ['physics', 'collision', 'camera'] },
    { id: 'puzzle-logic', label: 'Grid logic puzzle', ruleset: 'puzzle', tags: ['thinking', 'turns'], requires: ['grid'] },
    { id: 'racing', label: 'Time-trial racing', ruleset: 'racer', tags: ['speed', 'track'], requires: ['physics', 'camera', 'procgen'] },
    { id: 'tower-defense', label: 'Tower defense', ruleset: 'defense', tags: ['strategy', 'economy'], requires: ['grid', 'ai', 'procgen'] },
    { id: 'endless-runner', label: 'Endless runner', ruleset: 'runner', tags: ['reflex', 'score'], requires: ['physics', 'collision', 'procgen'] },
    { id: 'stealth-infiltration', label: 'Stealth infiltration', ruleset: 'stealth', tags: ['tension', 'patrol'], requires: ['ai', 'collision', 'procgen'] },
    { id: 'exploration-3d', label: '3D exploration', ruleset: 'explorer3d', tags: ['3d', 'discovery'], requires: ['three', 'camera3d'] },
    { id: 'survival-crafting', label: 'Survival gathering', ruleset: 'arena', tags: ['resources', 'timer'], requires: ['entities', 'collision', 'ai'] },
    { id: 'wave-defense-shooter', label: 'Wave defense shooter', ruleset: 'arena', tags: ['action', 'defend'], requires: ['entities', 'collision', 'ai'] },
    { id: 'maze-escape', label: 'Maze escape', ruleset: 'stealth', tags: ['navigation'], requires: ['procgen', 'ai'] },
    { id: 'block-builder', label: 'Block placement builder', ruleset: 'puzzle', tags: ['creative', 'grid'], requires: ['grid'] },
    { id: 'obstacle-course', label: 'Obstacle course', ruleset: 'platformer', tags: ['skill'], requires: ['physics', 'collision'] },
  ],

  camera: [
    { id: 'fixed', label: 'Fixed single screen', rulesets: ['arena', 'puzzle', 'defense', 'stealth'] },
    { id: 'follow-smooth', label: 'Smooth follow', rulesets: ['arena', 'platformer', 'racer', 'runner', 'stealth'] },
    { id: 'follow-deadzone', label: 'Deadzone follow', rulesets: ['platformer', 'arena', 'runner'] },
    { id: 'side-scroll-lock', label: 'Side-scrolling lock', rulesets: ['platformer', 'runner'] },
    { id: 'rotating-chase', label: 'Rotating chase cam', rulesets: ['racer', 'explorer3d'] },
    { id: 'first-person', label: 'First person', rulesets: ['explorer3d'] },
    { id: 'third-person-3d', label: 'Third person orbit', rulesets: ['explorer3d'] },
    { id: 'isometric', label: 'Isometric tilt', rulesets: ['arena', 'defense', 'stealth'] },
  ],

  controls: [
    { id: 'wasd-8dir', label: 'WASD / arrows, 8 directions', rulesets: ['arena', 'stealth', 'explorer3d'], requires: ['keyboard'] },
    { id: 'wasd-mouse-aim', label: 'Move with keys, aim with pointer', rulesets: ['arena', 'stealth'], requires: ['keyboard', 'pointer'] },
    { id: 'run-jump', label: 'Run and jump', rulesets: ['platformer', 'runner'], requires: ['keyboard'] },
    { id: 'one-button', label: 'One button (tap / space)', rulesets: ['runner', 'platformer'], requires: ['keyboard'] },
    { id: 'grid-step', label: 'Discrete grid steps', rulesets: ['puzzle', 'stealth'], requires: ['keyboard'] },
    { id: 'point-and-click', label: 'Point and click placement', rulesets: ['defense', 'puzzle'], requires: ['pointer'] },
    { id: 'drag-select', label: 'Drag to select and move', rulesets: ['puzzle', 'defense'], requires: ['pointer'] },
    { id: 'steer-throttle', label: 'Steer + throttle', rulesets: ['racer'], requires: ['keyboard'] },
    { id: 'virtual-stick', label: 'Touch virtual stick', rulesets: ['arena', 'racer', 'stealth', 'explorer3d'], requires: ['touch'] },
  ],

  world: [
    { id: 'bounded-arena', label: 'Bounded arena', rulesets: ['arena', 'stealth'] },
    { id: 'wrapping-field', label: 'Screen-wrapping field', rulesets: ['arena'] },
    { id: 'scrolling-lane', label: 'Endless scrolling lane', rulesets: ['runner'] },
    { id: 'handcrafted-levels', label: 'Discrete levels', rulesets: ['platformer', 'puzzle', 'stealth'] },
    { id: 'procedural-rooms', label: 'Procedural rooms', rulesets: ['stealth', 'arena', 'explorer3d'] },
    { id: 'procedural-track', label: 'Procedural closed track', rulesets: ['racer'] },
    { id: 'tile-grid', label: 'Tile grid board', rulesets: ['puzzle', 'defense'] },
    { id: 'path-map', label: 'Path through terrain', rulesets: ['defense'] },
    { id: 'open-3d-field', label: 'Open 3D field', rulesets: ['explorer3d'] },
    { id: 'shrinking-zone', label: 'Shrinking safe zone', rulesets: ['arena', 'stealth'] },
  ],

  objective: [
    { id: 'survive-duration', label: 'Survive for a set time', rulesets: ['arena', 'stealth', 'runner'] },
    { id: 'clear-waves', label: 'Clear N waves', rulesets: ['arena', 'defense'] },
    { id: 'reach-exit', label: 'Reach the exit', rulesets: ['platformer', 'stealth', 'explorer3d'] },
    { id: 'collect-all', label: 'Collect every item', rulesets: ['platformer', 'explorer3d', 'arena', 'stealth'] },
    { id: 'solve-board', label: 'Solve the board', rulesets: ['puzzle'] },
    { id: 'best-lap', label: 'Beat the target lap time', rulesets: ['racer'] },
    { id: 'protect-core', label: 'Keep the core alive', rulesets: ['defense', 'arena'] },
    { id: 'max-distance', label: 'Travel as far as possible', rulesets: ['runner'] },
    { id: 'escape-undetected', label: 'Escape without being seen', rulesets: ['stealth'] },
  ],

  progression: [
    { id: 'wave-escalation', label: 'Escalating waves', rulesets: ['arena', 'defense'] },
    { id: 'level-sequence', label: 'Level sequence with rising difficulty', rulesets: ['platformer', 'puzzle', 'stealth'] },
    { id: 'score-chase', label: 'Pure score chase', rulesets: ['runner', 'arena'] },
    { id: 'economy-upgrades', label: 'Currency and upgrades', rulesets: ['defense', 'arena'] },
    { id: 'time-attack', label: 'Time attack with splits', rulesets: ['racer', 'platformer'] },
    { id: 'unlock-abilities', label: 'Unlockable abilities', rulesets: ['platformer', 'arena', 'explorer3d'] },
    { id: 'speed-ramp', label: 'Continuously rising speed', rulesets: ['runner', 'racer'] },
  ],

  physics: [
    { id: 'topdown-friction', label: 'Top-down acceleration + friction', rulesets: ['arena', 'stealth'] },
    { id: 'platform-gravity', label: 'Gravity, jump arcs, coyote time', rulesets: ['platformer', 'runner'] },
    { id: 'grid-discrete', label: 'Discrete grid movement', rulesets: ['puzzle', 'stealth', 'defense'] },
    { id: 'vehicle-drift', label: 'Vehicle steering with drift', rulesets: ['racer'] },
    { id: 'float-inertia', label: 'Low-friction floaty inertia', rulesets: ['arena', 'explorer3d'] },
    { id: 'kinematic-3d', label: 'Kinematic 3D walk + gravity', rulesets: ['explorer3d'] },
  ],

  enemies: [
    { id: 'chasers', label: 'Direct chasers', rulesets: ['arena', 'runner', 'stealth'] },
    { id: 'patrollers', label: 'Patrolling guards with vision', rulesets: ['stealth', 'arena'] },
    { id: 'shooters', label: 'Ranged attackers', rulesets: ['arena', 'defense'] },
    { id: 'swarm-spawners', label: 'Nests that spawn swarms', rulesets: ['arena', 'defense'] },
    { id: 'hazards-only', label: 'No enemies, only hazards', rulesets: ['platformer', 'runner', 'puzzle', 'racer', 'explorer3d'] },
    { id: 'rival-racers', label: 'Rival AI racers', rulesets: ['racer'] },
    { id: 'creep-waves', label: 'Waves walking a path', rulesets: ['defense'] },
  ],

  rewards: [
    { id: 'score-combo', label: 'Score with combo multiplier', rulesets: RULESETS },
    { id: 'currency-shop', label: 'Currency spent between rounds', rulesets: ['arena', 'defense', 'racer'] },
    { id: 'powerup-drops', label: 'Temporary power-up drops', rulesets: ['arena', 'runner', 'platformer'] },
    { id: 'collectible-set', label: 'Collectible set completion', rulesets: ['platformer', 'explorer3d', 'puzzle', 'stealth'] },
    { id: 'medal-tiers', label: 'Bronze/silver/gold medals', rulesets: ['racer', 'platformer', 'puzzle'] },
  ],

  visualStyle: [
    { id: 'neon-vector', label: 'Neon vector on black', palette: ['#03040a', '#0ff5d4', '#ff2e97', '#ffe45e', '#7c5cff'] },
    { id: 'flat-pastel', label: 'Flat pastel shapes', palette: ['#f7f3ea', '#3d405b', '#81b29a', '#e07a5f', '#f2cc8f'] },
    { id: 'monochrome-ink', label: 'Monochrome ink', palette: ['#f4f4f2', '#141414', '#7a7a78', '#c7c7c2', '#ff4d3d'] },
    { id: 'retro-crt', label: 'Retro CRT phosphor', palette: ['#0b1b0b', '#63ff5b', '#b7ff9e', '#1d3b1d', '#ffe94a'] },
    { id: 'blueprint', label: 'Blueprint schematic', palette: ['#0a2239', '#9ad1f5', '#e8f4ff', '#2f6f9f', '#ffb347'] },
    { id: 'sunset-gradient', label: 'Warm gradient dusk', palette: ['#1b0a2a', '#ff7b54', '#ffd56b', '#6c5ce7', '#ffe9d6'] },
    { id: 'high-contrast', label: 'High-contrast accessibility', palette: ['#000000', '#ffffff', '#ffd400', '#00b3ff', '#ff3b30'] },
    { id: 'deep-sea', label: 'Deep sea bioluminescence', palette: ['#02111b', '#30c5d2', '#a4f9c8', '#173e43', '#f5f3bb'] },
  ],

  ui: [
    { id: 'minimal-hud', label: 'Minimal corner HUD' },
    { id: 'full-hud', label: 'Full HUD with bars and panels' },
    { id: 'diegetic', label: 'In-world diegetic indicators' },
    { id: 'panel-sidebar', label: 'Sidebar panel with stats' },
  ],

  audio: [
    { id: 'procedural-sfx', label: 'Procedural WebAudio effects', requires: ['audio'] },
    { id: 'tone-cues', label: 'Sparse tonal cues only', requires: ['audio'] },
    { id: 'silent', label: 'Silent (visual feedback only)' },
  ],

  /**
   * Twists are the novelty lever. They are implemented as real modifiers in the
   * rulesets, not as flavour text.
   */
  twist: [
    { id: 'none', label: 'No modifier', rulesets: RULESETS, weight: 0.4 },
    { id: 'gravity-flip', label: 'Gravity can be flipped', rulesets: ['platformer', 'runner'] },
    { id: 'time-dilation', label: 'Time slows while aiming/steering', rulesets: ['arena', 'racer', 'stealth', 'platformer'] },
    { id: 'shrinking-arena', label: 'The playable area shrinks', rulesets: ['arena', 'stealth', 'runner'] },
    { id: 'resource-decay', label: 'A core resource drains constantly', rulesets: ['arena', 'stealth', 'explorer3d', 'defense'] },
    { id: 'one-hit-fragile', label: 'One hit ends the run', rulesets: ['arena', 'platformer', 'runner', 'stealth'] },
    { id: 'light-radius', label: 'Vision limited to a light radius', rulesets: ['arena', 'stealth', 'explorer3d', 'platformer'] },
    { id: 'combo-chain', label: 'Chaining actions multiplies reward', rulesets: RULESETS },
    { id: 'terrain-mutation', label: 'The terrain changes as you play', rulesets: ['arena', 'defense', 'puzzle', 'racer'] },
    { id: 'echo-replay', label: 'A ghost of your last run competes with you', rulesets: ['racer', 'platformer', 'runner'] },
    { id: 'charge-release', label: 'Actions must be charged and released', rulesets: ['arena', 'platformer', 'puzzle'] },
    { id: 'rhythm-window', label: 'Actions are stronger on the beat', rulesets: ['arena', 'runner', 'platformer'] },
  ],
};

export const DIMENSION_KEYS = Object.keys(DIMENSIONS);

/** Weights used when measuring how similar two designs are (spec 5). */
export const SIMILARITY_WEIGHTS = {
  genre: 3.0, twist: 2.2, objective: 1.8, physics: 1.6, world: 1.5, enemies: 1.3,
  progression: 1.2, controls: 1.1, camera: 0.9, rewards: 0.7, visualStyle: 0.5, ui: 0.4, audio: 0.3,
};

export function optionsFor(dimension, ruleset) {
  const list = DIMENSIONS[dimension] || [];
  if (!ruleset) return list;
  return list.filter((o) => !o.rulesets || o.rulesets.includes(ruleset));
}

export function findOption(dimension, id) {
  return (DIMENSIONS[dimension] || []).find((o) => o.id === id) || null;
}

/** Total size of the constrained trait space - reported honestly in the UI. */
export function spaceSize() {
  let total = 0;
  for (const g of DIMENSIONS.genre) {
    let n = 1;
    for (const dim of DIMENSION_KEYS) {
      if (dim === 'genre') continue;
      n *= Math.max(1, optionsFor(dim, g.ruleset).length);
    }
    total += n;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Palette contrast
// ---------------------------------------------------------------------------
// A palette that looks good in a swatch row can still render a game where the
// player is barely visible against the floor. These helpers enforce a minimum
// contrast ratio against the background colour (palette[0]) before the palette
// reaches the generator, so light themes stay as legible as dark ones.

function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

/** WCAG relative luminance. */
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours (1 = identical, 21 = black/white). */
export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Pushes `hex` away from `bg` until the contrast target is met. */
export function ensureContrast(hex, bg, target = 3.5) {
  if (contrastRatio(hex, bg) >= target) return hex;
  const bgLight = luminance(bg) > 0.5;
  let rgb = hexToRgb(hex);
  for (let i = 0; i < 24; i++) {
    rgb = rgb.map((v) => (bgLight ? v * 0.86 : v + (255 - v) * 0.16));
    const candidate = rgbToHex(rgb);
    if (contrastRatio(candidate, bg) >= target) return candidate;
  }
  return bgLight ? '#101014' : '#f5f7ff';
}

/**
 * Returns a palette where every colour after the background is guaranteed to
 * be readable against it: text/ink at 7:1, gameplay colours at 3.5:1.
 */
export function normalizePalette(palette) {
  const bg = palette[0];
  return [
    bg,
    ensureContrast(palette[1], bg, 7),
    ...palette.slice(2).map((c) => ensureContrast(c, bg, 3.5)),
  ];
}
