import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Lab } from '../src/lab.js';
import { Sandbox } from '../src/runtime/sandbox.js';
import { readZip } from '../src/importer/zip.js';
import { LEARNING_KINDS } from '../src/training/pipeline.js';
import { HeuristicProvider, ModelRegistry } from '../src/models/provider.js';
import { Config } from '../src/core/config.js';

async function freshLab() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lab-sub-'));
  return { lab: await Lab.open(dir), dir };
}

test('sandbox denies host access to executed code', () => {
  const sandbox = new Sandbox();
  const h = sandbox.load([{
    name: 'probe.js',
    code: `
      window.__probe = {
        hasRequire: typeof require !== 'undefined',
        hasProcess: typeof process !== 'undefined',
        hasFetch: typeof fetch !== 'undefined',
        hasModule: typeof module !== 'undefined',
      };
    `,
  }]);
  assert.deepEqual(h.errors, []);
  const probe = h.dom.win.__probe;
  assert.equal(probe.hasRequire, false, 'generated code must not reach require()');
  assert.equal(probe.hasProcess, false, 'generated code must not reach process');
  assert.equal(probe.hasModule, false);
  assert.equal(probe.hasFetch, false, 'the sandbox has no network');
});

test('sandbox reports runtime errors with file and line', () => {
  const sandbox = new Sandbox();
  const h = sandbox.load([{ name: 'boom.js', code: 'window.requestAnimationFrame(function(){ null.x = 1; });' }]);
  h.step(1);
  assert.equal(h.errors.length, 1);
  assert.match(h.errors[0].message, /null/);
  assert.equal(h.errors[0].phase, 'frame');
});

test('sandbox clock is virtual and deterministic', () => {
  const sandbox = new Sandbox();
  const h = sandbox.load([{
    name: 'clock.js',
    code: `
      window.__t = [];
      (function tick(now){ window.__t.push(now); window.requestAnimationFrame(tick); })(window.performance.now());
    `,
  }]);
  h.step(3, 16);
  const t = h.dom.win.__t;
  assert.equal(t.length, 4);
  assert.equal(t[3] - t[0], 48, 'three 16ms frames must advance exactly 48ms');
});

test('heuristic provider is honest about not being an LLM', async () => {
  const p = new HeuristicProvider();
  assert.equal(p.capabilities.llm, false);
  assert.equal(p.capabilities.offline, true);
  const out = await p.complete({ task: 'project-summary', data: { name: 'x', kind: '2d-game', files: 3, concepts: 5 } });
  assert.equal(out.usedLlm, false);
  assert.match(out.note, /no language model/);

  const v1 = await p.embed({ text: 'game loop delta time' });
  const v2 = await p.embed({ text: 'game loop delta time' });
  assert.deepEqual(v1, v2, 'embeddings must be deterministic');
  assert.equal(v1.length, 128);
});

test('model registry reports capabilities without overclaiming', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lab-models-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const config = await Config.load(dir);
  const registry = new ModelRegistry({ config, bus: null });
  const caps = registry.capabilities();
  assert.equal(caps.llm, false);
  assert.equal(caps.vision, false);
  assert.match(caps.note, /will not claim to understand/);
  assert.deepEqual(caps.providers, ['heuristic']);
});

test('research refuses hosts outside the official-docs allowlist', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  assert.equal(lab.research.allowed('https://developer.mozilla.org/en-US/docs/Web/API'), true);
  assert.equal(lab.research.allowed('https://example.com/blog'), false);
  assert.equal(lab.research.allowed('http://developer.mozilla.org/x'), false, 'plain http must be rejected');

  // network is off by default, so a fetch must degrade instead of failing
  const doc = await lab.research.fetchDoc('https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame');
  assert.equal(doc.ok, false);
  assert.match(doc.reason, /network access is disabled/);

  const result = await lab.research.investigate('how does requestAnimationFrame deliver the timestamp');
  assert.ok(result.sources.length === 0 || result.sources.every((s) => s.fromCache));
  assert.ok(result.confidence <= 0.5, 'no corroboration means low confidence');
});

test('offline report lists what still works with no network', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const off = await lab.offlineReport();
  assert.ok(off.available.some((x) => x.includes('generate')));
  assert.ok(off.unavailable.some((x) => x.includes('documentation')));
});

test('training pipeline runs every implemented stage and stops at weights', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  await lab.store.lessons.put({ task: 'do a thing that is long enough to survive cleaning', decision: 'chose the documented approach for this case', result: 'it worked as expected in the test', lesson: 'prefer the documented approach when one exists', tags: [] });
  await lab.store.lessons.put({ task: 'do a thing that is long enough to survive cleaning', decision: 'chose the documented approach for this case', result: 'it worked as expected in the test', lesson: 'prefer the documented approach when one exists', tags: [] });

  const built = await lab.training.build({ name: 'test-dataset' });
  assert.ok(built.examples.length >= 2);
  const cleaned = lab.training.clean(built);
  const deduped = lab.training.dedupe(cleaned);
  assert.ok(deduped.duplicates >= 1, 'identical examples must be deduplicated');
  const prepared = lab.training.prepare(deduped);
  assert.ok(prepared.split.train >= 1);
  assert.match(prepared.stats.estimateNote, /estimate/);

  const saved = await lab.training.save(prepared);
  const jsonl = await fs.readFile(path.join(lab.config.dirs.datasets, `${saved.name}.train.jsonl`), 'utf8');
  assert.ok(jsonl.split('\n')[0].startsWith('{'));
  assert.match(saved.note, /No model weights/);

  // the honesty boundary
  const status = lab.trainingEngine.available();
  assert.equal(status.available, false);
  assert.match(status.reason, /cannot change model weights/);
  const attempt = await lab.trainingEngine.train({ datasetName: saved.name, baseModel: 'whatever' });
  assert.equal(attempt.started, false);
  assert.match(attempt.whatHappenedInstead, /not model training/);

  assert.equal(LEARNING_KINDS.knowledge.implemented, true);
  assert.equal(LEARNING_KINDS.fineTuning.implemented, false);
  assert.equal(LEARNING_KINDS.fineTuning.changesWeights, true);
});

test('exports are real zips and never carry configuration or credentials', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await lab.importPath(path.join(process.cwd(), 'samples', 'MY_PROJECTS'));
  await lab.learnAll();

  const out = await lab.exporter.exportKnowledge();
  const entries = readZip(await fs.readFile(out.file));
  const names = entries.map((e) => e.name);
  assert.ok(names.includes('knowledge.json'));
  assert.ok(names.includes('EXPORT_MANIFEST.json'));
  assert.ok(!names.some((n) => /config|apikey|credential/i.test(n)), 'exports must never include configuration');

  const manifest = JSON.parse(entries.find((e) => e.name === 'EXPORT_MANIFEST.json').data().toString('utf8'));
  assert.equal(manifest.kind, 'knowledge-base');
  assert.match(manifest.excludes, /source code/);

  const knowledge = JSON.parse(entries.find((e) => e.name === 'knowledge.json').data().toString('utf8'));
  assert.ok(Array.isArray(knowledge) && knowledge.length > 0);
});

test('task queue runs, records results and survives a restart', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  lab.queue.handle('echo', async (payload) => ({ echoed: payload.value }));
  lab.queue.handle('explode', async () => { throw new Error('intentional failure'); });
  await lab.queue.add('echo', { value: 42 });
  await lab.queue.add('explode', {});
  await lab.queue.drain();

  const tasks = await lab.queue.list();
  const ok = tasks.find((x) => x.type === 'echo');
  const bad = tasks.find((x) => x.type === 'explode');
  assert.equal(ok.state, 'done');
  assert.deepEqual(ok.result, { echoed: 42 });
  assert.equal(bad.state, 'failed');
  assert.match(bad.error, /intentional failure/);

  // tasks live in the store, so a new Lab on the same workspace still sees them
  const reopened = await Lab.open(dir);
  const persisted = await reopened.queue.list();
  assert.equal(persisted.length, 2);
});

test('status reports counts with the anti-hype disclaimer attached', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const s = await lab.status();
  assert.match(s.disclaimer, /not how "smart"/);
  assert.match(s.disclaimer, /No model weights are trained/);
  assert.equal(s.models.llm, false);
  assert.ok(s.traitSpace > 0);
});
