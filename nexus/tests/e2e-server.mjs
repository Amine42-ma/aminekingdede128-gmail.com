/* ============================================================
   NEXUS tests · the site as Netlify would serve it, on this machine:
   the static files of nexus/ and the two server functions
   (netlify/edge-functions/ai.js, points.js) answering /api/ai/* and
   /api/points/*, with the Firebase emulators as their database
   (FIRESTORE_EMULATOR_HOST — the real firestore.rules apply to the page)
   and fake AI providers (mock-world.mjs) instead of the real ones.
   ============================================================ */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.glb': 'model/gltf-binary', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.txt': 'text/plain' };

/* challenges.js imports ./ai.js and ./points.js: loaded through a copy that imports the SAME
   versioned copies (a fresh load gets fresh caches, like a new deploy) */
export async function importChallenges(query) {
  const src = fs.readFileSync(path.join(ROOT, 'netlify/edge-functions/challenges.js'), 'utf8')
    .replace(/from '\.\/(ai|points)\.js'/g, (m, f) => "from '" + pathToFileURL(path.join(ROOT, 'netlify/edge-functions', f + '.js')).href + '?' + query + "'");
  const tmp = path.join(os.tmpdir(), 'nexus-challenges-' + query.replace(/\W/g, '_') + '.mjs');
  fs.writeFileSync(tmp, src);
  return (await import(pathToFileURL(tmp).href)).default;
}

export async function startSite({ env, files = {}, port = 0 }) {
  globalThis.Netlify = { env: { get: k => env[k] } };
  let ai, points, challenges, n = 0;
  /* a fresh copy of the functions (empty caches: key pool, model lists, resting keys) */
  const load = async () => {
    const v = Date.now() + '-' + (++n);
    ai = (await import(pathToFileURL(path.join(ROOT, 'netlify/edge-functions/ai.js')).href + '?e2e=' + v)).default;
    points = (await import(pathToFileURL(path.join(ROOT, 'netlify/edge-functions/points.js')).href + '?e2e=' + v)).default;
    challenges = await importChallenges('e2e=' + v);
  };
  await load();
  const log = [];
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://' + req.headers.host);
      const fn = /^\/api\/ai(\/|$)/.test(url.pathname) ? ai : /^\/api\/points(\/|$)/.test(url.pathname) ? points : /^\/api\/challenges(\/|$)/.test(url.pathname) ? challenges : null;
      if (fn) {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const headers = {};
        ['authorization', 'content-type', 'origin', 'x-nexus-cron'].forEach(h => { if (req.headers[h]) headers[h] = req.headers[h]; });
        const r = await fn(new Request(url.href, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }));
        log.push({ at: Date.now(), method: req.method, path: url.pathname, status: r.status });
        res.writeHead(r.status, Object.fromEntries(r.headers));
        if (r.body) for await (const chunk of r.body) res.write(chunk);
        return res.end();
      }
      /* netlify.toml's pretty links (…/game/<id>, …/fc/<id> …) are the page itself */
      if (/^\/(game|app|f|challenge|fc)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname) || url.pathname === '/') url.pathname = '/index.html';
      if (files[url.pathname]) { res.writeHead(200, { 'content-type': TYPES[path.extname(url.pathname)] || 'application/octet-stream', 'access-control-allow-origin': '*' }); return res.end(files[url.pathname]); }
      let p = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
      if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
      if (!fs.existsSync(p)) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(p).pipe(res);
    } catch (e) { if (!res.headersSent) res.writeHead(500); res.end(String(e && e.stack || e)); }
  });
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  return { base, log, reload: load, close: () => new Promise(r => { server.closeAllConnections && server.closeAllConnections(); server.close(r); }) };
}
