/**
 * Workspace confinement (spec 44, 51).
 *
 * Every filesystem call in the lab goes through resolveInside(). The agent can
 * only read and write inside directories the user explicitly granted. There is
 * no "escape hatch" flag: a path outside the scope throws.
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';

export class ScopeError extends Error {
  constructor(msg) { super(msg); this.name = 'ScopeError'; this.code = 'EOUTOFSCOPE'; }
}

export class Scope {
  /** @param {string[]} roots absolute directories the agent may touch */
  constructor(roots) {
    this.roots = roots.map((r) => path.resolve(r));
  }

  add(root) {
    const r = path.resolve(root);
    if (!this.roots.includes(r)) this.roots.push(r);
    return r;
  }

  contains(p) {
    const abs = path.resolve(p);
    return this.roots.some((root) => abs === root || abs.startsWith(root + path.sep));
  }

  /** Resolve `p` and assert it stays inside the scope. Follows symlinks when they exist. */
  resolve(p) {
    const abs = path.resolve(p);
    let real = abs;
    try { real = fsSync.realpathSync(abs); } catch { /* not created yet - check the literal path */ }
    if (!this.contains(abs) || !this.contains(real)) {
      throw new ScopeError(`path is outside the permitted workspace: ${abs}`);
    }
    return abs;
  }

  async readFile(p, enc) { return fs.readFile(this.resolve(p), enc); }
  async writeFile(p, data) {
    const abs = this.resolve(p);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    return fs.writeFile(abs, data);
  }
  async mkdir(p) { return fs.mkdir(this.resolve(p), { recursive: true }); }
  async readdir(p, opts) { return fs.readdir(this.resolve(p), opts); }
  async stat(p) { return fs.stat(this.resolve(p)); }
  async rm(p, opts) { return fs.rm(this.resolve(p), opts); }
}

/** Recursive walk that never leaves the scope and skips noise directories. */
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', 'dist', 'build', '.cache', '.next',
  '__pycache__', '.idea', '.vscode', 'vendor', '.gradle', 'Pods',
]);

export async function walk(scope, root, { maxFiles = 20000, maxDepth = 12 } = {}) {
  const out = [];
  const start = scope.resolve(root);
  const queue = [{ dir: start, depth: 0 }];
  while (queue.length && out.length < maxFiles) {
    const { dir, depth } = queue.shift();
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (!scope.contains(full)) continue;
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
        if (depth < maxDepth) queue.push({ dir: full, depth: depth + 1 });
      } else if (e.isFile()) {
        out.push({ path: full, rel: path.relative(start, full), depth });
        if (out.length >= maxFiles) break;
      }
    }
  }
  return out;
}

export const ext = (p) => path.extname(p).toLowerCase().replace('.', '');
export { path };
