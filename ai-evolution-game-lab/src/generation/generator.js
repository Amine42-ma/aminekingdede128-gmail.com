/**
 * Generation orchestrator (spec 26).
 *
 * design document -> emitted files -> disk -> originality check -> record.
 * The generator never concatenates imported source; it composes the lab's own
 * emitters against the design, then verifies the result does not echo the
 * corpus (diversity.checkCode).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { emitCore, emitMath, emitInput, emitEntities } from './emit/engine-core.js';
import { emitPhysics, emitCollision, emitCamera, emitAi, emitProcgen, emitParticles } from './emit/engine-sim.js';
import { emitRender, emitUi, emitAudio, emitSave, emitThree } from './emit/engine-view.js';
import { emitConfig, emitMain, emitHtml, emitCss, emitManifest, emitReadme } from './assemble.js';
import { getRuleset } from './rules/index.js';
import { id as makeId, slug, bytes as fmtBytes } from '../core/util.js';

const AI_BEHAVIOURS = {
  chasers: ['seek'],
  patrollers: ['patrol', 'seek'],
  shooters: ['standOff', 'seek'],
  'swarm-spawners': ['seek', 'wander'],
  'rival-racers': ['followPath'],
  'creep-waves': ['followPath'],
  'hazards-only': [],
};

/**
 * Some rulesets call specific AI helpers no matter which enemy trait the design
 * picked (a stealth level needs vision cones even if its enemies are chasers).
 * Emitting a behaviour the rules call is not optional - this union is what
 * keeps the emitted code self-consistent.
 */
const RULESET_AI = {
  stealth: ['patrol', 'seek'],
  defense: ['seek', 'followPath'],
  racer: ['followPath'],
  arena: ['seek'],
  runner: ['seek'],
  platformer: [],
  puzzle: [],
  explorer3d: [],
};

const PROCGEN_FEATURES = {
  arena: ['noise'],
  platformer: ['platforms', 'noise'],
  runner: ['noise'],
  puzzle: ['noise'],
  racer: ['track', 'noise'],
  defense: ['path', 'noise'],
  stealth: ['rooms', 'maze', 'noise'],
  explorer3d: ['noise', 'rooms'],
};

export class Generator {
  constructor({ config, store, bus, diversity, knowledge }) {
    this.config = config;
    this.store = store;
    this.bus = bus;
    this.diversity = diversity;
    this.knowledge = knowledge;
  }

  /** Build the in-memory file map for a design (no disk writes). */
  buildFiles(design, policy = {}) {
    const modules = new Set(design.architecture.modules);
    const opts = policy.options || {};
    const files = new Map();
    const ruleset = getRuleset(design.ruleset);

    const spatialHash = opts.spatialHash ?? design.architecture.modules.includes('collision');
    const pooling = opts.pooling ?? true;
    const swept = opts.sweptCollision ?? true;
    const dtClamp = opts.dtClamp ?? 0.05;
    const dpr = opts.dprScaling ?? true;
    const pauseOnBlur = opts.pauseOnBlur ?? true;
    const loopStyle = policy.loopStyle || design.architecture.loopStyle;

    files.set('src/engine/core.js', emitCore({ loopStyle, dtClamp, fixedStep: policy.fixedStep || 1 / 60, pauseOnBlur }));
    files.set('src/engine/math.js', emitMath({ spatialHash }));
    files.set('src/engine/input.js', emitInput({
      bindings: { ...design.controls.bindings, pause: ['KeyP'] },
      pointerAim: design.controls.pointerAim,
      virtualStick: design.controls.mobile?.virtualStick,
      gamepad: opts.gamepad ?? true,
      bufferMs: opts.inputBufferMs ?? 120,
    }));
    files.set('src/engine/entities.js', emitEntities({ pooling, maxEntities: 1200 }));

    if (modules.has('physics')) {
      files.set('src/engine/physics.js', emitPhysics({ model: design.traits.physics, params: design.parameters, twist: design.twist.mechanic }));
    }
    if (modules.has('collision')) {
      files.set('src/engine/collision.js', emitCollision({ spatialHash, swept, cell: opts.gridCell ?? 64 }));
    }
    if (modules.has('camera')) {
      files.set('src/engine/camera.js', emitCamera({ mode: design.traits.camera, isometric: design.traits.camera === 'isometric' }));
    }
    if (modules.has('ai')) {
      files.set('src/engine/ai.js', emitAi({
        behaviours: [...new Set([...(AI_BEHAVIOURS[design.traits.enemies] || ['seek']), ...(RULESET_AI[design.ruleset] || [])])],
        grid: ['stealth', 'defense', 'puzzle'].includes(design.ruleset),
      }));
    }
    if (modules.has('procgen')) {
      files.set('src/engine/procgen.js', emitProcgen({ features: PROCGEN_FEATURES[design.ruleset] || ['noise'] }));
    }
    if (modules.has('particles')) {
      files.set('src/engine/particles.js', emitParticles({ pooling, max: opts.maxParticles ?? 600 }));
    }
    files.set('src/engine/render.js', emitRender({ palette: design.visual.palette, dpr, style: design.traits.visualStyle, lightBackground: !!design.visual.lightBackground }));
    files.set('src/engine/ui.js', emitUi({
      elements: design.ui.elements,
      mobileControls: opts.mobileControls ?? true,
      title: design.name,
      controlsHelp: Object.entries(design.controls.bindings || {}).map(([a, k]) => `${a}: ${k.slice(0, 2).join(' / ')}`),
    }));
    files.set('src/engine/audio.js', emitAudio({ cues: design.audio.cues, enabled: design.traits.audio !== 'silent' }));
    files.set('src/engine/save.js', emitSave({ key: `${slug(design.name)}.save`, version: 1, fields: ['best', 'runs', 'unlocks'] }));
    if (modules.has('three')) {
      files.set('src/engine/three.js', emitThree({ models: (design.assets || []).filter((a) => a.kind === 'model').map((a) => a.ref) }));
    }

    files.set('src/game/config.js', emitConfig(design, policy));
    files.set('src/game/world.js', ruleset.emitWorld(design));
    files.set('src/game/rules.js', ruleset.emitRules(design));
    files.set('src/game/main.js', emitMain(design, policy));

    // Script order matters: engine first, then game data, rules, bootstrap.
    const order = [
      'src/engine/core.js', 'src/engine/math.js', 'src/engine/input.js', 'src/engine/entities.js',
      'src/engine/physics.js', 'src/engine/collision.js', 'src/engine/camera.js', 'src/engine/ai.js',
      'src/engine/procgen.js', 'src/engine/particles.js', 'src/engine/render.js', 'src/engine/ui.js',
      'src/engine/audio.js', 'src/engine/save.js', 'src/engine/three.js',
      'src/game/config.js', 'src/game/world.js', 'src/game/rules.js', 'src/game/main.js',
    ].filter((f) => files.has(f));

    files.set('index.html', emitHtml(design, order));
    files.set('styles/main.css', emitCss(design));

    return { files, order };
  }

  /**
   * Generate, write to disk, verify originality, and record the project.
   * @returns generated-project record
   */
  async generate(design, { policy = {}, write = true } = {}) {
    const started = Date.now();
    const { files, order } = this.buildFiles(design, policy);

    const codeOverlap = await this.diversity.checkCode([...files.entries()].filter(([f]) => f.endsWith('.js')).map(([, src]) => src));
    if (!codeOverlap.pass) {
      this.bus?.warn('generate.overlap', { overlap: codeOverlap.maxOverlapWithImports, nearest: codeOverlap.nearestProject });
    }

    files.set('manifest.json', emitManifest(design, { agentVersion: policy.version || 'v1', codeOverlap }));
    files.set('README.md', emitReadme(design, { agentVersion: policy.version || 'v1', codeOverlap }));

    const genId = makeId('gen');
    const dir = path.join(this.config.dirs.generated, `${slug(design.name)}-${genId.slice(-6)}`);
    let totalBytes = 0;
    if (write) {
      for (const [rel, content] of files) {
        const target = path.join(dir, rel);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, content);
        totalBytes += Buffer.byteLength(content);
      }
    } else {
      for (const [, content] of files) totalBytes += Buffer.byteLength(content);
    }

    const record = {
      id: genId,
      designId: design.id,
      name: design.name,
      ruleset: design.ruleset,
      dir: write ? dir : null,
      files: [...files.keys()],
      scriptOrder: order,
      bytes: totalBytes,
      bytesHuman: fmtBytes(totalBytes),
      agentVersion: policy.version || 'v1',
      policy: { ...policy },
      traits: design.traits,
      novelty: design.novelty,
      diversity: design.diversity,
      codeOverlap,
      knowledgeUsed: (design.sourceKnowledge || []).map((k) => k.key),
      test: null,
      quality: null,
      status: 'generated',
      generationMs: Date.now() - started,
      createdAt: new Date().toISOString(),
    };

    this.bus?.success('generate.done', { name: design.name, files: files.size, bytes: record.bytesHuman, ms: record.generationMs });
    return { record, files };
  }

  /** Re-emit a single file after the debugger changed the policy or design. */
  async rewrite(record, design, policy) {
    const { files } = this.buildFiles(design, policy);
    for (const [rel, content] of files) {
      const target = path.join(record.dir, rel);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content);
    }
    return [...files.keys()];
  }
}
