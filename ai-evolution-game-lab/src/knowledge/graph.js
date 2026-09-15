/**
 * Knowledge graph (spec 34).
 *
 * Nodes: concepts, categories, roles (input/physics/...), libraries, asset kinds.
 * Edges: co-occurrence inside a project, weighted by pointwise mutual
 * information so that "collision <-> physics" outranks "collision <-> exists in
 * every project anyway".
 */
import { round } from '../core/util.js';

const STATE_KEY = 'knowledge-graph';

export class KnowledgeGraph {
  constructor({ store }) {
    this.store = store;
    this.data = null;
  }

  async load() {
    if (this.data) return this.data;
    this.data = await this.store.getState(STATE_KEY, { nodes: {}, pairs: {}, docs: 0 });
    return this.data;
  }

  async save() { return this.store.setState(STATE_KEY, this.data); }

  /** Feed one project's analysis into the graph. */
  async addProject(analysis) {
    await this.load();
    const d = this.data;
    const terms = new Set();

    for (const c of analysis.concepts) {
      terms.add(`concept:${c.key}`);
      terms.add(`category:${c.category}`);
    }
    for (const n of analysis.relations.nodes) terms.add(`role:${n.role}`);
    for (const dep of analysis.dependencies) terms.add(`lib:${dep.name}`);
    for (const a of analysis.assets) terms.add(`asset:${a.kind}`);
    if (analysis.architecture.dominantLoop) terms.add(`loop:${analysis.architecture.dominantLoop}`);
    terms.add(`rendering:${analysis.architecture.rendering}`);
    terms.add(`composition:${analysis.architecture.composition}`);
    terms.add(`kind:${analysis.kind}`);

    const list = [...terms];
    d.docs++;
    for (const t of list) {
      d.nodes[t] = (d.nodes[t] || 0) + 1;
    }
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const key = list[i] < list[j] ? `${list[i]}|${list[j]}` : `${list[j]}|${list[i]}`;
        d.pairs[key] = (d.pairs[key] || 0) + 1;
      }
    }
    // The relation edges carry real direction; store them with a marker.
    for (const e of analysis.relations.edges) {
      const key = `role:${e.from}=>role:${e.to}`;
      d.pairs[key] = (d.pairs[key] || 0) + e.weight;
    }
    await this.save();
    return this.summary();
  }

  /** PMI-weighted view of the graph, ready for the UI. */
  summary({ minCount = 1, maxEdges = 400 } = {}) {
    const d = this.data || { nodes: {}, pairs: {}, docs: 0 };
    const docs = Math.max(1, d.docs);
    const nodes = Object.entries(d.nodes)
      .filter(([, c]) => c >= minCount)
      .map(([id, count]) => {
        const [type, ...rest] = id.split(':');
        return { id, type, label: rest.join(':'), count, weight: round(count / docs, 3) };
      })
      .sort((a, b) => b.count - a.count);

    const edges = [];
    for (const [key, count] of Object.entries(d.pairs)) {
      const directed = key.includes('=>');
      const [a, b] = directed ? key.split('=>') : key.split('|');
      const ca = d.nodes[a] || 0;
      const cb = d.nodes[b] || 0;
      if (!ca || !cb) { if (directed) edges.push({ from: a, to: b, weight: count, pmi: null, directed: true }); continue; }
      const pAB = count / docs;
      const pmi = Math.log2(pAB / ((ca / docs) * (cb / docs)) || 1e-9);
      edges.push({ from: a, to: b, weight: count, pmi: round(pmi, 3), directed });
    }
    edges.sort((x, y) => (y.pmi ?? 0) * Math.log(1 + y.weight) - (x.pmi ?? 0) * Math.log(1 + x.weight));

    return { docs: d.docs, nodes: nodes.slice(0, 300), edges: edges.slice(0, maxEdges) };
  }

  /** Neighbours of a node, strongest association first. */
  neighbours(nodeId, limit = 12) {
    const { edges } = this.summary({ maxEdges: 100000 });
    return edges
      .filter((e) => e.from === nodeId || e.to === nodeId)
      .map((e) => ({ id: e.from === nodeId ? e.to : e.from, pmi: e.pmi, weight: e.weight }))
      .slice(0, limit);
  }

  /** Concepts that usually travel together with the given set (used when planning a game). */
  suggestCompanions(nodeIds, limit = 8) {
    const scores = new Map();
    for (const id of nodeIds) {
      for (const n of this.neighbours(id, 40)) {
        if (nodeIds.includes(n.id)) continue;
        scores.set(n.id, (scores.get(n.id) || 0) + (n.pmi ?? 0) * Math.log(1 + n.weight));
      }
    }
    return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
      .map(([id, score]) => ({ id, score: round(score, 3) }));
  }
}
