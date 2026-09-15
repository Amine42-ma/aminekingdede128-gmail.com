/**
 * AGENT VERSIONS (spec 17, 46, 48, 50).
 *
 * An "agent version" here is a *policy*: the set of generation decisions the
 * lab makes (loop style, delta clamp, broadphase, pooling, particle budget,
 * input buffering, ...). Those decisions change the emitted code, so a version
 * change is measurable on the benchmark.
 *
 * This is Agent Improvement, NOT model training. No weights exist here and the
 * lab never says otherwise - see src/training/pipeline.js for the real thing.
 */
import { Benchmark } from './benchmark.js';
import { round, nowIso } from '../core/util.js';

export const BASE_POLICY = {
  version: 'v1',
  loopStyle: 'raf-delta',
  fixedStep: 1 / 60,
  options: {
    dtClamp: 0.05,
    spatialHash: true,
    pooling: true,
    sweptCollision: true,
    dprScaling: true,
    pauseOnBlur: true,
    mobileControls: true,
    gamepad: true,
    inputBufferMs: 120,
    maxParticles: 600,
    gridCell: 64,
    difficultyBias: 1,
  },
};

export class VersionManager {
  constructor({ store, bus, benchmark }) {
    this.store = store;
    this.bus = bus;
    this.benchmark = benchmark;
  }

  async active() {
    const all = await this.store.versions.all();
    const live = all.filter((v) => v.status === 'active').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (live.length) return live[0];
    return this.seed();
  }

  /** Creates v1 from the base policy and benchmarks it once. */
  async seed() {
    const existing = await this.store.versions.findOne((v) => v.version === 'v1');
    if (existing) return existing;
    const doc = await this.store.versions.put({
      version: 'v1',
      label: 'baseline',
      policy: JSON.parse(JSON.stringify(BASE_POLICY)),
      parentVersion: null,
      status: 'active',
      benchmark: null,
      rationale: 'Initial policy: conservative defaults chosen from the corpus concepts with the highest confidence.',
      createdAt: nowIso(),
    });
    this.bus?.info('version.seed', { version: 'v1' });
    return doc;
  }

  async history() {
    const all = await this.store.versions.all();
    return all.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  }

  async nextVersionNumber() {
    const all = await this.store.versions.all();
    const nums = all.map((v) => parseInt(String(v.version).replace(/^v/, ''), 10)).filter(Number.isFinite);
    return `v${(nums.length ? Math.max(...nums) : 0) + 1}`;
  }

  /** Benchmark the active version if it has never been measured. */
  async ensureBaseline() {
    const active = await this.active();
    if (active.benchmark) return active;
    const result = await this.benchmark.run(active.policy, { label: `${active.version} baseline` });
    return this.store.versions.patch(active.id, { benchmark: result });
  }

  /**
   * Evaluate a candidate policy against the active version.
   * Promotion requires a measured improvement bigger than the noise margin AND
   * no task regressing badly. Otherwise the candidate is archived with its
   * evidence - a rollback that leaves a record, not a silent discard.
   */
  async evaluateCandidate({ policy, rationale, hypothesis = null }) {
    const active = await this.ensureBaseline();
    const version = await this.nextVersionNumber();
    const candidatePolicy = { ...JSON.parse(JSON.stringify(policy)), version };

    const result = await this.benchmark.run(candidatePolicy, { label: `${version} candidate` });
    const comparison = Benchmark.compare(active.benchmark, result);

    const promote = comparison.improved && !comparison.brokeSomething;
    const doc = await this.store.versions.put({
      version,
      label: promote ? 'promoted' : 'rejected',
      policy: candidatePolicy,
      parentVersion: active.version,
      status: promote ? 'active' : 'archived',
      benchmark: result,
      comparison,
      hypothesis,
      rationale,
      decision: promote
        ? `Promoted: ${comparison.statement}`
        : comparison.regressed
          ? `Rolled back: ${comparison.statement}; keeping ${active.version}`
          : `Rolled back: change was inside the noise margin (${comparison.statement}); keeping ${active.version}`,
      createdAt: nowIso(),
    });

    if (promote) {
      await this.store.versions.patch(active.id, { status: 'superseded' });
      this.bus?.success('version.promote', { from: active.version, to: version, delta: comparison.delta, statement: comparison.statement });
    } else {
      this.bus?.warn('version.rollback', { candidate: version, keeping: active.version, delta: comparison.delta, statement: comparison.statement });
    }

    return { promoted: promote, version: doc, previous: active, comparison };
  }

  /** Explicit rollback to a named version (spec 17). */
  async rollbackTo(versionName) {
    const target = await this.store.versions.findOne((v) => v.version === versionName);
    if (!target) return null;
    const all = await this.store.versions.all();
    for (const v of all) {
      if (v.status === 'active' && v.version !== versionName) await this.store.versions.patch(v.id, { status: 'superseded' });
    }
    const restored = await this.store.versions.patch(target.id, { status: 'active', label: 'restored', restoredAt: nowIso() });
    this.bus?.warn('version.rollback.manual', { to: versionName });
    return restored;
  }

  /** Side-by-side comparison for the UI (spec 42). */
  async compareVersions(a, b) {
    const va = await this.store.versions.findOne((v) => v.version === a);
    const vb = await this.store.versions.findOne((v) => v.version === b);
    if (!va?.benchmark || !vb?.benchmark) return null;
    return {
      a: { version: va.version, score: va.benchmark.score, shipped: va.benchmark.shipped, policy: va.policy },
      b: { version: vb.version, score: vb.benchmark.score, shipped: vb.benchmark.shipped, policy: vb.policy },
      comparison: Benchmark.compare(va.benchmark, vb.benchmark),
      policyDiff: diffPolicy(va.policy, vb.policy),
    };
  }
}

export function diffPolicy(a, b) {
  const out = [];
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) {
    if (k === 'options') {
      const oa = a?.options || {}, ob = b?.options || {};
      for (const ok of new Set([...Object.keys(oa), ...Object.keys(ob)])) {
        if (oa[ok] !== ob[ok]) out.push({ key: `options.${ok}`, from: oa[ok], to: ob[ok] });
      }
      continue;
    }
    if (JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k])) out.push({ key: k, from: a?.[k], to: b?.[k] });
  }
  return out;
}

export function scoreToStatement(before, after, suiteSize) {
  const delta = round((after - before) * 100, 2);
  return `${delta >= 0 ? '+' : ''}${delta} points on a ${suiteSize}-task benchmark`;
}
