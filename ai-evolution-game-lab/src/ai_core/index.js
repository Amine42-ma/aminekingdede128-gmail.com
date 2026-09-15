/**
 * AI CORE - foundation (Phase 1).
 *
 * WHAT THIS IS
 * ------------
 * The mounting point for this project's *own* intelligence. It owns nothing
 * clever yet: Phase 1 delivers the skeleton, the lifecycle, the persistent
 * state and the registration contract that later phases plug into.
 *
 * WHAT THIS IS NOT
 * ----------------
 * It is NOT an AI yet. There is no tokenizer, no vocabulary, no embeddings, no
 * semantic memory, no planner, no model and no weights in this file. Every
 * capability below reports `false`, and `status().honest` says so in words, so
 * the dashboard and the logs cannot accidentally imply otherwise.
 *
 * DESIGN RULES (carried into every later phase)
 * ---------------------------------------------
 * 1. No external model API is ever the brain. This core runs locally, offline,
 *    with no network. Remote providers stay optional adapters in src/models/.
 * 2. It depends only on what the lab already has: `config`, `store`, `bus`.
 *    It introduces no new storage engine and no new event system.
 * 3. It is independent of the dashboard: the UI reads `status()`, nothing more.
 * 4. Modules register themselves; the core never imports them directly, so
 *    adding Phase 2's tokenizer touches this file zero times.
 */
import { nowIso } from '../core/util.js';

export const AI_CORE_VERSION = '0.1.0';
export const STATE_KEY = 'ai_core';

/**
 * Capability flags. Phase 1 declares every one of them false, on purpose.
 * A later phase flips a flag ONLY when the thing behind it genuinely works and
 * is covered by a test.
 */
export const CAPABILITIES = {
  tokenizer: false,        // Phase 2
  vocabulary: false,       // Phase 2
  conceptVectors: false,   // Phase 2
  semanticMemory: false,   // Phase 2
  ast: false,              // Phase 4
  assetLibrary: false,     // Phase 5
  training: false,         // Phase 7
  nlu: false,              // Phase 8 (Arabic + English)
  planner: false,          // Phase 9
  selfLearning: false,     // Phase 10
};

/**
 * Base class every AI Core module extends. Keeping the contract tiny is what
 * makes later phases additive: a module is a name, an optional init, an
 * optional status, and an optional dispose.
 */
export class AIModule {
  /** @param {{name:string, phase?:number, core?:AICore}} opts */
  constructor({ name, phase = null } = {}) {
    if (!name) throw new Error('an AI Core module needs a name');
    this.name = name;
    this.phase = phase;
    this.core = null;
    this.ready = false;
  }

  /** Called once by AICore.init(). Override in later phases. */
  async init() { this.ready = true; }

  /** Override to report real numbers. Must never overstate. */
  status() { return { name: this.name, phase: this.phase, ready: this.ready }; }

  /** Override if the module holds handles that need releasing. */
  async dispose() { this.ready = false; }
}

export class AICore {
  /**
   * @param {{config:object, store:object, bus:object}} deps - the lab's own
   *   dependencies, injected exactly like every other subsystem.
   */
  constructor({ config, store, bus }) {
    if (!store) throw new Error('AICore requires the lab store');
    this.config = config;
    this.store = store;
    this.bus = bus;
    this.version = AI_CORE_VERSION;
    this.modules = new Map();
    this.initialized = false;
    this.state = null;
    this.startedAt = null;
  }

  // ------------------------------------------------------------- lifecycle

  /**
   * Loads persistent state and initialises every registered module.
   * Safe to call more than once: the second call is a no-op that still returns
   * the status, so callers never have to guard.
   */
  async init() {
    if (this.initialized) return this.status();
    const previous = await this.store.getState(STATE_KEY, null);

    this.state = {
      version: this.version,
      createdAt: previous?.createdAt || nowIso(),
      firstVersion: previous?.firstVersion || this.version,
      initCount: (previous?.initCount || 0) + 1,
      lastInitAt: nowIso(),
      // Modules record their own durable state under this namespace so a
      // Phase 2 tokenizer can persist its vocabulary without new plumbing.
      modules: previous?.modules || {},
      // A simple, honest record of what the core has been asked to do.
      counters: previous?.counters || { requests: 0 },
    };

    const failures = [];
    for (const module of this.modules.values()) {
      try {
        module.core = this;
        await module.init();
      } catch (err) {
        failures.push({ module: module.name, error: err.message });
        this.bus?.error('ai_core.module.failed', { module: module.name, error: err.message });
      }
    }

    this.initialized = true;
    this.startedAt = nowIso();
    await this.saveState();

    this.bus?.success('ai_core.init', {
      version: this.version,
      modules: this.modules.size,
      initCount: this.state.initCount,
      failures: failures.length,
    });
    return { ...this.status(), failures };
  }

  async dispose() {
    for (const module of this.modules.values()) {
      try { await module.dispose(); } catch { /* a failing dispose must not block shutdown */ }
    }
    this.initialized = false;
  }

  // -------------------------------------------------------------- modules

  /**
   * Registers a module. Later phases call this from `Lab`; the core never
   * imports module implementations itself.
   * @param {AIModule} module
   */
  register(module) {
    if (!(module instanceof AIModule)) throw new Error('AI Core modules must extend AIModule');
    if (this.modules.has(module.name)) throw new Error(`AI Core module "${module.name}" is already registered`);
    this.modules.set(module.name, module);
    module.core = this;
    this.bus?.info('ai_core.register', { module: module.name, phase: module.phase });
    return module;
  }

  has(name) { return this.modules.has(name); }

  /** @returns {AIModule|null} */
  get(name) { return this.modules.get(name) || null; }

  /**
   * Throws a clear error instead of returning undefined, so a later phase that
   * depends on a module which is not installed fails loudly rather than
   * silently degrading into fake behaviour.
   */
  require(name) {
    const module = this.modules.get(name);
    if (!module) throw new Error(`AI Core module "${name}" is not installed (NOT IMPLEMENTED in this build)`);
    if (!module.ready) throw new Error(`AI Core module "${name}" is registered but not initialised`);
    return module;
  }

  // ---------------------------------------------------------------- state

  /** Per-module durable state, stored inside the lab's existing state store. */
  moduleState(name) {
    if (!this.state) return null;
    if (!this.state.modules[name]) this.state.modules[name] = {};
    return this.state.modules[name];
  }

  async setModuleState(name, patch) {
    const current = this.moduleState(name) || {};
    this.state.modules[name] = { ...current, ...patch, updatedAt: nowIso() };
    await this.saveState();
    return this.state.modules[name];
  }

  async saveState() {
    if (!this.state) return null;
    return this.store.setState(STATE_KEY, this.state);
  }

  /** Re-reads state from disk. Used after a restore replaces the database. */
  async reloadState() {
    this.state = await this.store.getState(STATE_KEY, this.state);
    return this.state;
  }

  // --------------------------------------------------------------- status

  /**
   * What the core can honestly claim. Every capability is false in Phase 1 and
   * `honest` spells that out, because a status object that looks impressive is
   * exactly how a project starts lying to its owner.
   */
  capabilities() {
    const caps = { ...CAPABILITIES };
    for (const module of this.modules.values()) {
      if (module.ready && module.capability && caps[module.capability] !== undefined) {
        caps[module.capability] = true;
      }
    }
    return caps;
  }

  status() {
    const caps = this.capabilities();
    const active = Object.entries(caps).filter(([, on]) => on).map(([k]) => k);
    return {
      version: this.version,
      initialized: this.initialized,
      local: true,
      externalModelUsed: false,
      startedAt: this.startedAt,
      initCount: this.state?.initCount ?? 0,
      createdAt: this.state?.createdAt ?? null,
      modules: [...this.modules.values()].map((m) => m.status()),
      moduleCount: this.modules.size,
      capabilities: caps,
      activeCapabilities: active,
      phase: 1,
      honest: active.length === 0
        ? 'Phase 1 foundation only: lifecycle, module registry and persistent state. No tokenizer, no memory, no model, no training, no reasoning. This core is not intelligent yet and does not claim to be.'
        : `Active capabilities: ${active.join(', ')}. Everything else is not implemented yet.`,
    };
  }

  /** Counts a call made through the core. Used later to report real usage. */
  async countRequest(kind = 'generic') {
    if (!this.state) return;
    this.state.counters.requests = (this.state.counters.requests || 0) + 1;
    this.state.counters[kind] = (this.state.counters[kind] || 0) + 1;
    await this.saveState();
  }
}
