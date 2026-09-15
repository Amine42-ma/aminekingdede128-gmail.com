/**
 * Tiny append-friendly JSON document store.
 *
 * Collections live as <workspace>/db/<collection>/<id>.json plus an index file.
 * No database dependency, human-inspectable on disk, atomic-ish writes
 * (tmp file + rename). Good enough for a single-user lab; the interface is
 * narrow so it can be swapped for SQLite later without touching callers.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { id as makeId, nowIso } from './util.js';

export class Collection {
  constructor(store, name) {
    this.store = store;
    this.name = name;
    this.dir = path.join(store.root, 'db', name);
    this.cache = new Map();
    this.loaded = false;
  }

  async ensure() {
    if (this.loaded) return;
    await fs.mkdir(this.dir, { recursive: true });
    let files = [];
    try { files = await fs.readdir(this.dir); } catch { /* empty */ }
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(this.dir, f), 'utf8');
        const doc = JSON.parse(raw);
        this.cache.set(doc.id, doc);
      } catch { /* skip corrupt document rather than failing the whole lab */ }
    }
    this.loaded = true;
  }

  async all() { await this.ensure(); return [...this.cache.values()]; }

  async get(id) { await this.ensure(); return this.cache.get(id) || null; }

  async find(pred) { await this.ensure(); return [...this.cache.values()].filter(pred); }

  async findOne(pred) { await this.ensure(); return [...this.cache.values()].find(pred) || null; }

  async count() { await this.ensure(); return this.cache.size; }

  async put(doc) {
    await this.ensure();
    const record = { ...doc };
    if (!record.id) record.id = makeId(this.name.slice(0, 4));
    if (!record.createdAt) record.createdAt = nowIso();
    record.updatedAt = nowIso();
    this.cache.set(record.id, record);
    const file = path.join(this.dir, `${record.id}.json`);
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(record, null, 2));
    await fs.rename(tmp, file);
    return record;
  }

  async patch(id, changes) {
    const cur = await this.get(id);
    if (!cur) return null;
    return this.put({ ...cur, ...changes });
  }

  async remove(id) {
    await this.ensure();
    this.cache.delete(id);
    try { await fs.rm(path.join(this.dir, `${id}.json`)); } catch { /* already gone */ }
  }

  async clear() {
    await this.ensure();
    for (const id of [...this.cache.keys()]) await this.remove(id);
  }
}

export class Store {
  constructor(root) {
    this.root = root;
    this.collections = new Map();
  }

  collection(name) {
    if (!this.collections.has(name)) this.collections.set(name, new Collection(this, name));
    return this.collections.get(name);
  }

  // Named accessors keep call sites readable and typo-proof.
  get projects() { return this.collection('projects'); }
  get files() { return this.collection('files'); }
  get knowledge() { return this.collection('knowledge'); }
  get designs() { return this.collection('designs'); }
  get generated() { return this.collection('generated'); }
  get lessons() { return this.collection('lessons'); }
  get experiments() { return this.collection('experiments'); }
  get versions() { return this.collection('versions'); }
  get tasks() { return this.collection('tasks'); }
  get runs() { return this.collection('runs'); }
  get assets() { return this.collection('assets'); }
  get research() { return this.collection('research'); }
  get datasets() { return this.collection('datasets'); }
  get models() { return this.collection('models'); }

  /** Single-document key/value slots (graph, settings, counters). */
  async getState(key, fallback = null) {
    const file = path.join(this.root, 'db', 'state', `${key}.json`);
    try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
  }

  async setState(key, value) {
    const file = path.join(this.root, 'db', 'state', `${key}.json`);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value, null, 2));
    await fs.rename(tmp, file);
    return value;
  }
}
