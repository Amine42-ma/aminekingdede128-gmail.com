/**
 * The Lab: one object that owns every subsystem and exposes the pipeline the
 * whole project is about (spec 1, 60):
 *
 *   IMPORT -> ANALYZE -> UNDERSTAND -> EXTRACT -> STORE -> RESEARCH -> PLAN ->
 *   GENERATE -> BUILD -> RUN -> TEST -> EVALUATE -> IMPROVE -> LEARN -> NEXT
 *
 * The HTTP server, the CLI and the tests all drive this same object.
 */
import { Config } from './core/config.js';
import { Store } from './core/store.js';
import { Bus } from './core/events.js';
import { BackupManager } from './core/backup.js';
import { AICore } from './ai_core/index.js';
import { Importer } from './importer/importer.js';
import { analyzeProject } from './analysis/analyzer.js';
import { KnowledgeEngine } from './knowledge/engine.js';
import { KnowledgeGraph } from './knowledge/graph.js';
import { ProjectMemory } from './knowledge/memory.js';
import { DiversityEngine } from './design/diversity.js';
import { NoveltyEngine } from './design/novelty.js';
import { Designer } from './design/designer.js';
import { Generator } from './generation/generator.js';
import { TestAgent, qualityScore } from './testing/testagent.js';
import { AutoDebugger } from './testing/debugger.js';
import { Benchmark } from './evolution/benchmark.js';
import { VersionManager } from './evolution/versions.js';
import { LessonBook } from './evolution/lessons.js';
import { Autopilot } from './evolution/autopilot.js';
import { ExperimentEngine } from './evolution/experiments.js';
import { ModelRegistry } from './models/provider.js';
import { ResearchEngine } from './research/research.js';
import { TrainingPipeline, TrainingEngine, LEARNING_KINDS } from './training/pipeline.js';
import { TaskQueue } from './queue/queue.js';
import { Exporter } from './export/exporter.js';
import { spaceSize } from './design/traits.js';
import { round, nowIso } from './core/util.js';

export class Lab {
  constructor({ config, store, bus }) {
    this.config = config;
    this.store = store;
    this.bus = bus;

    this.importer = new Importer({ config, store, bus });
    this.knowledge = new KnowledgeEngine({ store, bus });
    this.graph = new KnowledgeGraph({ store });
    this.memory = new ProjectMemory({ store, bus });
    this.diversity = new DiversityEngine({ store, bus });
    this.novelty = new NoveltyEngine({ store, diversity: this.diversity, bus });
    this.designer = new Designer({ store, bus, knowledge: this.knowledge, diversity: this.diversity, graph: this.graph });
    this.generator = new Generator({ config, store, bus, diversity: this.diversity, knowledge: this.knowledge });
    this.tester = new TestAgent({ bus });
    this.debugger = new AutoDebugger({ generator: this.generator, bus, knowledge: this.knowledge, memory: this.memory });
    this.benchmark = new Benchmark({ designer: this.designer, generator: this.generator, bus, store });
    this.versions = new VersionManager({ store, bus, benchmark: this.benchmark });
    this.lessons = new LessonBook({ store, bus });
    this.experiments = new ExperimentEngine({ store, bus, benchmark: this.benchmark });
    this.autopilot = new Autopilot({ store, bus, versions: this.versions, benchmark: this.benchmark, lessons: this.lessons });
    this.models = new ModelRegistry({ config, bus });
    this.research = new ResearchEngine({ config, store, bus });
    this.training = new TrainingPipeline({ config, store, bus });
    this.trainingEngine = new TrainingEngine({ store, bus, backend: null });
    this.exporter = new Exporter({ config, store, bus });
    this.queue = new TaskQueue({ store, bus });
    // Phase 1: this project's own AI Core (local, offline, no external model)
    // and real versioned backups. Both are injected exactly like every other
    // subsystem, so nothing above them had to change.
    this.ai = new AICore({ config, store, bus });
    this.backups = new BackupManager({ config, store, bus });

    this.#registerTasks();
  }

  static async open(workspace) {
    const config = await Config.load(workspace);
    const store = new Store(config.workspace);
    const bus = new Bus();
    const lab = new Lab({ config, store, bus });
    await lab.graph.load();
    await lab.versions.seed();
    await lab.ai.init();
    return lab;
  }

  // --------------------------------------------------------------- pipeline

  /** IMPORT */
  async importPath(sourcePath, opts = {}) {
    return this.importer.importPath(sourcePath, opts);
  }

  /** ANALYZE + EXTRACT + STORE for one project */
  async analyze(projectId) {
    const project = await this.store.projects.get(projectId);
    if (!project) throw new Error(`project ${projectId} not found`);
    const analysis = await analyzeProject(project, { limits: this.config.limits });
    await this.store.projects.patch(projectId, { analysis, status: 'analyzed', analyzedAt: nowIso() });
    await this.knowledge.ingestProject(analysis);
    await this.graph.addProject(analysis);
    await this.memory.record(projectId, analysis);
    this.bus.success('analyze.done', { project: project.name, concepts: analysis.concepts.length, problems: analysis.problems.length });
    return analysis;
  }

  /** Analyze everything not yet analyzed (START LEARNING). */
  async learnAll({ reanalyze = false } = {}) {
    const projects = await this.store.projects.all();
    const targets = reanalyze ? projects : projects.filter((p) => !p.analysis);
    const done = [];
    for (const p of targets) {
      try { done.push(await this.analyze(p.id)); } catch (err) {
        this.bus.error('analyze.failed', { project: p.name, error: err.message });
      }
    }
    const stats = await this.knowledge.stats();
    return { analyzed: done.length, skipped: projects.length - targets.length, knowledge: stats };
  }

  /** PLAN */
  async design(opts = {}) {
    const design = await this.designer.design(opts);
    await this.store.designs.put(design);
    return design;
  }

  /**
   * GENERATE -> BUILD -> RUN -> TEST -> (fix) -> EVALUATE -> LEARN.
   * This is the single call behind "make me a new game".
   */
  async createGame({ seed = null, brief = {}, maxRounds = 3, write = true } = {}) {
    const policy = (await this.versions.active()).policy;
    const design = await this.design({ seed, brief });

    const outcome = await this.debugger.iterate(design, { policy, maxRounds });
    const finalDesign = outcome.design || design;
    const finalPolicy = outcome.policy || policy;

    const { record, files } = await this.generator.generate(finalDesign, { policy: finalPolicy, write });
    const quality = qualityScore({ test: outcome.report, design: finalDesign, record });

    const saved = await this.store.generated.put({
      ...record,
      test: {
        score: outcome.report.score,
        verdict: outcome.report.verdict,
        passed: outcome.report.passed,
        failed: outcome.report.failed,
        failures: outcome.report.failures,
        checks: outcome.report.checks.map((c) => ({ id: c.id, pass: c.pass, severity: c.severity, detail: c.detail, metrics: c.metrics })),
      },
      quality,
      fixes: outcome.fixes,
      rounds: outcome.rounds,
      status: outcome.report.verdict,
    });

    // Feed the outcome back into the knowledge base and the lesson book.
    for (const key of record.knowledgeUsed || []) {
      await this.knowledge.recordUse(key, {
        success: outcome.report.verdict === 'ship',
        ref: saved.id,
        note: `${finalDesign.ruleset} build scored ${outcome.report.score}`,
        score: outcome.report.score,
      });
    }
    await this.lessons.fromCycle({ design: finalDesign, report: outcome.report, fixes: outcome.fixes, record: saved });

    this.bus.success('game.created', {
      name: finalDesign.name, ruleset: finalDesign.ruleset, score: outcome.report.score,
      verdict: outcome.report.verdict, rounds: outcome.rounds, dir: saved.dir,
    });
    return { design: finalDesign, record: saved, report: outcome.report, files, quality, fixes: outcome.fixes };
  }

  /** IMPROVE (autonomous). */
  async evolve({ cycles = 3, taskCount = 4 } = {}) {
    return this.autopilot.run({ maxCycles: cycles, taskCount });
  }

  // ------------------------------------------------------------- reporting

  async status() {
    const [projects, designs, generated, knowledge, lessons, experiments, versionList] = await Promise.all([
      this.store.projects.all(),
      this.store.designs.count(),
      this.store.generated.all(),
      this.knowledge.stats(),
      this.lessons.stats(),
      this.experiments.stats(),
      this.versions.history(),
    ]);
    const active = versionList.find((v) => v.status === 'active') || versionList[versionList.length - 1] || null;
    const tested = generated.filter((g) => g.test);
    const analysed = projects.filter((p) => p.analysis);

    return {
      workspace: this.config.workspace,
      permissions: this.config.permissions,
      projects: {
        imported: projects.length,
        analyzed: analysed.length,
        files: projects.reduce((s, p) => s + (p.fileCount || 0), 0),
        bytes: projects.reduce((s, p) => s + (p.bytes || 0), 0),
      },
      knowledge,
      designs,
      generated: {
        total: generated.length,
        shipped: generated.filter((g) => g.status === 'ship').length,
        averageTestScore: tested.length ? round(tested.reduce((s, g) => s + g.test.score, 0) / tested.length, 3) : null,
        averageQuality: tested.length ? round(tested.reduce((s, g) => s + (g.quality?.overall || 0), 0) / tested.length, 3) : null,
      },
      lessons,
      experiments,
      agent: active ? {
        version: active.version,
        benchmarkScore: active.benchmark?.score ?? null,
        shippedTasks: active.benchmark ? `${active.benchmark.shipped}/${active.benchmark.tasks.length}` : null,
        promotedFrom: active.parentVersion,
        decision: active.decision || null,
      } : null,
      models: this.models.capabilities(),
      ai: this.ai.status(),
      backups: await this.backups.stats(),
      learning: LEARNING_KINDS,
      traitSpace: spaceSize(),
      queue: this.queue.status(),
      autopilot: this.autopilot.status(),
      // Required disclaimer (spec 40, 50): these are counts, not intelligence.
      disclaimer: 'These are counts and measured pass-rates. They describe how much the lab has analysed and how its generated projects score on a fixed benchmark - not how "smart" any model is. No model weights are trained by this system.',
      at: nowIso(),
    };
  }

  async offlineReport() { return this.research.offlineCapabilities(); }

  // ---------------------------------------------------------------- queue

  #registerTasks() {
    this.queue
      .handle('import', async (payload) => {
        const res = await this.importPath(payload.path, payload.options || {});
        return { projects: res.projects.map((p) => ({ id: p.id, name: p.name, files: p.fileCount })), assets: res.assets.length };
      })
      .handle('analyze', async (payload) => {
        if (payload.projectId) {
          const a = await this.analyze(payload.projectId);
          return { project: a.name, concepts: a.concepts.length };
        }
        return this.learnAll(payload);
      })
      .handle('design', async (payload) => {
        const d = await this.design(payload);
        return { id: d.id, name: d.name, ruleset: d.ruleset, novelty: d.novelty.novelty };
      })
      .handle('generate', async (payload) => {
        const r = await this.createGame(payload);
        return { id: r.record.id, name: r.design.name, score: r.report.score, verdict: r.report.verdict, dir: r.record.dir };
      })
      .handle('benchmark', async () => {
        const active = await this.versions.active();
        const result = await this.benchmark.run(active.policy, { label: `${active.version} manual` });
        await this.store.versions.patch(active.id, { benchmark: result });
        return { version: active.version, score: result.score, shipped: result.shipped };
      })
      .handle('evolve', async (payload) => this.evolve(payload))
      .handle('research', async (payload) => {
        const r = await this.research.investigate(payload.question);
        return { question: r.question, corroboration: r.corroboration, confidence: r.confidence };
      })
      .handle('dataset', async (payload) => {
        const { dataset } = await this.training.buildAndSave(payload || {});
        return { name: dataset.name, split: dataset.split, stats: dataset.stats };
      })
      .handle('backup', async (payload) => {
        const m = await this.backups.create(payload || {});
        return { id: m.id, files: m.files, bytes: m.bytesHuman, parts: m.parts };
      })
      .handle('restore', async (payload) => this.backups.restore(payload.id, payload))
      .handle('export', async (payload) => {
        switch (payload.what) {
          case 'project': return this.exporter.exportGeneratedProject(payload.id);
          case 'knowledge': return this.exporter.exportKnowledge();
          case 'memory': return this.exporter.exportProjectMemory(payload.id);
          case 'evaluation': return this.exporter.exportEvaluation();
          case 'datasets': return this.exporter.exportDatasetMetadata();
          case 'logs': return this.exporter.exportLogs(this.bus);
          default: throw new Error(`unknown export target "${payload.what}"`);
        }
      });
  }
}
