/**
 * Event bus + rolling log. The HTTP layer streams these to the dashboard over
 * SSE; the CLI prints them. Everything the agent does emits an event, so the
 * UI never has to poll for "what is it doing right now".
 */
import { EventEmitter } from 'node:events';
import { nowIso } from './util.js';

export class Bus extends EventEmitter {
  constructor({ keep = 2000 } = {}) {
    super();
    this.setMaxListeners(64);
    this.log = [];
    this.keep = keep;
    this.seq = 0;
  }

  emitEvent(type, data = {}, level = 'info') {
    const evt = { seq: ++this.seq, at: nowIso(), type, level, ...data };
    this.log.push(evt);
    if (this.log.length > this.keep) this.log.splice(0, this.log.length - this.keep);
    this.emit('event', evt);
    this.emit(type, evt);
    return evt;
  }

  info(type, data) { return this.emitEvent(type, data, 'info'); }
  warn(type, data) { return this.emitEvent(type, data, 'warn'); }
  error(type, data) { return this.emitEvent(type, data, 'error'); }
  success(type, data) { return this.emitEvent(type, data, 'success'); }

  tail(n = 200, sinceSeq = 0) {
    return this.log.filter((e) => e.seq > sinceSeq).slice(-n);
  }
}

export const bus = new Bus();
