/**
 * DIVERSITY ENGINE (spec 5).
 *
 * Purpose, stated plainly: stop the lab from producing the same game twice.
 * This is an anti-repetition mechanism, not a judgement about anyone's rights.
 *
 * Two independent measures:
 *   1. design similarity  - trait-vector distance against previously generated designs
 *   2. code similarity    - normalized token shingles against the *imported* corpus,
 *                           which catches the generator accidentally reproducing
 *                           a chunk of the user's own source instead of composing
 *                           something new
 */
import { SIMILARITY_WEIGHTS, DIMENSION_KEYS } from './traits.js';
import { jaccard, round, shingles } from '../core/util.js';
import { normalizedTokens } from '../analysis/js.js';

export const DEFAULT_THRESHOLD = 0.62;

export function traitVector(design) {
  const v = {};
  for (const k of DIMENSION_KEYS) v[k] = design.traits?.[k] ?? null;
  return v;
}

/** Weighted trait agreement, 0 (nothing in common) .. 1 (identical design). */
export function designSimilarity(a, b) {
  const va = traitVector(a);
  const vb = traitVector(b);
  let total = 0;
  let same = 0;
  const shared = [];
  for (const [k, w] of Object.entries(SIMILARITY_WEIGHTS)) {
    total += w;
    if (va[k] && va[k] === vb[k]) { same += w; shared.push(k); }
  }
  // mechanics overlap adds a second, content-level signal
  const ma = new Set(a.mechanics || []);
  const mb = new Set(b.mechanics || []);
  const mech = ma.size || mb.size ? jaccard(ma, mb) : 0;
  const traitScore = total ? same / total : 0;
  return { score: round(traitScore * 0.8 + mech * 0.2, 3), sharedDimensions: shared, mechanicsOverlap: round(mech, 3) };
}

export class DiversityEngine {
  constructor({ store, bus, threshold = DEFAULT_THRESHOLD } = {}) {
    this.store = store;
    this.bus = bus;
    this.threshold = threshold;
  }

  async previousDesigns(limit = 80) {
    const all = await this.store.designs.all();
    return all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, limit);
  }

  /** @returns {{max:number, nearest:object|null, matches:Array, pass:boolean}} */
  async checkDesign(design, { threshold = this.threshold } = {}) {
    const prev = await this.previousDesigns();
    const matches = prev
      .filter((p) => p.id !== design.id)
      .map((p) => ({ id: p.id, name: p.name, ...designSimilarity(design, p) }))
      .sort((a, b) => b.score - a.score);
    const max = matches.length ? matches[0].score : 0;
    return {
      max,
      nearest: matches[0] || null,
      matches: matches.slice(0, 5),
      pass: max < threshold,
      threshold,
      comparedAgainst: prev.length,
    };
  }

  /**
   * Compare generated source against the imported corpus fingerprints.
   * A high value means the generator echoed existing code rather than composing
   * new code, which is a generation bug we want to catch.
   */
  async checkCode(sources) {
    const projects = await this.store.projects.all();
    const genSet = new Set();
    for (const src of sources) {
      try {
        for (const s of shingles(normalizedTokens(src), 9)) genSet.add(s);
      } catch { /* ignore unparseable emitted file */ }
    }
    let worst = { project: null, overlap: 0 };
    for (const p of projects) {
      const fp = p.analysis?.fingerprint?.sample;
      if (!fp || !fp.length) continue;
      const corpus = new Set(fp);
      let hits = 0;
      for (const s of genSet) if (corpus.has(s)) hits++;
      const overlap = genSet.size ? hits / genSet.size : 0;
      if (overlap > worst.overlap) worst = { project: p.name, overlap: round(overlap, 4) };
    }
    return {
      generatedShingles: genSet.size,
      maxOverlapWithImports: worst.overlap,
      nearestProject: worst.project,
      pass: worst.overlap < 0.15,
      note: 'Token-shingle overlap with the imported corpus. High values mean the generator echoed existing source instead of composing new code.',
    };
  }

  /**
   * Which trait values are over-used in the corpus? The designer uses this to
   * bias away from them (this is what actually creates variety, rather than
   * rejecting designs after the fact).
   */
  async saturation() {
    const prev = await this.previousDesigns(200);
    const counts = {};
    for (const dim of DIMENSION_KEYS) counts[dim] = {};
    for (const d of prev) {
      for (const dim of DIMENSION_KEYS) {
        const v = d.traits?.[dim];
        if (!v) continue;
        counts[dim][v] = (counts[dim][v] || 0) + 1;
      }
    }
    return { total: prev.length, counts };
  }
}
