/* ============================================================
   NEXUS tests · 🤝 giving a key — on a site WITHOUT a service account
   (no FIREBASE_SERVICE_ACCOUNT: the server cannot read Firestore's pool),
   with the site's own Netlify Blobs store — the usual Netlify site linked
   to GitHub. In a real browser (Chromium) with the Firebase emulators:
   • one paste: the key is recognised, one button: the SERVER tests it with
     a real request, keeps it in the Blobs store, and the free AI answers
     with it at once (it had no key before) — no setup at all;
   • a refused key is never kept; the same key twice is refused;
   • «🧪 try my keys» answers for each key; a key of another site (Base URL)
     asks for its address by itself; withdrawing takes it out of the free AI;
   • the site's server not running (a drag-and-drop deploy): the key is
     still kept by the rules, and the sheet says exactly what to fix.
   Run:  node nexus/tests/donation-e2e.test.mjs
   ============================================================ */
import assert from 'node:assert/strict';
import { startWorld } from './mock-world.mjs';
import { startSite } from './e2e-server.mjs';
import { chromium, resetEmulators, newDevice, signUp, until, run, fsQuery } from './e2e-kit.mjs';

const W = await startWorld();
const KEY = { groq: 'gsk_DONATEDGROQKEY000000000000001', bad: 'gsk_REFUSEDGROQKEY00000000000001', gem: 'AIzaDONATEDGEMINIKEY00000000000000000001', site: 'sk-reseller-BLOBS0000000000000000001' };
W.keys[KEY.bad] = '401';
W.lists.reseller = ['gpt-4o', 'gpt-4o-mini'];
/* no FIRESTORE_EMULATOR_HOST and no service account for the SERVER: only its Netlify Blobs store */
const env = { FIREBASE_PROJECT_ID: 'demo-nexus', NEXUS_TEST_EMULATOR_TOKENS: '1', NETLIFY_BLOBS_CONTEXT: W.blobsContext(),
  GEMINI_BASE: W.base + '/gemini', GROQ_BASE: W.base + '/groq', OPENROUTER_BASE: W.base + '/openrouter', ANTHROPIC_BASE: W.base + '/anthropic',
  NEXUS_TEST_CUSTOM_BASE: W.base + '/reseller', AI_PER_MINUTE: '500' };
await resetEmulators();
const site = await startSite({ env });
const browser = await chromium.launch();
const logs = [];
const tests = [];
const test = (name, f) => tests.push({ name, f });
const S = {};
const pool = () => JSON.parse(W.blobs && W.blobs.get('site:nexus-ai-keys/pool') || '{"keys":[]}').keys;
const health = page => page.evaluate(async () => (await fetch('/api/ai/health')).json());
const T = (page, k, v) => page.evaluate(([k, v]) => NX.T(k, v), [k, v]);

async function give(page, key, base) {
  await page.evaluate(() => { NX.Sheet.closeAll(); NX.KeyPool.open(); });
  await until(page, () => document.querySelectorAll('#sheet-root .sheet').length === 1 && !!document.querySelector('#sheet-root .sheet.in .kp'), null, 10000);
  await page.fill('#sheet-root .sheet.in .kp input[type=password]', key);
  if (base) await page.fill('#sheet-root .sheet.in .kp-base', base);
  await page.check('#kp-agree');
  await page.locator('#sheet-root .sheet.in .kp-give').click();
  await until(page, () => { const b = document.querySelector('#sheet-root .sheet.in .kp-give'); return b && !b.disabled && document.querySelector('#sheet-root .sheet.in .kp-result .kp-step'); }, null, 60000);
  return page.evaluate(() => [...document.querySelectorAll('#sheet-root .sheet.in .kp-result .kp-step')].map(s => s.textContent));
}

test('1 · Before: the free AI has no key at all on this site — it says so, and offers «🤝 donate a key»', async () => {
  const { page } = S.a = await newDevice(browser, site, logs);
  S.aUid = await signUp(page, 'donor@test.io', { free: false });
  const h = await health(page);
  assert.equal(h.free, false); assert.equal(h.pool.readable, true, 'the Blobs store is readable with no setup');
  const off = await page.evaluate(async () => { NX.FreeAI._probe = null; await NX.FreeAI.probe(); return NX.FreeAI.offText(); });
  assert.ok(off.includes(await T(page, 'KP2_OFF_DONATE')), off);
});

test('2 · One paste, one button: the server tests the Groq key for real, keeps it in the site\'s own store, and the free AI answers with it at once', async () => {
  const { page } = S.a;
  await page.evaluate(() => NX.KeyPool.open());
  await page.fill('#sheet-root .sheet.in .kp input[type=password]', KEY.groq);
  assert.match(await page.locator('#sheet-root .sheet.in .kp-kind').textContent(), /Groq/);
  assert.equal(await page.locator('#sheet-root .sheet.in .kp-site').evaluate(n => n.classList.contains('hide')), true, 'no address asked for a known key');
  await page.evaluate(() => NX.Sheet.closeAll());
  const n = W.calls.length;
  const steps = await give(page, KEY.groq);
  assert.ok(steps[0].startsWith('✓') && steps[1].startsWith('✓') && steps[2].startsWith('✓'), steps.join(' | '));
  assert.ok(steps[1].includes(await T(page, 'KP2_KEPT_NETLIFY')), steps[1]);
  assert.ok(W.calls.slice(n).some(c => c.provider === 'groq' && c.key === KEY.groq && c.status === 200), 'a real request with the key');
  const keys = pool();
  assert.equal(keys.length, 1); assert.equal(keys[0].uid, S.aUid); assert.equal(keys[0].provider, 'groq'); assert.equal(keys[0].status, 'active'); assert.equal(keys[0].tier, 'strong');
  /* the free AI: on, and answering with the donated key */
  const h = await health(page);
  assert.equal(h.free, true); assert.deepEqual(h.providers, ['groq']);
  const m = W.calls.length;
  const r = await page.evaluate(async () => {
    const tok = await NX.Backend.fb.auth.currentUser.getIdToken();
    const res = await fetch('/api/ai/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: JSON.stringify({ model: 'auto', messages: [{ role: 'user', content: 'hello' }] }) });
    return { status: res.status, text: await res.text() };
  });
  assert.equal(r.status, 200, r.text);
  assert.ok(W.calls.slice(m).some(c => c.key === KEY.groq), 'the free AI used the donated key');
  const html = await page.content();
  assert.ok(!html.includes(KEY.groq.slice(4)), 'the key is nowhere in the page');
  /* the sheet: my key, working, the server fine */
  await until(page, () => /🟢/.test((document.querySelector('#sheet-root .sheet.in .kp-status') || {}).textContent || ''), null, 20000);
  const row = await page.locator('#sheet-root .sheet.in .kp-row').first().textContent();
  assert.match(row, /Groq ••••0001/); assert.match(row, /🟢/);
});

test('3 · A refused key is never kept; the same key twice is refused', async () => {
  const { page } = S.a;
  const steps = await give(page, KEY.bad);
  assert.ok(steps[0].startsWith('✗') && /رفض/.test(steps[0]), steps.join(' | '));
  assert.equal(pool().length, 1);
  const again = await give(page, KEY.groq);
  assert.ok(again[0].startsWith('✗') && /من قبل/.test(again[0]), again.join(' | '));
  assert.equal(pool().length, 1);
});

test('4 · A key of another site: its address is asked for by itself; tested on the site\'s own models; «🧪 try my keys» answers for each key', async () => {
  const { page } = S.a;
  await page.evaluate(() => { NX.Sheet.closeAll(); NX.KeyPool.open(); });
  await until(page, () => document.querySelectorAll('#sheet-root .sheet').length === 1 && !!document.querySelector('#sheet-root .sheet.in .kp'), null, 10000);
  await page.fill('#sheet-root .sheet.in .kp input[type=password]', KEY.site);
  assert.equal(await page.locator('#sheet-root .sheet.in .kp-site').evaluate(n => n.classList.contains('hide')), false, 'the address field opens by itself');
  const steps = await give(page, KEY.site, W.base + '/reseller/v1');
  assert.ok(steps.every(s => s.startsWith('✓')), steps.join(' | '));
  const k = pool().find(x => x.provider === 'custom');
  assert.equal(k.base, W.base + '/reseller/v1'); assert.deepEqual(k.models, ['gpt-4o', 'gpt-4o-mini']); assert.equal(k.tier, 'strong');
  await until(page, () => !!document.querySelector('#sheet-root .sheet.in .kp-try'), null, 20000);
  await page.locator('#sheet-root .sheet.in .kp-try').click();
  await until(page, () => [...document.querySelectorAll('#sheet-root .sheet.in .kp-line')].filter(l => l.textContent.startsWith('✓')).length === 2, null, 30000);
});

test('5 · Withdrawn: out of the store and out of the free AI', async () => {
  const { page } = S.a;
  for (let i = 0; i < 2; i++) {
    await until(page, () => !!document.querySelector('#sheet-root .sheet.in .kp-row .btn.danger'), null, 20000);
    await page.locator('#sheet-root .sheet.in .kp-row .btn.danger').first().click();
    await page.locator('.modal .btn.danger').click();
    await until(page, n => document.querySelectorAll('#sheet-root .sheet.in .kp-row').length === n, 1 - i, 20000);
  }
  assert.equal(pool().length, 0);
  assert.equal((await health(page)).free, false);
});

test('6 · The site\'s server not running (a drag-and-drop deploy): the key is still kept by the rules — and the sheet says exactly what to fix', async () => {
  const { page } = S.a;
  await page.route('**/api/ai/**', route => route.fulfill({ status: 404, contentType: 'text/html', body: '<h1>Not found</h1>' }));
  const steps = await give(page, KEY.gem);
  assert.ok(steps[0].startsWith('⚠') && steps[1].startsWith('✓'), steps.join(' | '));
  assert.ok(steps[2].includes('Link repository') && steps[2].includes('Base directory = nexus'), steps[2]);
  const docs = await fsQuery('api_keys', 'donorUid', S.aUid);
  assert.equal(docs.length, 1, 'kept in the pool by the rules');
  await until(page, () => /🔴/.test((document.querySelector('#sheet-root .sheet.in .kp-status') || {}).textContent || ''), null, 20000);
  await page.unroute('**/api/ai/**');
});

test('7 · No errors on the page', async () => {
  const bad = logs.filter(l => !/serviceWorker|service worker|ServiceWorker|404|Failed to fetch|api\/ai/.test(l));
  assert.deepEqual(bad, []);
});

await run(tests, logs, async () => { await browser.close(); await site.close(); await W.close(); });
