/**
 * Lab configuration and permission scopes (spec 44, 45, 51, 52).
 *
 * Defaults are deliberately restrictive:
 *   - the agent may only touch the workspace directory
 *   - network access is OFF until the user turns it on
 *   - nothing the user imported is ever modified or deleted; imports are copied
 *     into the workspace and originals are read-only
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { Scope } from './paths.js';

export const DEFAULT_PERMISSIONS = {
  readImports: true,       // read the folders the user granted
  writeWorkspace: true,    // write inside <workspace>
  network: false,          // research engine / remote model providers
  runSandbox: true,        // execute generated code in the in-process VM sandbox
  runBrowser: false,       // drive a real browser (requires playwright, opt-in)
  shell: false,            // never on by default
  modifyImports: false,    // never true: originals stay untouched
};

export class Config {
  constructor(data = {}) {
    this.workspace = path.resolve(data.workspace || process.env.LAB_WORKSPACE || path.join(os.homedir(), 'AI-LAB'));
    this.importRoots = (data.importRoots || []).map((p) => path.resolve(p));
    this.permissions = { ...DEFAULT_PERMISSIONS, ...(data.permissions || {}), modifyImports: false };
    this.models = data.models || { default: 'heuristic', providers: {} };
    this.limits = {
      maxFilesPerProject: 4000,
      maxFileBytes: 4 * 1024 * 1024,
      maxProjects: 2000,
      sandboxFrames: 600,
      sandboxTimeoutMs: 8000,
      autonomousMaxCycles: 25,
      ...(data.limits || {}),
    };
    this.research = {
      allowlist: [
        'developer.mozilla.org', 'html.spec.whatwg.org', 'www.w3.org', 'w3.org',
        'registry.khronos.org', 'www.khronos.org', 'threejs.org', 'nodejs.org',
        'tc39.es', 'web.dev', 'developer.chrome.com', 'wiki.mozilla.org',
        'caniuse.com', 'developer.apple.com',
      ],
      minSources: 2,
      ...(data.research || {}),
    };
    this.ui = { locale: data.ui?.locale || 'ar', theme: data.ui?.theme || 'dark' };
  }

  get dirs() {
    const w = this.workspace;
    return {
      workspace: w,
      db: path.join(w, 'db'),
      imports: path.join(w, 'imports'),
      generated: path.join(w, 'generated'),
      snapshots: path.join(w, 'snapshots'),
      exports: path.join(w, 'exports'),
      cache: path.join(w, 'cache'),
      datasets: path.join(w, 'datasets'),
      models: path.join(w, 'models'),
    };
  }

  /** Scope = workspace + every import root the user granted. */
  scope() {
    return new Scope([this.workspace, ...this.importRoots]);
  }

  toJSON() {
    return {
      workspace: this.workspace,
      importRoots: this.importRoots,
      permissions: this.permissions,
      models: this.models,
      limits: this.limits,
      research: this.research,
      ui: this.ui,
    };
  }

  static configPath(workspace) { return path.join(workspace, 'lab.config.json'); }

  static async load(workspace) {
    const ws = path.resolve(workspace || process.env.LAB_WORKSPACE || path.join(os.homedir(), 'AI-LAB'));
    let data = {};
    try { data = JSON.parse(await fs.readFile(Config.configPath(ws), 'utf8')); } catch { /* first run */ }
    const cfg = new Config({ ...data, workspace: ws });
    await cfg.ensureDirs();
    return cfg;
  }

  async ensureDirs() {
    for (const dir of Object.values(this.dirs)) await fs.mkdir(dir, { recursive: true });
  }

  async save() {
    await this.ensureDirs();
    await fs.writeFile(Config.configPath(this.workspace), JSON.stringify(this.toJSON(), null, 2));
    return this;
  }
}
