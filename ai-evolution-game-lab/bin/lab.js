#!/usr/bin/env node
/**
 * AI Evolution Game Lab - command line.
 *
 * Everything the dashboard can do is available here, so the lab can run on a
 * machine with no browser (and inside CI).
 */
import { Lab } from '../src/lab.js';
import { createServer } from '../src/server.js';
import { BENCHMARK_TASKS } from '../src/evolution/benchmark.js';
import { rulesetNames } from '../src/generation/rules/index.js';
import { spaceSize } from '../src/design/traits.js';

const args = process.argv.slice(2);
const command = args[0] || 'help';
const flags = parseFlags(args.slice(1));

function parseFlags(list) {
  const out = { _: [] };
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) out[k] = coerce(v);
      else if (list[i + 1] && !list[i + 1].startsWith('--')) out[k] = coerce(list[++i]);
      else out[k] = true;
    } else out._.push(a);
  }
  return out;
}
function coerce(v) {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

function attachLog(lab, verbose) {
  lab.bus.on('event', (e) => {
    if (!verbose && e.level === 'info') return;
    const tag = e.level === 'error' ? C.red('x') : e.level === 'warn' ? C.yellow('!') : e.level === 'success' ? C.green('+') : C.dim('.');
    const { seq, at, type, level, ...rest } = e;
    console.log(`${tag} ${C.dim(type)} ${Object.entries(rest).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' ')}`);
  });
}

async function open() {
  const lab = await Lab.open(flags.workspace);
  attachLog(lab, !!flags.verbose);
  return lab;
}

const COMMANDS = {
  async serve() {
    const { url, lab } = await createServer({
      workspace: flags.workspace,
      port: flags.port || 7717,
      host: flags.host || '127.0.0.1',
    });
    attachLog(lab, !!flags.verbose);
    lab.queue.start();
    console.log(`\n  ${C.bold('AI Evolution Game Lab')}`);
    console.log(`  dashboard  ${C.cyan(url)}`);
    console.log(`  workspace  ${lab.config.workspace}`);
    console.log(`  network    ${lab.config.permissions.network ? C.yellow('enabled') : 'disabled (offline-first)'}`);
    console.log(C.dim('\n  Ctrl+C to stop.\n'));
  },

  async import() {
    const lab = await open();
    const target = flags._[0] || flags.path;
    if (!target) return fail('usage: lab import <path-to-folder-or-zip>');
    const res = await lab.importPath(target, { copy: flags.copy !== false });
    console.log(`\nimported ${C.bold(res.projects.length)} project(s), ${res.assets.length} loose asset(s)`);
    for (const p of res.projects) console.log(`  ${p.name}  ${C.dim(`${p.fileCount} files, ${p.id}`)}`);
    if (flags.analyze !== false) {
      const learned = await lab.learnAll();
      console.log(`\nanalysed ${learned.analyzed}; knowledge now ${learned.knowledge.items} item(s) across ${learned.knowledge.categories} categories`);
    }
  },

  async learn() {
    const lab = await open();
    const res = await lab.learnAll({ reanalyze: !!flags.reanalyze });
    console.log(`\nanalysed ${res.analyzed} project(s) (${res.skipped} already done)`);
    console.log(JSON.stringify(res.knowledge, null, 2));
  },

  async status() {
    const lab = await open();
    const s = await lab.status();
    console.log(`\n  ${C.bold('workspace')}  ${s.workspace}`);
    console.log(`  ${C.bold('projects')}   ${s.projects.analyzed}/${s.projects.imported} analysed, ${s.projects.files} files`);
    console.log(`  ${C.bold('knowledge')}  ${s.knowledge.items} items, avg confidence ${s.knowledge.averageConfidence}, ${s.knowledge.sourceProjects} source projects`);
    console.log(`  ${C.bold('generated')}  ${s.generated.total} project(s), ${s.generated.shipped} shipped, avg test ${s.generated.averageTestScore ?? '-'}`);
    console.log(`  ${C.bold('agent')}      ${s.agent?.version ?? '-'} benchmark ${s.agent?.benchmarkScore ?? 'not measured'} (${s.agent?.shippedTasks ?? '-'})`);
    console.log(`  ${C.bold('models')}     llm=${s.models.llm} vision=${s.models.vision} providers=${s.models.providers.join(',')}`);
    console.log(`  ${C.bold('space')}      ${s.traitSpace.toLocaleString()} distinct trait combinations`);
    console.log(C.dim(`\n  ${s.disclaimer}\n`));
  },

  async design() {
    const lab = await open();
    const d = await lab.design({ seed: flags.seed, brief: briefFromFlags() });
    console.log(`\n${C.bold(d.name)}  ${C.dim(`[${d.ruleset}]`)}`);
    console.log(`${d.pitch}\n`);
    console.log('traits:', Object.entries(d.traits).map(([k, v]) => `${k}=${v}`).join(' '));
    console.log('core loop:', d.coreLoop.join(' -> '));
    console.log('novelty:', d.novelty.novelty, '| nearest previous design similarity:', d.diversity.max);
    console.log('modules:', d.architecture.modules.join(', '));
  },

  async generate() {
    const lab = await open();
    const r = await lab.createGame({ seed: flags.seed, brief: briefFromFlags(), maxRounds: flags.rounds || 3 });
    console.log(`\n${C.bold(r.design.name)} ${C.dim(`[${r.design.ruleset}]`)}`);
    console.log(`  ${r.design.pitch}`);
    console.log(`  test score ${r.report.score} (${r.report.verdict}) after ${r.record.rounds} round(s)`);
    for (const f of r.report.failures) console.log(`  ${C.yellow('!')} ${f.id}: ${f.detail}`);
    for (const f of r.fixes) console.log(`  ${C.cyan('fix')} ${f.check}: ${f.why}`);
    console.log(`  files: ${r.record.files.length}, ${r.record.bytesHuman}`);
    console.log(`  open:  ${C.cyan(`${r.record.dir}/index.html`)}`);
  },

  async test() {
    const lab = await open();
    const id = flags._[0];
    const rec = id ? await lab.store.generated.get(id) : (await lab.store.generated.all()).pop();
    if (!rec) return fail('no generated project found; run "lab generate" first');
    const design = await lab.store.designs.get(rec.designId);
    const { files, order } = lab.generator.buildFiles(design, rec.policy || {});
    const report = await lab.tester.run(files, order, design);
    console.log(`\n${rec.name}: score ${report.score} (${report.verdict})`);
    for (const c of report.checks) {
      console.log(`  ${c.pass ? C.green('pass') : C.red('FAIL')} ${c.id.padEnd(20)} ${C.dim(c.detail)}`);
    }
  },

  async benchmark() {
    const lab = await open();
    const active = await lab.versions.active();
    const result = await lab.benchmark.run(active.policy, { label: `${active.version} cli` });
    await lab.store.versions.patch(active.id, { benchmark: result });
    console.log(`\n${C.bold(active.version)} scored ${C.bold(result.score)} (${result.shipped}/${result.tasks.length} shipped)`);
    for (const t of result.tasks) {
      console.log(`  ${t.score === 1 ? C.green('ok  ') : C.yellow('warn')} ${t.taskId.padEnd(18)} ${t.score} ${C.dim(t.failures.join(',') || '')}`);
    }
  },

  async evolve() {
    const lab = await open();
    const res = await lab.evolve({ cycles: flags.cycles || 3, taskCount: flags.tasks || 4 });
    console.log(`\n${C.bold(res.summary)}`);
    for (const o of res.outcomes) {
      if (!o.experiment) { console.log(`  cycle ${o.cycle}: ${o.outcome}`); continue; }
      console.log(`  cycle ${o.cycle}: ${o.hypothesis} (${o.targets}) -> ${o.experiment.conclusion}`);
      console.log(`    ${C.dim(o.experiment.statement)}`);
      console.log(`    ${o.promoted ? C.green(o.decision) : C.dim(o.decision)}`);
    }
  },

  async versions() {
    const lab = await open();
    const hist = await lab.versions.history();
    for (const v of hist) {
      const mark = v.status === 'active' ? C.green('*') : ' ';
      console.log(`${mark} ${v.version.padEnd(5)} ${String(v.benchmark?.score ?? '-').padEnd(8)} ${v.status.padEnd(11)} ${C.dim((v.decision || v.rationale || '').slice(0, 90))}`);
    }
  },

  async rollback() {
    const lab = await open();
    const to = flags._[0] || flags.to;
    if (!to) return fail('usage: lab rollback <version>');
    const v = await lab.versions.rollbackTo(to);
    console.log(v ? `rolled back to ${v.version}` : `version ${to} not found`);
  },

  async research() {
    const lab = await open();
    const question = flags._.join(' ') || flags.q;
    if (!question) return fail('usage: lab research "how does requestAnimationFrame deliver timestamps"');
    const r = await lab.research.investigate(question);
    console.log(`\n${r.answer}\n`);
    console.log(`corroborating sources: ${r.corroboration} (confidence ${r.confidence})${r.note ? ` - ${r.note}` : ''}`);
    for (const s of r.sources) console.log(`  ${s.fromCache ? C.dim('[cache]') : '[live] '} ${s.url}`);
  },

  async dataset() {
    const lab = await open();
    const { dataset, prepared } = await lab.training.buildAndSave({ name: flags.name });
    console.log(`\ndataset ${C.bold(dataset.name)}: ${JSON.stringify(dataset.split)} ${JSON.stringify(prepared.stats)}`);
    console.log(C.dim(`\n${lab.trainingEngine.available().reason || 'a training backend is attached'}`));
  },

  async export() {
    const lab = await open();
    const what = flags._[0] || flags.what || 'knowledge';
    const map = {
      project: () => lab.exporter.exportGeneratedProject(flags.id || flags._[1]),
      knowledge: () => lab.exporter.exportKnowledge(),
      memory: () => lab.exporter.exportProjectMemory(flags.id || flags._[1]),
      evaluation: () => lab.exporter.exportEvaluation(),
      datasets: () => lab.exporter.exportDatasetMetadata(),
      logs: () => lab.exporter.exportLogs(lab.bus),
    };
    if (!map[what]) return fail(`unknown export target "${what}" (project|knowledge|memory|evaluation|datasets|logs)`);
    const r = await map[what]();
    console.log(`\nwrote ${C.cyan(r.file)} (${r.entries} entries)`);
  },

  async backup() {
    const lab = await open();
    const m = await lab.backups.create({ note: flags.note || '', full: !!flags.full, tag: flags.tag });
    console.log(`\ncreated ${C.bold(m.id)}  ${m.files} files, ${m.bytesHuman}`);
    console.log(`  parts:    ${m.parts.join(', ')}`);
    console.log(`  excluded: ${C.dim(m.excluded.join(', '))}`);
    console.log(`  path:     ${C.cyan(m.dir)}`);
  },

  async backups() {
    const lab = await open();
    const all = await lab.backups.list();
    if (!all.length) return console.log('\nno backups yet - run "lab backup"');
    for (const b of all) {
      const mark = b.incomplete ? C.red('!') : C.green('*');
      console.log(`${mark} ${String(b.id).padEnd(26)} ${String(b.bytesHuman || '-').padEnd(9)} ${C.dim(b.createdAt || '')} ${b.note || ''}`);
    }
  },

  async restore() {
    const lab = await open();
    const id = flags._[0] || flags.id;
    if (!id) return fail('usage: lab restore <backup-id|index>  (a safety copy is taken first)');
    const r = await lab.backups.restore(id, { safetyBackup: flags.safety !== false });
    console.log(`\nrestored ${C.bold(r.restored)}  parts: ${r.parts.join(', ')}`);
    console.log(`  safety copy of the previous state: ${C.cyan(r.safetyBackup || 'skipped')}`);
    console.log(`  counts now: ${JSON.stringify(r.counts)}`);
  },

  async ai() {
    const lab = await open();
    const s = lab.ai.status();
    console.log(`\n  ${C.bold('AI Core')} v${s.version}  phase ${s.phase}`);
    console.log(`  initialized: ${s.initialized}  ·  runs: ${s.initCount}  ·  local-only: ${s.local}  ·  external model used: ${s.externalModelUsed}`);
    console.log(`  modules:     ${s.moduleCount ? s.modules.map((m) => m.name).join(', ') : C.dim('none yet')}`);
    console.log(`  capabilities:`);
    for (const [k, v] of Object.entries(s.capabilities)) console.log(`    ${v ? C.green('on ') : C.dim('off')} ${k}`);
    console.log(C.dim(`\n  ${s.honest}\n`));
  },

  async knowledge() {
    const lab = await open();
    const byCat = await lab.knowledge.byCategory();
    for (const [cat, items] of Object.entries(byCat)) {
      if (!items.length) continue;
      console.log(`\n${C.bold(cat)}`);
      for (const k of items) {
        console.log(`  ${String(k.confidence).padEnd(6)} ${k.concept}`);
        console.log(`         ${C.dim(`${k.sources.length} source project(s): ${k.sources.map((s) => s.projectName).slice(0, 3).join(', ')}`)}`);
      }
    }
  },

  async queue() {
    const lab = await open();
    const tasks = await lab.queue.list();
    for (const t of tasks) console.log(`  ${t.state.padEnd(10)} ${t.type.padEnd(10)} ${t.label} ${C.dim(t.error || '')}`);
    if (flags.drain) { await lab.queue.drain(); console.log('queue drained'); }
  },

  help() {
    console.log(`
  ${C.bold('AI Evolution Game Lab')}

  ${C.bold('lab serve')} [--port 7717] [--host 127.0.0.1]   start the dashboard + API
  ${C.bold('lab import')} <path> [--no-analyze]             import a folder of projects or a .zip
  ${C.bold('lab learn')} [--reanalyze]                      analyse everything imported
  ${C.bold('lab knowledge')}                                print the knowledge base
  ${C.bold('lab design')} [--genre X] [--twist Y]           produce a design document only
  ${C.bold('lab generate')} [--genre X] [--rounds 3]        design, build, run, test, fix, save
  ${C.bold('lab test')} [generatedId]                       re-run the test agent on a build
  ${C.bold('lab benchmark')}                                measure the active agent version
  ${C.bold('lab evolve')} [--cycles 3] [--tasks 4]          autonomous improvement cycles
  ${C.bold('lab versions')} / ${C.bold('lab rollback')} <v>          version history and rollback
  ${C.bold('lab research')} "<question>"                    consult official documentation
  ${C.bold('lab dataset')} [--name X]                       build a training dataset
  ${C.bold('lab export')} <target> [--id X]                 project|knowledge|memory|evaluation|datasets|logs
  ${C.bold('lab ai')}                                       AI Core status (local, no external model)
  ${C.bold('lab backup')} [--note x] [--full] [--tag t]      create a versioned backup
  ${C.bold('lab backups')}                                  list backups
  ${C.bold('lab restore')} <id|index>                        restore (takes a safety copy first)
  ${C.bold('lab status')}                                   overall state

  common flags: --workspace <dir> --seed <string> --verbose

  rulesets: ${rulesetNames().join(', ')}
  benchmark tasks: ${BENCHMARK_TASKS.length}
  trait space: ${spaceSize().toLocaleString()} combinations
`);
  },
};

function briefFromFlags() {
  const brief = {};
  for (const key of ['genre', 'twist', 'camera', 'controls', 'world', 'objective', 'progression', 'physics', 'enemies', 'rewards', 'visualStyle', 'ui', 'audio']) {
    if (flags[key]) brief[key] = flags[key];
  }
  return brief;
}

function fail(msg) {
  console.error(`\n${C.red('error')} ${msg}\n`);
  process.exitCode = 1;
}

const fn = COMMANDS[command] || COMMANDS.help;
try {
  await fn();
  if (command !== 'serve') process.exit(process.exitCode || 0);
} catch (err) {
  console.error(`\n${C.red('failed')} ${err.message}`);
  if (flags.verbose) console.error(err.stack);
  process.exit(1);
}
