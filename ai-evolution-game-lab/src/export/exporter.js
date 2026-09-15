/**
 * EXPORT (spec 54).
 *
 * Exports are explicit about what they contain. System internals (config with
 * credentials, caches, raw import copies) are never mixed into an export
 * bundle; each exporter states exactly what it includes.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { writeZip } from '../importer/zip.js';
import { walk } from '../core/paths.js';
import { nowIso, slug, bytes as fmtBytes } from '../core/util.js';

const NEVER_EXPORT = [/lab\.config\.json$/i, /\.env$/i, /apikey/i, /credential/i, /\.key$/i, /token/i];

function isSafe(rel) { return !NEVER_EXPORT.some((re) => re.test(rel)); }

export class Exporter {
  constructor({ config, store, bus }) {
    this.config = config;
    this.store = store;
    this.bus = bus;
  }

  async #write(name, files, { manifest }) {
    const entries = [...files, { name: 'EXPORT_MANIFEST.json', data: JSON.stringify(manifest, null, 2) }];
    const buf = writeZip(entries);
    const out = path.join(this.config.dirs.exports, `${slug(name)}-${Date.now().toString(36)}.zip`);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, buf);
    this.bus?.success('export.done', { file: path.basename(out), size: fmtBytes(buf.length), entries: entries.length });
    return { file: out, bytes: buf.length, entries: entries.length, manifest };
  }

  /** A generated game, ready to open or publish. */
  async exportGeneratedProject(generatedId) {
    const rec = await this.store.generated.get(generatedId);
    if (!rec) throw new Error(`generated project ${generatedId} not found`);
    if (!rec.dir) throw new Error('this project was generated in memory only; regenerate it to disk first');
    const scope = this.config.scope();
    const files = [];
    for (const f of await walk(scope, rec.dir, { maxFiles: 4000 })) {
      if (!isSafe(f.rel)) continue;
      files.push({ name: f.rel.split(path.sep).join('/'), data: await fs.readFile(f.path) });
    }
    return this.#write(rec.name, files, {
      manifest: {
        kind: 'generated-project',
        name: rec.name,
        generatedId: rec.id,
        designId: rec.designId,
        agentVersion: rec.agentVersion,
        testScore: rec.test?.score ?? null,
        quality: rec.quality ?? null,
        files: files.length,
        contains: 'the complete runnable project: HTML, CSS, engine modules, game rules, manifest and README',
        excludes: 'lab configuration, caches, credentials and any imported source',
        license: 'You own this generated project. All art and audio are produced at runtime from code, so nothing third-party is bundled.',
        exportedAt: nowIso(),
      },
    });
  }

  /** The knowledge base, as data rather than as a database dump. */
  async exportKnowledge() {
    const items = await this.store.knowledge.all();
    const graph = await this.store.getState('knowledge-graph', { nodes: {}, pairs: {}, docs: 0 });
    const files = [
      { name: 'knowledge.json', data: JSON.stringify(items, null, 2) },
      { name: 'graph.json', data: JSON.stringify(graph, null, 2) },
      { name: 'knowledge.csv', data: toCsv(items.map((k) => ({
        key: k.key, category: k.category, concept: k.concept, confidence: k.confidence,
        sources: (k.sources || []).map((s) => s.projectName).join('; '),
        successfulUses: (k.successfulUses || []).length, failedUses: (k.failedUses || []).length,
      }))) },
    ];
    return this.#write('knowledge', files, {
      manifest: {
        kind: 'knowledge-base',
        items: items.length,
        contains: 'concepts, descriptions, confidence, source projects, related concepts and generator outcomes',
        excludes: 'any source code from the imported projects',
        exportedAt: nowIso(),
      },
    });
  }

  /** Per-project memory (spec 32). */
  async exportProjectMemory(projectId) {
    const memory = await this.store.collection('memory').findOne((m) => m.projectId === projectId);
    const project = await this.store.projects.get(projectId);
    if (!memory || !project) throw new Error('project memory not found');
    const files = [
      { name: 'memory.json', data: JSON.stringify(memory, null, 2) },
      { name: 'analysis.json', data: JSON.stringify(stripHeavy(project.analysis), null, 2) },
    ];
    return this.#write(`memory-${project.name}`, files, {
      manifest: {
        kind: 'project-memory',
        project: project.name,
        contains: 'architecture, features, assets index, known bugs, solutions, decisions, lessons and versions',
        excludes: 'the project source files themselves and the code fingerprint',
        exportedAt: nowIso(),
      },
    });
  }

  /** Dataset metadata only - the JSONL files stay in the workspace. */
  async exportDatasetMetadata() {
    const datasets = await this.store.datasets.all();
    return this.#write('dataset-metadata', [
      { name: 'datasets.json', data: JSON.stringify(datasets, null, 2) },
    ], {
      manifest: {
        kind: 'dataset-metadata',
        datasets: datasets.length,
        contains: 'dataset names, stages, counts, splits and size estimates',
        excludes: 'the training examples themselves (they stay in the workspace under datasets/)',
        note: 'No model weights exist in this project; these datasets are inputs for an external training backend.',
        exportedAt: nowIso(),
      },
    });
  }

  /** Evaluation history: versions, benchmarks, experiments. */
  async exportEvaluation() {
    const versions = await this.store.versions.all();
    const experiments = await this.store.experiments.all();
    const files = [
      { name: 'versions.json', data: JSON.stringify(versions, null, 2) },
      { name: 'experiments.json', data: JSON.stringify(experiments, null, 2) },
      { name: 'versions.csv', data: toCsv(versions.map((v) => ({
        version: v.version, status: v.status, parent: v.parentVersion,
        score: v.benchmark?.score ?? '', shipped: v.benchmark?.shipped ?? '',
        decision: v.decision || '', createdAt: v.createdAt,
      }))) },
    ];
    return this.#write('evaluation', files, {
      manifest: {
        kind: 'evaluation-history',
        versions: versions.length,
        experiments: experiments.length,
        contains: 'benchmark scores per version, per-task results, experiment hypotheses and outcomes',
        exportedAt: nowIso(),
      },
    });
  }

  async exportLogs(bus) {
    const log = bus?.log || [];
    return this.#write('logs', [
      { name: 'events.jsonl', data: log.map((e) => JSON.stringify(e)).join('\n') },
    ], {
      manifest: { kind: 'logs', events: log.length, contains: 'the in-memory event log of this session', exportedAt: nowIso() },
    });
  }
}

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

function stripHeavy(analysis) {
  if (!analysis) return null;
  const { fingerprint, ...rest } = analysis;
  return { ...rest, fingerprint: fingerprint ? { shingleCount: fingerprint.shingleCount, digest: fingerprint.digest } : null };
}
