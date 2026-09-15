/**
 * BACKUP / RESTORE (Phase 1).
 *
 * Real copies on disk, numbered and described. No button that pretends.
 *
 * WHAT IS BACKED UP (default)
 *   db/              every collection and state document - the lab's memory
 *   lab.config.json  workspace configuration (permissions, model settings)
 *
 * WHAT IS ADDED BY `full: true`
 *   datasets/        prepared training data
 *   generated/       generated game projects
 *
 * WHAT IS NEVER BACKED UP, and why
 *   imports/   copies of your own projects; they are large and you already own
 *              the originals, which the lab never modifies
 *   cache/     re-fetchable documentation cache
 *   exports/   already-exported bundles
 *   backups/   itself, which would recurse
 *
 * SAFETY RULES
 *   - a backup never writes inside the directories it is copying
 *   - it is built in a `.tmp` directory and renamed into place, so a crash
 *     mid-copy leaves no half-backup that looks complete
 *   - a restore ALWAYS takes a safety backup of the current state first
 *   - a restore swaps directories by rename and rolls the swap back if any
 *     step fails, so the workspace is never left half-restored
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { nowIso, bytes as fmtBytes } from './util.js';

/** Directories that must never end up inside a backup. */
export const NEVER_BACKUP = ['backups', 'cache', 'exports', 'imports'];

const DEFAULT_PARTS = ['db', 'config'];
const FULL_PARTS = ['db', 'config', 'datasets', 'generated'];

export class BackupManager {
  /** @param {{config:object, store:object, bus:object}} deps */
  constructor({ config, store, bus }) {
    this.config = config;
    this.store = store;
    this.bus = bus;
    this.root = path.join(config.workspace, 'backups');
  }

  async ensureRoot() {
    await fs.mkdir(this.root, { recursive: true });
    return this.root;
  }

  // ----------------------------------------------------------------- list

  /** Every complete backup, oldest first. Incomplete ones are ignored. */
  async list() {
    await this.ensureRoot();
    let entries = [];
    try { entries = await fs.readdir(this.root, { withFileTypes: true }); } catch { return []; }
    const out = [];
    for (const e of entries) {
      if (!e.isDirectory() || !/^backup-\d{3}/.test(e.name)) continue;
      const manifestPath = path.join(this.root, e.name, 'backup.json');
      try {
        const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
        out.push({ ...manifest, dir: path.join(this.root, e.name) });
      } catch {
        // No manifest means the copy never finished; report it rather than
        // silently offering a broken restore point.
        out.push({ id: e.name, index: parseIndex(e.name), incomplete: true, dir: path.join(this.root, e.name) });
      }
    }
    return out.sort((a, b) => (a.index || 0) - (b.index || 0));
  }

  async get(idOrIndex) {
    const all = await this.list();
    if (typeof idOrIndex === 'number') return all.find((b) => b.index === idOrIndex) || null;
    const key = String(idOrIndex);
    return all.find((b) => b.id === key)
      || all.find((b) => b.id?.startsWith(key))
      || all.find((b) => String(b.index) === key)
      || all.find((b) => String(b.index).padStart(3, '0') === key.padStart(3, '0'))
      || null;
  }

  async #nextIndex() {
    const all = await this.list();
    return all.reduce((max, b) => Math.max(max, b.index || 0), 0) + 1;
  }

  // --------------------------------------------------------------- create

  /**
   * @param {{note?:string, full?:boolean, parts?:string[], tag?:string}} opts
   * @returns manifest of the created backup
   */
  async create({ note = '', full = false, parts = null, tag = null } = {}) {
    await this.ensureRoot();
    const started = Date.now();
    const index = await this.#nextIndex();
    const id = `backup-${String(index).padStart(3, '0')}${tag ? `-${sanitize(tag)}` : ''}`;
    const finalDir = path.join(this.root, id);
    const tmpDir = `${finalDir}.tmp`;

    const wanted = (parts || (full ? FULL_PARTS : DEFAULT_PARTS))
      .filter((p) => !NEVER_BACKUP.includes(p));

    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.mkdir(tmpDir, { recursive: true });

    const contents = [];
    let totalBytes = 0;
    let totalFiles = 0;

    try {
      for (const part of wanted) {
        if (part === 'config') {
          const src = path.join(this.config.workspace, 'lab.config.json');
          try {
            const data = await fs.readFile(src);
            await fs.writeFile(path.join(tmpDir, 'lab.config.json'), data);
            contents.push({ part: 'config', files: 1, bytes: data.length });
            totalBytes += data.length;
            totalFiles += 1;
          } catch {
            contents.push({ part: 'config', files: 0, bytes: 0, note: 'no lab.config.json yet' });
          }
          continue;
        }
        const src = path.join(this.config.workspace, part);
        const dest = path.join(tmpDir, part);
        const stats = await copyTree(src, dest);
        contents.push({ part, files: stats.files, bytes: stats.bytes });
        totalBytes += stats.bytes;
        totalFiles += stats.files;
      }

      const manifest = {
        id,
        index,
        tag,
        note,
        createdAt: nowIso(),
        workspace: this.config.workspace,
        labVersion: await readLabVersion(),
        parts: wanted,
        contents,
        files: totalFiles,
        bytes: totalBytes,
        bytesHuman: fmtBytes(totalBytes),
        state: await this.#snapshotCounts(),
        excluded: NEVER_BACKUP,
        durationMs: Date.now() - started,
        format: 'directory-copy-v1',
      };
      await fs.writeFile(path.join(tmpDir, 'backup.json'), JSON.stringify(manifest, null, 2));

      // Rename only after everything is written: a backup directory without a
      // manifest can never appear as a usable restore point.
      await fs.rm(finalDir, { recursive: true, force: true });
      await fs.rename(tmpDir, finalDir);

      this.bus?.success('backup.created', { id, files: totalFiles, bytes: manifest.bytesHuman, parts: wanted.join(',') });
      return { ...manifest, dir: finalDir };
    } catch (err) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      this.bus?.error('backup.failed', { id, error: err.message });
      throw new Error(`backup failed: ${err.message}`);
    }
  }

  /** Counts stored in the manifest so a restore point can be recognised later. */
  async #snapshotCounts() {
    const names = ['projects', 'knowledge', 'designs', 'generated', 'lessons', 'experiments', 'versions', 'tasks', 'assets', 'datasets'];
    const counts = {};
    for (const name of names) {
      try { counts[name] = await this.store.collection(name).count(); } catch { counts[name] = null; }
    }
    return counts;
  }

  // -------------------------------------------------------------- restore

  /**
   * Restores a backup over the current workspace.
   *
   * Order of operations, all of it deliberate:
   *   1. validate the backup (manifest + expected parts present)
   *   2. take a safety backup of the CURRENT state, tagged `pre-restore`
   *   3. for each part: copy backup -> `<part>.restoring`
   *   4. swap: `<part>` -> `<part>.replaced-<ts>`, `<part>.restoring` -> `<part>`
   *   5. on any failure, swap everything back and delete the partial copies
   *   6. drop the store's in-memory caches so the process sees restored data
   *
   * @param {string|number} idOrIndex
   * @param {{safetyBackup?:boolean, parts?:string[]}} opts
   */
  async restore(idOrIndex, { safetyBackup = true, parts = null } = {}) {
    const backup = await this.get(idOrIndex);
    if (!backup) throw new Error(`backup "${idOrIndex}" not found`);
    if (backup.incomplete) throw new Error(`backup "${backup.id}" is incomplete (no manifest) and cannot be restored`);

    const wanted = (parts || backup.parts || DEFAULT_PARTS).filter((p) => !NEVER_BACKUP.includes(p));
    const started = Date.now();

    let safety = null;
    if (safetyBackup) {
      safety = await this.create({ tag: 'pre-restore', note: `automatic safety copy taken before restoring ${backup.id}` });
    }

    const swapped = [];   // { live, parked }
    const staged = [];    // directories to clean up on failure
    try {
      // 3. stage every part first; nothing live is touched yet
      for (const part of wanted) {
        if (part === 'config') continue;
        const src = path.join(backup.dir, part);
        if (!(await exists(src))) continue;
        const staging = path.join(this.config.workspace, `${part}.restoring`);
        await fs.rm(staging, { recursive: true, force: true });
        await copyTree(src, staging);
        staged.push({ part, staging });
      }

      // 4. swap staged directories into place
      const stamp = Date.now().toString(36);
      for (const { part, staging } of staged) {
        const live = path.join(this.config.workspace, part);
        const parked = `${live}.replaced-${stamp}`;
        if (await exists(live)) {
          await fs.rename(live, parked);
          swapped.push({ live, parked });
        } else {
          swapped.push({ live, parked: null });
        }
        await fs.rename(staging, live);
      }

      // config last: a single small file, copied rather than swapped
      if (wanted.includes('config')) {
        const src = path.join(backup.dir, 'lab.config.json');
        if (await exists(src)) {
          await fs.copyFile(src, path.join(this.config.workspace, 'lab.config.json'));
        }
      }

      // 6. the process is holding cached documents from the previous database
      if (typeof this.store.reload === 'function') this.store.reload();

      // the parked originals are only removed once everything else succeeded
      for (const { parked } of swapped) {
        if (parked) await fs.rm(parked, { recursive: true, force: true }).catch(() => {});
      }

      const result = {
        restored: backup.id,
        parts: wanted,
        safetyBackup: safety ? safety.id : null,
        counts: await this.#snapshotCounts(),
        durationMs: Date.now() - started,
        at: nowIso(),
      };
      this.bus?.success('backup.restored', { id: backup.id, parts: wanted.join(','), safetyBackup: result.safetyBackup });
      return result;
    } catch (err) {
      // 5. roll the swap back, newest first
      for (const { live, parked } of swapped.reverse()) {
        try {
          if (parked && await exists(parked)) {
            await fs.rm(live, { recursive: true, force: true }).catch(() => {});
            await fs.rename(parked, live);
          }
        } catch { /* best effort: the safety backup is the last line of defence */ }
      }
      for (const { staging } of staged) await fs.rm(staging, { recursive: true, force: true }).catch(() => {});
      this.bus?.error('backup.restore.failed', { id: backup.id, error: err.message, safetyBackup: safety?.id || null });
      throw new Error(`restore failed and the workspace was rolled back: ${err.message}`);
    }
  }

  // --------------------------------------------------------------- delete

  /** Removes a backup. Refuses without an explicit id - no wildcard deletes. */
  async remove(idOrIndex) {
    const backup = await this.get(idOrIndex);
    if (!backup) throw new Error(`backup "${idOrIndex}" not found`);
    await fs.rm(backup.dir, { recursive: true, force: true });
    this.bus?.warn('backup.removed', { id: backup.id });
    return { removed: backup.id };
  }

  async stats() {
    const all = await this.list();
    return {
      count: all.length,
      complete: all.filter((b) => !b.incomplete).length,
      incomplete: all.filter((b) => b.incomplete).length,
      latest: all.length ? all[all.length - 1].id : null,
      latestAt: all.length ? all[all.length - 1].createdAt || null : null,
      totalBytes: all.reduce((s, b) => s + (b.bytes || 0), 0),
      root: this.root,
      excluded: NEVER_BACKUP,
    };
  }
}

// ---------------------------------------------------------------- helpers

async function exists(p) {
  try { await fs.stat(p); return true; } catch { return false; }
}

function parseIndex(name) {
  const m = String(name).match(/^backup-(\d{3})/);
  return m ? parseInt(m[1], 10) : 0;
}

function sanitize(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
}

/** Recursive copy that reports what it moved. Missing source is not an error. */
async function copyTree(src, dest) {
  const stats = { files: 0, bytes: 0 };
  if (!(await exists(src))) return stats;
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const from = path.join(src, e.name);
    const to = path.join(dest, e.name);
    if (e.isDirectory()) {
      const sub = await copyTree(from, to);
      stats.files += sub.files;
      stats.bytes += sub.bytes;
    } else if (e.isFile()) {
      // Skip the store's transient write files: they are mid-write by
      // definition and restoring one would corrupt a document.
      if (e.name.endsWith('.tmp')) continue;
      await fs.copyFile(from, to);
      const st = await fs.stat(to);
      stats.files += 1;
      stats.bytes += st.size;
    }
  }
  return stats;
}

async function readLabVersion() {
  try {
    const url = new URL('../../package.json', import.meta.url);
    const pkg = JSON.parse(await fs.readFile(url, 'utf8'));
    return pkg.version || null;
  } catch { return null; }
}
