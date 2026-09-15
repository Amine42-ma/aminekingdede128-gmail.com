/**
 * AUTONOMOUS IMPROVEMENT (spec 18, 43).
 *
 *   analyse weaknesses -> form a hypothesis -> implement it -> build -> test
 *   -> evaluate -> better? promote : roll back -> record the lesson -> repeat
 *
 * Every cycle is bounded (max cycles, pause/stop honoured between steps) and
 * every promotion is backed by a benchmark comparison. If nothing improves, the
 * lab says so instead of inventing progress.
 */
import { ExperimentEngine, MUTATIONS } from './experiments.js';
import { round, nowIso } from '../core/util.js';

export class Autopilot {
  constructor({ store, bus, versions, benchmark, lessons }) {
    this.store = store;
    this.bus = bus;
    this.versions = versions;
    this.benchmark = benchmark;
    this.lessons = lessons;
    this.experiments = new ExperimentEngine({ store, bus, benchmark });
    this.state = 'idle'; // idle | running | paused | stopping
    this.cycle = 0;
    this.history = [];
  }

  status() {
    return { state: this.state, cycle: this.cycle, history: this.history.slice(-20) };
  }

  pause() { if (this.state === 'running') this.state = 'paused'; return this.status(); }
  resume() { if (this.state === 'paused') this.state = 'running'; return this.status(); }
  stop() { if (this.state !== 'idle') this.state = 'stopping'; return this.status(); }

  async #waitIfPaused() {
    while (this.state === 'paused') await new Promise((r) => setTimeout(r, 250));
    return this.state !== 'stopping';
  }

  /**
   * Identify the weakest measured area of the active version.
   * Uses the benchmark's per-check pass rates, not intuition.
   */
  async analyseWeaknesses() {
    const active = await this.versions.ensureBaseline();
    const rates = active.benchmark?.checkRates || {};
    const weak = Object.entries(rates)
      .filter(([, rate]) => rate < 1)
      .sort((a, b) => a[1] - b[1]);
    const recurring = await this.lessons.recurring(2);
    return {
      version: active.version,
      score: active.benchmark?.score ?? null,
      weakestChecks: weak.map(([id, rate]) => ({ check: id, passRate: rate })),
      worstTask: active.benchmark?.worstTask ?? null,
      recurringLessons: recurring.slice(0, 5).map((r) => ({ lesson: r.lesson, count: r.count, successRate: r.successRate })),
    };
  }

  /** Pick the next hypothesis: target the weakest check, else explore. */
  async proposeHypothesis(weaknesses) {
    const candidates = [];
    for (const w of weaknesses.weakestChecks) {
      for (const m of MUTATIONS[w.check] || []) candidates.push({ ...m, targets: w.check, priority: 2 - w.passRate });
    }
    for (const m of MUTATIONS.explore) candidates.push({ ...m, targets: 'exploration', priority: 0.4 });

    for (const c of candidates.sort((a, b) => b.priority - a.priority)) {
      const settled = await this.experiments.alreadySettled(c.id);
      // One measured result is enough to move on: re-running an inconclusive
      // experiment with the same subset produces the same number.
      if (settled && settled.tried >= 1) continue;
      return c;
    }
    return null;
  }

  /**
   * Run improvement cycles. Returns a report of what actually changed.
   * @param {number} maxCycles
   */
  async run({ maxCycles = 3, taskCount = 4 } = {}) {
    if (this.state === 'running') return { error: 'autopilot is already running' };
    this.state = 'running';
    const started = Date.now();
    const outcomes = [];

    try {
      for (let i = 0; i < maxCycles; i++) {
        if (!(await this.#waitIfPaused())) break;
        this.cycle++;

        const weaknesses = await this.analyseWeaknesses();
        const hypothesis = await this.proposeHypothesis(weaknesses);
        if (!hypothesis) {
          this.bus?.info('autopilot.exhausted', { cycle: this.cycle });
          outcomes.push({ cycle: this.cycle, outcome: 'no-untried-hypothesis', weaknesses });
          break;
        }

        this.bus?.info('autopilot.cycle', { cycle: this.cycle, hypothesis: hypothesis.id, targets: hypothesis.targets });
        const active = await this.versions.active();

        // 1. cheap controlled experiment on a subset
        const { experiment, comparison, variantPolicy } = await this.experiments.run({
          basePolicy: active.policy,
          mutation: hypothesis,
          taskCount,
          reason: `weakest check: ${hypothesis.targets}`,
        });

        if (!(await this.#waitIfPaused())) break;

        let promotion = null;
        if (experiment.conclusion === 'supported') {
          // 2. confirm on the full suite before touching the active version
          promotion = await this.versions.evaluateCandidate({
            policy: variantPolicy,
            rationale: `${hypothesis.hypothesis} (experiment ${experiment.id}: ${experiment.statement})`,
            hypothesis: hypothesis.id,
          });
        }

        const outcome = {
          cycle: this.cycle,
          hypothesis: hypothesis.id,
          targets: hypothesis.targets,
          experiment: { id: experiment.id, conclusion: experiment.conclusion, delta: experiment.delta, statement: experiment.statement },
          promoted: !!promotion?.promoted,
          version: promotion?.version?.version ?? null,
          decision: promotion?.version?.decision ?? `Experiment ${experiment.conclusion}; active version unchanged.`,
          at: nowIso(),
        };
        outcomes.push(outcome);
        this.history.push(outcome);

        await this.lessons.record({
          task: `autonomous improvement cycle ${this.cycle}`,
          decision: `test hypothesis "${hypothesis.id}" targeting ${hypothesis.targets}: ${JSON.stringify(hypothesis.change)}`,
          result: outcome.decision,
          lesson: experiment.conclusion === 'supported'
            ? `${hypothesis.hypothesis} - measured ${experiment.statement}.`
            : experiment.conclusion === 'contradicted'
              ? `Rejected: ${hypothesis.hypothesis} made the benchmark worse (${experiment.statement}).`
              : `Inconclusive: ${hypothesis.hypothesis} moved the benchmark less than the noise margin (${experiment.statement}).`,
          evidence: { experimentId: experiment.id, delta: experiment.delta, margin: experiment.margin, perCheck: experiment.perCheck },
          success: !!promotion?.promoted,
          confidence: experiment.conclusion === 'supported' ? 0.7 : 0.5,
          tags: ['autopilot', hypothesis.targets, hypothesis.id],
        });

        if (this.state === 'stopping') break;
      }
    } finally {
      this.state = 'idle';
    }

    const promoted = outcomes.filter((o) => o.promoted);
    const active = await this.versions.active();
    return {
      cycles: outcomes.length,
      promoted: promoted.length,
      activeVersion: active.version,
      activeScore: active.benchmark?.score ?? null,
      outcomes,
      durationMs: Date.now() - started,
      // Honest summary (spec 50): no "smarter", only measured deltas.
      summary: promoted.length
        ? `Promoted ${promoted.length} change(s); active policy is now ${active.version} at benchmark score ${round(active.benchmark?.score ?? 0, 4)}.`
        : `No change beat the current policy by more than the noise margin; ${active.version} remains active at benchmark score ${round(active.benchmark?.score ?? 0, 4)}.`,
    };
  }
}
