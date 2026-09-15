/**
 * Execution sandbox (spec 27, 51).
 *
 * Runs a generated game inside node:vm with the DOM stub, drives frames on a
 * virtual clock, injects input, and reports what happened. Untrusted-code
 * safety: the VM context has no require, no process, no fs, no network, and
 * every script runs under a wall-clock timeout.
 */
import vm from 'node:vm';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createDom, fire } from './domstub.js';

const FRAME_MS = 1000 / 60;

export class Sandbox {
  constructor({ timeoutMs = 8000, width = 960, height = 540 } = {}) {
    this.timeoutMs = timeoutMs;
    this.width = width;
    this.height = height;
  }

  /**
   * @param {Array<{name:string, code:string}>} scripts in load order
   * @returns {object} handle with step()/press()/snapshot()
   */
  load(scripts) {
    const dom = createDom({ width: this.width, height: this.height });
    const context = vm.createContext(dom.win, { name: 'lab-sandbox', codeGeneration: { strings: false, wasm: false } });
    const errors = [];

    for (const s of scripts) {
      try {
        vm.runInContext(s.code, context, { filename: s.name, timeout: this.timeoutMs, displayErrors: true });
      } catch (err) {
        errors.push({ phase: 'load', file: s.name, message: err.message, stack: cleanStack(err.stack), line: lineOf(err.stack, s.name) });
        break; // a script that fails to parse makes everything after it meaningless
      }
    }

    const state = dom.state;
    const self = this;

    const runTimers = () => {
      const due = state.timers.filter((t) => t.at <= state.time);
      state.timers = state.timers.filter((t) => t.at > state.time);
      for (const t of due) {
        try { t.fn(); } catch (err) { errors.push({ phase: 'timer', message: err.message, stack: cleanStack(err.stack) }); }
        if (t.every) { t.at = state.time + t.every; state.timers.push(t); }
      }
    };

    const handle = {
      dom,
      context,
      errors,
      logs: state.logs,
      get lab() { return dom.win.__LAB__ || null; },

      /** Advance one frame: run the rAF queue with the virtual clock. */
      step(frames = 1, deltaMs = FRAME_MS) {
        for (let i = 0; i < frames; i++) {
          state.time += deltaMs;
          const queue = state.rafQueue;
          state.rafQueue = [];
          for (const entry of queue) {
            try {
              entry.fn(state.time);
            } catch (err) {
              errors.push({ phase: 'frame', frame: i, message: err.message, stack: cleanStack(err.stack), line: lineOf(err.stack) });
              if (errors.length > 12) return handle;
            }
          }
          runTimers();
        }
        return handle;
      },

      press(action) { try { dom.win.__LAB__?.press(action); } catch (err) { errors.push({ phase: 'input', message: err.message }); } },
      release(action) { try { dom.win.__LAB__?.release(action); } catch (err) { errors.push({ phase: 'input', message: err.message }); } },
      key(code, down = true) {
        fire(dom.win, down ? 'keydown' : 'keyup', { code, key: code });
      },
      pointer(x, y, type = 'pointermove') {
        const evt = { type, clientX: x, clientY: y, button: 0, pointerId: 1, preventDefault() {}, stopPropagation() {} };
        dom.stage.dispatchEvent(evt);
      },
      click(el) { el?.dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {} }); },
      hide() { dom.doc.hidden = true; fire(dom.win, 'visibilitychange'); },
      show() { dom.doc.hidden = false; fire(dom.win, 'visibilitychange'); },

      snapshot() {
        try { return dom.win.__LAB__ ? dom.win.__LAB__.snapshot() : null; } catch (err) {
          errors.push({ phase: 'snapshot', message: err.message });
          return null;
        }
      },

      canvas() { return dom.ctx(); },

      dispose() {
        state.rafQueue.length = 0;
        state.timers.length = 0;
      },
    };

    // main.js boots on DOMContentLoaded if the document were loading; our stub
    // reports 'complete', so boot already ran during load. Fire it anyway for
    // games that listen regardless - listeners are idempotent here.
    fire(dom.win, 'DOMContentLoaded');
    return handle;
  }

  /** Convenience: read a generated project from disk in script order. */
  async loadProject(dir, scriptOrder) {
    const scripts = [];
    for (const rel of scriptOrder) {
      const abs = path.join(dir, rel);
      scripts.push({ name: rel, code: await fs.readFile(abs, 'utf8') });
    }
    return this.load(scripts);
  }

  /** Same, but from an in-memory file map (no disk round-trip). */
  loadFiles(files, scriptOrder) {
    return this.load(scriptOrder.map((rel) => ({ name: rel, code: files.get(rel) })));
  }
}

function cleanStack(stack = '') {
  return String(stack).split('\n').slice(0, 6).map((l) => l.trim()).join(' | ');
}

function lineOf(stack = '', file = '') {
  const m = String(stack).match(new RegExp(`${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:(\\d+):(\\d+)`));
  if (m) return { line: +m[1], column: +m[2] };
  const g = String(stack).match(/:(\d+):(\d+)/);
  return g ? { line: +g[1], column: +g[2] } : null;
}
