/**
 * EXPERIMENT ENGINE (spec 36).
 *
 * When the lab does not know whether an approach is better, it does not guess:
 * it builds two variants that differ in exactly one decision, runs both over
 * the same benchmark subset, and records the measured difference.
 */
import { Benchmark, BENCHMARK_TASKS } from './benchmark.js';
import { round, nowIso, id as makeId } from '../core/util.js';

/**
 * Candidate policy mutations, grouped by the failing check they target.
 * Each has a hypothesis written in advance - that is what makes the result
 * interpretable rather than post-hoc.
 */
export const MUTATIONS = {
  'dt-spike': [
    { id: 'fixed-step', change: { loopStyle: 'fixed-timestep-accumulator' }, hypothesis: 'A fixed-timestep accumulator bounds simulation advance per frame better than a clamped variable delta.' },
    { id: 'tight-clamp', change: { options: { dtClamp: 0.032 } }, hypothesis: 'Clamping delta to ~2 frames prevents large single-step integration during stalls.' },
    { id: 'swept', change: { options: { sweptCollision: true } }, hypothesis: 'Swept collision tests stop fast movers from passing through colliders when a frame is long.' },
  ],
  performance: [
    { id: 'fewer-particles', change: { options: { maxParticles: 260 } }, hypothesis: 'The particle budget dominates draw calls; halving it lowers frame cost without changing gameplay.' },
    { id: 'bigger-cells', change: { options: { gridCell: 96 } }, hypothesis: 'Larger broadphase cells reduce bucket bookkeeping for sparse arenas.' },
    { id: 'smaller-cells', change: { options: { gridCell: 48 } }, hypothesis: 'Smaller broadphase cells cut the candidate set for dense arenas.' },
  ],
  memory: [
    { id: 'pooling-on', change: { options: { pooling: true } }, hypothesis: 'Recycling dead entities removes per-frame allocation and the GC pauses that follow it.' },
  ],
  'input-response': [
    { id: 'wide-buffer', change: { options: { inputBufferMs: 200 } }, hypothesis: 'A wider input buffer catches presses that land between fixed simulation steps.' },
  ],
  stability: [
    { id: 'hard-clamp', change: { options: { dtClamp: 0.028 } }, hypothesis: 'A hard delta clamp keeps integrators inside their stable range.' },
  ],
  'pause-on-hide': [
    { id: 'pause-blur', change: { options: { pauseOnBlur: true } }, hypothesis: 'Pausing on visibilitychange avoids the delta spike when the player returns.' },
  ],
  'mobile-layout': [
    { id: 'touch-controls', change: { options: { mobileControls: true } }, hypothesis: 'Emitting touch controls makes builds playable on phones.' },
  ],
  renders: [
    { id: 'dpr-on', change: { options: { dprScaling: true } }, hypothesis: 'Scaling the backing store by devicePixelRatio removes blur on dense displays.' },
  ],
  'progress-reachable': [
    { id: 'gentler-start', change: { options: { difficultyBias: 0.75 } }, hypothesis: 'Lower hazard density and spawn pressure let a run reach its first reward, which is the difference between a demo and a loop.' },
    { id: 'harsher-start', change: { options: { difficultyBias: 1.25 } }, hypothesis: 'More pressure early may produce more scoring events per run rather than fewer.' },
  ],
  explore: [
    { id: 'explore-cell-80', change: { options: { gridCell: 80 } }, hypothesis: 'An intermediate broadphase cell size may suit the mix of arena densities.' },
    { id: 'explore-buffer-160', change: { options: { inputBufferMs: 160 } }, hypothesis: 'A slightly wider input buffer may improve responsiveness without feeling sticky.' },
    { id: 'explore-particles-420', change: { options: { maxParticles: 420 } }, hypothesis: 'A mid particle budget may keep feedback strong at lower cost.' },
  ],
};

export class ExperimentEngine {
  constructor({ store, bus, benchmark }) {
    this.store = store;
    this.bus = bus;
    this.benchmark = benchmark;
  }

  /**
   * Run one controlled A/B over a benchmark subset.
   * @param {object} opts
   * @param {object} opts.basePolicy the control
   * @param {object} opts.mutation {id, change, hypothesis}
   * @param {number} opts.taskCount how many benchmark tasks to use (subset keeps cycles cheap)
   */
  async run({ basePolicy, mutation, taskCount = 4, reason = 'autonomous improvement cycle' }) {
    const tasks = pickTasks(taskCount, mutation.id);
    const variant = mergePolicy(basePolicy, mutation.change);
    const expId = makeId('exp');

    this.bus?.info('experiment.start', { id: expId, mutation: mutation.id, tasks: tasks.length });

    const control = await this.benchmark.run(basePolicy, { tasks, label: `control:${mutation.id}` });
    const treatment = await this.benchmark.run(variant, { tasks, label: `variant:${mutation.id}` });
    const comparison = Benchmark.compare(control, treatment);

    const conclusion = comparison.improved
      ? 'supported'
      : comparison.regressed ? 'contradicted' : 'inconclusive';

    const doc = await this.store.experiments.put({
      id: expId,
      hypothesis: mutation.hypothesis,
      mutationId: mutation.id,
      change: mutation.change,
      reason,
      tasks: tasks.map((t) => t.id),
      control: { score: control.score, shipped: control.shipped, checkRates: control.checkRates },
      treatment: { score: treatment.score, shipped: treatment.shipped, checkRates: treatment.checkRates },
      delta: comparison.delta,
      margin: comparison.margin,
      conclusion,
      statement: comparison.statement,
      perCheck: comparison.perCheck,
      at: nowIso(),
      durationMs: control.durationMs + treatment.durationMs,
    });

    this.bus?.[conclusion === 'supported' ? 'success' : 'info']('experiment.done', {
      id: expId, mutation: mutation.id, conclusion, delta: comparison.delta,
    });
    return { experiment: doc, comparison, variantPolicy: variant };
  }

  async recent(n = 30) {
    const all = await this.store.experiments.all();
    return all.sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, n);
  }

  async stats() {
    const all = await this.store.experiments.all();
    return {
      total: all.length,
      supported: all.filter((e) => e.conclusion === 'supported').length,
      contradicted: all.filter((e) => e.conclusion === 'contradicted').length,
      inconclusive: all.filter((e) => e.conclusion === 'inconclusive').length,
      averageDelta: all.length ? round(all.reduce((s, e) => s + (e.delta || 0), 0) / all.length, 4) : null,
    };
  }

  /** Has this exact mutation already been tried and settled? */
  async alreadySettled(mutationId) {
    const all = await this.store.experiments.all();
    const tried = all.filter((e) => e.mutationId === mutationId);
    if (!tried.length) return null;
    const supported = tried.some((e) => e.conclusion === 'supported');
    return { tried: tried.length, supported, last: tried[tried.length - 1] };
  }
}

function pickTasks(count, salt = '') {
  // Deterministic subset: the same mutation always faces the same tasks, so
  // repeated experiments are comparable.
  const n = Math.max(1, Math.min(count, BENCHMARK_TASKS.length));
  let h = 7;
  for (let i = 0; i < String(salt).length; i++) h = (h * 31 + String(salt).charCodeAt(i)) >>> 0;
  const start = h % BENCHMARK_TASKS.length;
  const out = [];
  for (let i = 0; i < n; i++) out.push(BENCHMARK_TASKS[(start + i) % BENCHMARK_TASKS.length]);
  return out;
}

export function mergePolicy(policy, change) {
  const next = JSON.parse(JSON.stringify(policy || {}));
  for (const [k, v] of Object.entries(change || {})) {
    if (k === 'options') next.options = { ...(next.options || {}), ...v };
    else next[k] = v;
  }
  return next;
}
