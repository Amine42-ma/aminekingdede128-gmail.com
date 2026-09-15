/**
 * GAME DESIGN ENGINE (spec 25).
 *
 * Produces a complete design document *before* any code is written:
 *   concept -> core loop -> player goal -> controls -> progression ->
 *   difficulty -> world -> UI -> technical architecture -> implementation plan
 *
 * The document is the single input to the generator, which means a design can
 * be reviewed, edited, stored and regenerated deterministically from its seed.
 */
import { findOption, normalizePalette, luminance } from './traits.js';
import { NoveltyEngine } from './novelty.js';
import { rng as makeRng, id as makeId, slug, round, clamp, titleCase } from '../core/util.js';

/** Baseline parameters per physics model, in real units (px/s, px/s^2). */
const PHYSICS_DEFAULTS = {
  'topdown-friction': { maxSpeed: 260, accel: 1800, friction: 8.5, drag: 0.86 },
  'platform-gravity': { gravity: 2000, jumpVelocity: 620, moveSpeed: 240, accel: 2200, friction: 12, coyoteMs: 90, bufferMs: 120, maxFall: 900 },
  'grid-discrete': { stepMs: 120, tileSize: 40 },
  'vehicle-drift': { engine: 520, turnRate: 2.6, gripForward: 0.97, gripLateral: 0.86, brake: 900, maxSpeed: 430 },
  'float-inertia': { maxSpeed: 300, accel: 900, friction: 1.4, drag: 0.985 },
  'kinematic-3d': { moveSpeed: 6.5, gravity: 22, jumpVelocity: 8.5, lookSensitivity: 0.0022 },
};

const CONTROL_BINDINGS = {
  'wasd-8dir': { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], action: ['Space'], secondary: ['ShiftLeft'] },
  'wasd-mouse-aim': { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], action: ['Mouse0', 'Space'], secondary: ['ShiftLeft'] },
  'run-jump': { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], action: ['Space', 'KeyW', 'ArrowUp'], secondary: ['ShiftLeft'] },
  'one-button': { action: ['Space', 'Mouse0', 'ArrowUp'] },
  'grid-step': { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], action: ['Space'], undo: ['KeyZ'] },
  // Pointer schemes keep a keyboard fallback: a build that is unplayable
  // without a mouse fails the lab's own input-response check, and excludes
  // keyboard-only players.
  'point-and-click': { action: ['Mouse0', 'Space'], secondary: ['Mouse2', 'ShiftLeft'], cycle: ['Tab'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] },
  'drag-select': { action: ['Mouse0', 'Space'], secondary: ['Mouse2', 'ShiftLeft'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] },
  'steer-throttle': { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], action: ['Space'] },
  'virtual-stick': { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], action: ['Space'] },
};

const CORE_LOOPS = {
  arena: ['read the threat layout', 'reposition', 'commit to an attack or dodge', 'collect what drops', 'survive the escalation'],
  platformer: ['read the next obstacle', 'time the jump', 'land and keep momentum', 'collect the optional pickup', 'reach the next checkpoint'],
  puzzle: ['read the board', 'plan a sequence', 'commit a move', 'observe the cascade', 'undo or advance'],
  racer: ['read the corner ahead', 'brake and turn in', 'hold the line', 'hit the checkpoint', 'shave the lap time'],
  defense: ['read the incoming path', 'spend resources on placement', 'watch the wave resolve', 'repair and upgrade', 'face a harder wave'],
  runner: ['read the pattern ahead', 'react', 'chain a near miss', 'bank the multiplier', 'push for distance'],
  stealth: ['observe the patrol', 'pick a window', 'move quietly', 'break line of sight', 'slip past to the exit'],
  explorer3d: ['scan the space', 'choose a direction', 'traverse', 'interact with what you find', 'update your mental map'],
};

const TWIST_RULES = {
  'gravity-flip': { mechanic: 'flip-gravity', description: 'A held action inverts gravity; level geometry is designed to be traversed both ways.' },
  'time-dilation': { mechanic: 'time-scale', description: 'Holding the secondary action slows simulation time while a meter drains.' },
  'shrinking-arena': { mechanic: 'shrink-bounds', description: 'The playable bounds contract over time, forcing engagement.' },
  'resource-decay': { mechanic: 'resource-drain', description: 'A core resource drains every second; pickups top it back up.' },
  'one-hit-fragile': { mechanic: 'one-hit', description: 'The player has a single hit point; the reward curve is raised to compensate.' },
  'light-radius': { mechanic: 'light-radius', description: 'Vision is limited to a radius that shrinks as the resource drains.' },
  'combo-chain': { mechanic: 'combo', description: 'Consecutive successful actions inside a window multiply the reward.' },
  'terrain-mutation': { mechanic: 'terrain-mutation', description: 'Parts of the terrain change state as the round progresses.' },
  'echo-replay': { mechanic: 'ghost-replay', description: 'The previous run is recorded and replayed as a competing ghost.' },
  'charge-release': { mechanic: 'charge', description: 'The main action must be charged; release strength scales with charge time.' },
  'rhythm-window': { mechanic: 'beat-window', description: 'A steady beat runs; acting inside the window boosts the effect.' },
  none: { mechanic: null, description: 'No global modifier; the base loop carries the design.' },
};

/**
 * Imported projects often store per-frame constants (gravity 0.68 means
 * 0.68 px per frame^2 at 60fps). We convert to per-second units before using
 * them as priors, and we record that we did.
 */
function normalizePrior(name, value) {
  if (!Number.isFinite(value)) return null;
  const accelLike = /gravity|accel/i.test(name);
  const speedLike = /speed|velocity|jump/i.test(name);
  if (accelLike && Math.abs(value) < 8) return { value: value * 3600, converted: 'per-frame^2 -> per-second^2 (x3600 @60fps)' };
  if (speedLike && Math.abs(value) < 25) return { value: value * 60, converted: 'per-frame -> per-second (x60 @60fps)' };
  return { value, converted: null };
}

export class Designer {
  constructor({ store, bus, knowledge, diversity, graph }) {
    this.store = store;
    this.bus = bus;
    this.knowledge = knowledge;
    this.diversity = diversity;
    this.graph = graph;
    this.novelty = new NoveltyEngine({ store, diversity, bus });
  }

  /**
   * @param {object} opts
   * @param {string} [opts.seed]
   * @param {object} [opts.brief] user constraints: {genre, twist, theme, mustUseAssets:[assetId]}
   */
  async design({ seed = null, brief = {}, noveltyWeight = 1.0 } = {}) {
    const usedSeed = seed || makeId('seed');
    const rng = makeRng(usedSeed);

    const proposal = await this.novelty.proposeTraits({ rng, brief, noveltyWeight });
    const { traits, ruleset } = proposal;
    const theme = await this.novelty.synthesizeTheme({ rng, traits, graph: this.graph });
    const caps = await this.knowledge.capabilities({ minConfidence: 0.2 });
    const knowledgeIndex = new Map(caps.supported.map((k) => [k.key, k]));

    const genre = findOption('genre', traits.genre);
    const physics = this.#parameters(traits, caps.parameters, rng);
    const world = this.#world(traits, ruleset, rng, physics);
    const entities = this.#entities(traits, ruleset, rng);
    const progression = this.#progression(traits, ruleset, rng);
    const twist = TWIST_RULES[traits.twist] || TWIST_RULES.none;
    const modules = this.#modules(traits, ruleset, caps);
    const style = findOption('visualStyle', traits.visualStyle);

    const name = this.#name(rng, traits, theme);
    const design = {
      id: makeId('design'),
      seed: usedSeed,
      name,
      slug: slug(name),
      ruleset,
      traits,
      theme,
      pitch: this.#pitch(traits, theme, twist),
      concept: {
        premise: `You play ${theme.role} in ${theme.setting}. ${capitalize(theme.pressure)}.`,
        fantasy: genre?.label || traits.genre,
        sessionLength: progression.model === 'score-chase' ? '60-180s runs' : '3-8 minute sessions',
        audience: 'browser, keyboard + pointer, playable on a phone in portrait or landscape',
      },
      coreLoop: CORE_LOOPS[ruleset] || CORE_LOOPS.arena,
      playerGoal: findOption('objective', traits.objective)?.label || 'survive',
      winCondition: this.#winCondition(traits, progression),
      loseCondition: this.#loseCondition(traits),
      controls: {
        scheme: traits.controls,
        label: findOption('controls', traits.controls)?.label,
        bindings: CONTROL_BINDINGS[traits.controls] || CONTROL_BINDINGS['wasd-8dir'],
        pointerAim: traits.controls === 'wasd-mouse-aim' || traits.controls === 'point-and-click' || traits.controls === 'drag-select',
        mobile: { virtualStick: ['wasd-8dir', 'wasd-mouse-aim', 'virtual-stick', 'steer-throttle'].includes(traits.controls), tapAction: true },
      },
      camera: { mode: traits.camera, label: findOption('camera', traits.camera)?.label },
      world,
      entities,
      progression,
      difficulty: this.#difficulty(progression, rng),
      twist: { id: traits.twist, ...twist },
      ui: { style: traits.ui, label: findOption('ui', traits.ui)?.label, elements: this.#uiElements(traits, ruleset, progression) },
      audio: { style: traits.audio, cues: traits.audio === 'silent' ? [] : this.#audioCues(ruleset) },
      visual: {
        style: traits.visualStyle,
        label: style?.label,
        // Contrast-checked before anything is emitted: a palette that renders an
        // invisible player is a real defect, not a style choice.
        palette: normalizePalette(style?.palette || ['#05060c', '#eaeaf2', '#7c5cff', '#00d4a0', '#ff5470']),
        lightBackground: luminance((style?.palette || ['#05060c'])[0]) > 0.5,
      },
      parameters: physics.values,
      parameterSources: physics.sources,
      architecture: {
        structure: 'multi-file',
        loopStyle: modules.loopStyle,
        modules: modules.list,
        rendering: ruleset === 'explorer3d' ? 'three.js (WebGL)' : 'canvas 2D',
        files: modules.files,
        rationale: modules.rationale,
      },
      sourceKnowledge: this.#sourceKnowledge(modules.list, knowledgeIndex),
      assets: brief.assets || [],
      novelty: proposal.evaluation,
      risks: this.#risks(traits, ruleset, modules),
      createdAt: new Date().toISOString(),
    };

    const check = await this.diversity.checkDesign(design);
    design.diversity = check;

    if (!check.pass) {
      // Regenerate with stronger novelty pressure rather than shipping a clone.
      this.bus?.warn('diversity.reject', { name: design.name, similarity: check.max, nearest: check.nearest?.name });
      if (noveltyWeight < 3) {
        return this.design({ seed: `${usedSeed}-r`, brief, noveltyWeight: noveltyWeight + 1 });
      }
      design.diversityOverride = 'Trait space is saturated for these constraints; shipped the least-similar available design.';
    }

    this.bus?.success('design.created', { name: design.name, genre: traits.genre, twist: traits.twist, novelty: design.novelty.novelty });
    return design;
  }

  #parameters(traits, learned, rng) {
    const base = { ...(PHYSICS_DEFAULTS[traits.physics] || PHYSICS_DEFAULTS['topdown-friction']) };
    const values = { ...base };
    const sources = {};
    const map = { gravity: 'gravity', accel: 'accel', maxSpeed: 'maxspeed', moveSpeed: 'speed', friction: 'friction', jumpVelocity: 'jump' };

    for (const [param, priorKey] of Object.entries(map)) {
      if (values[param] == null) continue;
      const prior = learned?.[priorKey];
      if (!prior || !Number.isFinite(prior.median)) {
        sources[param] = `genre default (${base[param]}) - no learned prior available`;
        continue;
      }
      const norm = normalizePrior(param, prior.median);
      if (!norm) continue;
      // Blend 40% toward the learned prior, clamped to a sane band around the default.
      const blended = clamp(base[param] * 0.6 + norm.value * 0.4, base[param] * 0.45, base[param] * 2.2);
      values[param] = round(blended, 2);
      sources[param] = `blended 60/40 with learned prior from ${prior.projects?.length || 0} project(s): median ${prior.median}${norm.converted ? ` (${norm.converted})` : ''}`;
    }
    // small deterministic variation so two designs with the same traits still feel different
    for (const k of Object.keys(values)) {
      if (typeof values[k] !== 'number') continue;
      values[k] = round(values[k] * rng.range(0.92, 1.08), 3);
    }
    return { values, sources };
  }

  #world(traits, ruleset, rng, physics) {
    const tile = physics.values.tileSize || rng.pick([32, 36, 40, 44, 48]);
    const common = { kind: traits.world, label: findOption('world', traits.world)?.label, seed: rng.int(1, 1e9) };
    switch (ruleset) {
      case 'puzzle':
        return { ...common, cols: rng.int(6, 10), rows: rng.int(6, 10), tileSize: tile, targets: rng.int(3, 6), movableBlocks: rng.int(3, 7) };
      case 'defense':
        return { ...common, cols: rng.int(12, 18), rows: rng.int(8, 12), tileSize: rng.int(34, 46), pathTurns: rng.int(4, 9), buildableRatio: round(rng.range(0.45, 0.7), 2) };
      case 'racer':
        return { ...common, trackPoints: rng.int(7, 12), trackRadius: rng.int(560, 900), trackWidth: rng.int(110, 170), laps: rng.int(2, 4), checkpoints: rng.int(6, 12) };
      case 'platformer':
        return { ...common, width: rng.int(2600, 4200), height: 720, platformCount: rng.int(16, 30), hazardCount: rng.int(4, 12), collectibles: rng.int(6, 16), gapBias: round(rng.range(0.25, 0.55), 2) };
      case 'runner':
        return { ...common, laneCount: rng.int(1, 3), chunkWidth: 420, obstacleDensity: round(rng.range(0.35, 0.7), 2), scrollSpeed: rng.int(260, 420) };
      case 'stealth':
        return { ...common, cols: rng.int(18, 26), rows: rng.int(12, 18), tileSize: rng.int(32, 44), guards: rng.int(3, 7), rooms: rng.int(5, 10), exits: 1 };
      case 'explorer3d':
        return { ...common, size: rng.int(90, 180), scatter: rng.int(40, 120), landmarks: rng.int(4, 9), collectibles: rng.int(5, 12) };
      default:
        return { ...common, width: rng.int(900, 1400), height: rng.int(620, 900), spawnMargin: 60, obstacles: rng.int(0, 10) };
    }
  }

  #entities(traits, ruleset, rng) {
    const list = [{ id: 'player', role: 'player', hp: traits.twist === 'one-hit-fragile' ? 1 : rng.int(3, 6), radius: rng.int(10, 16), speedFactor: 1 }];
    const enemy = traits.enemies;
    if (enemy !== 'hazards-only') {
      const behaviour = {
        chasers: 'seek', patrollers: 'patrol-vision', shooters: 'keep-distance-and-fire',
        'swarm-spawners': 'spawn-nest', 'rival-racers': 'follow-racing-line', 'creep-waves': 'follow-path',
      }[enemy] || 'seek';
      list.push({ id: 'enemy', role: 'enemy', behaviour, hp: rng.int(1, 4), radius: rng.int(9, 15), speedFactor: round(rng.range(0.45, 0.95), 2), count: rng.int(3, 9) });
    }
    if (['arena', 'runner', 'platformer', 'stealth', 'explorer3d'].includes(ruleset)) {
      list.push({ id: 'pickup', role: 'pickup', effect: traits.rewards === 'powerup-drops' ? 'powerup' : 'score', radius: 8, count: rng.int(4, 12) });
    }
    if (ruleset === 'defense') list.push({ id: 'tower', role: 'buildable', cost: rng.int(20, 45), range: rng.int(90, 170), fireRate: round(rng.range(0.6, 1.8), 2), damage: rng.int(4, 12) });
    if (ruleset === 'arena' && traits.objective === 'protect-core') list.push({ id: 'core', role: 'objective', hp: rng.int(8, 20), radius: 26 });
    if (['arena', 'stealth', 'platformer'].includes(ruleset) && rng.chance(0.5)) list.push({ id: 'hazard', role: 'hazard', damage: 1, count: rng.int(2, 8) });
    return list;
  }

  #progression(traits, ruleset, rng) {
    const model = traits.progression;
    const stageCount = { 'wave-escalation': rng.int(5, 9), 'level-sequence': rng.int(4, 8), 'score-chase': 1, 'economy-upgrades': rng.int(5, 8), 'time-attack': rng.int(2, 4), 'unlock-abilities': rng.int(3, 6), 'speed-ramp': 1 }[model] || 5;
    const stages = [];
    for (let i = 0; i < stageCount; i++) {
      const t = stageCount > 1 ? i / (stageCount - 1) : 0;
      stages.push({
        index: i + 1,
        label: model === 'wave-escalation' ? `Wave ${i + 1}` : model === 'level-sequence' ? `Level ${i + 1}` : `Stage ${i + 1}`,
        enemyCount: Math.round(3 + t * rng.int(8, 18)),
        enemySpeed: round(1 + t * rng.range(0.25, 0.7), 2),
        spawnInterval: round(1.6 - t * rng.range(0.6, 1.0), 2),
        durationSec: model === 'wave-escalation' ? Math.round(18 + t * 22) : null,
        reward: Math.round(10 + t * 60),
      });
    }
    return {
      model,
      label: findOption('progression', model)?.label,
      stages,
      unlocks: model === 'unlock-abilities' ? rng.sample(['dash', 'double-jump', 'shield', 'magnet', 'slow-field'], 3) : [],
      economy: model === 'economy-upgrades' ? { startingCurrency: rng.int(40, 90), upgradeCosts: [25, 45, 80, 140] } : null,
    };
  }

  #difficulty(progression, rng) {
    const points = progression.stages.map((s, i) => ({
      at: s.label,
      pressure: round(clamp(0.2 + (i / Math.max(1, progression.stages.length - 1)) * rng.range(0.55, 0.85), 0, 1), 2),
    }));
    return {
      curve: points,
      rampStyle: rng.pick(['linear', 'stepped', 'ease-in', 'wave-with-rest-beats']),
      catchUp: rng.chance(0.5) ? 'brief calm window after each spike' : 'no catch-up assistance',
    };
  }

  #uiElements(traits, ruleset, progression) {
    const els = [{ id: 'score', kind: 'counter', label: 'Score' }];
    if (traits.twist === 'one-hit-fragile') els.push({ id: 'fragile', kind: 'badge', label: 'One hit' });
    else els.push({ id: 'health', kind: 'bar', label: 'Health' });
    if (progression.model === 'wave-escalation') els.push({ id: 'wave', kind: 'counter', label: 'Wave' });
    if (progression.model === 'time-attack' || ruleset === 'racer') els.push({ id: 'timer', kind: 'timer', label: 'Time' });
    if (ruleset === 'racer') els.push({ id: 'lap', kind: 'counter', label: 'Lap' });
    if (ruleset === 'defense') els.push({ id: 'currency', kind: 'counter', label: 'Credits' }, { id: 'lives', kind: 'counter', label: 'Core' });
    if (ruleset === 'puzzle') els.push({ id: 'moves', kind: 'counter', label: 'Moves' });
    if (traits.twist === 'resource-decay' || traits.twist === 'light-radius') els.push({ id: 'resource', kind: 'bar', label: 'Power' });
    if (traits.twist === 'combo-chain') els.push({ id: 'combo', kind: 'multiplier', label: 'Combo' });
    els.push({ id: 'menu', kind: 'overlay', label: 'Start / pause / game over' });
    return els;
  }

  #audioCues(ruleset) {
    const base = [
      { id: 'action', wave: 'square', freq: 440, ms: 60 },
      { id: 'hit', wave: 'sawtooth', freq: 140, ms: 120 },
      { id: 'pickup', wave: 'triangle', freq: 880, ms: 90 },
      { id: 'lose', wave: 'sine', freq: 90, ms: 400 },
      { id: 'win', wave: 'triangle', freq: 660, ms: 320 },
    ];
    if (ruleset === 'racer') base.push({ id: 'checkpoint', wave: 'square', freq: 720, ms: 100 });
    if (ruleset === 'defense') base.push({ id: 'build', wave: 'triangle', freq: 320, ms: 90 });
    return base;
  }

  #modules(traits, ruleset, caps) {
    const list = ['core', 'input', 'math', 'entities', 'render', 'ui', 'save'];
    const rationale = {};
    const has = (k) => caps.supported.some((c) => c.key === k);

    // Every ruleset needs a movement integrator (grid-stepped counts) and a
    // camera transform; only the collision broadphase is genre-dependent.
    list.push('physics', 'camera');
    if (ruleset !== 'puzzle') list.push('collision');
    if (['arena', 'stealth', 'defense', 'racer', 'runner'].includes(ruleset)) list.push('ai');
    if (['racer', 'platformer', 'runner', 'stealth', 'defense', 'explorer3d', 'arena'].includes(ruleset)) list.push('procgen');
    if (traits.audio !== 'silent') list.push('audio');
    if (['arena', 'runner', 'racer', 'platformer'].includes(ruleset)) list.push('particles');
    if (ruleset === 'explorer3d') list.push('three');

    // Learned preferences: the corpus decides optional engineering choices.
    const spatial = has('opt.spatial');
    const pooling = has('opt.pooling');
    const fixedStep = has('game-loop.fixed-step');
    rationale.broadphase = spatial ? 'uniform grid broadphase (corpus shows spatial partitioning)' : 'simple pairwise broadphase (entity counts stay low)';
    rationale.pooling = pooling ? 'object pooling enabled (learned from corpus)' : 'direct allocation with a small cap';
    rationale.loop = fixedStep ? 'fixed-timestep accumulator (learned from corpus; deterministic physics)' : 'delta-time loop with clamped dt';

    const files = [
      'index.html', 'styles/main.css', 'manifest.json', 'README.md',
      ...list.map((m) => `src/engine/${m}.js`),
      'src/game/config.js', 'src/game/world.js', 'src/game/rules.js', 'src/game/main.js',
    ];

    return {
      list: [...new Set(list)],
      loopStyle: fixedStep ? 'fixed-timestep-accumulator' : 'raf-delta',
      options: { spatialHash: spatial, pooling, dpr: true, mobileControls: true },
      files,
      rationale,
    };
  }

  #sourceKnowledge(modules, index) {
    const map = {
      core: ['game-loop.fixed-step', 'game-loop.raf-delta', 'lifecycle.pause-on-blur'],
      input: ['input.keyboard-map', 'input.pointer', 'input.touch-mobile'],
      collision: ['physics.collision', 'opt.spatial'],
      physics: ['physics.tuning', 'sim.interpolation'],
      camera: ['sim.interpolation'],
      render: ['render.canvas2d', 'render.dpr'],
      ui: ['ui.hud-overlay', 'ui.design-tokens', 'ui.responsive'],
      save: ['data.save-localstorage'],
      audio: ['audio.webaudio'],
      particles: ['opt.pooling'],
      ai: ['ai.steering', 'ai.pathfinding'],
      procgen: ['procgen.noise', 'procgen.seeded'],
      three: ['3d.threejs', '3d.gltf-loading'],
    };
    const out = [];
    for (const m of modules) {
      for (const key of map[m] || []) {
        const item = index.get(key);
        if (!item) continue;
        out.push({
          key,
          concept: item.concept,
          confidence: item.confidence,
          sourceProjects: item.sources.map((s) => s.projectName).slice(0, 4),
          usedFor: m,
          note: 'concept reused; no source code was copied from these projects',
        });
      }
    }
    return out;
  }

  #winCondition(traits, progression) {
    switch (traits.objective) {
      case 'survive-duration': return { type: 'survive', seconds: 90 + progression.stages.length * 10 };
      case 'clear-waves': return { type: 'waves', count: progression.stages.length };
      case 'reach-exit': return { type: 'reach', target: 'exit' };
      case 'collect-all': return { type: 'collect', ratio: 1 };
      case 'solve-board': return { type: 'solve' };
      case 'best-lap': return { type: 'lap-time', targetSeconds: 45 };
      case 'protect-core': return { type: 'defend', waves: progression.stages.length };
      case 'max-distance': return { type: 'distance', endless: true };
      case 'escape-undetected': return { type: 'reach', target: 'exit', constraint: 'never fully detected' };
      default: return { type: 'score', target: 1000 };
    }
  }

  #loseCondition(traits) {
    if (traits.twist === 'one-hit-fragile') return { type: 'single-hit' };
    if (traits.twist === 'resource-decay') return { type: 'resource-empty' };
    if (traits.objective === 'protect-core') return { type: 'core-destroyed' };
    if (traits.enemies === 'hazards-only') return { type: 'hazard-contact-or-fall' };
    return { type: 'health-zero' };
  }

  #risks(traits, ruleset, modules) {
    const risks = [];
    if (ruleset === 'explorer3d') risks.push({ risk: '3D build cannot be verified by the headless sandbox', mitigation: 'static checks only; run it in a browser to confirm rendering', severity: 'medium' });
    if (traits.controls === 'point-and-click' && traits.camera !== 'fixed') risks.push({ risk: 'pointer placement with a moving camera needs screen->world conversion', mitigation: 'camera transform is applied to pointer input in the input module', severity: 'low' });
    if (traits.twist === 'echo-replay') risks.push({ risk: 'replay recording must stay deterministic', mitigation: 'record input samples with a fixed step', severity: 'low' });
    if (modules.list.includes('procgen')) risks.push({ risk: 'procedural layouts can generate unplayable levels', mitigation: 'generator validates reachability and regenerates on failure', severity: 'medium' });
    return risks;
  }

  #name(rng, traits, theme) {
    const A = ['Drift', 'Hollow', 'Signal', 'Ember', 'Static', 'Lantern', 'Quiet', 'Iron', 'Salt', 'Glass', 'Pale', 'Vault', 'Tide', 'Cinder', 'North', 'Amber'];
    const B = ['Circuit', 'Harbour', 'Garden', 'Relay', 'Spiral', 'Current', 'Archive', 'Orbit', 'Threshold', 'Canopy', 'Foundry', 'Lattice', 'Ridge', 'Beacon'];
    const suffix = { 'one-hit-fragile': 'Fragile', 'shrinking-arena': 'Contraction', 'light-radius': 'Dim', 'echo-replay': 'Echo', 'rhythm-window': 'Pulse', 'time-dilation': 'Slow' }[traits.twist];
    const name = `${rng.pick(A)} ${rng.pick(B)}${suffix ? `: ${suffix}` : ''}`;
    return titleCase(name);
  }

  #pitch(traits, theme, twist) {
    const goal = findOption('objective', traits.objective)?.label?.toLowerCase() || 'survive';
    const world = findOption('world', traits.world)?.label?.toLowerCase() || 'an arena';
    return `${capitalize(goal)} across ${world} as ${theme.role}, while ${theme.pressure}. ${twist.description}`;
  }
}

function capitalize(s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); }
