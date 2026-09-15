import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { rng, jaccard, shingles, hashHex, round } from '../src/core/util.js';
import { Scope, ScopeError } from '../src/core/paths.js';
import { Store } from '../src/core/store.js';
import { Bus } from '../src/core/events.js';
import { writeZip, readZip, crc32 } from '../src/importer/zip.js';

test('seeded rng is deterministic and reproducible', () => {
  const a = rng('seed-1');
  const b = rng('seed-1');
  const c = rng('seed-2');
  const sa = [a(), a(), a()];
  const sb = [b(), b(), b()];
  assert.deepEqual(sa, sb, 'same seed must produce the same sequence');
  assert.notDeepEqual(sa, [c(), c(), c()]);
  const r = rng('x');
  for (let i = 0; i < 500; i++) {
    const v = r.int(3, 7);
    assert.ok(v >= 3 && v <= 7, `int() out of range: ${v}`);
  }
});

test('weighted pick respects zero weights', () => {
  const r = rng('w');
  const items = [{ value: 'a', weight: 0 }, { value: 'b', weight: 1 }];
  for (let i = 0; i < 50; i++) assert.equal(r.weighted(items), 'b');
});

test('set similarity helpers', () => {
  assert.equal(jaccard([1, 2, 3], [1, 2, 3]), 1);
  assert.equal(jaccard([1], [2]), 0);
  assert.equal(round(jaccard([1, 2], [2, 3]), 3), 0.333);
  assert.equal(shingles(['a', 'b', 'c', 'd'], 2).size, 3);
  assert.equal(hashHex('abc'), hashHex('abc'));
  assert.notEqual(hashHex('abc'), hashHex('abd'));
});

test('scope confines filesystem access', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lab-scope-'));
  const scope = new Scope([dir]);
  assert.ok(scope.contains(path.join(dir, 'a', 'b.txt')));
  assert.throws(() => scope.resolve('/etc/passwd'), ScopeError);
  assert.throws(() => scope.resolve(path.join(dir, '..', 'outside.txt')), ScopeError);
  await scope.writeFile(path.join(dir, 'ok.txt'), 'hello');
  assert.equal(await fs.readFile(path.join(dir, 'ok.txt'), 'utf8'), 'hello');
  await fs.rm(dir, { recursive: true, force: true });
});

test('store persists and reloads documents', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lab-store-'));
  const store = new Store(dir);
  const doc = await store.projects.put({ name: 'x', value: 1 });
  assert.ok(doc.id);
  assert.equal((await store.projects.get(doc.id)).name, 'x');
  await store.projects.patch(doc.id, { value: 2 });

  const reopened = new Store(dir);
  const found = await reopened.projects.findOne((p) => p.name === 'x');
  assert.equal(found.value, 2, 'documents must survive a reopen');

  await store.setState('k', { a: 1 });
  assert.deepEqual(await reopened.getState('k'), { a: 1 });
  await fs.rm(dir, { recursive: true, force: true });
});

test('event bus keeps a bounded tail', () => {
  const bus = new Bus({ keep: 10 });
  for (let i = 0; i < 25; i++) bus.info('tick', { i });
  assert.equal(bus.log.length, 10);
  assert.equal(bus.tail(5).length, 5);
  assert.equal(bus.log[bus.log.length - 1].i, 24);
});

test('zip round-trips text and binary entries', () => {
  const big = Buffer.alloc(5000, 7);
  const zip = writeZip([
    { name: 'a/index.html', data: '<h1>hi</h1>' },
    { name: 'bin.dat', data: big },
  ]);
  const entries = readZip(zip);
  assert.equal(entries.length, 2);
  const html = entries.find((e) => e.name === 'a/index.html');
  assert.equal(html.data().toString('utf8'), '<h1>hi</h1>');
  const bin = entries.find((e) => e.name === 'bin.dat');
  assert.equal(bin.data().length, 5000);
  assert.equal(crc32(bin.data()), bin.crc, 'CRC must match the stored checksum');
});
