/**
 * HTTP server: static dashboard + JSON API + SSE event stream + a play route
 * that serves generated games straight from the workspace.
 *
 * Binds to 127.0.0.1 by default. The API is unauthenticated because it is a
 * local single-user tool; it is never exposed to a network interface unless the
 * user passes --host explicitly, and it says so when they do.
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Lab } from './lab.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.join(__dirname, '..', 'web');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.md': 'text/markdown; charset=utf-8',
  '.zip': 'application/zip', '.txt': 'text/plain; charset=utf-8',
};

export async function createServer({ workspace, port = 7717, host = '127.0.0.1' } = {}) {
  const lab = await Lab.open(workspace);
  const clients = new Set();

  lab.bus.on('event', (evt) => {
    const payload = `data: ${JSON.stringify(evt)}\n\n`;
    for (const res of clients) {
      try { res.write(payload); } catch { clients.delete(res); }
    }
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    try {
      if (url.pathname === '/events') return sse(req, res, clients, lab);
      if (url.pathname.startsWith('/api/')) return await api(req, res, url, lab);
      if (url.pathname.startsWith('/play/')) return await servePlay(req, res, url, lab);
      return await serveStatic(req, res, url);
    } catch (err) {
      json(res, 500, { error: err.message, stack: String(err.stack).split('\n').slice(0, 3) });
    }
  });

  await new Promise((resolve) => server.listen(port, host, resolve));
  lab.bus.success('server.listening', { url: `http://${host}:${port}`, workspace: lab.config.workspace });
  if (host !== '127.0.0.1' && host !== 'localhost') {
    lab.bus.warn('server.exposed', { host, note: 'the API is unauthenticated; binding outside localhost exposes your workspace to the network' });
  }
  return { server, lab, url: `http://${host}:${port}` };
}

function json(res, status, body) {
  const data = JSON.stringify(body, null, 2);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(data);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}

function sse(req, res, clients, lab) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });
  res.write(': connected\n\n');
  for (const evt of lab.bus.tail(60)) res.write(`data: ${JSON.stringify(evt)}\n\n`);
  clients.add(res);
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* closed */ } }, 20000);
  req.on('close', () => { clearInterval(ping); clients.delete(res); });
}

async function serveStatic(req, res, url) {
  let rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  rel = rel.replace(/\.\./g, '');
  const file = path.join(WEB_DIR, rel);
  if (!file.startsWith(WEB_DIR)) { res.writeHead(403); return res.end('forbidden'); }
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
}

/** Serve a generated project so it can be played from the dashboard. */
async function servePlay(req, res, url, lab) {
  const [, , id, ...rest] = url.pathname.split('/');
  const rec = await lab.store.generated.get(id);
  if (!rec?.dir) { res.writeHead(404); return res.end('generated project not found on disk'); }
  const rel = (rest.join('/') || 'index.html').replace(/\.\./g, '');
  const file = path.join(rec.dir, rel);
  if (!file.startsWith(rec.dir)) { res.writeHead(403); return res.end('forbidden'); }
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}

async function api(req, res, url, lab) {
  const route = url.pathname.replace('/api/', '');
  const method = req.method.toUpperCase();
  const body = method === 'POST' ? await readBody(req) : {};
  const q = Object.fromEntries(url.searchParams);

  // ---- read ---------------------------------------------------------------
  if (method === 'GET') {
    switch (route) {
      case 'status': return json(res, 200, await lab.status());
      case 'config': return json(res, 200, lab.config.toJSON());
      case 'projects': {
        const all = await lab.store.projects.all();
        return json(res, 200, all.map((p) => ({
          id: p.id, name: p.name, files: p.fileCount, bytes: p.bytes, kinds: p.kinds,
          status: p.status, root: p.root, importedAt: p.importedAt,
          summary: p.analysis?.summary ?? null, kind: p.analysis?.kind ?? null,
          concepts: p.analysis?.concepts?.length ?? 0,
          problems: p.analysis?.problems?.length ?? 0,
          license: p.analysis?.license ?? null,
        })));
      }
      case 'knowledge': return json(res, 200, { byCategory: await lab.knowledge.byCategory(), stats: await lab.knowledge.stats() });
      case 'knowledge/graph': return json(res, 200, lab.graph.summary());
      case 'designs': return json(res, 200, (await lab.store.designs.all()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
      case 'generated': {
        const all = await lab.store.generated.all();
        return json(res, 200, all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map((g) => ({
          id: g.id, name: g.name, ruleset: g.ruleset, traits: g.traits, dir: g.dir,
          files: g.files?.length ?? 0, bytes: g.bytesHuman, agentVersion: g.agentVersion,
          test: g.test ? { score: g.test.score, verdict: g.test.verdict, failed: g.test.failed } : null,
          quality: g.quality, novelty: g.novelty, diversity: g.diversity, codeOverlap: g.codeOverlap,
          fixes: g.fixes?.length ?? 0, rounds: g.rounds, createdAt: g.createdAt,
        })));
      }
      case 'versions': return json(res, 200, await lab.versions.history());
      case 'versions/compare': return json(res, 200, await lab.versions.compareVersions(q.a, q.b));
      case 'experiments': return json(res, 200, await lab.experiments.recent(50));
      case 'lessons': return json(res, 200, { recent: await lab.lessons.recent(60), recurring: await lab.lessons.recurring(2), stats: await lab.lessons.stats() });
      case 'queue': return json(res, 200, { status: lab.queue.status(), tasks: await lab.queue.list() });
      case 'models': return json(res, 200, { providers: lab.models.list(), capabilities: lab.models.capabilities() });
      case 'research': return json(res, 200, { history: await lab.research.history(), online: await lab.research.online(), offline: await lab.research.offlineCapabilities(), allowlist: lab.research.allowlist });
      case 'training': return json(res, 200, { datasets: await lab.store.datasets.all(), engine: lab.trainingEngine.available(), models: await lab.trainingEngine.versions() });
      case 'autopilot': return json(res, 200, lab.autopilot.status());
      case 'ai': return json(res, 200, lab.ai.status());
      case 'backups': return json(res, 200, { stats: await lab.backups.stats(), list: await lab.backups.list() });
      case 'assets': return json(res, 200, await lab.store.assets.all());
      case 'events': return json(res, 200, lab.bus.tail(Number(q.n) || 200, Number(q.since) || 0));
      default: break;
    }
    if (route.startsWith('projects/')) {
      const p = await lab.store.projects.get(route.split('/')[1]);
      if (!p) return json(res, 404, { error: 'project not found' });
      const memory = await lab.memory.forProject(p.id);
      return json(res, 200, { ...p, files: p.files?.slice(0, 200), memory });
    }
    if (route.startsWith('generated/')) {
      const g = await lab.store.generated.get(route.split('/')[1]);
      if (!g) return json(res, 404, { error: 'generated project not found' });
      const design = await lab.store.designs.get(g.designId);
      return json(res, 200, { ...g, design });
    }
    return json(res, 404, { error: `unknown GET route "${route}"` });
  }

  // ---- write --------------------------------------------------------------
  if (method === 'POST') {
    switch (route) {
      case 'import': {
        if (!body.path) return json(res, 400, { error: 'path is required' });
        const queued = body.queue !== false;
        if (queued) return json(res, 202, await lab.queue.add('import', { path: body.path, options: body.options || {} }, { label: `import ${body.path}` }));
        return json(res, 200, await lab.importPath(body.path, body.options || {}));
      }
      case 'analyze':
        return json(res, 202, await lab.queue.add('analyze', body, { label: body.projectId ? 'analyze project' : 'analyze all projects', priority: 7 }));
      case 'design':
        return json(res, 200, await lab.design(body));
      case 'generate':
        return json(res, 202, await lab.queue.add('generate', body, { label: `generate ${body.brief?.genre || 'game'}`, priority: 6 }));
      case 'generate/sync': {
        const r = await lab.createGame(body);
        return json(res, 200, { id: r.record.id, name: r.design.name, score: r.report.score, verdict: r.report.verdict, dir: r.record.dir, fixes: r.fixes });
      }
      case 'benchmark':
        return json(res, 202, await lab.queue.add('benchmark', {}, { label: 'run benchmark', priority: 4 }));
      case 'evolve':
        return json(res, 202, await lab.queue.add('evolve', { cycles: body.cycles || 3, taskCount: body.taskCount || 4 }, { label: `autopilot x${body.cycles || 3}`, priority: 3 }));
      case 'autopilot/pause': return json(res, 200, lab.autopilot.pause());
      case 'autopilot/resume': return json(res, 200, lab.autopilot.resume());
      case 'autopilot/stop': return json(res, 200, lab.autopilot.stop());
      case 'queue/start': lab.queue.start(); return json(res, 200, lab.queue.status());
      case 'queue/pause': return json(res, 200, lab.queue.pause());
      case 'queue/resume': return json(res, 200, lab.queue.resume());
      case 'queue/stop': return json(res, 200, lab.queue.stop());
      case 'queue/clear': await lab.queue.clearFinished(); return json(res, 200, { ok: true });
      case 'queue/task': return json(res, 200, await lab.queue.add(body.type, body.payload || {}, { label: body.label, priority: body.priority }));
      case 'research':
        if (!lab.config.permissions.network) {
          return json(res, 200, { ...(await lab.research.investigate(body.question)), warning: 'network access is disabled; only cached sources were used' });
        }
        return json(res, 200, await lab.research.investigate(body.question));
      case 'training/dataset': {
        const { dataset, prepared } = await lab.training.buildAndSave(body || {});
        return json(res, 200, { dataset, stats: prepared.stats, split: prepared.split });
      }
      case 'training/train':
        return json(res, 200, await lab.trainingEngine.train(body));
      case 'versions/rollback':
        return json(res, 200, await lab.versions.rollbackTo(body.version));
      case 'export': {
        const map = {
          project: () => lab.exporter.exportGeneratedProject(body.id),
          knowledge: () => lab.exporter.exportKnowledge(),
          memory: () => lab.exporter.exportProjectMemory(body.id),
          evaluation: () => lab.exporter.exportEvaluation(),
          datasets: () => lab.exporter.exportDatasetMetadata(),
          logs: () => lab.exporter.exportLogs(lab.bus),
        };
        if (!map[body.what]) return json(res, 400, { error: `unknown export target "${body.what}"` });
        return json(res, 200, await map[body.what]());
      }
      case 'backup':
        return json(res, 200, await lab.backups.create({ note: body.note, full: !!body.full, tag: body.tag }));
      case 'restore': {
        if (!body.id) return json(res, 400, { error: 'id is required (backup id or index)' });
        return json(res, 200, await lab.backups.restore(body.id, { safetyBackup: body.safetyBackup !== false }));
      }
      case 'backup/delete': {
        if (!body.id) return json(res, 400, { error: 'id is required' });
        return json(res, 200, await lab.backups.remove(body.id));
      }
      case 'permissions': {
        lab.config.permissions = { ...lab.config.permissions, ...body, modifyImports: false };
        await lab.config.save();
        lab.bus.warn('permissions.changed', { permissions: lab.config.permissions });
        return json(res, 200, lab.config.permissions);
      }
      case 'workspace/grant': {
        if (!body.path) return json(res, 400, { error: 'path is required' });
        const abs = await lab.importer.grant(body.path);
        return json(res, 200, { granted: abs, roots: lab.config.importRoots });
      }
      case 'assets/license': {
        const asset = await lab.store.assets.get(body.id);
        if (!asset) return json(res, 404, { error: 'asset not found' });
        return json(res, 200, await lab.store.assets.patch(body.id, { license: body.license, ownedByUser: !!body.ownedByUser, note: body.note || asset.note }));
      }
      default:
        return json(res, 404, { error: `unknown POST route "${route}"` });
    }
  }

  return json(res, 405, { error: 'method not allowed' });
}
