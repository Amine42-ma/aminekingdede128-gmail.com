/* ============================================================
   NEXUS tests · 💳 top-up and withdrawal on the server (points.js, PART 43) —
   any amount, worked out again by the server (dollars ÷ price, tokens × price)
   in exact integers, Stripe Checkout for exactly that amount, the tokens only
   from Stripe's SIGNED webhook, withdrawals held and decided by the site's owner,
   every one a row of transactions/ — against the Firebase emulator's Firestore
   and a fake Stripe (mock-world.mjs).
   Needs:  firebase emulators:start --project demo-nexus --only auth,firestore,storage
   Run:    node nexus/tests/money-server.test.mjs
   ============================================================ */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { token, fakeStripe } from './mock-world.mjs';
import { importChallenges } from './e2e-server.mjs';
import { fsSet, fsGet, fsQuery, resetEmulators } from './e2e-kit.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let ENV = {}, version = 0;
globalThis.Netlify = { env: { get: k => ENV[k] } };
const DAY = 864e5, M6 = 1000000;
const S = await fakeStripe('whsec_money');

let H = {};
async function fresh(env = {}) {
  ENV = Object.assign({ FIREBASE_PROJECT_ID: 'demo-nexus', NEXUS_TEST_EMULATOR_TOKENS: '1', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', ADMIN_EMAILS: 'owner@example.com',
    STRIPE_SECRET_KEY: 'sk_test_money', STRIPE_WEBHOOK_SECRET: 'whsec_money', STRIPE_API_BASE: S.base }, env);
  await resetEmulators();
  const v = 'v=' + (++version);
  H.market = await importChallenges(v, 'market');
  H.points = (await import(pathToFileURL(path.join(ROOT, 'netlify/edge-functions/points.js')).href + '?' + v)).default;
  S.deliver = (raw, headers) => H.points(new Request('http://nexus.test/api/points/stripe', { method: 'POST', headers, body: raw }));
  S.calls.length = 0;
}
const call = (h, base) => async (p, { uid = null, body, method = 'POST', email, verified } = {}) => {
  const r = await h(new Request('http://nexus.test/api/' + base + p, { method, headers: Object.assign({ 'content-type': 'application/json' },
    uid ? { authorization: 'Bearer ' + token(uid, Object.assign(email ? { email } : {}, verified === false ? { verified: false } : {})) } : {}), body: body ? JSON.stringify(body) : undefined }));
  const j = await r.json(); return Object.assign(j, { status: r.status });
};
const M = (p, o) => call(H.market, 'market')(p, o), P = (p, o) => call(H.points, 'points')(p, o);
const OWNER = { uid: 'owner', email: 'owner@example.com' };
const owner = values => M('/config', Object.assign({ body: { values } }, OWNER));
const wal = async uid => (await fsGet('wallets/' + uid)) || {};
const txs = async uid => (await fsQuery('transactions', 'uid', uid)).map(d => Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [k, v.integerValue != null ? +v.integerValue : v.stringValue != null ? v.stringValue : v.doubleValue != null ? v.doubleValue : v.nullValue === null ? null : v])));
const ledgerOf = async uid => {
  const r = await fetch('http://127.0.0.1:8080/v1/projects/demo-nexus/databases/(default)/documents/wallets/' + uid + '/ledger?pageSize=300', { headers: { authorization: 'Bearer owner' } });
  return ((await r.json()).documents || []).map(d => Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [k, v.integerValue != null ? +v.integerValue : v.stringValue != null ? v.stringValue : v.doubleValue])));
};
/* the page's own sums are the same — the expected numbers it sends are the server's quote */
const q = async (uid, kind, anchor, amount) => (await P('/money/quote', { uid, body: { kind, anchor, amount } })).quote;
/* a seller with tokens they EARNED (a sale), a verified e-mail, 18+, an account a month old */
async function earner(uid, { micro = 2000 * M6, earn = 1200 * M6, born = { y: 1990, m: 1 } } = {}) {
  await fsSet('wallets/' + uid, { micro, points: micro / M6, earnMicro: earn, welcomed: true, createdAt: Date.now() - 30 * DAY, updatedAt: Date.now() });
  if (born) await fsSet('ages/' + uid, Object.assign({ at: 1 }, born));
}

const tests = [];
const test = (name, f) => tests.push({ name, f });

/* ================================================================ the price and the sums */
test('1 · ONE price: BASE_TOKEN_PRICE_USD (0.01 by default, a Netlify variable, or the owner inside NEXUS — nobody else); the quote both ways, exact, any amount, fractions too', async () => {
  await fresh();
  let c = await P('/config', { method: 'GET' });
  assert.deepEqual([c.money.price, c.money.priceMicro, c.money.topup.min, c.money.topup.max, c.money.withdraw.on], ['0.01', 10000, '1.00', '500.00', false]);
  /* dollars → tokens (÷) and tokens → dollars (×) */
  assert.deepEqual(await q('lina', 'topup', 'usd', '1.51'), { anchor: 'usd', micro: 151 * M6, cents: 151, tokens: '151', usd: '1.51', priceMicro: 10000, price: '0.01' });
  const t = await q('lina', 'topup', 'tokens', '150.25');
  assert.deepEqual([t.tokens, t.usd, t.cents], ['150.25', '1.51', 151], 'a top-up: the tokens typed, exact; the dollars rounded UP to the cent');
  const w = await q('lina', 'withdraw', 'tokens', '1000.25');
  assert.deepEqual([w.tokens, w.usd], ['1000.25', '10.00'], 'a withdrawal: the dollars rounded DOWN');
  assert.deepEqual([(await q('lina', 'topup', 'tokens', '0.5')).tokens, (await q('lina', 'topup', 'tokens', '0.25')).tokens], ['0.5', '0.25'], 'fractional tokens');
  assert.equal((await q('lina', 'topup', 'usd', '٠٫٥٠')).tokens, '50', 'Arabic digits and decimal mark');
  assert.equal((await P('/money/quote', { uid: 'lina', body: { kind: 'topup', anchor: 'usd', amount: '1.234' } })).error.code, 'amount_usd', 'no fraction of a cent');
  assert.equal((await P('/money/quote', { uid: 'lina', body: { kind: 'topup', anchor: 'tokens', amount: '0.0000001' } })).error.code, 'amount_tokens', 'at most 6 decimals');
  assert.equal((await P('/money/quote', { uid: 'lina', body: { kind: 'topup', anchor: 'usd', amount: '-5' } })).error.code, 'amount_usd');
  /* the variable */
  await fresh({ BASE_TOKEN_PRICE_USD: '0.003' });
  c = await P('/config', { method: 'GET' });
  assert.equal(c.money.price, '0.003');
  assert.equal((await q('lina', 'topup', 'usd', '1')).tokens, '333.333333', '$1 ÷ 0.003 = 333.333333… → down to the millionth');
  assert.equal((await q('lina', 'withdraw', 'usd', '1')).tokens, '333.333334', 'a withdrawal takes the tokens UP');
  /* the site's owner — and only them */
  assert.equal((await M('/config', { uid: 'lina', body: { values: { tokenPriceMicro: 1 } } })).error.code, 'not_owner');
  assert.equal((await owner({ tokenPriceMicro: 0 })).error.code, 'value');
  assert.equal((await owner({ tokenPriceMicro: 0.02, topupMinCents: 2, withdrawOn: 1 })).ok, true);
  c = await P('/config', { method: 'GET' });
  assert.deepEqual([c.money.price, c.money.priceMicro, c.money.topup.min, c.money.withdraw.on], ['0.02', 20000, '2.00', true]);
  assert.equal((await q('lina', 'topup', 'usd', '3')).tokens, '150');
  assert.equal((await M('/config', { method: 'GET' })).money.price, '0.02', 'the owner\'s panel reads it back');
});

/* ================================================================ top-up */
test('2 · Top-up of any amount: Stripe Checkout for exactly the server\'s cents (price_data, no pack); the tokens only after Stripe\'s signed webhook — once; the Transactions row', async () => {
  await fresh();
  const quote = await q('lina', 'topup', 'tokens', '150.25');
  const r = await P('/topup', { uid: 'lina', body: { anchor: 'tokens', amount: '150.25', expect: { micro: quote.micro, cents: quote.cents, priceMicro: quote.priceMicro } } });
  assert.equal(r.ok, true, JSON.stringify(r));
  const call0 = S.calls.at(-1);
  assert.equal(call0.auth, 'Bearer sk_test_money');
  assert.deepEqual([call0.params.mode, call0.params['line_items[0][price_data][unit_amount]'], call0.params['line_items[0][price_data][currency]'], call0.params['metadata[kind]'], call0.params['metadata[tx]']],
    ['payment', '151', 'usd', 'topup', r.tx]);
  let t = await fsGet('transactions/' + r.tx);
  assert.deepEqual([t.uid, t.type, t.status, t.micro, t.tokens, t.cents, t.usd, t.price, t.anchor, t.typed, t.currency], ['lina', 'topup', 'pending', 150250000, '150.25', 151, '1.51', '0.01', 'tokens', '150.25', 'USD']);
  assert.equal(((await wal('lina')).micro), 50 * M6, 'nothing yet — only the welcome gift');
  /* someone else's «webhook»: no signature, a wrong one → refused, nothing added */
  const sess = S.sessions.get(r.url.split('/').pop());
  sess.payment_status = 'paid';
  const forged = S.signed('checkout.session.completed', sess, { sign: 'whsec_wrong' });
  assert.equal((await H.points(new Request('http://nexus.test/api/points/stripe', { method: 'POST', headers: forged.headers, body: forged.raw }))).status, 400);
  assert.equal((await H.points(new Request('http://nexus.test/api/points/stripe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: forged.raw }))).status, 400);
  assert.equal(((await wal('lina')).micro), 50 * M6);
  /* paid → +150.25 exactly, once */
  const done = await S.pay(sess.id);
  assert.equal(done.status, 'completed', JSON.stringify(done));
  let w = await wal('lina');
  assert.deepEqual([w.micro, w.points, w.earnMicro], [200250000, 200.25, 0], 'bought tokens are not earned tokens');
  t = await fsGet('transactions/' + r.tx);
  assert.deepEqual([t.status, t.paymentIntent, t.stripeSession], ['completed', sess.payment_intent, sess.id]);
  /* the same event again, another event for the same payment, five at once → still once */
  assert.equal((await S.pay(sess.id)).duplicate, true);
  assert.equal((await S.pay(sess.id, 'checkout.session.async_payment_succeeded')).duplicate, true);
  await Promise.all([1, 2, 3, 4, 5].map(() => S.pay(sess.id)));
  w = await wal('lina');
  assert.equal(w.micro, 200250000);
  const led = (await ledgerOf('lina')).filter(x => x.reason === 'topup');
  assert.deepEqual(led.map(x => [x.micro, x.delta, x.tx]), [[150250000, 150.25, r.tx]]);
  /* the person's own list */
  const mine = await P('/transactions', { uid: 'lina', method: 'GET' });
  assert.deepEqual(mine.transactions.map(x => [x.type, x.status, x.tokens, x.usd]), [['topup', 'completed', '150.25', '1.51']]);
  assert.equal((await P('/transactions', { uid: 'omar', method: 'GET' })).transactions.length, 0);
});

test('3 · DevTools: the page\'s numbers changed, cents/tokens slipped into the request, out of the limits, not a number → refused or ignored; Stripe always charges the server\'s amount', async () => {
  await fresh();
  const bad = await P('/topup', { uid: 'lina', body: { anchor: 'usd', amount: '1', expect: { micro: 999999 * M6, cents: 100 } } });
  assert.equal(bad.status, 409); assert.equal(bad.error.code, 'quote_changed');
  assert.equal(bad.quote.tokens, '100', 'the right numbers come back');
  assert.equal(S.calls.length, 0, 'no Stripe page'); assert.equal((await txs('lina')).length, 0, 'no transaction');
  /* the amount the page claims, a price of its own, a balance: ignored — the server's quote is what Stripe gets */
  const r = await P('/topup', { uid: 'lina', body: { anchor: 'usd', amount: '1', cents: 1, micro: 999999 * M6, priceMicro: 1, points: 999999 } });
  assert.equal(r.ok, true);
  assert.equal(S.calls.at(-1).params['line_items[0][price_data][unit_amount]'], '100');
  assert.equal((await fsGet('transactions/' + r.tx)).micro, 100 * M6);
  for (const [amount, code] of [['0.49', 'amount_range'], ['500.01', 'amount_range'], ['abc', 'amount_usd'], ['1e3', 'amount_usd'], ['', 'amount_usd'], ['0', 'amount_range']])
    assert.equal((await P('/topup', { uid: 'lina', body: { anchor: 'usd', amount } })).error.code, code, amount);
  assert.equal((await P('/topup', { body: { anchor: 'usd', amount: '5' } })).status, 401, 'an account only');
  /* back from Stripe: to this site only (a page path), the wallet open */
  for (const [back, want] of [['/index.html?emulators=1', 'http://nexus.test/index.html?emulators=1#wallet'], ['//evil.example/x', 'http://nexus.test/#wallet'], ['https://evil.example', 'http://nexus.test/#wallet']]) {
    await P('/topup', { uid: 'lina', body: { anchor: 'usd', amount: '5', back } });
    assert.deepEqual([S.calls.at(-1).params.success_url, S.calls.at(-1).params.cancel_url], [want, want], back);
  }
  /* a signed event that does not match the transaction's amount → kept for review, no tokens */
  const r2 = await P('/topup', { uid: 'lina', body: { anchor: 'usd', amount: '2' } });
  const s2 = S.sessions.get(r2.url.split('/').pop());
  s2.amount_total = 1;
  assert.equal((await S.pay(s2.id)).status, 'review');
  assert.equal((await fsGet('transactions/' + r2.tx)).status, 'review');
  assert.equal((await wal('lina')).micro, 50 * M6);
  /* a page cannot write its wallet or a transaction (firestore.rules: server only) — the rules file says so */
  const rules = (await import('node:fs')).readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  assert.match(rules, /match \/transactions\/\{tx\} \{[\s\S]*?allow write: if false;/);
  /* no Stripe → no top-up (never tokens for nothing) */
  await fresh({ STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '' });
  assert.equal((await P('/topup', { uid: 'lina', body: { anchor: 'usd', amount: '5' } })).error.code, 'topup_stripe');
  assert.equal((await P('/config', { method: 'GET' })).money.topup.on, false);
});

test('4 · Exact: 150.1 + 150.2 tokens = 300.3 (a float says 300.29999999999995); at $0.003 three $1 top-ups = 999.999999 — integers of millionths, no drift', async () => {
  await fresh();
  for (const amount of ['150.1', '150.2']) {
    const r = await P('/topup', { uid: 'lina', body: { anchor: 'tokens', amount } });
    assert.equal(S.calls.at(-1).params['line_items[0][price_data][unit_amount]'], '151', '$1.501 / $1.502 → $1.51');
    await S.pay(r.url.split('/').pop());
  }
  assert.notEqual(150.1 + 150.2, 300.3);
  let w = await wal('lina');
  assert.deepEqual([w.micro, w.points], [350300000, 350.3]);
  await fresh({ BASE_TOKEN_PRICE_USD: '0.003' });
  for (let i = 0; i < 3; i++) { const r = await P('/topup', { uid: 'omar', body: { anchor: 'usd', amount: '1' } }); await S.pay(r.url.split('/').pop()); }
  w = await wal('omar');
  assert.deepEqual([w.micro, w.points], [50 * M6 + 999999999, 1049.999999]);
  const me = await P('/me', { uid: 'omar', method: 'GET' });
  assert.deepEqual([me.micro, me.points], [1049999999, 1049.999999]);
});

test('5 · Refunded or disputed at Stripe: the tokens go back out (half a refund → half) — never below zero, the rest noted on the transaction', async () => {
  await fresh();
  const r = await P('/topup', { uid: 'lina', body: { anchor: 'usd', amount: '10' } });
  const s = S.sessions.get(r.url.split('/').pop());
  await S.pay(s.id);
  assert.equal((await wal('lina')).micro, 1050 * M6);
  assert.equal((await S.send('charge.refunded', { id: 'ch_1', object: 'charge', payment_intent: s.payment_intent, amount: 1000, amount_refunded: 500 })).status, 'reversed');
  assert.equal((await wal('lina')).micro, 550 * M6);
  assert.equal((await S.send('charge.refunded', { id: 'ch_1', object: 'charge', payment_intent: s.payment_intent, amount: 1000, amount_refunded: 500 })).duplicate, true, 'the same refund twice → once');
  /* spent meanwhile: a dispute takes what is there */
  await fsSet('wallets/lina', { micro: 100 * M6, points: 100 });
  await S.send('charge.dispute.created', { id: 'dp_1', object: 'dispute', payment_intent: s.payment_intent, amount: 1000 });
  const w = await wal('lina'), t = await fsGet('transactions/' + r.tx);
  assert.equal(w.micro, 0);
  assert.deepEqual([t.status, t.reversedMicro, t.shortMicro], ['disputed', 1000 * M6, 400 * M6]);
  assert.equal((await S.send('charge.refunded', { id: 'ch_2', object: 'charge', payment_intent: 'pi_unknown', amount_refunded: 100 })).ignored, 'unknown');
});

test('6 · An abandoned or failed payment: expired / failed → the transaction closes, no tokens; a later «paid» for it does nothing', async () => {
  await fresh();
  const r = await P('/topup', { uid: 'lina', body: { anchor: 'usd', amount: '3' } });
  const s = S.sessions.get(r.url.split('/').pop());
  await S.send('checkout.session.expired', s);
  assert.equal((await fsGet('transactions/' + r.tx)).status, 'expired');
  assert.equal((await S.pay(s.id)).duplicate, true);
  assert.equal((await wal('lina')).micro, 50 * M6);
  /* a delayed method: «completed» while unpaid waits for its own event */
  const r2 = await P('/topup', { uid: 'lina', body: { anchor: 'usd', amount: '4' } });
  const s2 = S.sessions.get(r2.url.split('/').pop());
  assert.equal((await S.send('checkout.session.completed', s2)).status, 'waiting');
  assert.equal((await S.pay(s2.id, 'checkout.session.async_payment_succeeded')).status, 'completed');
  assert.equal((await wal('lina')).micro, 450 * M6);
});

/* ================================================================ withdrawal */
test('7 · Withdrawal: off until the owner turns it on; then verified e-mail, 18+, an account old enough — each refused with its reason', async () => {
  await fresh();
  await earner('lina');
  const body = { anchor: 'usd', amount: '10', method: 'paypal', payTo: 'lina@pay.example' };
  assert.equal((await P('/withdraw', { uid: 'lina', body })).error.code, 'withdraw_off');
  await owner({ withdrawOn: 1 });
  assert.equal((await P('/withdraw', { uid: 'lina', body, verified: false })).error.code, 'withdraw_verify');
  await earner('kid', { born: { y: new Date().getUTCFullYear() - 15, m: 1 } });
  assert.equal((await P('/withdraw', { uid: 'kid', body })).error.code, 'withdraw_age');
  await earner('nobirth', { born: null });
  assert.equal((await P('/withdraw', { uid: 'nobirth', body })).error.code, 'withdraw_age');
  await earner('newbie');
  await fsSet('wallets/newbie', { createdAt: Date.now() - DAY });
  assert.equal((await P('/withdraw', { uid: 'newbie', body })).error.code, 'withdraw_new');
  assert.equal((await P('/withdraw', { uid: 'lina', body: Object.assign({}, body, { payTo: '' }) })).error.code, 'withdraw_to');
  assert.equal((await P('/withdraw', { uid: 'lina', body: Object.assign({}, body, { amount: '4.99' }) })).error.code, 'amount_range');
  const me = await P('/me', { uid: 'lina', method: 'GET' });
  assert.deepEqual([me.money.withdraw.on, me.withdrawable, me.adult, me.verified], [true, 1200 * M6, true, true]);
});

test('8 · Only EARNED tokens leave (a sale, Play Rewards, prizes — not the welcome gift, ads, nor tokens bought); held at once; the owner pays (reference) or refuses (back); the person may cancel', async () => {
  await fresh();
  await owner({ withdrawOn: 1 });
  await earner('lina');                                                     // 2000 tokens, 1200 of them earned
  const ask = (amount, anchor = 'tokens') => P('/withdraw', { uid: 'lina', body: { anchor, amount, method: 'paypal', payTo: 'lina@pay.example' } });
  const more = await ask('1500');
  assert.equal(more.error.code, 'withdraw_more'); assert.equal(more.withdrawable, '1200');
  /* 1000.25 tokens → $10.00 (down to the cent); the tokens typed leave exactly */
  const a = await ask('1000.25');
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.deepEqual([a.quote.usd, a.quote.tokens], ['10.00', '1000.25']);
  let w = await wal('lina');
  assert.deepEqual([w.micro, w.earnMicro], [999750000, 199750000]);
  let t = await fsGet('transactions/' + a.tx);
  assert.deepEqual([t.type, t.status, t.queue, t.method, t.payTo, t.cents], ['withdraw', 'pending', 'withdraw', 'paypal', 'lina@pay.example', 1000]);
  /* the owner's queue — the owner only */
  assert.equal((await P('/withdrawals', { uid: 'omar', method: 'GET' })).error.code, 'not_owner');
  const queue = await P('/withdrawals', Object.assign({ method: 'GET' }, OWNER));
  assert.deepEqual(queue.withdrawals.map(x => [x.id, x.uid, x.usd, x.payTo]), [[a.tx, 'lina', '10.00', 'lina@pay.example']]);
  assert.equal((await P('/withdraw/decide', { uid: 'omar', body: { tx: a.tx, action: 'paid' } })).error.code, 'not_owner');
  assert.equal((await P('/withdraw/decide', Object.assign({ body: { tx: a.tx, action: 'paid', ref: 'PAYPAL-7781' } }, OWNER))).status, 200);
  t = await fsGet('transactions/' + a.tx);
  assert.deepEqual([t.status, t.ref, t.queue], ['paid', 'PAYPAL-7781', null]);
  assert.equal((await wal('lina')).micro, 999750000, 'paid: nothing moves again');
  assert.equal((await P('/withdraw/decide', Object.assign({ body: { tx: a.tx, action: 'reject' } }, OWNER))).error.code, 'tx_closed', 'a paid one is not refunded');
  /* refused → back, and earned again (another sale meanwhile: 900 earned) */
  await fsSet('wallets/lina', { earnMicro: 900 * M6 });
  const b = await ask('5', 'usd');
  assert.equal(b.quote.tokens, '500');
  assert.equal((await ask('5', 'usd')).error.code, 'withdraw_more', 'only 400 earned left');
  await P('/withdraw/decide', Object.assign({ body: { tx: b.tx, action: 'reject', why: 'details missing' } }, OWNER));
  w = await wal('lina');
  assert.deepEqual([w.micro, w.earnMicro], [999750000, 900 * M6]);
  assert.equal((await fsGet('transactions/' + b.tx)).status, 'rejected');
  /* cancelled by the person while it waits — someone else cannot */
  const c = await ask('6', 'usd');
  assert.equal((await P('/withdraw/cancel', { uid: 'omar', body: { tx: c.tx } })).error.code, 'tx_none');
  assert.equal((await P('/withdraw/cancel', { uid: 'lina', body: { tx: c.tx } })).ok, true);
  assert.equal((await P('/withdraw/cancel', { uid: 'lina', body: { tx: c.tx } })).error.code, 'tx_closed');
  assert.equal((await wal('lina')).micro, 999750000);
  const mine = await P('/transactions', { uid: 'lina', method: 'GET' });
  assert.deepEqual(mine.transactions.map(x => x.status).sort(), ['canceled', 'paid', 'rejected']);
  assert.match(mine.transactions[0].payTo, /^li•••ple$/, 'masked in the list');
});

test('9 · Earned, worked out for a wallet from before (its ledger: sales, Play Rewards, prizes — not ads or the gift); spending takes the rest first', async () => {
  await fresh();
  await owner({ withdrawOn: 1 });
  await fsSet('wallets/old', { points: 900, welcomed: true, createdAt: Date.now() - 60 * DAY, updatedAt: 1 });
  await fsSet('ages/old', { y: 1980, m: 5, at: 1 });
  for (const [id, delta, reason] of [['1', 50, 'welcome'], ['2', 300, 'market_sale'], ['3', 200, 'play'], ['4', 100, 'challenge'], ['5', 250, 'ad']])
    await fsSet('wallets/old/ledger/' + id, { delta, reason, at: +id });
  assert.equal((await P('/me', { uid: 'old', method: 'GET' })).withdrawable, 600 * M6);
  /* spend 10 (an AI pack): it comes out of the 300 not earned */
  const r = await P('/ai/buy', { uid: 'old', body: {} });
  assert.equal(r.ok, true);
  let w = await wal('old');
  assert.deepEqual([w.micro, w.earnMicro], [890 * M6, 600 * M6], 'the 10 came from the 300 not earned');
  const big = await P('/withdraw', { uid: 'old', body: { anchor: 'tokens', amount: '600', method: 'bank', payTo: 'DE00 1234 5678' } });
  assert.equal(big.ok, true, JSON.stringify(big));
  w = await wal('old');
  assert.deepEqual([w.micro, w.earnMicro], [290 * M6, 0]);
});

test('10 · At once: five withdrawals of 500 against 1200 earned → two pass, never below zero; the marketplace keeps working on exact balances (a sale is earned)', async () => {
  await fresh();
  await owner({ withdrawOn: 1 });
  await earner('lina', { micro: 1200 * M6, earn: 1200 * M6 });
  const res = await Promise.all([1, 2, 3, 4, 5].map(() => P('/withdraw', { uid: 'lina', body: { anchor: 'tokens', amount: '500', method: 'paypal', payTo: 'lina@pay.example' } })));
  assert.equal(res.filter(x => x.ok).length, 2, JSON.stringify(res.map(x => x.ok || x.error.code)));
  const w = await wal('lina');
  assert.deepEqual([w.micro, w.earnMicro], [200 * M6, 200 * M6]);
  assert.equal((await txs('lina')).filter(t => t.type === 'withdraw').length, 2);
  /* a project sale on exact balances: the buyer has 150.5, the seller earns the price */
  await fsSet('projects/proj_x', { projectId: 'proj_x', ownerId: 'lina', name: 'X', scene: { objects: [] }, files: [], createdAt: 1, updatedAt: 1 });
  await fsSet('games/game_x', { gameId: 'game_x', projectId: 'proj_x', ownerId: 'lina', creatorName: 'Lina', title: 'X', visibility: 'public', createdAt: 1, updatedAt: 1 });
  assert.equal((await M('/list', { uid: 'lina', body: { gameId: 'game_x', price: 100 } })).ok, true);
  await fsSet('wallets/omar', { micro: 150500000, points: 150.5, welcomed: true, createdAt: Date.now() - DAY, updatedAt: 1 });
  const buy = await M('/buy', { uid: 'omar', body: { gameId: 'game_x', transactionId: 'tx_buy_000001', expectedPrice: 100 } });
  assert.equal(buy.ok, true, JSON.stringify(buy));
  assert.equal(buy.points, 50.5);
  const [b, s] = [await wal('omar'), await wal('lina')];
  assert.deepEqual([b.micro, b.points, s.micro, s.earnMicro], [50500000, 50.5, 300 * M6, 300 * M6]);
});

let pass = 0, failN = 0;
for (const t of tests) {
  const t0 = Date.now();
  try { await t.f(); pass++; console.log('✓ ' + t.name + '  (' + ((Date.now() - t0) / 1000).toFixed(1) + 's)'); }
  catch (e) { failN++; console.log('✗ ' + t.name + '\n    ' + String(e && e.stack || e).split('\n').slice(0, 6).join('\n    ')); }
}
console.log('\n' + pass + ' passed, ' + failN + ' failed');
await S.close();
process.exit(failN ? 1 : 0);
