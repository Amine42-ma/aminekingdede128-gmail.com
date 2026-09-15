/**
 * NOVELTY ENGINE (spec 35).
 *
 * Rather than "generate then reject if too similar", this searches the trait
 * space for the point that is *furthest* from everything generated so far while
 * still being buildable with the capabilities the lab actually has. Rejection
 * (diversity.js) remains as the safety net; this is the part that produces
 * genuinely different games instead of shuffled ones.
 */
import { DIMENSIONS, DIMENSION_KEYS, optionsFor, findOption } from './traits.js';
import { designSimilarity } from './diversity.js';
import { round, clamp } from '../core/util.js';

/**
 * Capability support: how much evidence the knowledge base has for the modules
 * a trait needs. Used as a mild preference, never a veto - the lab must be able
 * to build genres it has never imported an example of.
 */
const CAPABILITY_CONCEPTS = {
  entities: ['arch.entity-list', 'arch.ecs'],
  collision: ['physics.collision', 'opt.spatial'],
  ai: ['ai.steering', 'ai.pathfinding'],
  particles: ['opt.pooling'],
  physics: ['physics.tuning', 'sim.interpolation'],
  camera: ['sim.interpolation'],
  procgen: ['procgen.noise', 'procgen.seeded'],
  grid: ['data.json-config'],
  three: ['3d.threejs', '3d.gltf-loading'],
  camera3d: ['3d.threejs'],
  keyboard: ['input.keyboard-map'],
  pointer: ['input.pointer'],
  touch: ['input.touch-mobile'],
  audio: ['audio.webaudio'],
};

export function capabilitySupport(requires = [], knowledgeIndex) {
  if (!requires.length) return 0.5;
  let sum = 0;
  for (const cap of requires) {
    const keys = CAPABILITY_CONCEPTS[cap] || [];
    const best = Math.max(0, ...keys.map((k) => knowledgeIndex.get(k)?.confidence || 0));
    sum += best;
  }
  return round(sum / requires.length, 3);
}

export class NoveltyEngine {
  constructor({ store, diversity, bus }) {
    this.store = store;
    this.diversity = diversity;
    this.bus = bus;
  }

  async knowledgeIndex() {
    const all = await this.store.knowledge.all();
    return new Map(all.map((k) => [k.key, k]));
  }

  /**
   * @param {object} opts
   * @param {function} opts.rng deterministic RNG
   * @param {object} opts.brief user constraints, e.g. {genre, mustUse:['glb'], theme}
   * @param {number} opts.candidates how many points to evaluate
   */
  async proposeTraits({ rng, brief = {}, candidates = 48, noveltyWeight = 1.0 } = {}) {
    const [{ counts, total }, index, previous] = await Promise.all([
      this.diversity.saturation(),
      this.knowledgeIndex(),
      this.diversity.previousDesigns(80),
    ]);

    const pickDim = (dim, ruleset, forced) => {
      if (forced && findOption(dim, forced)) return forced;
      const opts = optionsFor(dim, ruleset);
      if (!opts.length) return null;
      const used = counts[dim] || {};
      const items = opts.map((o) => {
        const seen = used[o.id] || 0;
        // inverse-frequency weighting: unexplored options are strongly preferred
        const freshness = 1 / (1 + seen * 1.6);
        const support = 0.5 + 0.5 * capabilitySupport(o.requires, index);
        const base = o.weight ?? 1;
        return { value: o.id, weight: base * (freshness ** noveltyWeight) * support };
      });
      return rng.weighted(items);
    };

    const evaluate = (traits) => {
      const probe = { traits, mechanics: [] };
      let maxSim = 0;
      let nearest = null;
      for (const p of previous) {
        const { score } = designSimilarity(probe, p);
        if (score > maxSim) { maxSim = score; nearest = p.name; }
      }
      const combo = `${traits.genre}|${traits.twist}|${traits.physics}|${traits.objective}`;
      const comboSeen = previous.some((p) => `${p.traits?.genre}|${p.traits?.twist}|${p.traits?.physics}|${p.traits?.objective}` === combo);
      const support = capabilitySupport(findOption('genre', traits.genre)?.requires, index);
      const novelty = 1 - maxSim;
      return {
        novelty: round(novelty, 3),
        maxSimilarity: round(maxSim, 3),
        nearest,
        comboSeen,
        support,
        score: round(novelty * 1.0 + (comboSeen ? -0.25 : 0.12) + support * 0.18, 4),
      };
    };

    let best = null;
    for (let i = 0; i < candidates; i++) {
      const genreId = pickDim('genre', null, brief.genre);
      const genre = findOption('genre', genreId);
      const ruleset = genre?.ruleset || 'arena';
      const traits = { genre: genreId };
      for (const dim of DIMENSION_KEYS) {
        if (dim === 'genre') continue;
        traits[dim] = pickDim(dim, ruleset, brief[dim]);
      }
      const evalResult = evaluate(traits);
      if (!best || evalResult.score > best.evaluation.score) best = { traits, ruleset, evaluation: evalResult };
    }

    this.bus?.info('novelty.proposed', {
      genre: best.traits.genre, twist: best.traits.twist,
      novelty: best.evaluation.novelty, comparedAgainst: total,
    });
    return { ...best, corpusSize: total };
  }

  /**
   * Concept synthesis: builds a theme from knowledge-graph companions rather
   * than from any single source project, so the pitch is not "project A + B".
   */
  async synthesizeTheme({ rng, traits, graph }) {
    const settings = [
      'a drifting research station', 'an overgrown rooftop district', 'a frozen signal array',
      'a collapsed data vault', 'a tidal cave system', 'a night market on stilts',
      'a derelict orbital elevator', 'a desert solar farm', 'a flooded metro line',
      'a glacier survey camp', 'a canyon relay network', 'a storm-cell observatory',
    ];
    const roles = [
      'a salvage diver', 'a signal courier', 'a night gardener', 'a survey drone pilot',
      'a lighthouse keeper', 'a cartographer', 'a repair technician', 'an archivist',
    ];
    const pressures = [
      'the power budget is falling', 'a storm front is closing in', 'the tide is rising',
      'the network is being overwritten', 'the structure is settling', 'the light is going out',
      'the swarm is waking up', 'the ice is breaking apart',
    ];
    const companions = graph ? graph.suggestCompanions([`concept:${traits.genre}`, `role:ai`], 5).map((c) => c.id) : [];
    return {
      setting: rng.pick(settings),
      role: rng.pick(roles),
      pressure: rng.pick(pressures),
      graphCompanions: companions,
    };
  }

  /** Reported in the UI: how much of the constrained space has been visited. */
  async coverage() {
    const prev = await this.diversity.previousDesigns(500);
    const seen = {};
    for (const dim of DIMENSION_KEYS) seen[dim] = new Set();
    for (const d of prev) for (const dim of DIMENSION_KEYS) if (d.traits?.[dim]) seen[dim].add(d.traits[dim]);
    const out = {};
    for (const dim of DIMENSION_KEYS) {
      const total = DIMENSIONS[dim].length;
      out[dim] = { used: seen[dim].size, total, ratio: round(seen[dim].size / total, 3) };
    }
    const combos = new Set(prev.map((d) => `${d.traits?.genre}|${d.traits?.twist}`));
    return { dimensions: out, uniqueGenreTwistPairs: combos.size, designs: prev.length };
  }
}

export function noveltyOf(design, previous) {
  let max = 0;
  for (const p of previous) max = Math.max(max, designSimilarity(design, p).score);
  return round(clamp(1 - max, 0, 1), 3);
}
