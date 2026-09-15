/**
 * BENCHMARK (spec 49, 50).
 *
 * A fixed, fully-specified task suite. Every trait of every task is pinned, so
 * the only thing that varies between runs is the agent policy under test. That
 * is the whole point: without a fixed suite, "v2 is better than v1" is a claim,
 * not a measurement.
 *
 * Scores are plain pass-rates over the test agent's checks. No IQ, no vibes.
 */
import { TestAgent, TEST_WEIGHTS } from '../testing/testagent.js';
import { round, mean, stdev } from '../core/util.js';

/** Eight tasks: one per ruleset, each pinning every trait it is allowed to pin. */
export const BENCHMARK_TASKS = [
  {
    id: 'bench-arena', label: 'Arena survival under wave pressure', seed: 'bench-arena-v1',
    brief: {
      genre: 'arena-survival', camera: 'follow-smooth', controls: 'wasd-mouse-aim', world: 'bounded-arena',
      objective: 'clear-waves', progression: 'wave-escalation', physics: 'topdown-friction', enemies: 'chasers',
      rewards: 'score-combo', visualStyle: 'neon-vector', ui: 'full-hud', audio: 'procedural-sfx', twist: 'none',
    },
  },
  {
    id: 'bench-platformer', label: 'Platformer jump-envelope integrity', seed: 'bench-plat-v1',
    brief: {
      genre: 'platformer', camera: 'follow-deadzone', controls: 'run-jump', world: 'handcrafted-levels',
      objective: 'reach-exit', progression: 'level-sequence', physics: 'platform-gravity', enemies: 'hazards-only',
      rewards: 'collectible-set', visualStyle: 'flat-pastel', ui: 'minimal-hud', audio: 'tone-cues', twist: 'none',
    },
  },
  {
    id: 'bench-puzzle', label: 'Grid puzzle solvability and undo', seed: 'bench-puzzle-v1',
    brief: {
      genre: 'puzzle-logic', camera: 'fixed', controls: 'grid-step', world: 'tile-grid',
      objective: 'solve-board', progression: 'level-sequence', physics: 'grid-discrete', enemies: 'hazards-only',
      rewards: 'medal-tiers', visualStyle: 'monochrome-ink', ui: 'panel-sidebar', audio: 'tone-cues', twist: 'none',
    },
  },
  {
    id: 'bench-racer', label: 'Vehicle handling and lap counting', seed: 'bench-racer-v1',
    brief: {
      genre: 'racing', camera: 'follow-smooth', controls: 'steer-throttle', world: 'procedural-track',
      objective: 'best-lap', progression: 'time-attack', physics: 'vehicle-drift', enemies: 'rival-racers',
      rewards: 'medal-tiers', visualStyle: 'sunset-gradient', ui: 'full-hud', audio: 'procedural-sfx', twist: 'none',
    },
  },
  {
    id: 'bench-defense', label: 'Tower defense economy and pathing', seed: 'bench-defense-v1',
    brief: {
      genre: 'tower-defense', camera: 'fixed', controls: 'point-and-click', world: 'path-map',
      objective: 'clear-waves', progression: 'economy-upgrades', physics: 'grid-discrete', enemies: 'creep-waves',
      rewards: 'currency-shop', visualStyle: 'blueprint', ui: 'panel-sidebar', audio: 'procedural-sfx', twist: 'none',
    },
  },
  {
    id: 'bench-runner', label: 'Endless runner chunk streaming', seed: 'bench-runner-v1',
    brief: {
      genre: 'endless-runner', camera: 'side-scroll-lock', controls: 'one-button', world: 'scrolling-lane',
      objective: 'max-distance', progression: 'speed-ramp', physics: 'platform-gravity', enemies: 'hazards-only',
      rewards: 'score-combo', visualStyle: 'retro-crt', ui: 'minimal-hud', audio: 'tone-cues', twist: 'combo-chain',
    },
  },
  {
    id: 'bench-stealth', label: 'Stealth vision cones and reachable exit', seed: 'bench-stealth-v1',
    brief: {
      genre: 'stealth-infiltration', camera: 'follow-smooth', controls: 'wasd-8dir', world: 'procedural-rooms',
      objective: 'reach-exit', progression: 'level-sequence', physics: 'topdown-friction', enemies: 'patrollers',
      rewards: 'collectible-set', visualStyle: 'deep-sea', ui: 'minimal-hud', audio: 'tone-cues', twist: 'none',
    },
  },
  {
    id: 'bench-3d', label: '3D build integrity (static + fallback path)', seed: 'bench-3d-v1',
    brief: {
      genre: 'exploration-3d', camera: 'third-person-3d', controls: 'wasd-8dir', world: 'open-3d-field',
      objective: 'collect-all', progression: 'unlock-abilities', physics: 'kinematic-3d', enemies: 'hazards-only',
      rewards: 'collectible-set', visualStyle: 'high-contrast', ui: 'minimal-hud', audio: 'silent', twist: 'none',
    },
  },
];

export class Benchmark {
  constructor({ designer, generator, bus, frames = 360, store = null }) {
    this.designer = designer;
    this.generator = generator;
    this.bus = bus;
    this.store = store;
    this.tester = new TestAgent({ bus, frames });
  }

  /**
   * The knowledge base feeds the designer, so it feeds the emitted code too.
   * Two benchmark runs are only comparable when it has not changed underneath
   * them - we record a fingerprint so the comparison can say when it did.
   */
  async #knowledgeFingerprint() {
    if (!this.store) return null;
    const items = await this.store.knowledge.all();
    const sig = items.map((k) => `${k.key}:${k.confidence}`).sort().join('|');
    let h = 0x811c9dc5;
    for (let i = 0; i < sig.length; i++) { h ^= sig.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return { items: items.length, digest: (h >>> 0).toString(16) };
  }

  /**
   * Run the full suite against one policy.
   * @returns {{score:number, tasks:Array, checkRates:object, ...}}
   */
  async run(policy, { tasks = BENCHMARK_TASKS, label = 'benchmark' } = {}) {
    const started = Date.now();
    const results = [];

    for (const task of tasks) {
      const t0 = Date.now();
      let design;
      let report;
      let generationError = null;
      try {
        design = await this.designer.design({ seed: task.seed, brief: task.brief });
        const { files, order } = this.generator.buildFiles(design, policy);
        report = await this.tester.run(files, order, design);
      } catch (err) {
        generationError = err.message;
      }
      results.push({
        taskId: task.id,
        label: task.label,
        ruleset: design?.ruleset ?? null,
        score: report?.score ?? 0,
        verdict: report?.verdict ?? 'broken',
        failures: report?.failures?.map((f) => f.id) ?? ['generation-failed'],
        checks: Object.fromEntries((report?.checks ?? []).map((c) => [c.id, c.pass])),
        metrics: Object.fromEntries((report?.checks ?? []).filter((c) => c.metrics).map((c) => [c.id, c.metrics])),
        generationError,
        ms: Date.now() - t0,
      });
      this.bus?.info('benchmark.task', { task: task.id, score: results[results.length - 1].score, verdict: results[results.length - 1].verdict });
    }

    const scores = results.map((r) => r.score);
    const checkRates = {};
    for (const id of Object.keys(TEST_WEIGHTS)) {
      const ran = results.filter((r) => r.checks[id] !== undefined);
      checkRates[id] = ran.length ? round(ran.filter((r) => r.checks[id]).length / ran.length, 3) : 0;
    }

    const summary = {
      label,
      policy,
      knowledge: await this.#knowledgeFingerprint(),
      score: round(mean(scores), 4),
      spread: round(stdev(scores), 4),
      worstTask: results.slice().sort((a, b) => a.score - b.score)[0]?.taskId ?? null,
      shipped: results.filter((r) => r.verdict === 'ship').length,
      broken: results.filter((r) => r.verdict === 'broken').length,
      tasks: results,
      checkRates,
      durationMs: Date.now() - started,
      at: new Date().toISOString(),
    };
    this.bus?.success('benchmark.done', { label, score: summary.score, shipped: summary.shipped, of: results.length });
    return summary;
  }

  /**
   * Compare two benchmark runs. `significant` is deliberately conservative:
   * the suite is small, so we require a margin bigger than the run-to-run
   * spread before calling an improvement real.
   */
  static compare(baseline, candidate) {
    const delta = round(candidate.score - baseline.score, 4);
    const knowledgeChanged = !!(baseline.knowledge && candidate.knowledge
      && baseline.knowledge.digest !== candidate.knowledge.digest);
    const margin = Math.max(0.01, (baseline.spread + candidate.spread) / 4);
    const perTask = candidate.tasks.map((t) => {
      const b = baseline.tasks.find((x) => x.taskId === t.taskId);
      return { taskId: t.taskId, before: b?.score ?? 0, after: t.score, delta: round(t.score - (b?.score ?? 0), 3) };
    });
    const perCheck = {};
    for (const [id, rate] of Object.entries(candidate.checkRates)) {
      const before = baseline.checkRates[id] ?? 0;
      if (rate !== before) perCheck[id] = { before, after: rate, delta: round(rate - before, 3) };
    }
    const regressions = perTask.filter((t) => t.delta < -0.001);
    return {
      delta,
      margin: round(margin, 4),
      improved: delta > margin,
      regressed: delta < -margin,
      significant: Math.abs(delta) > margin,
      brokeSomething: candidate.broken > baseline.broken || regressions.some((r) => r.delta < -0.1),
      perTask,
      perCheck,
      regressions,
      // The only phrasing the lab is allowed to use about improvement.
      knowledgeChanged,
      caveat: knowledgeChanged
        ? 'The knowledge base changed between these two runs, so part of this difference may come from the corpus rather than the policy. Re-run the baseline to compare cleanly.'
        : null,
      statement: `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(2)} points on the ${candidate.tasks.length}-task benchmark (${baseline.score.toFixed(3)} -> ${candidate.score.toFixed(3)}), margin ${(margin * 100).toFixed(2)}${knowledgeChanged ? ' [knowledge base changed between runs]' : ''}`,
    };
  }
}
