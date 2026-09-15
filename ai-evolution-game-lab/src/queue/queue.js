/**
 * TASK QUEUE (spec 38, 43).
 *
 * Persistent, resumable work list with pause/resume/stop. Tasks survive a
 * restart because they live in the store, not in memory - which is what makes
 * "keep working while I am away" true for the backend process (and honestly
 * false for a closed browser tab; the UI says so).
 */
import { nowIso, id as makeId } from '../core/util.js';

export const TASK_STATES = ['queued', 'running', 'done', 'failed', 'cancelled'];

export class TaskQueue {
  constructor({ store, bus }) {
    this.store = store;
    this.bus = bus;
    this.handlers = new Map();
    this.state = 'idle'; // idle | running | paused | stopping
    this.current = null;
    this.loopPromise = null;
  }

  /** Register a handler: fn(payload, ctx) -> result */
  handle(type, fn) { this.handlers.set(type, fn); return this; }

  async add(type, payload = {}, { priority = 5, label = null } = {}) {
    const task = await this.store.tasks.put({
      id: makeId('task'),
      type,
      label: label || type,
      payload,
      priority,
      state: 'queued',
      attempts: 0,
      result: null,
      error: null,
      queuedAt: nowIso(),
    });
    this.bus?.info('task.queued', { id: task.id, type, label: task.label });
    return task;
  }

  async list() {
    const all = await this.store.tasks.all();
    return all.sort((a, b) => (a.queuedAt || '').localeCompare(b.queuedAt || ''));
  }

  async pending() {
    const all = await this.store.tasks.all();
    return all.filter((t) => t.state === 'queued').sort((a, b) => b.priority - a.priority || (a.queuedAt || '').localeCompare(b.queuedAt || ''));
  }

  async cancel(id) {
    const t = await this.store.tasks.get(id);
    if (!t || t.state === 'done') return t;
    return this.store.tasks.patch(id, { state: 'cancelled', finishedAt: nowIso() });
  }

  async clearFinished() {
    for (const t of await this.store.tasks.all()) {
      if (['done', 'failed', 'cancelled'].includes(t.state)) await this.store.tasks.remove(t.id);
    }
  }

  status() {
    return { state: this.state, current: this.current ? { id: this.current.id, type: this.current.type, label: this.current.label } : null };
  }

  pause() { if (this.state === 'running') this.state = 'paused'; this.bus?.info('queue.pause', {}); return this.status(); }
  resume() { if (this.state === 'paused') { this.state = 'running'; this.bus?.info('queue.resume', {}); } return this.status(); }
  stop() { if (this.state !== 'idle') this.state = 'stopping'; this.bus?.warn('queue.stop', {}); return this.status(); }

  /** Starts the worker loop. Safe to call repeatedly. */
  start() {
    if (this.loopPromise) return this.loopPromise;
    this.state = 'running';
    this.loopPromise = this.#loop().finally(() => { this.loopPromise = null; });
    return this.loopPromise;
  }

  async #loop() {
    this.bus?.info('queue.start', {});
    while (this.state !== 'stopping') {
      if (this.state === 'paused') { await sleep(300); continue; }
      const [next] = await this.pending();
      if (!next) {
        if (this.state === 'running' && this.drainAndStop) break;
        await sleep(400);
        continue;
      }
      await this.#runTask(next);
    }
    this.state = 'idle';
    this.current = null;
    this.bus?.info('queue.idle', {});
  }

  /** Runs the queue until it is empty, then stops (used by the CLI). */
  async drain() {
    this.drainAndStop = true;
    await this.start();
    this.drainAndStop = false;
  }

  async #runTask(task) {
    const handler = this.handlers.get(task.type);
    this.current = task;
    await this.store.tasks.patch(task.id, { state: 'running', startedAt: nowIso(), attempts: (task.attempts || 0) + 1 });
    this.bus?.info('task.start', { id: task.id, type: task.type, label: task.label });
    if (!handler) {
      await this.store.tasks.patch(task.id, { state: 'failed', error: `no handler registered for "${task.type}"`, finishedAt: nowIso() });
      this.bus?.error('task.failed', { id: task.id, type: task.type, error: 'no handler' });
      this.current = null;
      return;
    }
    try {
      const result = await handler(task.payload, { task, bus: this.bus });
      await this.store.tasks.patch(task.id, { state: 'done', result: summarize(result), finishedAt: nowIso() });
      this.bus?.success('task.done', { id: task.id, type: task.type, label: task.label });
    } catch (err) {
      await this.store.tasks.patch(task.id, { state: 'failed', error: err.message, stack: String(err.stack).split('\n').slice(0, 4).join(' | '), finishedAt: nowIso() });
      this.bus?.error('task.failed', { id: task.id, type: task.type, error: err.message });
    } finally {
      this.current = null;
    }
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** Keeps task records small: results can be large objects. */
function summarize(result) {
  if (result === undefined || result === null) return null;
  if (typeof result !== 'object') return result;
  const json = JSON.stringify(result);
  if (json.length < 4000) return result;
  return { summary: `${json.slice(0, 800)}...`, truncated: true, bytes: json.length };
}
