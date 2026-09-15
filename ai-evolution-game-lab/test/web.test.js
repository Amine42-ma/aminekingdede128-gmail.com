import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');

test('dashboard script parses (guards against unbalanced delimiters)', async () => {
  const src = await fs.readFile(path.join(WEB, 'app.js'), 'utf8');
  assert.doesNotThrow(() => new vm.Script(src, { filename: 'web/app.js' }), 'web/app.js must be syntactically valid');
});

test('dashboard ships no external dependencies (offline-first)', async () => {
  const html = await fs.readFile(path.join(WEB, 'index.html'), 'utf8');
  const css = await fs.readFile(path.join(WEB, 'app.css'), 'utf8');
  const js = await fs.readFile(path.join(WEB, 'app.js'), 'utf8');

  const externals = [...html.matchAll(/(?:src|href)\s*=\s*"(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(externals, [], `dashboard must not load remote assets: ${externals.join(', ')}`);
  assert.ok(!/@import\s+url\(https?:/.test(css), 'stylesheet must not import remote CSS');
  assert.ok(!/fonts\.(googleapis|gstatic)/.test(css + html), 'no web fonts');
  assert.ok(js.includes("new EventSource('/events')"), 'dashboard must subscribe to the local event stream');
});

test('every nav entry has a view implementation', async () => {
  const html = await fs.readFile(path.join(WEB, 'index.html'), 'utf8');
  const js = await fs.readFile(path.join(WEB, 'app.js'), 'utf8');
  const navViews = [...html.matchAll(/data-view="([\w-]+)"/g)].map((m) => m[1]);
  assert.ok(navViews.length >= 10);
  for (const v of navViews) {
    assert.ok(js.includes(`views.${v} =`), `missing view implementation for "${v}"`);
  }
});

test('both UI languages define the same keys', async () => {
  const js = await fs.readFile(path.join(WEB, 'app.js'), 'utf8');
  const block = js.slice(js.indexOf('const I18N = {'), js.indexOf('let lang ='));
  const ar = [...block.matchAll(/'((?:nav|action|sub|log)\.[\w-]+)':/g)].map((m) => m[1]);
  const half = ar.length / 2;
  const arKeys = new Set(ar.slice(0, half));
  const enKeys = new Set(ar.slice(half));
  for (const k of arKeys) assert.ok(enKeys.has(k), `English translation missing for ${k}`);
  for (const k of enKeys) assert.ok(arKeys.has(k), `Arabic translation missing for ${k}`);
});
