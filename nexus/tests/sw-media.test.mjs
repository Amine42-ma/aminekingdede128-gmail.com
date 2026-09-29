/* ============================================================
   NEXUS tests · sw.js (the offline worker) in front of a Google Drive that
   answers, then refuses the way Drive does (403 JSON «downloadQuotaExceeded»,
   429), then drops the connection — in a real Chromium, with the real sw.js.
   What it guards: a refusal is never saved over a good copy (an <img>'s
   own request is opaque: v1 could not tell a refusal from a file), the saved
   copy is shown while the host refuses or the network fails, and the old
   v1 cache (which may hold such refusals) is deleted.
   Needs Playwright + Chromium and openssl (a throwaway certificate for the
   fake www.googleapis.com). Run:  node nexus/tests/sw-media.test.mjs
   ============================================================ */
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from './e2e-kit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SW = fs.readFileSync(path.join(here, '..', 'sw.js'), 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-sw-'));
try { execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(tmp, 'k.pem'), '-out', path.join(tmp, 'c.pem'), '-days', '1', '-subj', '/CN=www.googleapis.com'], { stdio: 'ignore' }); }
catch { console.log('skipped: openssl is not available here'); process.exit(0); }

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8DwnwEJMDGgAQA2GAQBm8y2vgAAAABJRU5ErkJggg==', 'base64');
let mode = 'ok', hits = 0;
const drive = https.createServer({ key: fs.readFileSync(path.join(tmp, 'k.pem')), cert: fs.readFileSync(path.join(tmp, 'c.pem')) }, (req, res) => {
  hits++;
  const h = { 'cache-control': 'private, max-age=0, must-revalidate', vary: 'Origin, X-Origin' };
  if (mode !== 'nocors') Object.assign(h, { 'access-control-allow-origin': req.headers.origin || '*', 'access-control-allow-credentials': 'true' });
  if (mode === 'ok' || mode === 'nocors') { res.writeHead(200, Object.assign({ 'content-type': 'image/png', 'content-disposition': 'attachment' }, h)); return res.end(PNG); }
  if (mode === 'quota') { res.writeHead(403, Object.assign({ 'content-type': 'application/json; charset=UTF-8' }, h)); return res.end('{"error":{"code":403,"message":"The download quota for this file has been exceeded.","errors":[{"domain":"usageLimits","reason":"downloadQuotaExceeded"}]}}'); }
  if (mode === 'rate') { res.writeHead(429, Object.assign({ 'content-type': 'text/html' }, h)); return res.end('<html>We\'re sorry… automated queries</html>'); }
  req.socket.destroy();                                                        // 'reset': the connection drops
});
await new Promise(r => drive.listen(0, '127.0.0.1', r));
const IMG = id => 'https://www.googleapis.com/drive/v3/files/' + id + '?alt=media&key=k';
const PAGE = `<!doctype html><meta charset=utf-8><body><script>
window.show = src => new Promise(done => { const i = new Image(); i.onload = () => done(i.naturalWidth ? 'shown' : 'BROKEN'); i.onerror = () => done('BROKEN'); i.src = src; });
window.ready = (async () => { await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready; return !!navigator.serviceWorker.controller; })();
</script>`;
const site = http.createServer((req, res) => {
  if (req.url.startsWith('/sw.js')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(SW); }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE);
});
await new Promise(r => site.listen(0, '127.0.0.1', r));
const base = 'http://localhost:' + site.address().port + '/';
const browser = await chromium.launch({ args: ['--no-proxy-server', '--host-resolver-rules=MAP www.googleapis.com 127.0.0.1:' + drive.address().port, '--ignore-certificate-errors'] });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await ctx.newPage();

const tests = [];
const test = (name, f) => tests.push({ name, f });
const look = async id => { await page.goto(base); await page.evaluate(() => window.ready); return page.evaluate(src => window.show(src), IMG(id)); };
const saved = () => page.evaluate(async () => (await caches.keys()).filter(k => k.startsWith('nexus-media-')));

test('an old v1 cache (it may hold refusals saved as files) is deleted when the worker starts', async () => {
  await page.goto(base);
  await page.evaluate(async () => { const c = await caches.open('nexus-media-v1'); await c.put('https://www.googleapis.com/drive/v3/files/OLD?alt=media', new Response('refusal', { status: 200 })); });
  await page.evaluate(() => window.ready);
  await page.goto(base); await page.evaluate(() => window.ready);
  assert.ok(!(await saved()).includes('nexus-media-v1'), 'v1 is gone: ' + await saved());
});

test('Drive answers: the icon is shown and a copy is kept', async () => {
  mode = 'ok';
  assert.equal(await look('T1'), 'shown');
  assert.ok((await saved()).includes('nexus-media-v2'));
});

for (const [m, what] of [['quota', 'Drive refuses: 403 «downloadQuotaExceeded»'], ['rate', 'Drive refuses: 429'], ['reset', 'the connection drops']])
  test(what + ' → the saved copy is shown (the refusal is never saved over it)', async () => {
    mode = m;
    assert.equal(await look('T1'), 'shown');
  });

test('after the refusals, the copy is still the file — shown again when the network drops', async () => {
  mode = 'reset';
  assert.equal(await look('T1'), 'shown');
  const kept = await page.evaluate(async src => { const r = await (await caches.open('nexus-media-v2')).match(src, { ignoreVary: true }); return r ? [r.status, r.type, (await r.arrayBuffer()).byteLength] : null; }, IMG('T1'));
  assert.deepEqual(kept, [200, 'cors', PNG.length]);
});

test('Drive answers again: the current file, as before', async () => {
  mode = 'ok'; const h0 = hits;
  assert.equal(await look('T1'), 'shown'); assert.ok(hits > h0, 'asked from Drive (fresh when online)');
});

test('a host without CORS for this site (a Storage bucket without cors.json): the <img> still loads it — nothing unreadable is saved', async () => {
  mode = 'nocors';
  assert.equal(await look('T2'), 'shown');
  const kept = await page.evaluate(async src => !!(await (await caches.open('nexus-media-v2')).match(src, { ignoreVary: true })), IMG('T2'));
  assert.equal(kept, false);
});

let pass = 0, failN = 0;
for (const t of tests) {
  try { await t.f(); pass++; console.log('✓ ' + t.name); }
  catch (e) { failN++; console.log('✗ ' + t.name + '\n    ' + String(e && e.stack || e).split('\n').slice(0, 4).join('\n    ')); }
}
await browser.close(); drive.close(); site.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log('\n' + pass + ' passed, ' + failN + ' failed');
process.exit(failN ? 1 : 0);
