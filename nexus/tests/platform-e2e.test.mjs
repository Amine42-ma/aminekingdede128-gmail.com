/* ============================================================
   NEXUS tests · the platform around the AI, end to end in a real browser:
   • asset icons — «clear cache», a reload, Google Drive refusing for a
     while: the records stay, the icons come back from them;
   • the account's age — asked at sign-up, kept in ages/{uid} (never an
     «age» number), the same on another phone, computed every time (a year
     passes: 15 → 16), and enforced by firestore.rules;
   • Pro and the council's limits cannot be raised from the page;
   • no AI provider at all: NEXUS stays usable.
   Needs the Firebase emulators (see council-e2e.test.mjs) and Playwright.
   Run:  node nexus/tests/platform-e2e.test.mjs
   ============================================================ */
import assert from 'node:assert/strict';
import { startWorld } from './mock-world.mjs';
import { startSite } from './e2e-server.mjs';
import { e2eReply } from './fake-models.mjs';
import { boxGLB } from './glb.mjs';
import { chromium, fsSet, fsGet, resetEmulators, newDevice, open, signUp, signIn, until, run } from './e2e-kit.mjs';

/* ---------------- a fake Google Drive for the icons (what the real one does, as measured) ----------------
   200: the file, «cache-control: private, max-age=0, must-revalidate», CORS · 403: its download limits
   (JSON) · 404: a file its owner deleted */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8DwnwEJMDGgAQA2GAQBm8y2vgAAAABJRU5ErkJggg==', 'base64');
const drive = { mode: 'ok', gone: new Set(), hits: [] };
async function fakeDrive(ctx) {
  await ctx.route(/^https:\/\/www\.googleapis\.com\/drive\/v3\/files\//, route => {
    const id = new URL(route.request().url()).pathname.split('/').pop();
    drive.hits.push(id);
    const cors = { 'access-control-allow-origin': '*', 'cache-control': 'private, max-age=0, must-revalidate' };
    if (drive.gone.has(id)) return route.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: '{"error":{"code":404,"message":"File not found"}}' });
    if (drive.mode === 'quota') return route.fulfill({ status: 403, headers: cors, contentType: 'application/json',
      body: '{"error":{"code":403,"message":"The download quota for this file has been exceeded.","errors":[{"domain":"usageLimits","reason":"downloadQuotaExceeded"}]}}' });
    return route.fulfill({ status: 200, headers: cors, contentType: 'image/png', body: PNG });
  });
}
const hitsOf = id => drive.hits.filter(h => h === id).length;

/* ---------------- the world ---------------- */
const W = await startWorld();
W.reply = e2eReply;
const files = { '/e2e-assets/house.glb': boxGLB('House', [6, 5, 6], [0.8, 0.6, 0.4]) };
const env = { FIREBASE_PROJECT_ID: 'demo-nexus', NEXUS_TEST_EMULATOR_TOKENS: '1', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', AI_PER_MINUTE: '500', PRO_AI_PER_DAY: '500', AI_FREE_PER_DAY: '50',
  GEMINI_BASE: W.base + '/gemini', GROQ_BASE: W.base + '/groq', OPENROUTER_BASE: W.base + '/openrouter', ANTHROPIC_BASE: W.base + '/anthropic',
  GEMINI_KEYS: 'AIzaGEMINI_TEST_KEY_000000000000000001', GROQ_KEYS: 'gsk_GROQTESTKEY0000000000000001', OPENROUTER_KEYS: 'sk-or-v1-OPENROUTERTESTKEY000000001' };
await resetEmulators();
const site = await startSite({ env, files });
const browser = await chromium.launch();
const logs = [];
const tests = [];
const test = (name, f) => tests.push({ name, f });
const S = {};
const NOW = new Date(), Y = NOW.getFullYear(), M = NOW.getMonth() + 1;

/* ================================================================ the account's age, from sign-up */
test('Sign-up asks the birth month once — it is kept in the account (ages/{uid}: year + month, never an «age» number)', async () => {
  const { page, ctx } = S.a = await newDevice(browser, site, logs);
  await fakeDrive(ctx);
  /* the real form: «البريد وكلمة المرور» → «حساب جديد» */
  await page.evaluate(() => NX.Platform.openEmailAuth());
  await page.fill('input[type="email"]', 'maya@test.io');
  await page.fill('input[type="password"]', 'secret123');
  await page.click('.sheet-foot .btn.ghost');                                             // حساب جديد
  await until(page, () => document.querySelector('.age-m') && document.querySelector('.age-y'));
  assert.match(await page.evaluate(() => document.querySelector('.age-m').closest('.modal, [role="dialog"], .sheet, body').innerText), /حساب جديد/);
  await page.selectOption('.age-m', String(M));
  await page.selectOption('.age-y', String(Y - 15));                                       // 15 years old this month
  await page.click('.age-save');
  await until(page, () => NX.Age._me && NX.Age._me.v);
  S.aUid = await page.evaluate(() => NX.Backend.user.uid);
  const doc = await fsGet('ages/' + S.aUid);
  assert.deepEqual(Object.keys(doc).sort(), ['at', 'm', 'y'], 'only year, month and when: ' + JSON.stringify(doc));
  assert.equal(doc.y, Y - 15); assert.equal(doc.m, M);
  assert.equal(await page.evaluate(() => NX.Age.years()), 15);
  const local = await page.evaluate(() => Object.keys(localStorage).filter(k => /age|birth/i.test(k)));
  assert.deepEqual(local, [], 'nothing about the age on this device');
});

test('The age cannot be changed from the page (DevTools): no update, no second write, no delete — the rules refuse', async () => {
  const { page } = S.a;
  const tries = await page.evaluate(async uid => {
    const { F, db } = NX.Backend.fb, out = {}, ref = F.doc(db, 'ages', uid);
    const t = async (k, f) => { try { await f(); out[k] = 'written'; } catch (e) { out[k] = e.code; } };
    await t('update', () => F.updateDoc(ref, { y: 1990 }));
    await t('set', () => F.setDoc(ref, { y: 1990, m: 1, at: F.serverTimestamp() }));
    await t('delete', () => F.deleteDoc(ref));
    await t('other', () => F.setDoc(F.doc(db, 'ages', 'someone-else'), { y: 1990, m: 1, at: F.serverTimestamp() }));
    return out;
  }, S.aUid);
  assert.deepEqual(tries, { update: 'permission-denied', set: 'permission-denied', delete: 'permission-denied', other: 'permission-denied' });
  assert.equal((await fsGet('ages/' + S.aUid)).y, Y - 15, 'unchanged on the server');
});

test('An account with an age: 12+ opens, 16+ is refused — by the server rules, even when the page is told otherwise', async () => {
  const { page } = S.a;
  for (const r of ['12', '16']) {
    await fsSet('games/g' + r, { gameId: 'g' + r, title: 'Game ' + r, ownerId: 'studio', visibility: 'public', ageRating: r, plays: 0, likes: 0, createdAt: 1, updatedAt: 1 });
    await fsSet('builds/g' + r, { gameId: 'g' + r, ownerId: 'studio', files: [] });
  }
  const read = await page.evaluate(async () => {
    NX.Age.allow = async () => true;                                                        // «DevTools»: the page lets everything through
    const { F, db } = NX.Backend.fb, out = {};
    for (const g of ['g12', 'g16']) { try { await F.getDocFromServer(F.doc(db, 'builds', g)); out[g] = 'read'; } catch (e) { out[g] = e.code; } }
    return out;
  });
  assert.deepEqual(read, { g12: 'read', g16: 'permission-denied' });
});

test('A year passes: the age is computed every time — 15 → 16 with nothing edited (page and server)', async () => {
  const { page } = S.a;
  /* the page: the same stored birth month, other dates */
  const ages = await page.evaluate(([y, m]) => {
    const b = NX.Age._me.v, at = (yy, mm) => NX.Age.yearsOf(b, new Date(yy, mm - 1, 15));
    return { now: at(y, m), elevenMonthsOn: at(m === 1 ? y : y + 1, m === 1 ? 12 : m - 1), oneYearOn: at(y + 1, m), twoYearsOn: at(y + 2, m) };
  }, [Y, M]);
  assert.deepEqual(ages, { now: 15, elevenMonthsOn: 15, oneYearOn: 16, twoYearsOn: 17 });
  /* the server: its rules compute the age at the time of each request (request.time). An account that
     turned 16 this month opens a 16+ game; one that turns 16 next month does not — yet. */
  const nextMonth = M === 12 ? { y: Y - 15, m: 1 } : { y: Y - 16, m: M + 1 };
  const out = {};
  for (const [name, birth] of [['sixteenNow', { y: Y - 16, m: M }], ['sixteenNextMonth', nextMonth]]) {
    const { page: p, ctx } = await newDevice(browser, site, logs);
    const uid = await signUp(p, name.toLowerCase() + '@test.io', { free: false });
    await fsSet('ages/' + uid, { y: birth.y, m: birth.m, at: '2026-01-01' });
    out[name] = await p.evaluate(async () => { const { F, db } = NX.Backend.fb; try { await F.getDocFromServer(F.doc(db, 'builds', 'g16')); return 'read'; } catch (e) { return e.code; } });
    out[name + 'Years'] = await p.evaluate(() => { NX.Age._me = { uid: null, v: undefined }; return NX.Age.years(); });
    await ctx.close();
  }
  assert.deepEqual(out, { sixteenNow: 'read', sixteenNowYears: 16, sixteenNextMonth: 'permission-denied', sixteenNextMonthYears: 15 });
});

/* ================================================================ asset icons */
test('Asset icons: downloaded once, then shown from this device — Drive refusing (403) does not blank them', async () => {
  const { page } = S.a;
  for (let i = 1; i <= 4; i++)
    await fsSet('assets/asset_icon_' + i, { assetId: 'asset_icon_' + i, ownerId: S.aUid, creatorName: 'maya', name: 'House ' + i, description: '', category: 'Buildings', tags: ['house'],
      assetType: 'building', typeSource: 'name', processing: 'ready', usable: true, projectId: null, storagePath: 'drive:MODEL_' + i, downloadURL: site.base + '/e2e-assets/house.glb',
      thumbnail: 'drive:THUMB_' + i, thumbnailURL: 'https://www.googleapis.com/drive/v3/files/THUMB_' + i + '?alt=media&key=test', fileType: 'glb', kind: 'model', bytes: 1000,
      license: 'CC0', hash: 'h_icon_' + i, originalBytes: null, visibility: 'public', stats: { size: [6, 5, 6] }, createdAt: Date.now() - i * 1000, updatedAt: Date.now(), usageCount: 0, searchTokens: ['house'] });
  drive.gone.add('THUMB_4');                                                                // its owner deleted this icon file from Drive
  const shown = () => page.evaluate(() => Array.from(window.__lib.body.querySelectorAll('.acard img')).map(i => i.style.opacity === '1' && i.naturalWidth > 0));
  const openLib = () => page.evaluate(() => { NX.Sheet.closeAll(); window.__lib = NX.openAssetLibrary({ scope: 'mine' }); });
  await openLib();
  await until(page, () => window.__lib.body.querySelectorAll('.acard').length === 4 && Array.from(window.__lib.body.querySelectorAll('.acard img')).every(i => i.style.opacity === '1' && i.naturalWidth > 0), null, 60000);
  assert.deepEqual([1, 2, 3].map(i => hitsOf('THUMB_' + i)), [1, 1, 1], 'each icon downloaded once');
  const kept = await page.evaluate(async () => (await NX.CacheDB.all('thumbs')).map(x => x.assetId + ':' + x.from).sort());
  assert.deepEqual(kept, ['asset_icon_1:remote', 'asset_icon_2:remote', 'asset_icon_3:remote', 'asset_icon_4:drawn'], 'the deleted icon was drawn again from the model file');
  /* the next visit: nothing downloaded again */
  await openLib();
  await until(page, () => window.__lib.body.querySelectorAll('.acard img').length === 4 && Array.from(window.__lib.body.querySelectorAll('.acard img')).every(i => i.style.opacity === '1'));
  assert.deepEqual([1, 2, 3].map(i => hitsOf('THUMB_' + i)), [1, 1, 1], 'shown from the copy on this device');
  /* Drive refuses for a while (its download limits): the icons stay */
  drive.mode = 'quota';
  await openLib();
  await until(page, () => window.__lib.body.querySelectorAll('.acard img').length === 4 && Array.from(window.__lib.body.querySelectorAll('.acard img')).every(i => i.style.opacity === '1'));
  assert.deepEqual(await shown(), [true, true, true, true]);
});

test('Clear Cache + Assets: «مسح ذاكرة الأصول المؤقتة» deletes copies only — the records stay, and the icons come back from them', async () => {
  const { page } = S.a;
  drive.mode = 'quota';                                                                     // and Drive is still refusing
  await page.evaluate(() => { NX.Sheet.closeAll(); NX.openSettings(); });
  await until(page, () => Array.from(document.querySelectorAll('.sheet button, .sheet .opt-row, .sheet [role="button"]')).some(b => /مسح ذاكرة الأصول المؤقتة/.test(b.innerText)));
  await page.evaluate(() => Array.from(document.querySelectorAll('.sheet button, .sheet .opt-row, .sheet [role="button"]')).find(b => /مسح ذاكرة الأصول المؤقتة/.test(b.innerText)).click());
  await until(page, async () => (await NX.CacheDB.keys('thumbs')).length === 0 || document.body.innerText.includes('مُسحت النسخ المؤقتة'));
  /* the permanent layer is untouched */
  for (let i = 1; i <= 4; i++) assert.ok(await fsGet('assets/asset_icon_' + i), 'record ' + i + ' kept');
  const hits0 = drive.hits.length;
  await page.evaluate(() => { NX.Sheet.closeAll(); window.__lib = NX.openAssetLibrary({ scope: 'mine' }); });
  await until(page, () => window.__lib.body.querySelectorAll('.acard').length === 4);
  await until(page, () => window.__lib.body.querySelector('.acard .thumb.thumb-wait'));
  /* the icon whose file is gone is drawn again from the model at once — no Drive needed */
  await until(page, () => Array.from(window.__lib.body.querySelectorAll('.acard')).some(c => c.querySelector('.ainfo b').textContent === 'House 4' && c.querySelector('img').style.opacity === '1'), null, 60000);
  const state = await page.evaluate(() => Array.from(window.__lib.body.querySelectorAll('.acard')).map(c => ({ name: c.querySelector('.ainfo b').textContent, placeholder: !!c.querySelector('.thumb .ph'), shown: c.querySelector('img').style.opacity === '1' })));
  assert.equal(state.length, 4, 'every asset still listed: ' + JSON.stringify(state));
  assert.ok(state.filter(s => !s.shown).every(s => s.placeholder), 'no empty square: a placeholder until the icon is back');
  assert.ok(state.find(s => s.name === 'House 4').shown, 'the drawn icon comes back at once (from the model file)');
  assert.ok(drive.hits.length > hits0, 'the icons were asked from Drive again');
  /* Drive answers again: the icons come back by themselves — no upload, no reload */
  drive.mode = 'ok';
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await until(page, () => Array.from(window.__lib.body.querySelectorAll('.acard img')).every(i => i.style.opacity === '1' && i.naturalWidth > 0), null, 30000);
  assert.equal((await page.evaluate(async () => (await NX.CacheDB.keys('thumbs')).length)), 4, 'the copies are built again');
});

test('Reload after the browser\'s cache is emptied (IndexedDB cache + Cache Storage): NEXUS rebuilds every icon from Firebase', async () => {
  const { page } = S.a;
  await page.evaluate(async () => {
    await new Promise(r => { const q = indexedDB.deleteDatabase('nexus-cache'); q.onsuccess = q.onerror = q.onblocked = () => r(); });
    if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
  });
  const before = [1, 2, 3].map(i => hitsOf('THUMB_' + i));
  await open(page, site);
  assert.equal(await page.evaluate(() => NX.Backend.user.uid), S.aUid, 'still the same account');
  await page.evaluate(() => { window.__lib = NX.openAssetLibrary({ scope: 'mine' }); });
  await until(page, () => window.__lib.body.querySelectorAll('.acard').length === 4 && Array.from(window.__lib.body.querySelectorAll('.acard img')).every(i => i.style.opacity === '1' && i.naturalWidth > 0), null, 60000);
  assert.deepEqual([1, 2, 3].map(i => hitsOf('THUMB_' + i) - before[i - 1]), [1, 1, 1], 'each icon fetched again from the record\'s Drive file');
  assert.equal((await page.evaluate(async () => (await NX.CacheDB.keys('thumbs')).length)), 4);
});

/* ================================================================ another phone */
test('Another phone, same account: the same age and the same assets — from the account, not from a device', async () => {
  const { page, ctx } = S.b = await newDevice(browser, site, logs);
  await fakeDrive(ctx);
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(k => /age|birth|asset/i.test(k))), [], 'a new phone: nothing stored');
  const uid = await signIn(page, 'maya@test.io');
  assert.equal(uid, S.aUid);
  await until(page, () => NX.Backend.user && NX.Backend.hasAccount());
  assert.equal(await page.evaluate(() => NX.Age.years()), 15, 'Phone B knows the same age');
  const mine = await page.evaluate(async uid => (await NX.Assets.search({ scope: 'mine', ownerId: uid, limit: 20 })).items.map(a => a.assetId).sort(), uid);
  assert.deepEqual(mine, ['asset_icon_1', 'asset_icon_2', 'asset_icon_3', 'asset_icon_4']);
  await page.evaluate(() => { window.__lib = NX.openAssetLibrary({ scope: 'mine' }); });
  await until(page, () => window.__lib.body.querySelectorAll('.acard').length === 4 && Array.from(window.__lib.body.querySelectorAll('.acard img')).every(i => i.style.opacity === '1'), null, 60000);
  await ctx.close();
});

/* ================================================================ Pro cannot be made from the page */
test('Pro from DevTools: the wallet, the day\'s counter, localStorage/sessionStorage — none of it makes an account Pro', async () => {
  const { page } = S.a;
  const tries = await page.evaluate(async uid => {
    const { F, db } = NX.Backend.fb, out = {};
    const t = async (k, f) => { try { await f(); out[k] = 'written'; } catch (e) { out[k] = e.code; } };
    await t('wallet', () => F.setDoc(F.doc(db, 'wallets', uid), { proUntil: Date.now() + 1e10 }, { merge: true }));
    await t('walletUpdate', () => F.updateDoc(F.doc(db, 'wallets', uid), { proUntil: Date.now() + 1e10 }));
    await t('usage', () => F.setDoc(F.doc(db, 'usage', uid), { used: 0 }, { merge: true }));
    localStorage.setItem('nx.council.mode', '"full"'); sessionStorage.setItem('nx.pro', 'true'); localStorage.setItem('nx.pro', 'true');
    NX.Council.caps = Object.assign({}, NX.Council.caps, { pro: true, maxModels: 4 });
    return out;
  }, S.aUid);
  assert.deepEqual(tries, { wallet: 'permission-denied', walletUpdate: 'permission-denied', usage: 'permission-denied' });
  assert.equal((await page.evaluate(() => NX.Council.config(true))).pro, false, 'the server still says: free');
  /* the request itself, sent by hand with two models */
  const r = await page.evaluate(async () => {
    const res = await fetch('/api/ai/council', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + await NX.FreeAI.token() },
      body: JSON.stringify({ mode: 'full', system: 'x', messages: [{ role: 'user', content: 'hi' }], members: [{ role: 'lead', lead: true, model: 'auto' }, { role: 'planner', model: 'auto' }] }) });
    return { status: res.status, body: await res.json() };
  });
  assert.equal(r.status, 403); assert.equal(r.body.error.code, 'pro_required');
});

/* ================================================================ no AI provider at all */
test('No AI provider at all: NEXUS stays usable — the chat says why, the builder uses its own planner', async () => {
  const saved = {};
  ['GEMINI_KEYS', 'GROQ_KEYS', 'OPENROUTER_KEYS'].forEach(k => { saved[k] = env[k]; delete env[k]; });
  await site.reload();
  try {
    const { page, ctx } = await newDevice(browser, site, logs);
    const errs0 = logs.filter(l => /pageerror/.test(l)).length;
    await signUp(page, 'nokeys@test.io', { free: false });
    const cfg = await page.evaluate(() => NX.Council.config(true));
    assert.ok(!cfg || !cfg.enabled, 'no council without providers');
    await page.evaluate(async () => { await NX.Platform.createProject('No AI'); });
    await until(page, () => NX.Studio.project && NX.Studio.engine);
    /* no model and no car in the library: it says so — it never invents an asset */
    await page.evaluate(() => { NX.Studio.openAI(); NX.AIPanel.setMode('build'); NX.AIPanel.send('أضف سيارة'); });
    await until(page, () => /لا أخترع أصولًا/.test(NX.AIPanel.log.innerText), null, 60000);
    assert.match(await page.evaluate(() => NX.AIPanel.log.innerText), /المخطّط المدمج/);
    /* what the built-in planner can build without a model: a real system, in the project */
    await page.evaluate(() => { NX.__f0 = NX.Studio.project.files.length; NX.AIPanel.send('أضف نظام وقود'); });
    await until(page, () => !NX.Builder.running && NX.Studio.project.files.length > NX.__f0, null, 120000);
    await page.evaluate(() => { NX.AIPanel.setMode('chat'); NX.Chat.send('مرحبا'); });
    await until(page, () => !NX.Chat.streaming && NX.Chat.ensure().messages.some(m => m.role === 'assistant'), null, 60000);
    const reply = await page.evaluate(() => NX.Chat.ensure().messages.filter(m => m.role === 'assistant').pop().content);
    assert.ok(reply && reply.length > 3, 'the chat answered something: ' + reply);
    assert.equal(logs.filter(l => /pageerror/.test(l)).length, errs0, 'no page error: ' + logs.slice(-4).join(' | '));
    await ctx.close();
  } finally {
    Object.assign(env, saved);
    await site.reload();
  }
});

await run(tests, logs, async () => { await browser.close(); await site.close(); await W.close(); });
