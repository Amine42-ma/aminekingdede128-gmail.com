/* ============================================================
   NEXUS tests · a small fake world for the AI server function:
   • AI providers — OpenAI-compatible (Gemini / Groq / OpenRouter) and
     Anthropic (Messages API, JSON and event stream) — whose answers,
     failures (401 · 429 · 500 · no credit · missing model · timeout)
     and delays are set by each test;
   • the Firestore REST API that ai.js uses through
     FIRESTORE_EMULATOR_HOST (documents, commit with preconditions and
     increments, runQuery) — wallets, usage, api_keys;
   • sign-in tokens in the Firebase emulator's unsigned form (accepted by
     ai.js only with NEXUS_TEST_EMULATOR_TOKENS=1).
   Nothing here talks to the internet.
   ============================================================ */
import http from 'node:http';

export function startWorld() {
  const W = {
    calls: [],                 // every provider call: { provider, key, model, system, messages, t0, t1, status }
    active: 0, maxActive: 0,   // provider calls running at the same time
    keys: {},                  // key → 'ok' | '401' | '429' | '500' | 'nocredit' | 'timeout'
    models: {},                // 'provider|model' → 'gone'
    delay: {},                 // provider → ms before answering
    reply: null,               // (call) → text; default below
    docs: new Map(),           // Firestore: 'collection/id' → { fields, updateTime }
    lists: {                   // the providers' own model lists
      groq: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'qwen/qwen3-32b'],
      openrouter: ['deepseek/deepseek-chat-v3:free', 'meta-llama/llama-3.3-70b-instruct:free'],
      anthropic: ['claude-sonnet-test-1', 'claude-opus-test-1', 'claude-haiku-test-1']
    }
  };
  let tick = 0;
  const stamp = () => new Date(Date.now() + (tick++)).toISOString();

  const roleOf = sys => /REVIEW & SYNTHESIS/.test(sys) ? 'synthesis' : ((/YOUR ROLE: ([^.\n]+)/.exec(sys) || [])[1] || 'single').trim();
  W.defaultReply = c => {
    const r = roleOf(c.system);
    if (r === 'synthesis') return 'FINAL by ' + c.provider + ':' + c.model + ' from [' + (c.lastUser.match(/^### #\d+ [^\n]+/gm) || []).map(s => s.replace(/^### #\d+ /, '')).join(' | ') + ']';
    return r + ' by ' + c.provider + ':' + c.model;
  };

  /* a browser may call a provider directly (a player's own key): CORS like the real APIs */
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access, http-referer, x-title', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
  const send = (res, status, obj, headers = {}) => { res.writeHead(status, Object.assign({ 'content-type': 'application/json' }, CORS, headers)); res.end(typeof obj === 'string' ? obj : JSON.stringify(obj)); };
  const body = req => new Promise(r => { let s = ''; req.on('data', d => s += d); req.on('end', () => r(s)); });

  async function provider(req, res, prov, rest) {
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
    const key = prov === 'anthropic' ? req.headers['x-api-key'] : String(req.headers.authorization || '').replace(/^Bearer /, '');
    const k = W.keys[key] || 'ok';
    if (req.method === 'GET') {
      if (k === '401') return send(res, 401, { error: { message: 'invalid api key' } });
      const ids = W.lists[prov] || [];
      if (prov === 'openrouter') return send(res, 200, { data: ids.map(id => ({ id, pricing: { prompt: '0', completion: '0' }, architecture: { output_modalities: ['text'] } })) });
      if (prov === 'anthropic') return send(res, 200, { data: ids.map(id => ({ id, type: 'model', display_name: id })), has_more: false });
      return send(res, 200, { data: ids.map(id => ({ id, active: true })) });
    }
    const raw = await body(req), j = JSON.parse(raw || '{}');
    const msgs = prov === 'anthropic' ? [{ role: 'system', content: j.system || '' }].concat(j.messages || []) : j.messages || [];
    const system = msgs.filter(m => m.role === 'system').map(m => m.content).join('\n');
    const users = msgs.filter(m => m.role === 'user');
    const call = { provider: prov, key, model: j.model, system, messages: msgs, lastUser: users.length ? String(users[users.length - 1].content) : '', t0: Date.now(), stream: !!j.stream, max_tokens: j.max_tokens, raw: j };
    W.calls.push(call);
    W.active++; W.maxActive = Math.max(W.maxActive, W.active);
    try {
      /* no answer at all — until the caller gives up (it aborts, the connection closes) */
      if (k === 'timeout') { await new Promise(r => { const t = setTimeout(r, 60000); res.on('close', () => { clearTimeout(t); r(); }); }); return; }
      await new Promise(r => setTimeout(r, W.delay[prov] || 5));
      if (k === '401') { call.status = 401; return send(res, 401, prov === 'anthropic' ? { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } : { error: { message: 'Invalid API Key', code: 'invalid_api_key' } }); }
      if (k === '429') { call.status = 429; return send(res, 429, { error: { message: 'Rate limit reached. Please try again in 20s.' } }, { 'retry-after': '20' }); }
      if (k === '500') { call.status = 500; return send(res, 500, { error: { message: 'internal error' } }); }
      if (k === 'nocredit') { call.status = 400; return send(res, 400, { type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } }); }
      if (W.models[prov + '|' + j.model] === 'gone') { call.status = 404; return send(res, 404, { error: { message: 'The model `' + j.model + '` does not exist', code: 'model_not_found' } }); }
      const text = (W.reply || W.defaultReply)(call);
      call.status = 200; call.text = text;
      if (prov === 'anthropic') {
        if (j.stream) {
          res.writeHead(200, Object.assign({ 'content-type': 'text/event-stream' }, CORS));
          const ev = (e, d) => res.write('event: ' + e + '\ndata: ' + JSON.stringify(d) + '\n\n');
          ev('message_start', { type: 'message_start', message: { id: 'msg_1', usage: { input_tokens: 11, output_tokens: 1 } } });
          ev('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
          for (const piece of text.match(/.{1,7}/gs) || []) ev('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: piece } });
          ev('content_block_stop', { type: 'content_block_stop', index: 0 });
          ev('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 7 } });
          ev('message_stop', { type: 'message_stop' });
          return res.end();
        }
        return send(res, 200, { id: 'msg_1', type: 'message', role: 'assistant', model: j.model, content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 11, output_tokens: 7 } });
      }
      if (j.stream) {
        res.writeHead(200, Object.assign({ 'content-type': 'text/event-stream' }, CORS));
        for (const piece of text.match(/.{1,7}/gs) || []) res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: piece } }] }) + '\n\n');
        res.write('data: [DONE]\n\n');
        return res.end();
      }
      return send(res, 200, { id: 'c1', model: j.model, choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
    } finally { call.t1 = Date.now(); W.active--; }
  }

  /* ---------------- Firestore REST (only what ai.js uses) ---------------- */
  const inc = (fields, path, n) => { const cur = fields[path] ? +(fields[path].integerValue || fields[path].doubleValue || 0) : 0; fields[path] = { integerValue: String(cur + n) }; };
  async function firestore(req, res, url) {
    const m = /\/v1\/projects\/[^/]+\/databases\/\(default\)\/documents(.*)$/.exec(decodeURIComponent(url.pathname));
    if (!m) return send(res, 404, { error: { message: 'no route' } });
    const rest = m[1];
    if (req.method === 'POST' && rest === ':commit') {
      const { writes } = JSON.parse(await body(req));
      const pathOf = n => n.split('/documents/')[1];
      for (const w of writes) {
        const p = pathOf(w.update ? w.update.name : w.transform.document), cur = W.docs.get(p), pre = w.currentDocument;
        if (pre && pre.exists === false && cur) return send(res, 409, { error: { status: 'ALREADY_EXISTS', message: 'exists' } });
        if (pre && pre.exists === true && !cur) return send(res, 404, { error: { status: 'NOT_FOUND', message: 'missing' } });
        if (pre && pre.updateTime && (!cur || cur.updateTime !== pre.updateTime)) return send(res, 400, { error: { status: 'FAILED_PRECONDITION', message: 'changed' } });
      }
      const results = [];
      for (const w of writes) {
        const p = pathOf(w.update ? w.update.name : w.transform.document), cur = W.docs.get(p);
        let fields;
        if (w.update) {
          fields = w.updateMask ? Object.assign({}, cur ? cur.fields : {}, Object.fromEntries(w.updateMask.fieldPaths.map(f => [f, w.update.fields[f]]).filter(x => x[1]))) : Object.assign({}, w.update.fields);
          (w.updateTransforms || []).forEach(t => inc(fields, t.fieldPath, +t.increment.integerValue));
        } else {
          fields = Object.assign({}, cur ? cur.fields : {});
          (w.transform.fieldTransforms || []).forEach(t => inc(fields, t.fieldPath, +t.increment.integerValue));
        }
        W.docs.set(p, { fields, updateTime: stamp() });
        results.push({ updateTime: W.docs.get(p).updateTime });
      }
      return send(res, 200, { writeResults: results });
    }
    if (req.method === 'POST' && rest === ':runQuery') {
      const q = JSON.parse(await body(req)).structuredQuery;
      const col = q.from[0].collectionId, f = q.where.fieldFilter;
      const out = [];
      for (const [p, d] of W.docs) {
        if (!p.startsWith(col + '/')) continue;
        const v = d.fields[f.field.fieldPath];
        if (v && v.stringValue === f.value.stringValue) out.push({ document: { name: 'projects/x/databases/(default)/documents/' + p, fields: d.fields } });
      }
      return send(res, 200, out.length ? out : [{ readTime: stamp() }]);
    }
    const p = rest.replace(/^\//, '');
    if (req.method === 'GET') {
      const d = W.docs.get(p);
      return d ? send(res, 200, { name: p, fields: d.fields, updateTime: d.updateTime }) : send(res, 404, { error: { status: 'NOT_FOUND' } });
    }
    if (req.method === 'PATCH') {
      const j = JSON.parse(await body(req)), cur = W.docs.get(p);
      const mask = url.searchParams.getAll('updateMask.fieldPaths');
      const fields = mask.length ? Object.assign({}, cur ? cur.fields : {}, Object.fromEntries(mask.map(f => [f, j.fields[f]]).filter(x => x[1]))) : j.fields;
      W.docs.set(p, { fields, updateTime: stamp() });
      return send(res, 200, { name: p, fields });
    }
    return send(res, 405, {});
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      const pm = /^\/(gemini|groq|openrouter|anthropic|alt-gemini|alt-groq)(\/.*)$/.exec(url.pathname);
      if (pm) return await provider(req, res, pm[1].replace(/^alt-/, ''), pm[2]);
      if (url.pathname.startsWith('/v1/projects/')) return await firestore(req, res, url);
      /* anything else a test serves (a game-news feed …): W.files[path] = { type, body, status } */
      const f = W.files && W.files[url.pathname];
      if (f) { W.fileHits = (W.fileHits || 0) + 1; res.writeHead(f.status || 200, { 'content-type': f.type || 'text/plain' }); return res.end(f.body); }
      send(res, 404, { error: 'no route ' + url.pathname });
    } catch (e) { if (!res.headersSent) send(res, 500, { error: String(e) }); }
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    W.port = server.address().port;
    W.base = 'http://127.0.0.1:' + W.port;
    W.close = () => new Promise(r => { server.closeAllConnections && server.closeAllConnections(); server.close(r); });
    resolve(W);
  }));
}

/* Firestore values */
export const fsInt = n => ({ integerValue: String(n) });
export const fsStr = s => ({ stringValue: s });

/* a sign-in token as the Firebase emulator makes it (unsigned — accepted only in a test run) */
export function token(uid, { project = 'demo-nexus', email = uid + '@example.com', provider = 'google.com' } = {}) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return b64({ alg: 'none', typ: 'JWT' }) + '.' + b64({ aud: project, iss: 'https://securetoken.google.com/' + project, sub: uid, iat: now, exp: now + 3600,
    email, email_verified: true, firebase: { sign_in_provider: provider } }) + '.';
}

/* the council's answer, read to the end: [{ event, data }] */
export async function readSSE(res) {
  const text = await res.text(), out = [];
  for (const block of text.split('\n\n')) {
    const ev = /^event: (.+)$/m.exec(block), data = /^data: (.+)$/m.exec(block);
    if (ev && data) out.push({ event: ev[1], data: JSON.parse(data[1]) });
  }
  return out;
}
