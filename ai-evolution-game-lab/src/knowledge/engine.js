/**
 * Knowledge engine (spec 9, 10, 14, 33).
 *
 * Converts per-project concept observations into durable, *abstract* knowledge
 * items. A knowledge item is never source code: it is a concept, a description,
 * where it was seen, how confident we are, which parameter ranges accompanied
 * it, and how it performed when the generator actually used it.
 *
 * Learning here is explicitly "knowledge learning" - not model training.
 * See docs/LEARNING.md and src/training/pipeline.js for the distinction.
 */
import { CATEGORIES } from '../analysis/concepts.js';
import { clamp, round, mean, median } from '../core/util.js';

export class KnowledgeEngine {
  constructor({ store, bus }) {
    this.store = store;
    this.bus = bus;
  }

  /**
   * Confidence model (kept deliberately simple and explainable):
   *   - independent source projects dominate: seeing a concept in 5 different
   *     projects is much stronger evidence than 50 hits in one project
   *   - generator outcomes adjust it: concepts that produced passing games gain
   *     confidence, concepts whose use coincided with failures lose some
   *   - it is never 1.0; nothing here is proven, it is evidence-weighted
   */
  static computeConfidence(item) {
    const projects = new Set(item.sources.map((s) => s.projectId)).size;
    const evidence = item.observations || 0;
    const base = 1 - Math.exp(-(0.45 * projects + 0.06 * Math.min(evidence, 40)));
    const uses = item.successfulUses.length + item.failedUses.length;
    const outcome = uses ? (item.successfulUses.length / uses - 0.5) * 0.3 : 0;
    const external = item.verifiedBy?.length ? 0.06 * Math.min(item.verifiedBy.length, 3) : 0;
    // Nothing reaches high confidence on corpus frequency alone: a concept only
    // passes 0.9 once the generator has actually shipped working code with it.
    const ceiling = item.successfulUses.length || item.verifiedBy?.length ? 0.97 : 0.9;
    return round(clamp(base + outcome + external, 0.05, ceiling), 3);
  }

  async ingestProject(analysis) {
    const touched = [];
    for (const c of analysis.concepts) {
      const existing = await this.store.knowledge.findOne((k) => k.key === c.key);
      const source = {
        projectId: analysis.projectId,
        projectName: analysis.name,
        files: c.evidence.map((e) => e.file).slice(0, 6),
        occurrences: c.occurrences,
        at: new Date().toISOString(),
      };

      const item = existing || {
        key: c.key,
        category: c.category,
        concept: c.title,
        description: c.summary,
        antiPattern: !!c.negative,
        examples: [],
        sources: [],
        related: [],
        successfulUses: [],
        failedUses: [],
        verifiedBy: [],
        parameters: {},
        observations: 0,
      };

      item.sources = [...item.sources.filter((s) => s.projectId !== analysis.projectId), source].slice(-40);
      item.observations += c.occurrences;
      for (const e of c.evidence.slice(0, 3)) {
        const ex = `${analysis.name}: ${e.file}${e.detail ? ` (${e.detail})` : ''}`;
        if (!item.examples.includes(ex)) item.examples.push(ex);
      }
      item.examples = item.examples.slice(-24);
      item.lastSeen = new Date().toISOString();
      item.confidence = KnowledgeEngine.computeConfidence(item);
      const saved = await this.store.knowledge.put(item);
      touched.push(saved);
    }

    await this.#mergeParameters(analysis);
    await this.#linkRelated(analysis);
    this.bus.info('knowledge.ingest', { project: analysis.name, concepts: analysis.concepts.length, items: touched.length });
    return touched;
  }

  /** Tuning priors are learned parameter *ranges*, attached to physics/tuning knowledge. */
  async #mergeParameters(analysis) {
    const key = 'physics.tuning';
    const item = await this.store.knowledge.findOne((k) => k.key === key);
    if (!item) return;
    for (const [name, summary] of Object.entries(analysis.tuningPriors || {})) {
      if (!summary) continue;
      const cur = item.parameters[name] || { samples: [], projects: [] };
      cur.samples = [...cur.samples, ...summary.samples].slice(-120);
      if (!cur.projects.includes(analysis.name)) cur.projects.push(analysis.name);
      cur.min = Math.min(...cur.samples);
      cur.max = Math.max(...cur.samples);
      cur.median = round(median(cur.samples), 4);
      cur.mean = round(mean(cur.samples), 4);
      item.parameters[name] = cur;
    }
    await this.store.knowledge.put(item);
  }

  /** Concepts observed together in one project become related concepts. */
  async #linkRelated(analysis) {
    const keys = analysis.concepts.map((c) => c.key);
    for (const k of keys) {
      const item = await this.store.knowledge.findOne((x) => x.key === k);
      if (!item) continue;
      const others = keys.filter((o) => o !== k);
      const counts = new Map(item.related.map((r) => [r.key, r.weight]));
      for (const o of others) counts.set(o, (counts.get(o) || 0) + 1);
      item.related = [...counts.entries()]
        .map(([key, weight]) => ({ key, weight }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 16);
      await this.store.knowledge.put(item);
    }
  }

  /** Feedback from the generator/test agent (spec 16). */
  async recordUse(key, { success, ref, note, score }) {
    const item = await this.store.knowledge.findOne((k) => k.key === key);
    if (!item) return null;
    const entry = { ref, note: note || null, score: score ?? null, at: new Date().toISOString() };
    if (success) item.successfulUses = [...item.successfulUses, entry].slice(-60);
    else item.failedUses = [...item.failedUses, entry].slice(-60);
    item.confidence = KnowledgeEngine.computeConfidence(item);
    return this.store.knowledge.put(item);
  }

  async markVerified(key, evidence) {
    const item = await this.store.knowledge.findOne((k) => k.key === key);
    if (!item) return null;
    item.verifiedBy = [...(item.verifiedBy || []), evidence].slice(-10);
    item.confidence = KnowledgeEngine.computeConfidence(item);
    return this.store.knowledge.put(item);
  }

  async byCategory() {
    const all = await this.store.knowledge.all();
    const out = {};
    for (const cat of CATEGORIES) out[cat] = [];
    for (const item of all) (out[item.category] ||= []).push(item);
    for (const cat of Object.keys(out)) out[cat].sort((a, b) => b.confidence - a.confidence);
    return out;
  }

  async stats() {
    const all = await this.store.knowledge.all();
    const projects = new Set();
    for (const k of all) for (const s of k.sources) projects.add(s.projectId);
    const uses = all.reduce((s, k) => s + k.successfulUses.length + k.failedUses.length, 0);
    const success = all.reduce((s, k) => s + k.successfulUses.length, 0);
    return {
      items: all.length,
      categories: new Set(all.map((k) => k.category)).size,
      sourceProjects: projects.size,
      antiPatterns: all.filter((k) => k.antiPattern).length,
      averageConfidence: round(mean(all.map((k) => k.confidence)), 3),
      highConfidence: all.filter((k) => k.confidence >= 0.7).length,
      generatorUses: uses,
      generatorSuccessRate: uses ? round(success / uses, 3) : null,
    };
  }

  /**
   * What the generator asks for: the strongest evidence-backed capabilities,
   * optionally filtered by category. Anti-patterns are returned separately so
   * the generator can actively avoid them.
   */
  async capabilities({ minConfidence = 0.25 } = {}) {
    const all = await this.store.knowledge.all();
    return {
      supported: all.filter((k) => !k.antiPattern && k.confidence >= minConfidence)
        .sort((a, b) => b.confidence - a.confidence),
      avoid: all.filter((k) => k.antiPattern),
      parameters: (all.find((k) => k.key === 'physics.tuning') || {}).parameters || {},
    };
  }
}
