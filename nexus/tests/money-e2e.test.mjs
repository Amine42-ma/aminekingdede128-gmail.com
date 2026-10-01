/* ============================================================
   NEXUS tests · 💳 top-up and withdrawal — any amount, both ways — in a real
   browser (Chromium: a phone with touch, and a computer), with the Firebase
   emulators and the real rules, the site's server (points.js, market.js)
   running here, and a fake Stripe (its Checkout page and its SIGNED webhook).
   The two linked fields (dollars ⇄ tokens, as you type), fractions, the
   server doing the sums again, Stripe for exactly that amount, the tokens
   only when it is paid, DevTools, precision, a withdrawal held and paid by
   the site's owner, and the same in English and Hindi.
   Run:  node nexus/tests/money-e2e.test.mjs
   ============================================================ */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startWorld, fakeStripe } from './mock-world.mjs';
import { startSite } from './e2e-server.mjs';
import { e2eReply } from './fake-models.mjs';
import { chromium, resetEmulators, newDevice, signUp, until, run, fsGet, fsSet } from './e2e-kit.mjs';

const W = await startWorld();
W.reply = c => e2eReply(c);
const STRIPE = await fakeStripe('whsec_e2e');
const env = { FIREBASE_PROJECT_ID: 'demo-nexus', NEXUS_TEST_EMULATOR_TOKENS: '1', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', ADMIN_EMAILS: 'boss@test.io',
  AI_PER_MINUTE: '500', GEMINI_BASE: W.base + '/gemini', GROQ_BASE: W.base + '/groq', GROQ_KEYS: 'gsk_GROQTESTKEY0000000000000001',
  STRIPE_SECRET_KEY: 'sk_test_e2e', STRIPE_WEBHOOK_SECRET: 'whsec_e2e', STRIPE_API_BASE: STRIPE.base };
await resetEmulators();
const HTML = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8').replace('window.NEXUS_FILES = "drive";', 'window.NEXUS_FILES = "firebase";');
const site = await startSite({ env, files: { '/index.html': HTML } });
STRIPE.site = site.base;
const browser = await chromium.launch();
const logs = [];
const tests = [];
const test = (name, f) => tests.push({ name, f });
const S = {};
const M6 = 1000000, DAY = 864e5;
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const top = '#sheet-root .sheet.in:last-of-type';
const wallet = async uid => (await fsGet('wallets/' + uid)) || {};
const denied = r => /permission|PERMISSION_DENIED|insufficient/i.test(String(r));
/* the wallet sheet, on the tab asked for */
async function openMoney(page, tab = 'topup') {
  await page.evaluate(() => { NX.Sheet.closeAll(); NX.Points.me = null; return NX.Points.open(); });
  await page.locator(top + ' .mn-card').waitFor({ timeout: 30000 });
  await page.locator(top + ' .mn-tab[data-k="' + tab + '"]').click();
  await page.locator(top + ' .mn-' + tab + ' .mn-usd').waitFor();
  return { usd: page.locator(top + ' .mn-usd'), tok: page.locator(top + ' .mn-tok'), sum: page.locator(top + ' .mn-sum'), err: page.locator(top + ' .mn-err'), go: page.locator(top + ' .mn-go') };
}
async function verify(uid, page) {
  await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-nexus/accounts:update', { method: 'POST', headers: { authorization: 'Bearer owner', 'content-type': 'application/json' }, body: JSON.stringify({ localId: uid, emailVerified: true }) });
  await page.evaluate(() => NX.Backend.fb.auth.currentUser.getIdToken(true));
}

/* ================================================================ the calculator (a phone) */
test('1 · Phone: ONE price on screen (1 token = $0.01); write dollars → tokens at once (÷), write tokens → dollars at once (×) — keystroke by keystroke', async () => {
  const { page } = S.lina = await newDevice(browser, site, logs, PHONE);
  S.linaUid = await signUp(page, 'lina@test.io');
  const f = await openMoney(page);
  assert.match(await page.locator(top + ' .mn-rate').innerText(), /= \$0\.01/);
  assert.match(await page.locator(top + ' .pts-rate').innerText(), /\$0\.01/);
  await f.usd.click();
  const seen = [];
  for (const ch of '12.5') { await page.keyboard.type(ch); seen.push(await f.tok.inputValue()); }
  assert.deepEqual(seen, ['100', '1200', '1200', '1250'], 'tokens = dollars ÷ 0.01, after every key');
  assert.match(await f.sum.innerText(), /\$12\.50/); assert.match(await f.sum.innerText(), /1,250/);
  await f.tok.fill('');
  await f.tok.click();
  for (const ch of '150.25') await page.keyboard.type(ch);
  assert.equal(await f.usd.inputValue(), '1.51', 'dollars = 150.25 × 0.01 = 1.5025 → up to the cent');
  assert.match(await f.go.innerText(), /\$1\.51/);
  assert.equal(await f.go.isDisabled(), false);
  if (process.env.NEXUS_SHOTS) await page.locator(top + ' .mn-card').screenshot({ path: path.join(process.env.NEXUS_SHOTS, 'money-phone-topup.png') });
});

test('2 · Fractions and mistakes: 0.5 and 0.25 tokens are understood; 3 decimals of a dollar, 7 of a token, letters → said, nothing sent; Arabic digits work', async () => {
  const { page } = S.lina;
  const f = await openMoney(page);
  await f.tok.fill('0.5');
  assert.equal(await f.usd.inputValue(), '0.01');
  assert.match(await f.err.innerText(), /1\.00/, 'below the smallest top-up ($1.00) — said, the button off');
  assert.equal(await f.go.isDisabled(), true);
  await f.tok.fill('0.25');
  assert.equal(await f.usd.inputValue(), '0.01');
  await f.usd.fill('1.234');
  assert.equal(await f.tok.inputValue(), ''); assert.notEqual(await f.err.innerText(), ''); assert.equal(await f.go.isDisabled(), true);
  await f.tok.fill('1.1234567');
  assert.equal(await f.usd.inputValue(), ''); assert.notEqual(await f.err.innerText(), '');
  await f.usd.fill('abc');
  assert.equal(await f.go.isDisabled(), true);
  await f.usd.fill('٢٫٥');
  assert.equal(await f.tok.inputValue(), '250');
  await f.usd.fill('600');
  assert.match(await f.err.innerText(), /500\.00/, 'above the largest top-up');
});

test('3 · The page\'s sums ARE the server\'s: 300 random amounts, both fields, top-up and withdrawal, at 0.01 and at 0.003 — the same tokens and cents to the unit; the price changed while the page was open → nothing paid, the new numbers shown', async () => {
  const { page } = S.lina;
  const check = () => page.evaluate(async () => {
    const m = await NX.Points.refresh(), price = m.money.priceMicro, bad = [];
    for (let i = 0; i < 150; i++) {
      const kind = i % 2 ? 'withdraw' : 'topup', anchor = i % 3 ? 'tokens' : 'usd';
      const amount = anchor === 'usd' ? (Math.random() * 400).toFixed(2) : (Math.random() * 40000).toFixed(i % 7);
      const mine = NX.Money.quote(kind, anchor, amount, price), srv = (await NX.Points.api('/money/quote', { kind, anchor, amount })).quote;
      if (mine.micro !== srv.micro || mine.cents !== srv.cents) bad.push({ kind, anchor, amount, mine, srv });
    }
    return { price, bad };
  });
  const a = await check();
  assert.equal(a.price, 10000); assert.deepEqual(a.bad, []);
  S.bossPage = (await newDevice(browser, site, logs)).page;
  S.bossUid = await signUp(S.bossPage, 'boss@test.io');
  await verify(S.bossUid, S.bossPage);
  /* the phone shows the wallet at 0.01 — and the owner changes the price meanwhile */
  const f = await openMoney(page);
  await f.usd.fill('5');
  assert.equal(await f.tok.inputValue(), '500');
  await S.bossPage.evaluate(() => NX.Market.api('/config', { values: { tokenPriceMicro: 0.003 } }));
  await new Promise(r => setTimeout(r, 31000));                      // the server's 30 s cache of the economy
  const calls = STRIPE.calls.length;
  await f.go.click();
  await until(page, () => [...document.querySelectorAll('.toast')].some(t => /0\.003/.test(t.textContent)), null, 20000);
  assert.equal(STRIPE.calls.length, calls, 'no payment at the old price');
  await until(page, () => /0\.003/.test((document.querySelector('#sheet-root .sheet.in .mn-rate') || {}).textContent || ''), null, 20000);
  assert.equal(await page.locator(top + ' .mn-usd').inputValue(), '5.00', 'what was typed is kept');
  assert.equal(await page.locator(top + ' .mn-tok').inputValue(), '1666.666666', '5 ÷ 0.003, down to the millionth');
  const b = await check();
  assert.equal(b.price, 3000); assert.deepEqual(b.bad, []);
  await S.bossPage.evaluate(() => NX.Market.api('/config', { values: { tokenPriceMicro: 0.01 } }));
  await new Promise(r => setTimeout(r, 31000));
});

test('4 · Top-up 150.25 tokens on the phone: Stripe\'s page asks exactly $1.51 → Pay → back in NEXUS, the wallet open: 200.25 exactly — the Transactions row «completed»', async () => {
  const { page } = S.lina;
  const f = await openMoney(page);
  await f.tok.fill('150.25');
  await Promise.all([page.waitForURL(u => String(u).startsWith(STRIPE.base), { timeout: 30000 }), f.go.click()]);
  assert.equal(await page.locator('#amount').innerText(), '$1.51 USD');
  assert.match(await page.locator('#item').innerText(), /150\.25 tokens/);
  const before = await wallet(S.linaUid);
  assert.equal(before.micro, 50 * M6, 'nothing before it is paid');
  await Promise.all([page.waitForURL(u => String(u).startsWith(site.base), { timeout: 30000 }), page.locator('#pay').click()]);
  assert.match(page.url(), /index\.html\?emulators=1#wallet$/, 'back to the same page, the wallet open');
  await until(page, () => window.NX && NX.Backend && NX.Backend.user && document.querySelector('#sheet-root .sheet.in .mn-card'), null, 90000);
  const w = await wallet(S.linaUid);
  assert.deepEqual([w.micro, w.points], [200250000, 200.25]);
  await until(page, () => (document.querySelector('#sheet-root .sheet.in .pts-live') || {}).textContent === '200.25', null, 30000);
  await page.locator(top + ' .mn-txbtn').click();
  await page.locator(top + ' .mn-tx').first().waitFor({ timeout: 20000 });
  const row = await page.locator(top + ' .mn-tx').first().innerText();
  assert.match(row, /\+150\.25/); assert.match(row, /\$1\.51/); assert.match(row, /مكتمل/);
  const hist = await page.evaluate(async () => { NX.Sheet.closeAll(); await NX.Points.open(); await new Promise(r => setTimeout(r, 1500)); return document.querySelector('#sheet-root .sheet.in .pts-hist').innerText; });
  assert.match(hist, /\+150\.25/, 'the history line is exact');
});

test('5 · DevTools on the phone: changed numbers → «quote_changed», no Stripe page; a wallet, a transaction, a «webhook» written by the page → refused; the balance unchanged', async () => {
  const { page } = S.lina;
  const calls = STRIPE.calls.length;
  const r = await page.evaluate(async () => { try { await NX.Points.api('/topup', { anchor: 'usd', amount: '1', expect: { micro: 999999e6, cents: 100, priceMicro: 10000 } }); return 'passed'; } catch (e) { return e.code + ' ' + e.data.quote.tokens; } });
  assert.equal(r, 'quote_changed 100');
  assert.equal(STRIPE.calls.length, calls);
  const w1 = await page.evaluate(async uid => { const { F, db } = NX.Backend.fb; try { await F.setDoc(F.doc(db, 'wallets', uid), { points: 999999, micro: 999999e6 }, { merge: true }); return 'written'; } catch (e) { return e.code || e.message; } }, S.linaUid);
  assert.ok(denied(w1), w1);
  const w2 = await page.evaluate(async uid => { const { F, db } = NX.Backend.fb; try { await F.setDoc(F.doc(db, 'transactions', 'tx_mine'), { uid, type: 'topup', status: 'completed', micro: 1e12 }); return 'written'; } catch (e) { return e.code || e.message; } }, S.linaUid);
  assert.ok(denied(w2), w2);
  const hook = await page.evaluate(async () => (await fetch('/api/points/stripe', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=00' },
    body: JSON.stringify({ id: 'evt_x', type: 'checkout.session.completed', data: { object: { metadata: { kind: 'topup', tx: 'x', uid: 'x' }, payment_status: 'paid' } } }) })).status);
  assert.equal(hook, 400);
  /* the page claims a price and an amount of its own: Stripe still gets the server's */
  const t = await page.evaluate(() => NX.Points.api('/topup', { anchor: 'tokens', amount: '300', cents: 1, priceMicro: 1 }));
  assert.equal(STRIPE.calls.at(-1).params['line_items[0][price_data][unit_amount]'], '300');
  assert.equal((await fsGet('transactions/' + t.tx)).cents, 300);
  assert.equal((await wallet(S.linaUid)).micro, 200250000);
});

test('6 · Exact on the page too: +150.1 then +150.2 (a float makes 300.29999999999995) → the balance moves by exactly 300.3', async () => {
  const { page } = S.lina;
  for (const amount of ['150.1', '150.2']) {
    const r = await page.evaluate(a => NX.Points.api('/topup', { anchor: 'tokens', amount: a }), amount);
    assert.equal((await STRIPE.pay(r.url.split('/').pop())).status, 'completed');
  }
  const w = await wallet(S.linaUid);
  assert.deepEqual([w.micro, w.points], [500550000, 500.55]);
  await until(page, () => NX.Points.wallet && NX.Points.wallet.points === 500.55, null, 20000);
  assert.equal(await page.evaluate(() => document.getElementById('pts-val').textContent), '500.55');
});

/* ================================================================ withdrawal (a computer) */
test('7 · Withdrawal is off until the owner turns it on — in «⚙️ NEXUS economy» (the owner only); the calculator still shows the sums, the button says why', async () => {
  const { page } = S.omar = await newDevice(browser, site, logs);
  S.omarUid = await signUp(page, 'omar@test.io');
  await verify(S.omarUid, page);
  /* Omar sold projects: 1,200 of his 2,000 tokens are earned; a month old; born 1990 */
  await fsSet('wallets/' + S.omarUid, { micro: 2000 * M6, points: 2000, earnMicro: 1200 * M6, welcomed: true, createdAt: Date.now() - 30 * DAY });
  await fsSet('ages/' + S.omarUid, { y: 1990, m: 1, at: 1 });
  let f = await openMoney(page, 'withdraw');
  await f.tok.fill('100');
  assert.equal(await f.usd.inputValue(), '1.00');
  assert.equal(await f.go.isDisabled(), true);
  assert.match(await page.locator(top + ' .mn-off').innerText(), /غير مفعّل/);
  /* the owner's panel: Omar has none */
  assert.equal(await page.evaluate(() => NX.Market.isOwner()), false);
  const r = await page.evaluate(async () => { try { await NX.Market.api('/config', { values: { withdrawOn: 1 } }); return 'ok'; } catch (e) { return e.code; } });
  assert.equal(r, 'not_owner');
  const bp = S.bossPage;
  await bp.evaluate(() => NX.Market.openEconomy());
  await bp.locator(top + ' input[data-k="withdrawOn"]').fill('1');
  assert.equal(await bp.locator(top + ' input[data-k="tokenPriceMicro"]').inputValue(), '0.01');
  await bp.locator(top + ' .mk-eco-save').click();
  await until(bp, () => [...document.querySelectorAll('.toast')].some(t => /حُفظ/.test(t.textContent)), null, 20000);
  assert.equal((await fsGet('economy/config')).withdrawOn, 1);
  await new Promise(r => setTimeout(r, 31000));
  f = await openMoney(page, 'withdraw');
  assert.equal(await page.locator(top + ' .mn-off').count(), 0);
  assert.match(await page.locator(top + ' .mn-can').innerText(), /1,200/);
});

test('8 · Withdraw 1000.25 tokens → $10.00 (down to the cent): only earned tokens, confirmed, held at once (999.75 left); listed «pending»; cancelled → back', async () => {
  const { page } = S.omar;
  const f = await openMoney(page, 'withdraw');
  await f.tok.fill('1500');
  assert.match(await f.err.innerText(), /1,200/, 'more than earned'); assert.equal(await f.go.isDisabled(), true);
  await f.tok.fill('1000.25');
  assert.equal(await f.usd.inputValue(), '10.00');
  assert.match(await f.sum.innerText(), /\$10\.00/); assert.match(await f.sum.innerText(), /1,000\.25/);
  if (process.env.NEXUS_SHOTS) await page.locator(top + ' .mn-card').screenshot({ path: path.join(process.env.NEXUS_SHOTS, 'money-web-withdraw.png') });
  await page.locator(top + ' .mn-method').selectOption('paypal');
  await page.locator(top + ' .mn-payto').fill('omar@pay.example');
  await f.go.click();
  await page.locator('.modal-box.in', { hasText: '1,000.25' }).waitFor();
  await page.locator('.modal-box.in .btn.danger').click();
  await until(page, () => [...document.querySelectorAll('.toast')].some(t => /معلّق/.test(t.textContent)), null, 20000);
  let w = await wallet(S.omarUid);
  assert.deepEqual([w.micro, w.earnMicro], [999750000, 199750000]);
  const tx = (await (await fetch('http://127.0.0.1:8080/v1/projects/demo-nexus/databases/(default)/documents:runQuery', { method: 'POST', headers: { authorization: 'Bearer owner', 'content-type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'transactions' }], where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: { stringValue: S.omarUid } } } } }) })).json()).filter(x => x.document);
  assert.equal(tx.length, 1);
  const t = tx[0].document.fields;
  assert.deepEqual([t.type.stringValue, t.status.stringValue, t.micro.integerValue, t.cents.integerValue, t.payTo.stringValue], ['withdraw', 'pending', '1000250000', '1000', 'omar@pay.example']);
  S.wd1 = tx[0].document.name.split('/').pop();
  /* his own list — and cancel */
  await page.evaluate(() => NX.Money.transactions());
  await page.locator(top + ' .mn-tx.st-pending').waitFor();
  await page.locator(top + ' .mn-tx.st-pending .mn-cancel').click();
  await page.locator(top + ' .mn-tx.st-canceled').waitFor({ timeout: 20000 });
  w = await wallet(S.omarUid);
  assert.deepEqual([w.micro, w.earnMicro], [2000 * M6, 1200 * M6]);
});

test('9 · The owner\'s 🏦 queue: a new $11.34 request (dollars typed → 1,134 tokens) — «Paid» with the PayPal reference; Omar sees «paid»; another refused → his tokens back', async () => {
  const { page } = S.omar;
  let f = await openMoney(page, 'withdraw');
  await f.usd.fill('11.34');
  assert.equal(await f.tok.inputValue(), '1134');
  await page.locator(top + ' .mn-payto').fill('omar@pay.example');
  await f.go.click();
  await page.locator('.modal-box.in .btn.danger').click();
  await until(page, () => [...document.querySelectorAll('.toast')].some(t => /معلّق/.test(t.textContent)), null, 20000);
  const bp = S.bossPage;
  await bp.evaluate(() => { NX.Sheet.closeAll(); return NX.Money.queue(); });
  await bp.locator(top + ' .mn-tx').first().waitFor({ timeout: 20000 });
  const row = bp.locator(top + ' .mn-tx').first();
  assert.match(await row.innerText(), /omar@pay\.example/); assert.match(await row.innerText(), /\$11\.34/);
  await row.locator('.mn-paid').click();
  await bp.locator('.modal-box.in input').fill('PAYPAL-5521');
  await bp.locator('.modal-box.in .btn.primary').click();
  await bp.locator(top + ' .mn-qnone').waitFor({ timeout: 20000 });
  await page.evaluate(() => { NX.Sheet.closeAll(); return NX.Money.transactions(); });
  await page.locator(top + ' .mn-tx.st-paid').waitFor({ timeout: 20000 });
  assert.match(await page.locator(top + ' .mn-tx.st-paid').innerText(), /PAYPAL-5521/);
  let w = await wallet(S.omarUid);
  assert.equal(w.micro, 2000 * M6 - 1134 * M6);
  /* refused → back (another sale meanwhile: 800 earned) */
  await fsSet('wallets/' + S.omarUid, { earnMicro: 800 * M6 });
  f = await openMoney(page, 'withdraw');
  await f.usd.fill('5');
  await page.locator(top + ' .mn-payto').fill('omar@pay.example');
  await f.go.click();
  await page.locator('.modal-box.in .btn.danger').click();
  await until(page, () => [...document.querySelectorAll('.toast')].some(t => /معلّق/.test(t.textContent)), null, 20000);
  await bp.evaluate(() => { NX.Sheet.closeAll(); return NX.Money.queue(); });
  await bp.locator(top + ' .mn-tx .mn-reject').first().click();
  await bp.locator('.modal-box.in input').fill('IBAN missing');
  await bp.locator('.modal-box.in .btn.primary').click();
  await bp.locator(top + ' .mn-qnone').waitFor({ timeout: 20000 });
  w = await wallet(S.omarUid);
  assert.equal(w.micro, 866 * M6);
  const mine = await page.evaluate(() => NX.Points.api('/transactions'));
  assert.deepEqual(mine.transactions.map(x => x.status), ['rejected', 'paid', 'canceled']);
});

test('10 · Not for everyone: the phone account (no birth month) is told why and offered to add it; a stranger cannot open the owner\'s queue', async () => {
  const { page } = S.lina;
  await page.goto(site.base + '/index.html?emulators=1');
  await until(page, () => window.NX && NX.Backend && NX.Backend.isOnline && NX.Backend.isOnline() && NX.Backend.user && NX.Points, null, 90000);
  await openMoney(page, 'withdraw');
  const off = await page.locator(top + ' .mn-off').innerText();
  assert.ok(/18/.test(off) || /مؤكَّد/.test(off), off);
  const r = await page.evaluate(async () => { try { await NX.Points.api('/withdrawals'); return 'listed'; } catch (e) { return e.code; } });
  assert.equal(r, 'not_owner');
  assert.equal(await page.locator(top + ' .mn-queuebtn').count(), 0);
});

test('11 · English and Hindi: the calculator, the transactions, the queue — no Arabic; the sums the same', async () => {
  const ARABIC = /[؀-ۿ]/;
  for (const lang of ['en', 'hi']) {
    const { page } = S.omar;
    await page.evaluate(l => { NX.Sheet.closeAll(); return NX.setLanguage(l); }, lang);
    const f = await openMoney(page, 'withdraw');
    await f.tok.fill('600.5');
    assert.equal(await f.usd.inputValue(), '6.00');
    await page.waitForTimeout(600);
    const card = await page.locator(top + ' .mn-card').innerText();
    await page.evaluate(() => { NX.Sheet.closeAll(); return NX.Money.transactions(); });
    await page.locator(top + ' .mn-tx').first().waitFor();
    await page.waitForTimeout(600);
    const list = await page.locator(top + ' .mn-list').innerText();
    for (const [k, v] of Object.entries({ card, list })) assert.deepEqual(v.split('\n').filter(l => ARABIC.test(l)), [], lang + ' ' + k);
    await page.evaluate(() => NX.setLanguage('ar'));
  }
});

test('12 · No errors on any page', async () => {
  const bad = logs.filter(l => !/serviceWorker|service worker|ServiceWorker|ERR_INTERNET_DISCONNECTED|Failed to fetch|net::|status of 4\d\d/.test(l));
  assert.deepEqual(bad, []);
});

await run(tests, logs, async () => { await browser.close(); await site.close(); await W.close(); await STRIPE.close(); });
