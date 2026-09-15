/**
 * SELF IMPROVEMENT ENGINE - lessons (spec 16).
 *
 * After every task the lab records what it did, what happened and what it would
 * do differently. Deliberately stored: summary, decision, result, lesson,
 * evidence. Deliberately NOT stored: any hidden reasoning trace - a lesson must
 * stand on evidence anyone can check.
 */
import { nowIso, round } from '../core/util.js';

export class LessonBook {
  constructor({ store, bus }) {
    this.store = store;
    this.bus = bus;
  }

  /**
   * @param {object} entry
   * @param {string} entry.task what was attempted
   * @param {string} entry.decision what the agent chose to do
   * @param {string} entry.result what measurably happened
   * @param {string} entry.lesson the transferable statement
   * @param {object} entry.evidence numbers backing the lesson
   */
  async record(entry) {
    const doc = await this.store.lessons.put({
      task: entry.task,
      decision: entry.decision,
      result: entry.result,
      lesson: entry.lesson,
      evidence: entry.evidence || null,
      tags: entry.tags || [],
      attempts: entry.attempts ?? 1,
      tools: entry.tools || [],
      success: !!entry.success,
      confidence: entry.confidence ?? 0.5,
      at: nowIso(),
    });
    this.bus?.info('lesson.record', { lesson: entry.lesson, success: !!entry.success });
    return doc;
  }

  /** Turn a generation+test cycle into lessons automatically. */
  async fromCycle({ design, report, fixes = [], record = null }) {
    const out = [];
    const base = {
      task: `generate ${design.ruleset} game "${design.name}"`,
      tools: ['designer', 'generator', 'sandbox', 'test-agent'],
      attempts: 1 + fixes.length,
      tags: [design.ruleset, design.traits.twist, design.traits.physics],
    };

    out.push(await this.record({
      ...base,
      decision: `build with modules [${design.architecture.modules.join(', ')}] and a ${design.architecture.loopStyle} loop`,
      result: `test score ${report.score} (${report.passed} passed, ${report.failed} failed), verdict ${report.verdict}`,
      lesson: report.verdict === 'ship'
        ? `The ${design.ruleset} ruleset with ${design.traits.physics} physics produces a shippable build under this policy.`
        : `The ${design.ruleset} ruleset still fails ${report.failures.map((f) => f.id).join(', ')} under this policy.`,
      evidence: {
        score: report.score,
        failures: report.failures,
        novelty: design.novelty?.novelty,
        codeOverlap: record?.codeOverlap?.maxOverlapWithImports ?? null,
      },
      success: report.verdict === 'ship',
      confidence: report.verdict === 'ship' ? 0.7 : 0.5,
    }));

    for (const fix of fixes) {
      out.push(await this.record({
        ...base,
        task: `fix failing check "${fix.check}" on ${design.name}`,
        decision: `${fix.target}: ${JSON.stringify(fix.change)}`,
        result: `applied in round ${fix.round}; final verdict ${report.verdict} at score ${report.score}`,
        lesson: fix.why,
        evidence: { check: fix.check, severity: fix.severity, before: fix.before },
        success: report.verdict === 'ship',
        confidence: 0.6,
        tags: [...base.tags, 'auto-debug', fix.check],
      }));
    }
    return out;
  }

  async recent(n = 40) {
    const all = await this.store.lessons.all();
    return all.sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, n);
  }

  /** Lessons that keep recurring are the ones worth acting on. */
  async recurring(minCount = 2) {
    const all = await this.store.lessons.all();
    const byLesson = new Map();
    for (const l of all) {
      const key = l.lesson;
      if (!byLesson.has(key)) byLesson.set(key, { lesson: key, count: 0, successes: 0, tags: new Set(), examples: [] });
      const rec = byLesson.get(key);
      rec.count++;
      if (l.success) rec.successes++;
      (l.tags || []).forEach((t) => rec.tags.add(t));
      if (rec.examples.length < 3) rec.examples.push({ task: l.task, result: l.result, at: l.at });
    }
    return [...byLesson.values()]
      .filter((r) => r.count >= minCount)
      .map((r) => ({ ...r, tags: [...r.tags], successRate: round(r.successes / r.count, 2) }))
      .sort((a, b) => b.count - a.count);
  }

  async stats() {
    const all = await this.store.lessons.all();
    const wins = all.filter((l) => l.success).length;
    return {
      total: all.length,
      successes: wins,
      failures: all.length - wins,
      successRate: all.length ? round(wins / all.length, 3) : null,
      tags: [...new Set(all.flatMap((l) => l.tags || []))].slice(0, 30),
    };
  }
}
