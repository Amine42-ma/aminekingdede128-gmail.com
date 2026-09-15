/**
 * Project importer (spec 6).
 *
 * Accepts: a folder containing many projects, a single project folder, a .zip,
 * or loose asset files (GLB, images, sketches).
 *
 * Non-destructive by design (spec 45): originals are read only. Everything is
 * copied into <workspace>/imports/<slug>/ and the lab works on the copy.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { walk, ext as extOf } from '../core/paths.js';
import { readZipFile } from './zip.js';
import { slug, id as makeId, bytes as fmtBytes } from '../core/util.js';
import { classifyFile } from '../analysis/analyzer.js';

const PROJECT_MARKERS = [
  (name) => name === 'index.html',
  (name) => name === 'package.json',
  (name) => /^(main|game|app|sketch|script)\.(js|mjs|ts)$/i.test(name),
  (name) => /\.html?$/i.test(name),
];

function markerScore(fileNames) {
  let score = 0;
  for (const name of fileNames) {
    if (name === 'index.html') score += 5;
    else if (/\.html?$/i.test(name)) score += 3;
    else if (name === 'package.json') score += 2;
    else if (/^(main|game|app|sketch|script)\.(js|mjs|ts)$/i.test(name)) score += 2;
    else if (/\.(js|mjs)$/i.test(name)) score += 1;
    else if (/\.(glb|gltf)$/i.test(name)) score += 1;
  }
  return score;
}

/**
 * Detect project roots inside a tree of files.
 * @param {string} root
 * @param {Array<{path:string, rel:string}>} files
 */
export function detectProjects(root, files) {
  const byDir = new Map();
  for (const f of files) {
    const dir = path.dirname(f.path);
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir).push(f);
  }

  const candidates = [];
  for (const [dir, list] of byDir) {
    const names = list.map((f) => path.basename(f.path));
    const score = markerScore(names);
    if (score >= 3 || names.some((n) => PROJECT_MARKERS[0](n))) {
      candidates.push({ dir, score, depth: path.relative(root, dir).split(path.sep).filter(Boolean).length });
    }
  }
  candidates.sort((a, b) => a.depth - b.depth || b.score - a.score);

  const roots = [];
  for (const c of candidates) {
    // skip anything already inside an accepted project
    if (roots.some((r) => c.dir === r.dir || c.dir.startsWith(r.dir + path.sep))) continue;
    roots.push(c);
  }

  // Nothing looked like a web project: treat immediate subdirectories as
  // asset-only projects so GLB/sketch collections are still importable.
  if (!roots.length) {
    const subdirs = new Set(files.map((f) => {
      const rel = path.relative(root, f.path);
      const first = rel.split(path.sep)[0];
      return rel.includes(path.sep) ? path.join(root, first) : root;
    }));
    for (const dir of subdirs) roots.push({ dir, score: 0, depth: 0 });
  }

  return roots.map((r) => {
    const own = files.filter((f) => f.path === r.dir || f.path.startsWith(r.dir + path.sep))
      .filter((f) => !roots.some((other) => other.dir !== r.dir && other.dir.startsWith(r.dir + path.sep) && f.path.startsWith(other.dir + path.sep)));
    return {
      root: r.dir,
      name: path.basename(r.dir) || path.basename(root) || 'project',
      score: r.score,
      files: own,
    };
  }).filter((p) => p.files.length);
}

export class Importer {
  constructor({ config, store, bus }) {
    this.config = config;
    this.store = store;
    this.bus = bus;
  }

  /** Grant read access to a path and remember it in the config. */
  async grant(sourcePath) {
    const abs = path.resolve(sourcePath);
    if (!this.config.importRoots.includes(abs)) {
      this.config.importRoots.push(abs);
      await this.config.save();
    }
    return abs;
  }

  /**
   * Import from a folder or a .zip.
   * @returns {Promise<{projects:Array, assets:Array}>}
   */
  async importPath(sourcePath, { copy = true, label = null } = {}) {
    const abs = await this.grant(sourcePath);
    const scope = this.config.scope();
    const stat = await fs.stat(abs);

    let workRoot = abs;
    let cleanupZipDir = null;

    if (stat.isFile() && extOf(abs) === 'zip') {
      workRoot = await this.#extractZip(abs, label);
      cleanupZipDir = null; // extracted copy is the import, we keep it
      this.bus.info('import.zip', { source: abs, extractedTo: workRoot });
    } else if (stat.isFile()) {
      // single loose file: treat the containing folder as the source but only take this file
      const rec = await this.#importLooseFile(abs);
      return { projects: [], assets: [rec] };
    }

    const files = await walk(scope, workRoot, { maxFiles: this.config.limits.maxFilesPerProject * 8 });
    const withSizes = [];
    for (const f of files) {
      try {
        const st = await fs.stat(f.path);
        withSizes.push({ ...f, size: st.size });
      } catch { /* vanished mid-walk */ }
    }

    const detected = detectProjects(workRoot, withSizes);
    this.bus.info('import.detected', { source: workRoot, projects: detected.length, files: withSizes.length });

    const imported = [];
    for (const p of detected.slice(0, this.config.limits.maxProjects)) {
      const record = await this.#registerProject(p, { copy, origin: abs });
      imported.push(record);
      this.bus.success('import.project', { name: record.name, files: record.files.length, bytes: fmtBytes(record.bytes) });
    }
    return { projects: imported, assets: [] };
  }

  async #extractZip(zipPath, label) {
    const name = slug(label || path.basename(zipPath, '.zip'));
    const dest = path.join(this.config.dirs.imports, `${name}-${Date.now().toString(36)}`);
    const entries = await readZipFile(zipPath);
    await fs.mkdir(dest, { recursive: true });
    for (const e of entries) {
      if (e.dir) continue;
      // reject path traversal inside the archive
      const safeRel = e.name.split('/').filter((s) => s && s !== '.' && s !== '..').join(path.sep);
      if (!safeRel) continue;
      const target = path.join(dest, safeRel);
      if (!target.startsWith(dest + path.sep)) continue;
      await fs.mkdir(path.dirname(target), { recursive: true });
      try { await fs.writeFile(target, e.data()); } catch (err) { this.bus.warn('import.zip.entry', { entry: e.name, error: String(err.message) }); }
    }
    return dest;
  }

  async #importLooseFile(abs) {
    const st = await fs.stat(abs);
    const kind = classifyFile(abs);
    const dest = path.join(this.config.dirs.imports, '_assets', path.basename(abs));
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(abs, dest);
    const rec = await this.store.assets.put({
      id: makeId('asset'),
      name: path.basename(abs),
      kind,
      bytes: st.size,
      origin: abs,
      stored: dest,
      ownedByUser: true,
      license: 'LICENSE_UNKNOWN',
      note: 'Imported as a standalone asset. Declare its licence in the Assets view.',
    });
    this.bus.success('import.asset', { name: rec.name, kind, bytes: fmtBytes(st.size) });
    return rec;
  }

  async #registerProject(p, { copy, origin }) {
    const projectId = makeId('proj');
    const name = p.name;
    let root = p.root;
    let fileRecords = p.files.map((f) => ({ rel: path.relative(p.root, f.path), abs: f.path, size: f.size }));

    if (copy && !p.root.startsWith(this.config.dirs.imports)) {
      const dest = path.join(this.config.dirs.imports, `${slug(name)}-${projectId.slice(-6)}`);
      for (const f of fileRecords) {
        const target = path.join(dest, f.rel);
        await fs.mkdir(path.dirname(target), { recursive: true });
        try { await fs.copyFile(f.abs, target); } catch { /* unreadable file */ }
      }
      root = dest;
      fileRecords = fileRecords.map((f) => ({ ...f, abs: path.join(dest, f.rel) }));
    }

    const bytes = fileRecords.reduce((s, f) => s + f.size, 0);
    const kinds = {};
    for (const f of fileRecords) {
      const k = classifyFile(f.rel);
      kinds[k] = (kinds[k] || 0) + 1;
    }

    return this.store.projects.put({
      id: projectId,
      name,
      root,
      originPath: origin,
      files: fileRecords.slice(0, this.config.limits.maxFilesPerProject),
      fileCount: fileRecords.length,
      bytes,
      kinds,
      status: 'imported',
      analysis: null,
      importedAt: new Date().toISOString(),
    });
  }
}
