import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Lab } from '../src/lab.js';
import { rulesetNames } from '../src/generation/rules/index.js';
import { designSimilarity } from '../src/design/diversity.js';
import { KnowledgeEngine } from '../src/knowledge/engine.js';
import { normalizePalette, contrastRatio, spaceSize } from '../src/design/traits.js';
import { Benchmark } from '../src/evolution/benchmark.js';

const SAMPLES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'samples', 'MY_PROJECTS');

async function freshLab() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lab-test-'));
  const lab = await Lab.open(dir);
  return { lab, dir };
}

test('import detects each project in a folder of projects', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  const res = await lab.importPath(SAMPLES);
  const names = res.projects.map((p) => p.name).sort();
  assert.deepEqual(names, ['APP_01_notes', 'GAME_01_runner', 'GAME_02_shooter']);

  // originals must be untouched: the lab works on copies inside the workspace
  for (const p of res.projects) {
    assert.ok(p.root.startsWith(dir), 'imported projects must live inside the workspace');
  }
  const originals = await fs.readdir(path.join(SAMPLES, 'GAME_01_runner'));
  assert.deepEqual(originals, ['index.html']);
  assert.equal(lab.config.permissions.modifyImports, false, 'modifying originals must stay permanently off');
});

test('analysis extracts concepts, problems and learned parameters', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await lab.importPath(SAMPLES);
  const res = await lab.learnAll();
  assert.equal(res.analyzed, 3);

  const projects = await lab.store.projects.all();
  const runner = projects.find((p) => p.name === 'GAME_01_runner');
  assert.equal(runner.analysis.kind, '2d-game');
  assert.ok(runner.analysis.concepts.length >= 5);
  assert.ok(runner.analysis.problems.length >= 1, 'the runner has no pause-on-blur, which must be reported');
  assert.ok(runner.analysis.tuningPriors.gravity, 'gravity constant must be learned');
  assert.ok(runner.analysis.summary.length > 40);

  // knowledge is abstract: no source code is stored
  const knowledge = await lab.store.knowledge.all();
  assert.ok(knowledge.length >= 10);
  for (const k of knowledge) {
    const blob = JSON.stringify(k);
    assert.ok(!blob.includes('requestAnimationFrame(loop)'), 'knowledge must not contain source code');
    assert.ok(k.sources.length > 0, `${k.key} must record where it came from`);
    assert.ok(k.confidence > 0 && k.confidence < 1);
  }

  // project memory stays separate from global knowledge
  const memory = await lab.memory.forProject(runner.id);
  assert.ok(memory.knownBugs.length >= 1);
  assert.ok(memory.architecture);
});

test('confidence rises with independent sources and never reaches certainty', () => {
  const item = { sources: [], observations: 0, successfulUses: [], failedUses: [], verifiedBy: [] };
  const scores = [];
  for (let i = 1; i <= 6; i++) {
    item.sources.push({ projectId: `p${i}` });
    item.observations += 3;
    scores.push(KnowledgeEngine.computeConfidence(item));
  }
  for (let i = 1; i < scores.length; i++) assert.ok(scores[i] >= scores[i - 1], 'confidence must be monotonic in evidence');
  assert.ok(scores[scores.length - 1] <= 0.9, 'corpus frequency alone must not exceed 0.9');

  item.successfulUses.push({ ref: 'g1' });
  assert.ok(KnowledgeEngine.computeConfidence(item) > scores[scores.length - 1], 'a successful generation must raise confidence');
});

test('two designs from the same lab differ across many dimensions', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await lab.importPath(SAMPLES);
  await lab.learnAll();

  const a = await lab.design({ seed: 'div-a' });
  const b = await lab.design({ seed: 'div-b' });
  const sim = designSimilarity(a, b);
  assert.ok(sim.score < 0.62, `designs must not be near-duplicates (similarity ${sim.score})`);

  const differing = Object.keys(a.traits).filter((k) => a.traits[k] !== b.traits[k]);
  assert.ok(differing.length >= 6, `expected many differing traits, got ${differing.join(',')}`);
  assert.ok(a.diversity.pass && b.diversity.pass);
  assert.ok(spaceSize() > 1e6);
});

test('palette contrast is enforced before emission', () => {
  const washed = ['#f4f4f2', '#d0d0cc', '#c7c7c2', '#cfcfca', '#dcdcd8'];
  const fixed = normalizePalette(washed);
  assert.ok(contrastRatio(fixed[1], fixed[0]) >= 7, 'text colour must reach 7:1');
  for (const c of fixed.slice(2)) {
    assert.ok(contrastRatio(c, fixed[0]) >= 3.4, `gameplay colour ${c} must reach ~3.5:1`);
  }
});

test('generated game ships: runs headlessly, responds to input, stays stable', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await lab.importPath(SAMPLES);
  await lab.learnAll();

  const r = await lab.createGame({ seed: 'pipeline-1' });
  assert.equal(r.report.verdict, 'ship', `expected a shippable build, failures: ${JSON.stringify(r.report.failures)}`);
  assert.ok(r.report.score >= 0.9);

  const byId = Object.fromEntries(r.report.checks.map((c) => [c.id, c]));
  for (const critical of ['loads', 'boots', 'starts', 'input-response', 'stability']) {
    assert.ok(byId[critical]?.pass, `${critical} must pass: ${byId[critical]?.detail}`);
  }

  // the project is real files on disk, openable with no build step
  const index = await fs.readFile(path.join(r.record.dir, 'index.html'), 'utf8');
  assert.ok(index.includes('<canvas id="stage"'));
  assert.ok(index.includes('src/game/main.js'));
  const manifest = JSON.parse(await fs.readFile(path.join(r.record.dir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.designId, r.design.id);
  assert.ok(manifest.knowledgeUsed.length > 0, 'the build must record which concepts informed it');
  assert.ok(manifest.provenance.note.includes('no source code was copied'));

  // originality: generated code must not echo the imported corpus
  assert.ok(r.record.codeOverlap.maxOverlapWithImports < 0.15,
    `generated code overlaps the corpus too much: ${r.record.codeOverlap.maxOverlapWithImports}`);

  // outcome feeds back into knowledge and lessons
  const lessons = await lab.store.lessons.all();
  assert.ok(lessons.length >= 1);
  const used = await lab.store.knowledge.findOne((k) => k.successfulUses.length > 0);
  assert.ok(used, 'a successful build must be recorded against the knowledge it used');
});

test('every ruleset generates a build that loads and runs without errors', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  const GENRES = {
    arena: 'arena-survival', platformer: 'platformer', puzzle: 'puzzle-logic', racer: 'racing',
    defense: 'tower-defense', runner: 'endless-runner', stealth: 'stealth-infiltration', explorer3d: 'exploration-3d',
  };
  assert.deepEqual(Object.keys(GENRES).sort(), rulesetNames().sort(), 'every ruleset needs coverage here');

  for (const [ruleset, genre] of Object.entries(GENRES)) {
    const design = await lab.design({ seed: `rs-${ruleset}`, brief: { genre } });
    assert.equal(design.ruleset, ruleset);
    const { files, order } = lab.generator.buildFiles(design, { version: 'test', options: {} });
    const report = await lab.tester.run(files, order, design);
    assert.equal(report.sandbox.errors.length, 0, `${ruleset} threw: ${JSON.stringify(report.sandbox.errors[0])}`);
    assert.ok(report.score >= 0.85, `${ruleset} scored ${report.score}: ${JSON.stringify(report.failures)}`);
    assert.equal(report.critical, 0, `${ruleset} has critical failures: ${JSON.stringify(report.failures)}`);
  }
});

test('the frame-spike check catches an unclamped delta', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  const design = await lab.design({ seed: 'clamp-test', brief: { genre: 'arena-survival' } });
  const bad = lab.generator.buildFiles(design, { loopStyle: 'raf-delta', options: { dtClamp: 1.5 } });
  const badReport = await lab.tester.run(bad.files, bad.order, design);
  const badCheck = badReport.checks.find((c) => c.id === 'dt-spike');
  assert.equal(badCheck.pass, false, 'a 1.5s delta clamp must fail the frame-spike check');

  const good = lab.generator.buildFiles(design, { loopStyle: 'raf-delta', options: { dtClamp: 0.05 } });
  const goodReport = await lab.tester.run(good.files, good.order, design);
  assert.equal(goodReport.checks.find((c) => c.id === 'dt-spike').pass, true);
});

test('the auto-debugger repairs a deliberately bad policy', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  const design = await lab.design({ seed: 'debug-test', brief: { genre: 'arena-survival' } });
  const result = await lab.debugger.iterate(design, {
    policy: { version: 'broken', loopStyle: 'raf-delta', options: { dtClamp: 1.5, pooling: false, pauseOnBlur: false, mobileControls: false } },
    maxRounds: 4,
  });
  assert.ok(result.fixes.length >= 1, 'the debugger must apply at least one fix');
  assert.ok(result.report.score > 0.9, `final score ${result.report.score}`);
  for (const fix of result.fixes) {
    assert.ok(fix.why && fix.check && fix.change, 'every fix must record what and why');
  }
});

test('benchmark is deterministic and comparison is conservative', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  const tasks = (await import('../src/evolution/benchmark.js')).BENCHMARK_TASKS.slice(0, 2);
  const policy = (await lab.versions.active()).policy;
  const a = await lab.benchmark.run(policy, { tasks, label: 'a' });
  const b = await lab.benchmark.run(policy, { tasks, label: 'b' });
  assert.equal(a.score, b.score, 'the same policy must score the same twice');

  const cmp = Benchmark.compare(a, b);
  assert.equal(cmp.improved, false);
  assert.equal(cmp.significant, false, 'an identical run must not be called an improvement');
  assert.ok(cmp.statement.includes('points on'));
  assert.ok(a.knowledge, 'the knowledge fingerprint must be recorded for honest comparison');
});

test('version promotion requires measured improvement', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  const tasks = (await import('../src/evolution/benchmark.js')).BENCHMARK_TASKS.slice(0, 2);
  const active = await lab.versions.active();
  active.benchmark = await lab.benchmark.run(active.policy, { tasks, label: 'baseline' });
  await lab.store.versions.put(active);

  // an identical policy cannot be promoted
  const result = await lab.versions.evaluateCandidate({ policy: { ...active.policy }, rationale: 'no change' });
  assert.equal(result.promoted, false);
  assert.match(result.version.decision, /Rolled back/);
  assert.equal((await lab.versions.active()).version, active.version, 'the active version must not change');
});
