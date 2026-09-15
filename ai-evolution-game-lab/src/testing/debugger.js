/**
 * AUTOMATIC DEBUGGING (spec 28, 59).
 *
 * Reads a failing test report, decides what to change, re-emits the project and
 * re-tests - up to `maxRounds`. Fixes are applied to the *generator policy* or
 * the *design*, never as blind text patches, so a fix that works becomes a
 * candidate improvement for the agent version itself (see evolution/autopilot).
 */
import { TestAgent, qualityScore } from './testagent.js';
import { round } from '../core/util.js';
import { normalizePalette } from '../design/traits.js';

/**
 * Each strategy: given a failed check, return a mutation describing what to
 * change and why. Returning null means "cannot fix this automatically".
 */
const STRATEGIES = {
  'dt-spike': (fail, { policy }) => {
    const current = policy.options?.dtClamp ?? 0.05;
    if (policy.loopStyle !== 'fixed-timestep-accumulator') {
      return { target: 'policy', change: { loopStyle: 'fixed-timestep-accumulator' }, why: 'variable-delta loop let entities jump during frame spikes; switching to a fixed-timestep accumulator bounds each simulation step' };
    }
    if (current > 0.028) {
      return { target: 'policy', change: { options: { dtClamp: 0.028 } }, why: `delta clamp of ${current}s still allowed a large jump; tightening it to 0.028s (~2 frames)` };
    }
    return { target: 'policy', change: { options: { sweptCollision: true } }, why: 'clamping alone was not enough; enabling swept collision so fast movers cannot step over colliders' };
  },

  stability: (fail, { policy, design }) => {
    const err = fail.errors?.[0]?.message || fail.detail || '';
    // A missing engine function means a module the rules need was not emitted.
    const missing = err.match(/LAB\.(\w+)\.(\w+) is not a function/);
    if (missing) {
      const mod = missing[1] === 'ai' ? 'ai' : missing[1] === 'procgen' ? 'procgen' : missing[1] === 'physics' ? 'physics' : missing[1];
      return {
        target: 'design',
        change: { addModule: mod, aiBehaviour: missing[1] === 'ai' ? missing[2] : null },
        why: `the rules call LAB.${missing[1]}.${missing[2]}() but that engine module/behaviour was not emitted; adding it to the build`,
      };
    }
    if (/non-finite|NaN/i.test(err) || /non-finite/i.test(fail.detail || '')) {
      return { target: 'policy', change: { options: { dtClamp: 0.025 } }, why: 'positions went non-finite, which is almost always an unbounded delta feeding an integrator; clamping delta hard' };
    }
    const undef = err.match(/(\w+) is not defined/);
    if (undef) {
      return { target: 'design', change: { addModule: guessModule(undef[1]) }, why: `${undef[1]} was referenced but never defined; emitting the module that provides it` };
    }
    return null;
  },

  'input-response': (fail, { policy, design }) => {
    if ((policy.options?.inputBufferMs ?? 120) < 220) {
      return { target: 'policy', change: { options: { inputBufferMs: 220 } }, why: 'no input produced a change; widening the input buffer so presses that land between simulation steps are not dropped' };
    }
    if (!design.controls.mobile?.virtualStick) {
      return { target: 'design', change: { virtualStick: true }, why: 'adding an analog stick path so pointer/touch input also feeds the movement axis' };
    }
    return null;
  },

  performance: (fail, { policy }) => {
    const draws = fail.metrics?.drawCalls ?? 0;
    if (draws > 2000 && (policy.options?.maxParticles ?? 600) > 200) {
      return { target: 'policy', change: { options: { maxParticles: 200 } }, why: `${draws} draw calls per frame; cutting the particle budget is the cheapest large win` };
    }
    if (!policy.options?.spatialHash) {
      return { target: 'policy', change: { options: { spatialHash: true } }, why: 'frame cost was dominated by pairwise collision tests; enabling the uniform-grid broadphase' };
    }
    return null;
  },

  memory: (fail, { policy }) => {
    if (!policy.options?.pooling) {
      return { target: 'policy', change: { options: { pooling: true } }, why: 'entity allocation grew unbounded; enabling pooling so dead entities are recycled' };
    }
    return null;
  },

  'pause-on-hide': (fail, { policy }) => {
    if (policy.options?.pauseOnBlur === false) {
      return { target: 'policy', change: { options: { pauseOnBlur: true } }, why: 'the simulation kept running while hidden, which burns battery and produces a delta spike on return' };
    }
    return null;
  },

  'mobile-layout': (fail, { policy }) => {
    if (!policy.options?.mobileControls) {
      return { target: 'policy', change: { options: { mobileControls: true } }, why: 'touch controls were missing from the build' };
    }
    return null;
  },

  'progress-reachable': (fail, { design }) => {
    return {
      target: 'design',
      change: { easier: true },
      why: 'a full scripted run produced no score, no pickup and no terminal state; increasing pickup density and spawn rate so the loop actually engages',
    };
  },

  'visual-contrast': (fail, { design }) => ({
    target: 'design',
    change: { renormalisePalette: true },
    why: 'gameplay colours were too close to the background; re-running the contrast pass on the palette',
  }),

  renders: (fail, { policy }) => {
    if ((fail.metrics?.nonFinite ?? 0) > 0) {
      return { target: 'policy', change: { options: { dtClamp: 0.025 } }, why: 'non-finite draw coordinates come from non-finite state; clamping delta' };
    }
    return null;
  },
};

function guessModule(symbol) {
  const map = { LAB: 'core', THREE: 'three' };
  return map[symbol] || 'core';
}

export class AutoDebugger {
  constructor({ generator, bus, knowledge, memory, frames = 420 }) {
    this.generator = generator;
    this.bus = bus;
    this.knowledge = knowledge;
    this.memory = memory;
    this.tester = new TestAgent({ bus, frames });
  }

  /**
   * Generate -> test -> fix -> re-test until the report ships or rounds run out.
   * @returns {{ report, files, order, policy, design, rounds, fixes }}
   */
  async iterate(design, { policy = {}, maxRounds = 3 } = {}) {
    let currentPolicy = deepClone({ options: {}, ...policy });
    let currentDesign = design;
    const fixes = [];
    let best = null;

    for (let round0 = 0; round0 < maxRounds; round0++) {
      const { files, order } = this.generator.buildFiles(currentDesign, currentPolicy);
      const report = await this.tester.run(files, order, currentDesign);
      const quality = qualityScore({ test: report, design: currentDesign, record: { files: [...files.keys()], codeOverlap: { maxOverlapWithImports: 0 } } });

      if (!best || report.score > best.report.score) {
        best = { report, files, order, policy: deepClone(currentPolicy), design: currentDesign, quality };
      }

      if (report.verdict === 'ship') {
        this.bus?.success('debug.pass', { name: currentDesign.name, round: round0 + 1, score: report.score });
        return { ...best, rounds: round0 + 1, fixes };
      }

      // pick the most severe fixable failure
      const ordered = [...report.failures].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
      let applied = null;
      for (const f of ordered) {
        const full = report.checks.find((c) => c.id === f.id);
        const strategy = STRATEGIES[f.id];
        if (!strategy) continue;
        const mutation = strategy(full, { policy: currentPolicy, design: currentDesign });
        if (!mutation) continue;
        applied = { round: round0 + 1, check: f.id, severity: f.severity, ...mutation, before: f.detail };
        if (mutation.target === 'policy') currentPolicy = mergePolicy(currentPolicy, mutation.change);
        else currentDesign = applyDesignFix(currentDesign, mutation.change);
        break;
      }

      if (!applied) {
        this.bus?.warn('debug.stuck', { name: currentDesign.name, round: round0 + 1, score: report.score, failures: report.failures.map((f) => f.id) });
        return { ...best, rounds: round0 + 1, fixes, stuck: report.failures.map((f) => f.id) };
      }

      fixes.push(applied);
      this.bus?.info('debug.fix', { name: currentDesign.name, round: round0 + 1, check: applied.check, why: applied.why });
    }

    return { ...best, rounds: maxRounds, fixes };
  }
}

function severityRank(s) { return s === 'critical' ? 3 : s === 'major' ? 2 : 1; }

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

function mergePolicy(policy, change) {
  const next = deepClone(policy);
  for (const [k, v] of Object.entries(change)) {
    if (k === 'options') next.options = { ...(next.options || {}), ...v };
    else next[k] = v;
  }
  return next;
}

function applyDesignFix(design, change) {
  const next = deepClone(design);
  if (change.renormalisePalette) {
    next.visual.palette = normalizePalette(next.visual.palette);
  }
  if (change.addModule && !next.architecture.modules.includes(change.addModule)) {
    next.architecture.modules.push(change.addModule);
  }
  if (change.virtualStick) {
    next.controls.mobile = { ...(next.controls.mobile || {}), virtualStick: true };
  }
  if (change.easier) {
    // More things to hit, sooner: the most reliable way to make a loop engage.
    next.world = { ...next.world, collectibles: Math.max(8, (next.world.collectibles || 6) + 4), obstacles: Math.max(2, next.world.obstacles || 0) };
    next.progression = {
      ...next.progression,
      stages: next.progression.stages.map((s) => ({ ...s, spawnInterval: Math.max(0.3, round(s.spawnInterval * 0.6, 2)), enemyCount: s.enemyCount + 2 })),
    };
  }
  return next;
}

export { STRATEGIES as FIX_STRATEGIES };
