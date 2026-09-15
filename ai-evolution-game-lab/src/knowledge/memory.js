/**
 * Project memory (spec 32) - deliberately separate from global knowledge (33).
 *
 *   Project memory : facts true of ONE project (its architecture, its bugs,
 *                    its decisions, its versions).
 *   Global knowledge: concepts abstracted across ALL projects.
 *
 * Keeping them apart is what stops the lab from "remembering" one project so
 * hard that every new game looks like it.
 */
import { nowIso } from '../core/util.js';

export class ProjectMemory {
  constructor({ store, bus }) {
    this.store = store;
    this.bus = bus;
    this.col = store.collection('memory');
  }

  async forProject(projectId) {
    return (await this.col.findOne((m) => m.projectId === projectId)) || null;
  }

  async record(projectId, analysis) {
    const existing = await this.forProject(projectId);
    const doc = existing || {
      projectId,
      name: analysis.name,
      architecture: null,
      features: [],
      assets: [],
      knownBugs: [],
      solutions: [],
      decisions: [],
      lessons: [],
      versions: [],
    };
    doc.name = analysis.name;
    doc.architecture = analysis.architecture;
    doc.features = analysis.features;
    doc.assets = analysis.assets.map((a) => ({ rel: a.rel, kind: a.kind, bytes: a.bytes }));
    doc.knownBugs = analysis.problems.map((p) => ({ ...p, status: 'open', foundAt: nowIso() }));
    doc.optimizations = analysis.optimizations;
    doc.pipeline = analysis.relations.pipeline;
    doc.license = analysis.license;
    doc.versions = [...(doc.versions || []), { at: nowIso(), stats: analysis.stats, concepts: analysis.concepts.length }].slice(-20);
    return this.col.put(doc);
  }

  async addDecision(projectId, { decision, rationale, result = null }) {
    const doc = await this.forProject(projectId);
    if (!doc) return null;
    doc.decisions = [...doc.decisions, { decision, rationale, result, at: nowIso() }].slice(-100);
    return this.col.put(doc);
  }

  async addSolution(projectId, { problem, solution, verified = false }) {
    const doc = await this.forProject(projectId);
    if (!doc) return null;
    doc.solutions = [...doc.solutions, { problem, solution, verified, at: nowIso() }].slice(-100);
    const bug = doc.knownBugs.find((b) => b.issue === problem);
    if (bug && verified) bug.status = 'fixed';
    return this.col.put(doc);
  }

  async addLesson(projectId, lesson) {
    const doc = await this.forProject(projectId);
    if (!doc) return null;
    doc.lessons = [...doc.lessons, { ...lesson, at: nowIso() }].slice(-100);
    return this.col.put(doc);
  }
}
