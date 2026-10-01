/* ============================================================
   NEXUS tests · the Multi-AI Council on the server (netlify/edge-functions/ai.js)
   Run:  node nexus/tests/council-server.test.mjs
   The function runs here as it runs on Netlify (a module whose default
   export answers a Request), against the fake world of mock-world.mjs.
   ============================================================ */
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { startWorld, fsInt, fsStr, token, readSSE } from './mock-world.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const AI = pathToFileURL(path.join(here, '..', 'netlify', 'edge-functions', 'ai.js')).href;
const W = await startWorld();
const KEYS = { gem1: 'AIzaGEMINI_TEST_KEY_000000000000000001', gem2: 'AIzaGEMINI_TEST_KEY_000000000000000002',
  groq1: 'gsk_GROQTESTKEY0000000000000001', groq2: 'gsk_GROQTESTKEY0000000000000002', groq3: 'gsk_GROQTESTKEY0000000000000003',
  or1: 'sk-or-v1-OPENROUTERTESTKEY000000001', ant1: 'sk-ant-api03-ANTHROPICTESTKEY0000000001' };
let ENV = {}, version = 0;
globalThis.Netlify = { env: { get: k => ENV[k] } };
const baseEnv = () => ({
  FIREBASE_PROJECT_ID: 'demo-nexus', NEXUS_TEST_EMULATOR_TOKENS: '1', FIRESTORE_EMULATOR_HOST: '127.0.0.1:' + W.port, AI_PER_MINUTE: '500',
  GEMINI_BASE: W.base + '/gemini', GROQ_BASE: W.base + '/groq', OPENROUTER_BASE: W.base + '/openrouter', ANTHROPIC_BASE: W.base + '/anthropic',
  GEMINI_KEYS: KEYS.gem1, GROQ_KEYS: KEYS.groq1, OPENROUTER_KEYS: KEYS.or1
});
/* a fresh copy of the function (its caches and resting keys start empty), with this environment */
async function fn(env = {}) {
  ENV = Object.assign(baseEnv(), env);
  W.calls.length = 0; W.maxActive = 0; W.keys = {}; W.models = {}; W.delay = {}; W.reply = null; W.docs.clear();
  W.docs.set('wallets/pro1', { fields: { proUntil: fsInt(Date.now() + 864e5) }, updateTime: 't0' });
  W.docs.set('wallets/pro2', { fields: { proUntil: fsInt(Date.now() + 864e5) }, updateTime: 't0' });
  W.docs.set('wallets/free1', { fields: { points: fsInt(50) }, updateTime: 't0' });
  return (await import(AI + '?v=' + (++version))).default;
}
const ask = (h, p, { uid = 'free1', method = 'POST', body } = {}) => h(new Request('http://nexus.test/api/ai' + p, {
  method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token(uid) }, body: body ? JSON.stringify(body) : undefined }));
const used = uid => { const d = W.docs.get('usage/' + uid); return d ? +d.fields.used.integerValue : 0; };
const ev = (list, name) => list.filter(e => e.event === name).map(e => e.data);
/* the most provider calls of this test that were open at the same moment */
const overlap = calls => { const pts = calls.flatMap(c => [[c.t0, 1], [c.t1 || Infinity, -1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); let n = 0, max = 0; pts.forEach(([, d]) => { n += d; max = Math.max(max, n); }); return max; };
const final = list => ev(list, 'final')[0];
const MSG = [{ role: 'user', content: 'أنشئ مدينة كاملة في لعبتي' }];
const SYS = 'You are the NEXUS assistant. Answer with a JSON plan.';
const M = {
  lead: { role: 'lead', title: 'Coder', lead: true, model: 'auto' },
  planner: { role: 'planner', title: 'Planner', model: 'auto' },
  assets: { role: 'assets', title: 'Assets', model: 'auto' },
  reviewer: { role: 'reviewer', title: 'Reviewer', model: 'auto', after: ['lead', 'planner'] }
};
const four = () => [M.lead, M.planner, M.assets, M.reviewer].map(m => Object.assign({}, m));
const council = (h, uid, members, extra = {}) => ask(h, '/council', { uid, body: Object.assign({ mode: 'full', kind: 'game', system: SYS, messages: MSG, members }, extra) });

const tests = [];
const test = (name, f) => tests.push({ name, f });

/* ---------------------------------------------------------------- what an account may use */
test('config: free = 1 model, Pro = 4, limits come from the server', async () => {
  const h = await fn({ COUNCIL_MAX_PARALLEL: '3', COUNCIL_MAX_SYNTHESIS_TOKENS: '2000' });
  const f = await (await ask(h, '/council/config', { method: 'GET', uid: 'free1' })).json();
  assert.equal(f.pro, false); assert.equal(f.maxModels, 1); assert.equal(f.verified, true); assert.equal(f.enabled, true);
  const p = await (await ask(h, '/council/config', { method: 'GET', uid: 'pro1' })).json();
  assert.equal(p.pro, true); assert.equal(p.maxModels, 4);
  assert.equal(p.limits.maxParallelRequests, 3); assert.equal(p.limits.maxSynthesisTokens, 2000); assert.equal(p.limits.maxModelsPerRequest, 4);
});

test('Free + Single AI: one model, counted once — no synthesis', async () => {
  const h = await fn();
  const r = await council(h, 'free1', [Object.assign({}, M.lead)], { mode: 'single' });
  assert.equal(r.status, 200);
  const list = await readSSE(r), plan = ev(list, 'plan')[0], fin = final(list);
  assert.equal(plan.allowed, 1); assert.equal(plan.pro, false); assert.equal(plan.reduced, null); assert.equal(plan.members.length, 1);
  assert.equal(W.calls.length, 1, 'one provider call');
  assert.ok(!W.calls.some(c => /REVIEW & SYNTHESIS/.test(c.system)));
  assert.match(fin.text, /^Coder by gemini:/);
  assert.equal(used('free1'), 1, 'counted once');
});

for (const n of [2, 4]) test('Free asks for ' + n + ' models (a page changed in DevTools / a forged request): refused by the server, nothing runs, nothing counted', async () => {
  const h = await fn();
  const r = await council(h, 'free1', four().slice(0, n), { mode: 'full' });
  assert.equal(r.status, 403);
  const e = (await r.json()).error;
  assert.equal(e.code, 'pro_required'); assert.match(e.message, /NEXUS Pro/);
  assert.equal(W.calls.length, 0, 'no provider was called'); assert.equal(used('free1'), 0, 'nothing counted');
  /* own-key members beside it («members» phase) are the same request for more models */
  const r2 = await ask(h, '/council', { uid: 'free1', body: { phase: 'members', mode: 'full', system: SYS, messages: MSG, members: [Object.assign({}, M.lead)], external: 1 } });
  assert.equal(r2.status, 403); assert.equal(W.calls.length, 0);
});

test('Pro + Single AI: the mode is honoured — one model even when several are sent', async () => {
  const h = await fn();
  const one = await readSSE(await council(h, 'pro1', [Object.assign({}, M.lead)], { mode: 'single' }));
  assert.equal(ev(one, 'plan')[0].members.length, 1); assert.equal(ev(one, 'plan')[0].pro, true);
  assert.equal(W.calls.length, 1); assert.ok(!W.calls.some(c => /REVIEW & SYNTHESIS/.test(c.system)));
  W.calls.length = 0;
  const four1 = await readSSE(await council(h, 'pro1', four(), { mode: 'single' }));
  assert.equal(ev(four1, 'plan')[0].members.length, 1); assert.equal(ev(four1, 'plan')[0].reduced, 'limit'); assert.equal(W.calls.length, 1);
});

test('Pro raises maxModels from the browser (8 members sent): the server runs its own maximum', async () => {
  let h = await fn();
  const eight = four().concat(four().map(m => Object.assign({}, m, { role: m.role + '2', lead: false })));
  let list = await readSSE(await council(h, 'pro1', eight));
  assert.equal(ev(list, 'plan')[0].members.length, 4); assert.equal(ev(list, 'plan')[0].reduced, 'limit');
  assert.equal(W.calls.filter(c => !/REVIEW & SYNTHESIS/.test(c.system)).length, 4, 'four members, never eight');
  h = await fn({ COUNCIL_MAX_MODELS: '2' });
  list = await readSSE(await council(h, 'pro1', eight));
  assert.equal(ev(list, 'plan')[0].members.length, 2, 'the owner\'s COUNCIL_MAX_MODELS');
  const cfg = await (await ask(h, '/council/config', { method: 'GET', uid: 'pro1' })).json();
  assert.equal(cfg.maxModels, 2);
});

test('Smart Council\'s points and thresholds come from the server (COUNCIL_SMART_*)', async () => {
  let h = await fn();
  let c = await (await ask(h, '/council/config', { method: 'GET', uid: 'pro1' })).json();
  assert.deepEqual(c.smart.thresholds, [2, 4, 6]); assert.equal(c.smart.weights.wholeGame, 4); assert.deepEqual(c.modes, ['single', 'smart', 'full']);
  h = await fn({ COUNCIL_SMART_THRESHOLDS: '3, 5, 8', COUNCIL_SMART_WEIGHTS: 'wholeGame=6, assets=2, bogus=9, code=x' });
  c = await (await ask(h, '/council/config', { method: 'GET', uid: 'pro1' })).json();
  assert.deepEqual(c.smart.thresholds, [3, 5, 8]); assert.equal(c.smart.weights.wholeGame, 6); assert.equal(c.smart.weights.assets, 2);
  assert.ok(!('bogus' in c.smart.weights)); assert.equal(c.smart.weights.code, 1, 'a value that is not a number is ignored');
  h = await fn({ COUNCIL_SMART_THRESHOLDS: '9,2,1' });
  c = await (await ask(h, '/council/config', { method: 'GET', uid: 'free1' })).json();
  assert.deepEqual(c.smart.thresholds, [2, 4, 6], 'thresholds out of order fall back to the defaults');
  assert.deepEqual(c.modes, ['single'], 'a free account is offered Single AI');
});

for (const n of [2, 3, 4]) test('Pro + ' + n + ' models: ' + n + ' members on different providers, then one synthesis', async () => {
  const h = await fn({ ANTHROPIC_KEYS: KEYS.ant1, ANTHROPIC_AUTO: '1' });
  const members = four().slice(0, n);
  if (n === 2) members[1] = Object.assign({}, M.planner);
  const r = await council(h, 'pro1', members);
  const list = await readSSE(r), plan = ev(list, 'plan')[0], fin = final(list);
  assert.equal(plan.allowed, 4); assert.equal(plan.members.length, n); assert.equal(plan.reduced, null);
  const memberCalls = W.calls.filter(c => !/REVIEW & SYNTHESIS/.test(c.system)), synth = W.calls.filter(c => /REVIEW & SYNTHESIS/.test(c.system));
  assert.equal(memberCalls.length, n); assert.equal(synth.length, 1);
  assert.equal(new Set(memberCalls.map(c => c.provider)).size, n, 'each member on its own provider');
  assert.match(fin.text, /^FINAL by /);
  members.forEach(m => assert.ok(fin.text.includes(m.title), 'the synthesis saw ' + m.title));
  assert.equal(fin.members.length, n); assert.ok(fin.members.every(m => m.state === 'done' && m.text));
  assert.equal(used('pro1'), n + 1, 'every model call counted, nothing more');
  assert.equal(+W.docs.get('usage/pro1').fields.councilUntil.integerValue, 0, 'the council lock is released');
});

test('Pro + 4: the reviewer starts after the lead and the planner, and reviews their drafts', async () => {
  const h = await fn({ ANTHROPIC_KEYS: KEYS.ant1, ANTHROPIC_AUTO: '1' });
  W.delay = { gemini: 120, groq: 60 };
  const list = await readSSE(await council(h, 'pro1', four()));
  const byRole = t => W.calls.find(c => new RegExp('YOUR ROLE: ' + t).test(c.system));
  const lead = byRole('Coder'), planner = byRole('Planner'), reviewer = byRole('Reviewer');
  assert.ok(reviewer.t0 >= lead.t1 && reviewer.t0 >= planner.t1, 'reviewer waited');
  assert.match(reviewer.system, /CONTRIBUTIONS TO REVIEW:[\s\S]*Coder by[\s\S]*Planner by/);
  assert.ok(final(list).text.includes('Reviewer'));
});

/* ---------------------------------------------------------------- failures */
test('Provider failure (500): the member moves to another provider, the council goes on', async () => {
  const h = await fn();
  W.keys[KEYS.groq1] = '500';
  const list = await readSSE(await council(h, 'pro1', [M.lead, M.planner].map(m => Object.assign({}, m))));
  const retry = ev(list, 'member').find(e => e.state === 'retrying');
  assert.ok(retry && /HTTP 500/.test(retry.note), 'said why it retried');
  const fin = final(list);
  assert.ok(fin.members.every(m => m.state === 'done'));
  assert.match(fin.text, /^FINAL by /);
});

test('API 429: the next key of the same provider answers; the limited key rests', async () => {
  const h = await fn({ GROQ_KEYS: KEYS.groq1 + ',' + KEYS.groq2, GEMINI_KEYS: '', OPENROUTER_KEYS: '' });
  W.keys[KEYS.groq1] = '429';
  /* the keys take turns (round-robin): councils until the limited key's turn comes */
  for (let i = 0; i < 3 && !W.calls.some(c => c.status === 429); i++) {
    const fin = final(await readSSE(await council(h, 'pro1', [Object.assign({}, M.lead)])));
    assert.match(fin.text, /^Coder by groq:/, 'answered every time');
  }
  const i429 = W.calls.findIndex(c => c.status === 429);
  assert.ok(i429 >= 0);
  assert.equal(W.calls[i429 + 1].key, KEYS.groq2, 'the same member went on with the next key');
  assert.equal(W.calls[i429 + 1].status, 200);
  const seen = W.calls.length;
  for (let i = 0; i < 2; i++) assert.ok(final(await readSSE(await council(h, 'pro1', [Object.assign({}, M.lead)]))));
  assert.ok(!W.calls.slice(seen).some(c => c.key === KEYS.groq1), 'the rate-limited key was not asked again while it rests');
});

test('API timeout: a provider that does not answer is left after COUNCIL_MEMBER_TIMEOUT_MS', async () => {
  const h = await fn({ COUNCIL_MEMBER_TIMEOUT_MS: '3000' });
  W.keys[KEYS.gem1] = 'timeout';
  const t = Date.now();
  const list = await readSSE(await council(h, 'pro1', [Object.assign({}, M.lead)]));
  const fin = final(list);
  assert.ok(Date.now() - t >= 2900 && Date.now() - t < 15000, 'waited about the timeout');
  assert.match(fin.text, /^Coder by (groq|openrouter):/);
  assert.ok(ev(list, 'member').some(e => e.state === 'retrying' && /timeout/.test(e.note)));
});

test('Model unavailable: a model the provider no longer has → another model; an unknown model → «auto»', async () => {
  const h = await fn();
  W.models['groq|qwen/qwen3-32b'] = 'gone';
  const list = await readSSE(await council(h, 'pro1', [Object.assign({}, M.lead, { model: 'qwen/qwen3-32b' }), Object.assign({}, M.planner, { model: 'made-up-model-9' })]));
  const plan = ev(list, 'plan')[0];
  assert.match(plan.members[1].note || '', /made-up-model-9/);
  assert.notEqual(plan.members[1].model, 'made-up-model-9');
  const retry = ev(list, 'member').find(e => e.id === 'm1' && e.state === 'retrying');
  assert.match(retry.note, /غير متاح/);
  const fin = final(list);
  assert.equal(fin.members[0].state, 'done'); assert.notEqual(fin.members[0].model, 'qwen/qwen3-32b');
});

test('Synthesis fails on its first model → another available model merges', async () => {
  const h = await fn();
  /* the synthesis on Gemini answers nothing → «ردّ فارغ» → the next model merges */
  W.reply = c => /REVIEW & SYNTHESIS/.test(c.system) && c.provider === 'gemini' ? '' : W.defaultReply(c);
  const members = [M.lead, M.planner].map(m => Object.assign({}, m));
  const list = await readSSE(await council(h, 'pro1', members, { synthesis: { model: 'gemini-3.6-flash' } }));
  const s = ev(list, 'synthesis');
  assert.ok(s.some(e => e.state === 'fallback'), 'fell back');
  assert.match(final(list).text, /^FINAL by (groq|openrouter):/);
});

test('Every synthesis model fails → the lead draft is the final answer (marked degraded)', async () => {
  const h = await fn();
  W.reply = c => /REVIEW & SYNTHESIS/.test(c.system) ? '' : W.defaultReply(c);
  const list = await readSSE(await council(h, 'pro1', [M.lead, M.planner].map(m => Object.assign({}, m))));
  const fin = final(list);
  assert.equal(fin.degraded, true); assert.match(fin.text, /^Coder by /);
  assert.ok(ev(list, 'synthesis').some(e => e.state === 'failed'));
});

test('One member fails, the others continue: Claude ✓ Gemini ✓ OpenRouter ✗ — final from the rest, its call given back', async () => {
  const h = await fn({ ANTHROPIC_KEYS: KEYS.ant1, COUNCIL_MAX_RETRIES: '0' });
  W.keys[KEYS.or1] = '500';
  const members = [Object.assign({}, M.lead, { model: 'claude-sonnet-test-1' }), Object.assign({}, M.planner, { model: 'gemini-3.6-flash' }), Object.assign({}, M.assets, { model: 'deepseek/deepseek-chat-v3:free' })];
  const list = await readSSE(await council(h, 'pro1', members));
  const fin = final(list);
  assert.deepEqual(fin.members.map(m => m.state), ['done', 'done', 'failed']);
  assert.match(fin.text, /^FINAL by /); assert.ok(!fin.text.includes('Assets'));
  assert.equal(used('pro1'), 3, 'two members + synthesis counted; the failed call was given back');
  assert.equal(ev(list, 'done')[0].refunded, 1);
});

test('Every member fails → an error, and every reserved call is given back', async () => {
  const h = await fn({ COUNCIL_MAX_RETRIES: '1' });
  W.keys = { [KEYS.gem1]: '500', [KEYS.groq1]: '500', [KEYS.or1]: '500' };
  const list = await readSSE(await council(h, 'pro1', [M.lead, M.planner].map(m => Object.assign({}, m))));
  assert.ok(ev(list, 'error')[0]); assert.equal(ev(list, 'error')[0].code, 'council_failed');
  assert.equal(used('pro1'), 0);
});

/* ---------------------------------------------------------------- the key pool */
test('One donated key: every member uses it — one call at a time, never in parallel', async () => {
  const h = await fn({ GEMINI_KEYS: '', GROQ_KEYS: '', OPENROUTER_KEYS: '' });
  W.docs.set('api_keys/donor1_0', { fields: { key: fsStr(KEYS.gem2), status: fsStr('active'), donorUid: fsStr('donor1') }, updateTime: 't0' });
  W.delay = { gemini: 80 };
  const list = await readSSE(await council(h, 'pro1', four().slice(0, 3)));
  const fin = final(list);
  assert.ok(fin.members.every(m => m.state === 'done'), JSON.stringify(fin.members.map(m => m.error)));
  const calls = W.calls.slice().sort((a, b) => a.t0 - b.t0);
  assert.ok(calls.every(c => c.key === KEYS.gem2));
  for (let i = 1; i < calls.length; i++) assert.ok(calls[i].t0 >= calls[i - 1].t1, 'no overlap on a donated key');
});

test('Multiple donated keys: members spread over them and run side by side', async () => {
  const h = await fn({ GEMINI_KEYS: '', GROQ_KEYS: '', OPENROUTER_KEYS: '' });
  [KEYS.groq1, KEYS.groq2, KEYS.groq3].forEach((k, i) => W.docs.set('api_keys/donor' + i + '_0', { fields: { key: fsStr(k), status: fsStr('active'), donorUid: fsStr('donor' + i) }, updateTime: 't0' }));
  W.delay = { groq: 150 };
  const list = await readSSE(await council(h, 'pro1', four().slice(0, 3)));
  assert.ok(final(list).members.every(m => m.state === 'done'));
  const memberKeys = new Set(W.calls.filter(c => !/REVIEW & SYNTHESIS/.test(c.system)).map(c => c.key));
  assert.equal(memberKeys.size, 3, 'three different donated keys');
  assert.ok(overlap(W.calls) >= 2, 'in parallel');
});

test('A refused donated key is disabled in the pool; the next key answers', async () => {
  const h = await fn({ GEMINI_KEYS: '', OPENROUTER_KEYS: '', GROQ_KEYS: KEYS.groq2 });
  W.docs.set('api_keys/donor1_0', { fields: { key: fsStr(KEYS.groq1), status: fsStr('active'), donorUid: fsStr('donor1') }, updateTime: 't0' });
  W.keys[KEYS.groq1] = '401';
  let list = [];
  for (let i = 0; i < 3 && !W.calls.some(c => c.key === KEYS.groq1); i++) list = await readSSE(await council(h, 'pro1', [Object.assign({}, M.lead)]));
  assert.ok(final(list));
  await new Promise(r => setTimeout(r, 50));
  assert.equal(W.docs.get('api_keys/donor1_0').fields.status.stringValue, 'disabled');
});

test('COUNCIL_USE_DONATED=0: council members never touch a donated key', async () => {
  const h = await fn({ GEMINI_KEYS: '', OPENROUTER_KEYS: '', COUNCIL_USE_DONATED: '0' });
  W.docs.set('api_keys/donor1_0', { fields: { key: fsStr(KEYS.gem2), status: fsStr('active'), donorUid: fsStr('donor1') }, updateTime: 't0' });
  const list = await readSSE(await council(h, 'pro1', [M.lead, M.planner].map(m => Object.assign({}, m))));
  assert.ok(final(list));
  assert.ok(!W.calls.some(c => c.key === KEYS.gem2));
});

test('Different base URLs: each provider is called at its own configured address', async () => {
  const h = await fn({ GROQ_BASE: W.base + '/alt-groq', GEMINI_BASE: W.base + '/alt-gemini' });
  const seen = [];
  const orig = W.defaultReply;
  W.reply = c => { seen.push(c.provider); return orig(c); };
  await readSSE(await council(h, 'pro1', four().slice(0, 3)));
  /* the mock records the provider after stripping «alt-»; the requests reached /alt-… (no other route answers them) */
  assert.ok(seen.includes('groq') && seen.includes('gemini'));
});

/* ---------------------------------------------------------------- Claude */
test('Claude: a member that chose a Claude model uses the Messages API (system apart, turns alternate)', async () => {
  const h = await fn({ ANTHROPIC_KEYS: KEYS.ant1 });
  const list = await readSSE(await council(h, 'pro1', [Object.assign({}, M.lead, { model: 'claude-opus-test-1' }), Object.assign({}, M.planner)],
    { messages: [{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }, { role: 'assistant', content: 'c' }, { role: 'user', content: 'd' }] }));
  const c = W.calls.find(x => x.provider === 'anthropic');
  assert.equal(c.model, 'claude-opus-test-1');
  assert.match(c.raw.system, /YOUR ROLE: Coder/);
  assert.deepEqual(c.raw.messages.map(m => m.role), ['user', 'assistant', 'user']);
  assert.ok(!('temperature' in c.raw));
  assert.equal(final(list).members[0].provider, 'Claude');
});

test('Claude is never used by «auto» unless ANTHROPIC_AUTO=1', async () => {
  const h = await fn({ ANTHROPIC_KEYS: KEYS.ant1, GEMINI_KEYS: '', GROQ_KEYS: '', OPENROUTER_KEYS: KEYS.or1 });
  await readSSE(await council(h, 'pro1', four()));
  assert.ok(!W.calls.some(c => c.provider === 'anthropic'));
});

test('Claude in the ordinary chat: its event stream arrives as OpenAI chunks', async () => {
  const h = await fn({ ANTHROPIC_KEYS: KEYS.ant1 });
  const r = await ask(h, '/chat/completions', { uid: 'pro1', body: { model: 'claude-sonnet-test-1', stream: true, messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'hi' }] } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-nexus-served'), 'anthropic:claude-sonnet-test-1');
  const text = await r.text();
  const parts = text.split('\n\n').filter(l => l.startsWith('data: ') && !/\[DONE\]/.test(l)).map(l => JSON.parse(l.slice(6)));
  const content = parts.map(p => (p.choices && p.choices[0].delta.content) || '').join('');
  assert.equal(content, 'single by anthropic:claude-sonnet-test-1');
  assert.ok(parts.some(p => p.usage && p.usage.completion_tokens === 7));
  assert.match(text, /data: \[DONE\]/);
  const j = await (await ask(h, '/chat/completions', { uid: 'pro1', body: { model: 'claude-sonnet-test-1', messages: [{ role: 'user', content: 'hi' }] } })).json();
  assert.equal(j.choices[0].message.content, 'single by anthropic:claude-sonnet-test-1');
});

test('Claude «credit balance is too low» is a key problem (the next key), not a failed request', async () => {
  const h = await fn({ ANTHROPIC_KEYS: KEYS.ant1 + ',sk-ant-api03-ANTHROPICTESTKEY0000000002' });
  W.keys[KEYS.ant1] = 'nocredit';
  const list = await readSSE(await council(h, 'pro1', [Object.assign({}, M.lead, { model: 'claude-sonnet-test-1' })]));
  assert.match(final(list).text, /^Coder by anthropic:claude-sonnet-test-1/);
});

test('The model list offers Claude\'s real models, grouped as «Claude»', async () => {
  const h = await fn({ ANTHROPIC_KEYS: KEYS.ant1 });
  const j = await (await ask(h, '/models', { method: 'GET', uid: 'free1' })).json();
  const claude = j.data.filter(d => d.provider === 'Claude').map(d => d.id);
  assert.deepEqual(claude, ['claude-sonnet-test-1', 'claude-opus-test-1', 'claude-haiku-test-1']);
});

/* ---------------------------------------------------------------- the limits hold whatever the page sends */
test('The day\'s requests: a Pro council with 2 left shrinks to one model', async () => {
  const h = await fn({ PRO_AI_PER_DAY: '10' });
  W.docs.set('usage/pro1', { fields: { day: fsStr(new Date().toISOString().slice(0, 10)), used: fsInt(8), extra: fsInt(0) }, updateTime: 't1' });
  const list = await readSSE(await council(h, 'pro1', four()));
  const plan = ev(list, 'plan')[0];
  assert.equal(plan.members.length, 1); assert.equal(plan.reduced, 'daily_limit');
  assert.equal(W.calls.length, 1);
  assert.equal(used('pro1'), 9, 'one counted, the other reserved call given back');
});

test('One council at a time per account (a second one at once is refused)', async () => {
  const h = await fn();
  W.delay = { gemini: 400, groq: 400, openrouter: 400 };
  const a = council(h, 'pro2', four().slice(0, 2));
  await new Promise(r => setTimeout(r, 80));
  const b = await council(h, 'pro2', four().slice(0, 2));
  assert.equal(b.status, 429);
  assert.equal((await b.json()).error.code, 'council_busy');
  assert.ok(final(await readSSE(await a)));
  const c = await council(h, 'pro2', [Object.assign({}, M.lead)]);
  assert.equal(c.status, 200, 'free again once the first ended');
  await readSSE(c);
});

test('A free account cannot get several contributions merged (phase «synthesis»)', async () => {
  const h = await fn();
  const r = await ask(h, '/council', { uid: 'free1', body: { phase: 'synthesis', system: SYS, messages: MSG, contributions: [{ title: 'A', text: 'a', lead: true }, { title: 'B', text: 'b' }, { title: 'C', text: 'c' }] } });
  assert.equal(r.status, 403);
  assert.equal((await r.json()).error.code, 'pro_required');
  assert.equal(W.calls.length, 0); assert.equal(used('free1'), 0);
});

test('maxParallelRequests: never more provider calls at once than COUNCIL_MAX_PARALLEL', async () => {
  const h = await fn({ COUNCIL_MAX_PARALLEL: '2', GROQ_KEYS: KEYS.groq1 + ',' + KEYS.groq2 });
  W.delay = { gemini: 150, groq: 150, openrouter: 150 };
  const members = four(); members[3].after = [];
  const list = await readSSE(await council(h, 'pro1', members));
  assert.ok(final(list));
  assert.equal(overlap(W.calls.filter(c => !/REVIEW & SYNTHESIS/.test(c.system))), 2);
});

test('maxSynthesisTokens / maxMemberTokens: the providers are asked for no more than the server allows', async () => {
  const h = await fn({ COUNCIL_MAX_SYNTHESIS_TOKENS: '900', COUNCIL_MAX_MEMBER_TOKENS: '300' });
  await readSSE(await council(h, 'pro1', [M.lead, M.planner].map(m => Object.assign({}, m)), { maxTokens: 99999 }));
  const lead = W.calls.find(c => /YOUR ROLE: Coder/.test(c.system)), pl = W.calls.find(c => /YOUR ROLE: Planner/.test(c.system)), s = W.calls.find(c => /REVIEW & SYNTHESIS/.test(c.system));
  assert.equal(lead.max_tokens, 900); assert.equal(pl.max_tokens, 300); assert.equal(s.max_tokens, 900);
});

test('maxRetries: a member makes at most 1 + COUNCIL_MAX_RETRIES attempts', async () => {
  const h = await fn({ COUNCIL_MAX_RETRIES: '1', GROQ_KEYS: [KEYS.groq1, KEYS.groq2, KEYS.groq3].join(','), GEMINI_KEYS: '', OPENROUTER_KEYS: '' });
  [KEYS.groq1, KEYS.groq2, KEYS.groq3].forEach(k => { W.keys[k] = '429'; });
  const list = await readSSE(await council(h, 'pro1', [Object.assign({}, M.lead)]));
  assert.equal(W.calls.length, 2);
  assert.ok(ev(list, 'error')[0]);
});

test('maxRequestTime: the whole council stops at COUNCIL_MAX_REQUEST_MS', async () => {
  const h = await fn({ COUNCIL_MAX_REQUEST_MS: '10000', COUNCIL_MEMBER_TIMEOUT_MS: '60000' });
  W.keys = { [KEYS.gem1]: 'timeout', [KEYS.groq1]: 'timeout', [KEYS.or1]: 'timeout' };
  const t = Date.now();
  const list = await readSSE(await council(h, 'pro1', [M.lead, M.planner].map(m => Object.assign({}, m))));
  assert.ok(Date.now() - t < 14000, 'stopped in time: ' + (Date.now() - t));
  assert.ok(ev(list, 'error')[0]);
  assert.equal(used('pro1'), 0);
});

test('COUNCIL_ENABLED=0 switches the council off', async () => {
  const h = await fn({ COUNCIL_ENABLED: '0' });
  const r = await council(h, 'pro1', four());
  assert.equal(r.status, 503); assert.equal((await r.json()).error.code, 'council_off');
});

test('No way to check Pro (no service account / Firestore): everyone gets one model', async () => {
  const h = await fn({ FIRESTORE_EMULATOR_HOST: '' });
  const cfg = await (await ask(h, '/council/config', { method: 'GET', uid: 'pro1' })).json();
  assert.equal(cfg.verified, false); assert.equal(cfg.maxModels, 1);
  const r = await council(h, 'pro1', four());
  assert.equal(r.status, 403); assert.match((await r.json()).error.message, /FIREBASE_SERVICE_ACCOUNT/); assert.equal(W.calls.length, 0);
  const list = await readSSE(await council(h, 'pro1', [Object.assign({}, M.lead)]));
  assert.equal(ev(list, 'plan')[0].members.length, 1); assert.equal(W.calls.length, 1, 'one model still answers');
});

test('Guests and forged tokens are refused', async () => {
  const h = await fn();
  const r = await h(new Request('http://nexus.test/api/ai/council', { method: 'POST', body: '{}' }));
  assert.equal(r.status, 401);
  const anon = await h(new Request('http://nexus.test/api/ai/council', { method: 'POST', headers: { authorization: 'Bearer ' + token('g1', { provider: 'anonymous' }) }, body: '{}' }));
  assert.equal(anon.status, 401);
});

test('Own keys beside the server: phase «members» (server members) then «synthesis» (all contributions)', async () => {
  const h = await fn();
  const a = await readSSE(await ask(h, '/council', { uid: 'pro1', body: { phase: 'members', external: 2, mode: 'full', system: SYS, messages: MSG,
    members: [Object.assign({}, M.lead), Object.assign({}, M.planner), Object.assign({}, M.assets)] } }));
  const fa = final(a);
  assert.equal(ev(a, 'plan')[0].members.length, 2, '4 allowed − 2 run in the browser = 2 here');
  assert.equal(fa.members.length, 2); assert.ok(fa.members.every(m => m.text));
  assert.equal(used('pro1'), 2);
  const contributions = fa.members.map(m => ({ role: m.role, title: m.title, lead: m.lead, provider: m.provider, model: m.model, text: m.text }))
    .concat([{ role: 'assets', title: 'Assets (own key)', provider: 'OpenAI', model: 'gpt-x', text: 'A1 for the car' }, { role: 'reviewer', title: 'Reviewer (own key)', provider: 'OpenAI', model: 'gpt-x', text: 'ok' }]);
  const b = await readSSE(await ask(h, '/council', { uid: 'pro1', body: { phase: 'synthesis', system: SYS, messages: MSG, contributions } }));
  assert.match(final(b).text, /^FINAL by .*Assets \(own key\)/);
  assert.equal(used('pro1'), 3);
});

test('The single-model chat still works as before (and counts one request)', async () => {
  const h = await fn();
  const r = await ask(h, '/chat/completions', { uid: 'free1', body: { model: 'auto', messages: [{ role: 'user', content: 'hi' }] } });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).choices[0].message.content, 'single by gemini:gemini-3.6-flash');
  assert.equal(used('free1'), 1);
});

/* ---------------------------------------------------------------- run */
let pass = 0, failN = 0;
for (const t of tests) {
  try { await t.f(); pass++; console.log('✓ ' + t.name); }
  catch (e) { failN++; console.log('✗ ' + t.name + '\n    ' + String(e && e.stack || e).split('\n').slice(0, 4).join('\n    ')); }
}
await W.close();
console.log('\n' + pass + ' passed, ' + failN + ' failed');
process.exit(failN ? 1 : 0);
