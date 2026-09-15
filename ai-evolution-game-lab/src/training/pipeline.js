/**
 * TRAINING PIPELINE (spec 14, 15, 46, 47, 48, 50).
 *
 * READ THIS FIRST - it is the honesty boundary of the whole project:
 *
 *   Knowledge learning  (implemented)  concepts, parameters, graph, lessons
 *   Memory learning     (implemented)  project memory + global knowledge
 *   Workflow learning   (implemented)  agent policy versions, benchmarked
 *   Retrieval           (implemented)  lexical retrieval over stored knowledge
 *   Fine-tuning         (INTERFACE ONLY)  needs a real training backend + GPU
 *   Continued training  (INTERFACE ONLY)  same
 *
 * This file builds real datasets and runs the real preparation stages. It stops
 * at the point where model weights would change, and says so, because nothing
 * in a browser or in this Node process can train a language model. Attach a
 * training backend and the same pipeline hands it a prepared dataset.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { hashHex, nowIso, round, mean } from '../core/util.js';

export const LEARNING_KINDS = {
  knowledge: { implemented: true, changesWeights: false, description: 'Concepts and parameter ranges extracted from analysed projects.' },
  memory: { implemented: true, changesWeights: false, description: 'Per-project memory and global knowledge, stored and queried.' },
  workflow: { implemented: true, changesWeights: false, description: 'Agent policy versions promoted or rolled back on benchmark evidence.' },
  retrieval: { implemented: true, changesWeights: false, description: 'Lexical retrieval over the knowledge base; no semantic embedding model unless one is configured.' },
  fineTuning: { implemented: false, changesWeights: true, description: 'Requires an external training backend with GPU; the lab only prepares datasets.' },
  continuedTraining: { implemented: false, changesWeights: true, description: 'Same as fine-tuning: dataset preparation only.' },
};

/** Dataset builder -> cleaner -> deduplicator -> preparation -> (trainer). */
export class TrainingPipeline {
  constructor({ config, store, bus }) {
    this.config = config;
    this.store = store;
    this.bus = bus;
    this.dir = config.dirs.datasets;
  }

  /**
   * Stage 1 - build: turn the lab's own records into supervised examples.
   * Sources are the lab's artefacts (analyses, designs, test reports, lessons),
   * never raw copies of the user's source files.
   */
  async build({ name = `dataset-${Date.now().toString(36)}`, include = ['analysis', 'design', 'debug', 'lessons'] } = {}) {
    const examples = [];

    if (include.includes('analysis')) {
      for (const p of await this.store.projects.all()) {
        const a = p.analysis;
        if (!a) continue;
        examples.push({
          kind: 'analysis',
          input: `Describe the architecture of a project with these signals: ${JSON.stringify({ kind: a.kind, apis: a.stats.apis, patterns: a.stats.patterns, files: a.stats.files })}`,
          output: `${a.summary}\nArchitecture: ${JSON.stringify(a.architecture)}`,
          source: { projectId: p.id, projectName: p.name },
        });
      }
    }

    if (include.includes('design')) {
      for (const d of await this.store.designs.all()) {
        examples.push({
          kind: 'design',
          input: `Design a ${d.traits?.genre} game with objective ${d.traits?.objective}, physics ${d.traits?.physics} and modifier ${d.traits?.twist}.`,
          output: JSON.stringify({ pitch: d.pitch, coreLoop: d.coreLoop, winCondition: d.winCondition, parameters: d.parameters, modules: d.architecture?.modules }),
          source: { designId: d.id },
        });
      }
    }

    if (include.includes('debug')) {
      for (const g of await this.store.generated.all()) {
        for (const f of g.fixes || []) {
          examples.push({
            kind: 'debug',
            input: `A generated ${g.ruleset} game failed the check "${f.check}": ${f.before}`,
            output: `${JSON.stringify(f.change)} - ${f.why}`,
            source: { generatedId: g.id },
          });
        }
      }
    }

    if (include.includes('lessons')) {
      for (const l of await this.store.lessons.all()) {
        examples.push({
          kind: 'lesson',
          input: `Task: ${l.task}. What is the right decision and why?`,
          output: `${l.decision}\nResult: ${l.result}\nLesson: ${l.lesson}`,
          source: { lessonId: l.id },
        });
      }
    }

    const dataset = {
      name,
      stage: 'built',
      builtAt: nowIso(),
      counts: countKinds(examples),
      examples,
    };
    this.bus?.info('training.build', { name, examples: examples.length });
    return dataset;
  }

  /** Stage 2 - clean: drop empty, oversized and malformed examples. */
  clean(dataset, { minChars = 24, maxChars = 6000 } = {}) {
    const kept = [];
    const dropped = [];
    for (const ex of dataset.examples) {
      const inLen = String(ex.input || '').length;
      const outLen = String(ex.output || '').length;
      if (inLen < minChars || outLen < minChars) { dropped.push({ ...ex, reason: 'too short' }); continue; }
      if (inLen > maxChars || outLen > maxChars) { dropped.push({ ...ex, reason: 'too long' }); continue; }
      if (/undefined|\[object Object\]/.test(ex.output)) { dropped.push({ ...ex, reason: 'malformed output' }); continue; }
      kept.push(ex);
    }
    this.bus?.info('training.clean', { kept: kept.length, dropped: dropped.length });
    return { ...dataset, stage: 'cleaned', examples: kept, dropped: dropped.length, dropReasons: countReasons(dropped) };
  }

  /** Stage 3 - deduplicate on a hash of the normalised pair. */
  dedupe(dataset) {
    const seen = new Set();
    const kept = [];
    let duplicates = 0;
    for (const ex of dataset.examples) {
      const key = hashHex(`${normalize(ex.input)}|${normalize(ex.output)}`);
      if (seen.has(key)) { duplicates++; continue; }
      seen.add(key);
      kept.push(ex);
    }
    this.bus?.info('training.dedupe', { kept: kept.length, duplicates });
    return { ...dataset, stage: 'deduplicated', examples: kept, duplicates };
  }

  /**
   * Stage 4 - prepare: split, and report size in an approximate token budget.
   * The estimate is chars/4; it is labelled as an estimate because no tokenizer
   * is bundled.
   */
  prepare(dataset, { valSplit = 0.15 } = {}) {
    const shuffled = dataset.examples.slice().sort((a, b) => hashHex(a.input).localeCompare(hashHex(b.input)));
    const cut = Math.max(1, Math.floor(shuffled.length * (1 - valSplit)));
    const train = shuffled.slice(0, cut);
    const val = shuffled.slice(cut);
    const chars = dataset.examples.reduce((s, e) => s + String(e.input).length + String(e.output).length, 0);
    return {
      ...dataset,
      stage: 'prepared',
      split: { train: train.length, validation: val.length },
      train,
      validation: val,
      stats: {
        examples: dataset.examples.length,
        characters: chars,
        estimatedTokens: Math.round(chars / 4),
        estimateNote: 'chars/4 heuristic - no tokenizer is bundled, so this is an estimate, not a token count',
        averageOutputChars: round(mean(dataset.examples.map((e) => String(e.output).length)), 1),
      },
    };
  }

  /** Persist a prepared dataset as JSONL plus a metadata record. */
  async save(dataset) {
    await fs.mkdir(this.dir, { recursive: true });
    const base = path.join(this.dir, dataset.name);
    const toJsonl = (rows) => rows.map((r) => JSON.stringify({ input: r.input, output: r.output, kind: r.kind })).join('\n');
    await fs.writeFile(`${base}.train.jsonl`, toJsonl(dataset.train || dataset.examples));
    if (dataset.validation) await fs.writeFile(`${base}.val.jsonl`, toJsonl(dataset.validation));
    const meta = {
      name: dataset.name,
      stage: dataset.stage,
      counts: dataset.counts,
      split: dataset.split || null,
      stats: dataset.stats || null,
      duplicates: dataset.duplicates ?? null,
      dropped: dataset.dropped ?? null,
      files: [`${dataset.name}.train.jsonl`, dataset.validation ? `${dataset.name}.val.jsonl` : null].filter(Boolean),
      createdAt: nowIso(),
      note: 'Dataset only. No model weights were changed by producing this file.',
    };
    const doc = await this.store.datasets.put(meta);
    this.bus?.success('training.save', { name: dataset.name, train: dataset.split?.train, val: dataset.split?.validation });
    return doc;
  }

  /** Run every implemented stage in order. */
  async buildAndSave(opts = {}) {
    const built = await this.build(opts);
    const prepared = this.prepare(this.dedupe(this.clean(built)), opts);
    const saved = await this.save(prepared);
    return { dataset: saved, prepared };
  }
}

/**
 * TrainingEngine: the interface a real backend would implement (spec 47).
 * The default backend refuses honestly instead of pretending.
 */
export class TrainingEngine {
  constructor({ store, bus, backend = null }) {
    this.store = store;
    this.bus = bus;
    this.backend = backend; // e.g. an HTTP client for a GPU training service
  }

  available() {
    return {
      available: !!this.backend,
      reason: this.backend ? null : 'No training backend is attached. Fine-tuning needs a GPU service; this process cannot change model weights.',
      requirements: [
        'a training service exposing prepare/train/checkpoint/evaluate',
        'GPU capacity appropriate to the base model',
        'a base model whose licence permits fine-tuning',
        'an evaluation suite to compare the new checkpoint against the old one',
      ],
    };
  }

  async train({ datasetName, baseModel, config = {} }) {
    if (!this.backend) {
      const status = this.available();
      this.bus?.warn('training.unavailable', { datasetName, reason: status.reason });
      return {
        started: false,
        ...status,
        whatHappenedInstead: 'The dataset is prepared and saved. Agent improvement (policy + knowledge) continues to work and is measured on the benchmark - that is not model training and the lab does not report it as such.',
      };
    }
    const run = await this.backend.train({ datasetName, baseModel, config });
    const doc = await this.store.models.put({
      modelVersion: run.version,
      baseModel,
      datasetName,
      config,
      parentVersion: run.parentVersion || null,
      checkpoint: run.checkpoint,
      evaluation: run.evaluation || null,
      createdAt: nowIso(),
    });
    return { started: true, run: doc };
  }

  /** Model versioning record shape (spec 48) - populated only by a real backend. */
  async versions() {
    const all = await this.store.models.all();
    return all.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  }
}

function countKinds(examples) {
  const out = {};
  for (const e of examples) out[e.kind] = (out[e.kind] || 0) + 1;
  return out;
}
function countReasons(rows) {
  const out = {};
  for (const r of rows) out[r.reason] = (out[r.reason] || 0) + 1;
  return out;
}
function normalize(s) { return String(s).toLowerCase().replace(/\s+/g, ' ').trim(); }
