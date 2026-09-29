/* ============================================================
   NEXUS tests · what the browser tests share: Chromium, the Firebase
   emulators as the server's admin (the page itself goes through the real
   firestore.rules), a page of NEXUS signed in with an account.
   ============================================================ */
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
export const { chromium } = (() => {
  for (const m of [process.env.PLAYWRIGHT_MODULE, 'playwright']) { try { if (m) return require(m); } catch { } }
  return require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
})();
export const VENDOR = process.env.NEXUS_E2E_VENDOR || '';
export const PROJECT = 'demo-nexus';
export const FS = 'http://127.0.0.1:8080/v1/projects/' + PROJECT + '/databases/(default)/documents';

/* ---------------- the emulators, as the server's admin ---------------- */
export const toFs = v => v === null || v === undefined ? { nullValue: null } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : typeof v === 'string' ? { stringValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(toFs) } } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFs(x)])) } };
const fromFs = f => { const [t, v] = Object.entries(f || {})[0] || []; return t === 'integerValue' ? +v : t === 'doubleValue' ? v : t === 'mapValue' ? Object.fromEntries(Object.entries(v.fields || {}).map(([k, x]) => [k, fromFs(x)])) : t === 'arrayValue' ? (v.values || []).map(fromFs) : t === 'nullValue' ? null : v; };
const admin = { authorization: 'Bearer owner', 'content-type': 'application/json' };
export async function fsSet(doc, obj) {
  const mask = Object.keys(obj).map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
  const r = await fetch(FS + '/' + doc + '?' + mask, { method: 'PATCH', headers: admin, body: JSON.stringify({ fields: toFs(obj).mapValue.fields }) });
  if (!r.ok) throw new Error('fsSet ' + doc + ' ' + r.status + ' ' + await r.text());
}
/* a document as the server sees it (null when there is none) */
export async function fsGet(doc) {
  const r = await fetch(FS + '/' + doc, { headers: admin });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('fsGet ' + doc + ' ' + r.status);
  const d = await r.json();
  return Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, fromFs(v)]));
}
export async function fsQuery(col, field, value) {
  const r = await fetch(FS + ':runQuery', { method: 'POST', headers: admin, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: col }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } } } }) });
  return (await r.json()).filter(x => x.document).map(x => x.document);
}
export async function resetEmulators() {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/' + PROJECT + '/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/' + PROJECT + '/accounts', { method: 'DELETE' });
}

/* ---------------- a phone: its own browser storage, NEXUS open on it ---------------- */
export async function newDevice(browser, site, logs = []) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  await ctx.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') return route.continue();
    if (VENDOR && u.hostname === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/10.12.2/'))
      return route.fulfill({ path: path.join(VENDOR, 'firebase/package', u.pathname.split('/').pop()), contentType: 'text/javascript' });
    if (VENDOR && u.hostname === 'cdn.jsdelivr.net' && u.pathname.startsWith('/npm/three@0.162.0/'))
      return route.fulfill({ path: path.join(VENDOR, 'three/package', u.pathname.replace('/npm/three@0.162.0/', '')), contentType: 'text/javascript' });
    return VENDOR ? route.abort() : route.continue();
  });
  const page = await ctx.newPage();
  watch(page, logs);
  await page.addInitScript(() => { try { localStorage.setItem('nx.mode', '"pro"'); } catch { } });
  await open(page, site);
  return { ctx, page };
}
export function watch(page, logs) {
  page.on('pageerror', e => logs.push('pageerror: ' + String(e.stack || e).slice(0, 500)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) logs.push('console: ' + m.text().slice(0, 400)); });
}
export async function open(page, site) {
  await page.goto(site.base + '/index.html?emulators=1');
  await page.waitForFunction(() => window.NX && NX.Backend && NX.Backend.isOnline && NX.Backend.isOnline() && NX.Backend.user && NX.Council && NX.CouncilUI && NX.Platform, null, { timeout: 90000 });
}
export async function signUp(page, email, { free = true } = {}) {
  const uid = await page.evaluate(async e => (await NX.Backend.auth.signInEmail(e, 'secret123', true)).uid, email);
  if (free) await page.waitForFunction(() => NX.FreeAI.ready(), null, { timeout: 30000 });
  return uid;
}
export async function signIn(page, email) {
  return page.evaluate(async e => (await NX.Backend.auth.signInEmail(e, 'secret123', false)).uid, email);
}
export const until = (page, fn, arg, timeout = 90000) => page.waitForFunction(fn, arg, { timeout, polling: 250 });

/* ---------------- the runner ---------------- */
export async function run(tests, logs, done) {
  let pass = 0, failN = 0;
  for (const t of tests) {
    const t0 = Date.now();
    try { await t.f(); pass++; console.log('✓ ' + t.name + '  (' + ((Date.now() - t0) / 1000).toFixed(1) + 's)'); }
    catch (e) {
      failN++;
      console.log('✗ ' + t.name + '\n    ' + String(e && e.stack || e).split('\n').slice(0, 5).join('\n    '));
      if (logs.length) console.log('    page: ' + logs.slice(-6).join('\n    page: '));
    }
  }
  await done();
  console.log('\n' + pass + ' passed, ' + failN + ' failed');
  process.exit(failN ? 1 : 0);
}
