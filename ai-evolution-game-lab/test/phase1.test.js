/**
 * Phase 1 tests: AI Core foundation, versioned Backup, Restore, persistence.
 *
 * These test the foundation only. There is nothing intelligent to test yet and
 * the tests assert exactly that: every capability must report false.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Lab } from '../src/lab.js';
import { AICore, AIModule, CAPABILITIES } from '../src/ai_core/index.js';
import { NEVER_BACKUP } from '../src/core/backup.js';

async function freshLab() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lab-p1-'));
  return { lab: await Lab.open(dir), dir };
}

// ------------------------------------------------------------- AI Core

test('AI Core initializes and is reachable from the lab', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  assert.ok(lab.ai instanceof AICore, 'lab.ai must be the AI Core');
  const s = lab.ai.status();
  assert.equal(s.initialized, true, 'Lab.open() must initialise the core');
  assert.equal(s.phase, 1);
  assert.equal(s.local, true);
  assert.equal(s.externalModelUsed, false, 'the core must never route through an external model');
  assert.ok(s.version);
});

test('AI Core claims no capability in Phase 1', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  const s = lab.ai.status();
  for (const [name, on] of Object.entries(s.capabilities)) {
    assert.equal(on, false, `capability "${name}" must be false until the phase that implements it`);
  }
  assert.deepEqual(s.activeCapabilities, []);
  assert.match(s.honest, /not intelligent yet/);
  assert.deepEqual(Object.keys(s.capabilities).sort(), Object.keys(CAPABILITIES).sort());
});

test('AI Core module registry accepts modules and refuses missing ones', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  class Probe extends AIModule {
    constructor() { super({ name: 'probe', phase: 1 }); this.initCalls = 0; }
    async init() { this.initCalls++; this.ready = true; }
    status() { return { ...super.status(), initCalls: this.initCalls }; }
  }

  const probe = lab.ai.register(new Probe());
  assert.ok(lab.ai.has('probe'));
  assert.throws(() => lab.ai.register(new Probe()), /already registered/);
  assert.throws(() => lab.ai.register({ name: 'fake' }), /must extend AIModule/);
  assert.throws(() => lab.ai.require('nope'), /NOT IMPLEMENTED/);
  assert.throws(() => lab.ai.require('probe'), /not initialised/, 'a registered-but-uninitialised module must fail loudly');

  // re-init runs the new module
  lab.ai.initialized = false;
  await lab.ai.init();
  assert.equal(probe.initCalls, 1);
  assert.equal(lab.ai.require('probe').name, 'probe');
  assert.ok(lab.ai.status().modules.some((m) => m.name === 'probe' && m.ready));
});

test('AI Core state persists across a restart', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lab-p1-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  const first = await Lab.open(dir);
  const createdAt = first.ai.status().createdAt;
  assert.equal(first.ai.status().initCount, 1);
  await first.ai.setModuleState('probe', { vocabularySize: 7 });

  // a brand new process-equivalent: a second Lab over the same workspace
  const second = await Lab.open(dir);
  const s = second.ai.status();
  assert.equal(s.initCount, 2, 'init count must survive a restart');
  assert.equal(s.createdAt, createdAt, 'the core keeps its original creation time');
  assert.deepEqual(second.ai.moduleState('probe').vocabularySize, 7, 'module state must survive a restart');
});

// -------------------------------------------------------------- Backup

test('backup creates a real, numbered, self-describing copy', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  await lab.store.projects.put({ name: 'alpha', marker: 1 });
  await lab.store.knowledge.put({ key: 'concept.x', confidence: 0.4, sources: [] });

  const m = await lab.backups.create({ note: 'first' });
  assert.equal(m.id, 'backup-001');
  assert.equal(m.index, 1);
  assert.ok(m.createdAt && m.bytes > 0 && m.files > 0);
  assert.equal(m.note, 'first');
  assert.deepEqual(m.parts, ['db', 'config']);
  assert.equal(m.state.projects, 1, 'the manifest records what the workspace held');

  // the files are genuinely on disk, not a promise of files
  const manifest = JSON.parse(await fs.readFile(path.join(m.dir, 'backup.json'), 'utf8'));
  assert.equal(manifest.id, 'backup-001');
  const copied = await fs.readdir(path.join(m.dir, 'db', 'projects'));
  assert.equal(copied.length, 1);
  const doc = JSON.parse(await fs.readFile(path.join(m.dir, 'db', 'projects', copied[0]), 'utf8'));
  assert.equal(doc.marker, 1);

  // numbering increments
  const second = await lab.backups.create({ note: 'second' });
  assert.equal(second.id, 'backup-002');
  assert.equal((await lab.backups.list()).length, 2);
});

test('backup never copies imports, cache, exports or itself', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  for (const part of NEVER_BACKUP) {
    await fs.mkdir(path.join(dir, part), { recursive: true });
    await fs.writeFile(path.join(dir, part, 'marker.txt'), 'should not be copied');
  }
  const m = await lab.backups.create({ full: true });
  const inside = await fs.readdir(m.dir);
  for (const part of NEVER_BACKUP) {
    assert.ok(!inside.includes(part), `"${part}" must never appear inside a backup`);
  }
  assert.deepEqual(m.excluded, NEVER_BACKUP);
});

test('creating a backup does not modify the original workspace', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  await lab.store.projects.put({ name: 'untouched', marker: 42 });
  const before = await fingerprint(path.join(dir, 'db'));
  await lab.backups.create({ note: 'no side effects' });
  const after = await fingerprint(path.join(dir, 'db'));
  assert.deepEqual(after, before, 'the database must be byte-identical after a backup');
});

// ------------------------------------------------------------- Restore

test('restore brings the data back and takes a safety copy first', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  await lab.store.projects.put({ name: 'original', marker: 'A' });
  const backup = await lab.backups.create({ note: 'good state' });

  // damage the workspace: replace the data with something else
  await lab.store.projects.clear();
  await lab.store.projects.put({ name: 'damaged', marker: 'B' });
  assert.equal((await lab.store.projects.all())[0].name, 'damaged');

  const result = await lab.backups.restore(backup.id);
  assert.equal(result.restored, backup.id);
  assert.ok(result.safetyBackup, 'a restore must take a safety copy of the current state');

  // the running process must see the restored data, not its stale cache
  const projects = await lab.store.projects.all();
  assert.equal(projects.length, 1);
  assert.equal(projects[0].name, 'original');
  assert.equal(projects[0].marker, 'A');

  // and the pre-restore state is itself recoverable
  const safety = await lab.backups.get(result.safetyBackup);
  assert.ok(safety, 'the safety copy must be listed as a restore point');
  await lab.backups.restore(safety.id, { safetyBackup: false });
  assert.equal((await lab.store.projects.all())[0].name, 'damaged', 'the safety copy must restore the damaged state back');
});

test('restore refuses unknown and incomplete backups', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  await assert.rejects(() => lab.backups.restore('backup-999'), /not found/);

  // a directory without a manifest is an unfinished copy, never a restore point
  await fs.mkdir(path.join(dir, 'backups', 'backup-007'), { recursive: true });
  const listed = await lab.backups.list();
  assert.ok(listed.find((b) => b.id === 'backup-007')?.incomplete);
  await assert.rejects(() => lab.backups.restore('backup-007'), /incomplete/);
});

test('backups and AI Core state survive a full restart together', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lab-p1-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  const first = await Lab.open(dir);
  await first.store.projects.put({ name: 'persisted', marker: 'P' });
  const created = await first.backups.create({ note: 'before restart' });
  await first.ai.setModuleState('probe', { seen: 3 });

  const second = await Lab.open(dir);
  const list = await second.backups.list();
  assert.equal(list.length, 1, 'backup metadata must be readable after a restart');
  assert.equal(list[0].id, created.id);
  assert.equal(list[0].note, 'before restart');
  assert.equal(second.ai.moduleState('probe').seen, 3);

  const stats = await second.backups.stats();
  assert.equal(stats.count, 1);
  assert.equal(stats.latest, created.id);

  // and it still restores from the new process
  await second.store.projects.clear();
  await second.backups.restore(created.id, { safetyBackup: false });
  assert.equal((await second.store.projects.all())[0].marker, 'P');
});

test('lab status exposes AI Core and backups without breaking V0 fields', async (t) => {
  const { lab, dir } = await freshLab();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  await lab.backups.create({ note: 'status check' });
  const s = await lab.status();

  // new in Phase 1
  assert.equal(s.ai.phase, 1);
  assert.equal(s.ai.externalModelUsed, false);
  assert.equal(s.backups.count, 1);

  // V0 fields must all still be there
  for (const key of ['workspace', 'permissions', 'projects', 'knowledge', 'generated', 'models', 'learning', 'traitSpace', 'queue', 'autopilot', 'disclaimer']) {
    assert.ok(key in s, `status.${key} must not disappear`);
  }
});

async function fingerprint(root) {
  const out = [];
  async function walk(dir, rel = '') {
    let entries = [];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, e.name);
      const key = path.join(rel, e.name);
      if (e.isDirectory()) await walk(full, key);
      else out.push(`${key}:${(await fs.stat(full)).size}`);
    }
  }
  await walk(root);
  return out;
}
