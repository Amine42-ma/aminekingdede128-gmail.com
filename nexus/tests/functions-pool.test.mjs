/* ============================================================
   NEXUS tests · the Cloud Function «processRequest» (functions/index.js)
   with donated Claude keys. Firebase Admin is replaced by a small
   in-memory stand-in; the providers are the fake ones of mock-world.mjs.
   Run:  node nexus/tests/functions-pool.test.mjs
   ============================================================ */
import assert from 'node:assert/strict';
import Module from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startWorld } from './mock-world.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const W = await startWorld();
const KEYS = { a1: 'sk-ant-api03-DONATEDKEYONE000000000000001', a2: 'sk-ant-api03-DONATEDKEYTWO000000000000002' };

/* ---------------- Firebase Admin, in memory ---------------- */
const keys = new Map();          // doc id → data
const updates = [];
const doc = id => ({ id, get: f => (keys.get(id) || {})[f], data: () => keys.get(id), ref: { update: async p => { updates.push({ id, p }); Object.assign(keys.get(id), p); } } });
const query = (filters = []) => ({
  where: (f, op, v) => query(filters.concat([[f, op, v]])),
  limit: () => query(filters),
  get: async () => {
    const docs = Array.from(keys.keys()).filter(id => filters.every(([f, op, v]) => op === '==' ? keys.get(id)[f] === v : false)).map(doc);
    return { docs, size: docs.length, empty: !docs.length };
  }
});
const db = {
  collection: name => name === 'api_keys'
    ? Object.assign(query(), { doc: id => ({ update: async p => { updates.push({ id, p }); Object.assign(keys.get(id), p); } }) })
    : { doc: () => ({}) },
  runTransaction: async fn => fn({ get: async () => ({ data: () => ({}) }), set: () => {} })
};
const stubs = {
  'firebase-functions/v2/https': { onRequest: (opts, h) => h },
  'firebase-functions/logger': { info() {}, warn() {}, error() {} },
  'firebase-admin/app': { initializeApp() {} },
  'firebase-admin/firestore': { getFirestore: () => db, FieldValue: { serverTimestamp: () => 'now', increment: n => ({ increment: n }), delete: () => 'delete' }, Timestamp: { now: () => ({}), fromMillis: ms => ({ ms }) } },
  'firebase-admin/auth': { getAuth: () => ({ verifyIdToken: async () => ({ uid: 'player1', firebase: { sign_in_provider: 'google.com' } }) }) }
};
const load = Module._load;
Module._load = function (req, ...rest) { return stubs[req] || load.call(this, req, ...rest); };
Object.assign(process.env, { POOL_CACHE_MS: '0', ANTHROPIC_BASE: W.base + '/anthropic', GEMINI_BASE: W.base + '/gemini', GROQ_BASE: W.base + '/groq', OPENROUTER_BASE: W.base + '/openrouter' });
const { processRequest } = Module.createRequire(import.meta.url)(path.join(here, '..', 'functions', 'index.js'));

async function call(body) {
  const res = { code: 0, body: null, headers: {}, set(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; }, send() {} };
  await processRequest({ method: 'POST', get: h => ({ authorization: 'Bearer t' })[h.toLowerCase()], body, query: {} }, res);
  return res;
}

const tests = [];
const test = (n, f) => tests.push({ n, f });

test('a donated Claude key answers through the Messages API (model from Anthropic\'s own list)', async () => {
  keys.clear(); W.calls.length = 0; W.keys = {};
  keys.set('donor_0', { key: KEYS.a1, status: 'active', donorUid: 'donor', failCount: 0 });
  const r = await call({ messages: [{ role: 'system', content: 'Be brief.' }, { role: 'user', content: 'hi' }], provider: 'anthropic', max_tokens: 200, temperature: 0.4 });
  assert.equal(r.code, 200, JSON.stringify(r.body));
  assert.equal(r.body.provider, 'anthropic');
  assert.equal(r.body.model, 'claude-sonnet-test-1');
  assert.equal(r.body.text, 'single by anthropic:claude-sonnet-test-1');
  const c = W.calls[0];
  assert.equal(c.raw.system, 'Be brief.'); assert.deepEqual(c.raw.messages.map(m => m.role), ['user']);
  assert.ok(!('temperature' in c.raw)); assert.equal(c.key, KEYS.a1);
});

test('«credit balance is too low»: that key rests (disabled until reviveAt), the next donated key answers', async () => {
  keys.clear(); W.calls.length = 0; updates.length = 0;
  keys.set('d1_0', { key: KEYS.a1, status: 'active', donorUid: 'd1', failCount: 0 });
  keys.set('d2_0', { key: KEYS.a2, status: 'active', donorUid: 'd2', failCount: 0 });
  W.keys = { [KEYS.a1]: 'nocredit' };
  // processRequest takes the keys in a random order: call until the empty key has had its turn
  let r = null;
  for (let i = 0; i < 60 && !(r && r.code === 200 && W.calls.some(c => c.key === KEYS.a1)); i++) r = await call({ messages: [{ role: 'user', content: 'hi' }], provider: 'anthropic' });
  assert.ok(W.calls.some(c => c.key === KEYS.a1), 'the empty key was never tried');
  assert.equal(r.code, 200);
  const u = updates.find(x => x.id === 'd1_0');
  assert.ok(u && u.p.status === 'disabled' && u.p.disabledReason === 'rate-limit' && u.p.reviveAt, JSON.stringify(updates));
});

test('a key that only looks like Claude\'s is not taken for one', async () => {
  keys.clear(); W.calls.length = 0; W.keys = {};
  keys.set('x_0', { key: 'sk-ant-short', status: 'active', donorUid: 'x', failCount: 0 });
  const r = await call({ messages: [{ role: 'user', content: 'hi' }], provider: 'anthropic' });
  assert.equal(r.code, 503); assert.equal(W.calls.length, 0);
});

let pass = 0, failN = 0;
for (const t of tests) {
  try { await t.f(); pass++; console.log('✓ ' + t.n); }
  catch (e) { failN++; console.log('✗ ' + t.n + '\n    ' + String(e && e.stack || e).split('\n').slice(0, 4).join('\n    ')); }
}
await W.close();
console.log('\n' + pass + ' passed, ' + failN + ' failed');
process.exit(failN ? 1 : 0);
