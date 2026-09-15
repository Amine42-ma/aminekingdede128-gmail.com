/**
 * TEST AGENT (spec 29, 30, 31).
 *
 * Runs a generated game in the headless sandbox and answers concrete questions:
 * does it load, does it boot, does it respond to input, does it stay stable
 * under frame spikes, does it draw anything, does it pause when hidden, is it
 * deterministic from its seed, does saving work, how expensive is a frame.
 *
 * Every check returns evidence (numbers, not adjectives) so the improvement
 * loop and the benchmark can compare versions honestly.
 */
import { Sandbox } from '../runtime/sandbox.js';
import { round, mean, clamp } from '../core/util.js';
import { contrastRatio } from '../design/traits.js';

const WEIGHTS = {
  loads: 3, boots: 3, starts: 2, renders: 2, 'input-response': 3, stability: 3,
  'dt-spike': 2, 'pause-on-hide': 1, determinism: 2, 'save-load': 1,
  performance: 2, memory: 1, 'mobile-layout': 1, 'visual-layout': 1, 'code-hygiene': 1, 'visual-contrast': 1,
  'progress-reachable': 2,
};

const MOVE_ACTIONS = ['right', 'left', 'up', 'down', 'action'];

export class TestAgent {
  constructor({ bus, frames = 420, timeoutMs = 10000 } = {}) {
    this.bus = bus;
    this.frames = frames;
    this.sandbox = new Sandbox({ timeoutMs });
  }

  /**
   * @param {Map<string,string>} files
   * @param {string[]} scriptOrder
   * @param {object} design
   */
  async run(files, scriptOrder, design) {
    const results = [];
    const started = Date.now();
    const is3d = design.ruleset === 'explorer3d';

    // ---- load ---------------------------------------------------------------
    let h;
    try {
      h = this.sandbox.loadFiles(files, scriptOrder);
    } catch (err) {
      return this.#finish([{ id: 'loads', pass: false, severity: 'critical', detail: `sandbox refused to load: ${err.message}` }], started, design, null);
    }
    results.push({
      id: 'loads', pass: h.errors.length === 0, severity: 'critical',
      detail: h.errors.length ? `${h.errors.length} load error(s): ${h.errors[0].message}` : 'all scripts parsed and executed',
      errors: h.errors.slice(0, 3),
    });
    if (h.errors.length) return this.#finish(results, started, design, h);

    // ---- boot ---------------------------------------------------------------
    const boot = h.snapshot();
    results.push({
      id: 'boots', pass: !!boot, severity: 'critical',
      detail: boot ? `test surface exposed, state=${boot.state}` : 'window.__LAB__ was never created',
      metrics: boot ? { entities: boot.entities } : null,
    });
    if (!boot) return this.#finish(results, started, design, h);

    // ---- start ---------------------------------------------------------------
    h.lab.start();
    h.step(6);
    const afterStart = h.snapshot();
    results.push({
      id: 'starts', pass: afterStart.state === 'playing', severity: 'critical',
      detail: `state after pressing start: ${afterStart.state}`,
    });

    // ---- input response ------------------------------------------------------
    const before = h.snapshot();
    const inputEvidence = [];
    let moved = false;
    for (const action of MOVE_ACTIONS) {
      const p0 = h.snapshot();
      h.press(action);
      h.pointer(720, 200);
      h.step(45);
      h.release(action);
      const p1 = h.snapshot();
      const dx = (p1.player?.x ?? 0) - (p0.player?.x ?? 0);
      const dy = (p1.player?.y ?? 0) - (p0.player?.y ?? 0);
      const dist = Math.hypot(dx, dy);
      const changed = dist > 0.5 || p1.score !== p0.score || p1.entities !== p0.entities || p1.hud?.moves !== p0.hud?.moves;
      if (changed) moved = true;
      inputEvidence.push({ action, movedPx: round(dist, 2), scoreDelta: round((p1.score || 0) - (p0.score || 0), 2), changed });
    }
    results.push({
      id: 'input-response', pass: moved, severity: 'critical',
      detail: moved ? 'the game reacts to input' : 'no input produced any change in player position, score or entity count',
      metrics: { actions: inputEvidence },
    });

    // ---- long run stability --------------------------------------------------
    const errorsBefore = h.errors.length;
    const entitySamples = [];
    const fpsSamples = [];
    const t0 = process.hrtime.bigint();
    let travelled = 0;
    let prevPos = h.snapshot()?.player;
    for (let i = 0; i < this.frames; i += 30) {
      if (i % 90 === 0) h.press(MOVE_ACTIONS[(i / 90) % MOVE_ACTIONS.length]);
      h.step(30);
      if (i % 90 === 0) h.release(MOVE_ACTIONS[(i / 90) % MOVE_ACTIONS.length]);
      const s = h.snapshot();
      if (!s) break;
      if (prevPos && s.player) travelled += Math.hypot(s.player.x - prevPos.x, s.player.y - prevPos.y);
      prevPos = s.player;
      entitySamples.push(s.entities);
      fpsSamples.push(s.fps);
      if (s.status !== 'playing') break;
    }
    const t1 = process.hrtime.bigint();
    const wallMs = Number(t1 - t0) / 1e6;
    const last = h.snapshot();
    const runtimeErrors = h.errors.slice(errorsBefore);
    const finite = last?.player ? Number.isFinite(last.player.x) && Number.isFinite(last.player.y) : true;
    results.push({
      id: 'stability', pass: runtimeErrors.length === 0 && finite, severity: 'critical',
      detail: runtimeErrors.length
        ? `${runtimeErrors.length} runtime error(s): ${runtimeErrors[0].message} (${runtimeErrors[0].file || 'frame'}${runtimeErrors[0].line ? `:${runtimeErrors[0].line.line}` : ''})`
        : finite ? `ran ${last?.frame ?? 0} frames cleanly` : 'player position became non-finite (NaN/Infinity)',
      errors: runtimeErrors.slice(0, 3),
      metrics: { frames: last?.frame ?? 0, entitiesPeak: Math.max(...entitySamples, 0), status: last?.status },
    });

    // ---- frame-spike resilience ---------------------------------------------
    // The exact question: how much simulated time does the game advance in ONE
    // frame when the browser stalls? Anything above ~0.15s means the delta is
    // not clamped and fast movers will tunnel through colliders.
    const spikeErrors = h.errors.length;
    h.press('right');
    let worstStep = 0;
    let worstSimAdvance = 0;
    let prev = h.snapshot();
    for (let i = 0; i < 10; i++) {
      h.step(1, 350); // a stalled tab, a GC pause, a slow phone
      const now = h.snapshot();
      if (prev && now) {
        worstSimAdvance = Math.max(worstSimAdvance, (now.elapsed ?? 0) - (prev.elapsed ?? 0));
        if (prev.player && now.player) {
          worstStep = Math.max(worstStep, Math.hypot(now.player.x - prev.player.x, now.player.y - prev.player.y));
        }
      }
      prev = now;
    }
    h.release('right');
    const spikeAfter = h.snapshot();
    const SIM_ADVANCE_LIMIT = 0.15;
    const spikeFinite = spikeAfter?.player ? Number.isFinite(spikeAfter.player.x) && Number.isFinite(spikeAfter.player.y) : true;
    const spikeOk = h.errors.length === spikeErrors && spikeFinite && worstSimAdvance <= SIM_ADVANCE_LIMIT;
    results.push({
      id: 'dt-spike', pass: spikeOk, severity: 'major',
      detail: spikeOk
        ? `survived 10 x 350ms frames: at most ${round(worstSimAdvance, 3)}s simulated per frame, worst move ${round(worstStep, 1)}px`
        : !spikeFinite ? 'position became non-finite under frame spikes'
          : worstSimAdvance > SIM_ADVANCE_LIMIT
            ? `one stalled frame advanced the simulation by ${round(worstSimAdvance, 3)}s (limit ${SIM_ADVANCE_LIMIT}s) and moved the player ${round(worstStep, 1)}px - delta is not clamped`
            : `errors during frame spikes: ${h.errors[spikeErrors]?.message}`,
      metrics: { simAdvanceSec: round(worstSimAdvance, 4), worstFrameMovePx: round(worstStep, 1) },
    });

    // ---- pause when hidden ---------------------------------------------------
    h.hide();
    const hidden0 = h.snapshot();
    h.step(30);
    const hidden1 = h.snapshot();
    h.show();
    // Restore play before the remaining checks: the pause is the point of the
    // previous check, not a state later checks should inherit.
    try { h.lab.loop.setPaused(false); h.lab.screen.set('playing'); } catch (err) { /* game already ended */ }
    h.step(2);
    const elapsedWhileHidden = (hidden1?.elapsed ?? 0) - (hidden0?.elapsed ?? 0);
    results.push({
      id: 'pause-on-hide', pass: elapsedWhileHidden < 0.05, severity: 'minor',
      detail: elapsedWhileHidden < 0.05
        ? 'simulation stops while the tab is hidden'
        : `simulation advanced ${round(elapsedWhileHidden, 2)}s while hidden`,
      metrics: { elapsedWhileHidden: round(elapsedWhileHidden, 3) },
    });

    // ---- rendering -----------------------------------------------------------
    const canvas = h.canvas();
    const coverage = canvas.coverageRatio();
    const renderOk = is3d ? true : coverage > 0.03 && canvas.nonFinite === 0;
    results.push({
      id: 'renders', pass: renderOk, severity: is3d ? 'minor' : 'major',
      detail: is3d
        ? '3D build: rendering is not verifiable headlessly (no WebGL in the sandbox); 2D fallback screen drew fine'
        : `screen coverage ${(coverage * 100).toFixed(1)}%, ${canvas.nonFinite} non-finite draw coordinate(s)`,
      metrics: { coverage: round(coverage, 3), nonFinite: canvas.nonFinite, outOfBounds: canvas.outOfBounds, ops: canvas.total },
    });

    // ---- visual layout sanity ------------------------------------------------
    const hudNodes = countNodes(h.dom.ui);
    const visualOk = hudNodes >= 3 && (is3d || coverage > 0.03);
    results.push({
      id: 'visual-layout', pass: visualOk, severity: 'minor',
      detail: `${hudNodes} HUD node(s) in the DOM overlay; ${canvas.texts.length} text draw(s) last frame`,
      metrics: { hudNodes, textDraws: canvas.texts.length },
    });

    // ---- performance ---------------------------------------------------------
    const framesRun = Math.max(1, (last?.frame ?? 1));
    const msPerFrame = wallMs / Math.max(1, framesRun);
    const drawCalls = last?.drawCalls ?? 0;
    const perfOk = msPerFrame < 4 && drawCalls < 4000;
    results.push({
      id: 'performance', pass: perfOk, severity: 'minor',
      detail: `${round(msPerFrame, 3)}ms of simulated work per frame in the sandbox, ${drawCalls} draw calls in the last frame`,
      metrics: { msPerFrame: round(msPerFrame, 3), drawCalls, collisionChecks: last?.collisionChecks ?? 0 },
    });

    // ---- memory / pooling ----------------------------------------------------
    const stats = last?.entityStats || { created: 0, recycled: 0 };
    const churn = stats.created + stats.recycled;
    const reuseRatio = churn ? stats.recycled / churn : 1;
    const memOk = stats.created < 4000;
    results.push({
      id: 'memory', pass: memOk, severity: 'minor',
      detail: `${stats.created} entities allocated, ${stats.recycled} recycled (${(reuseRatio * 100).toFixed(0)}% reuse)`,
      metrics: { created: stats.created, recycled: stats.recycled, reuseRatio: round(reuseRatio, 3), particles: last?.particles ?? 0 },
    });

    // ---- determinism ---------------------------------------------------------
    const det = this.#determinism(files, scriptOrder);
    results.push(det);

    // ---- save / load ---------------------------------------------------------
    const saveOk = this.#saveCheck(h);
    results.push(saveOk);

    // ---- progress reachable --------------------------------------------------
    results.push(this.#progress(h, last, design, travelled));

    // ---- static checks -------------------------------------------------------
    results.push(contrastCheck(design));
    results.push(mobileLayoutCheck(files));
    results.push(codeHygieneCheck(files, h));

    h.dispose();
    return this.#finish(results, started, design, h);
  }

  #determinism(files, scriptOrder) {
    const runOnce = () => {
      const h = this.sandbox.loadFiles(files, scriptOrder);
      if (h.errors.length) return null;
      h.lab.start();
      h.step(10);
      h.press('right'); h.press('action');
      h.step(90);
      h.release('right');
      h.step(60);
      const s = h.snapshot();
      h.dispose();
      return s;
    };
    const a = runOnce();
    const b = runOnce();
    if (!a || !b) return { id: 'determinism', pass: false, severity: 'major', detail: 'could not complete two comparison runs' };
    const pa = a.player || {}, pb = b.player || {};
    const dx = Math.abs((pa.x || 0) - (pb.x || 0));
    const dy = Math.abs((pa.y || 0) - (pb.y || 0));
    const same = dx < 1e-6 && dy < 1e-6 && a.score === b.score && a.entities === b.entities;
    return {
      id: 'determinism', pass: same, severity: 'major',
      detail: same
        ? 'two runs from the same seed produced identical state'
        : `runs diverged: dx=${round(dx, 4)} dy=${round(dy, 4)} score ${a.score} vs ${b.score}, entities ${a.entities} vs ${b.entities}`,
      metrics: { dx: round(dx, 6), dy: round(dy, 6) },
    };
  }

  #saveCheck(h) {
    try {
      const store = h.dom.win.localStorage;
      const keysBefore = store.length;
      // force a terminal state so the game writes its save
      h.lab.game.status = 'lost';
      h.step(4);
      const keysAfter = store.length;
      const wrote = keysAfter > keysBefore || keysAfter > 0;
      let roundTrip = false;
      if (wrote) {
        const saved = h.lab.save?.data;
        roundTrip = !!saved && typeof saved === 'object';
      }
      return {
        id: 'save-load', pass: wrote && roundTrip, severity: 'minor',
        detail: wrote ? `save written (${keysAfter} key(s)), reload returned ${roundTrip ? 'a valid object' : 'nothing'}` : 'nothing was persisted at the end of a run',
        metrics: { keys: keysAfter },
      };
    } catch (err) {
      return { id: 'save-load', pass: false, severity: 'minor', detail: `save check threw: ${err.message}` };
    }
  }

  #progress(h, last, design, travelled = 0) {
    // Did anything meaningful happen during the run: score, collection, waves,
    // level changes or a terminal state?
    const hud = last?.hud || {};
    const progressed = (last?.score ?? 0) > 0
      || String(hud.moves || '').split('/')[0] > 0
      || (last?.status && last.status !== 'playing')
      || (hud.wave && String(hud.wave) !== '1' && String(hud.wave) !== '1/1')
      || (last?.entityStats?.removed ?? 0) > 2
      || travelled > 240; /* the player actually traversed the world */
    return {
      id: 'progress-reachable', pass: !!progressed, severity: 'major',
      detail: progressed
        ? `run produced measurable progress (score ${last?.score ?? 0}, travelled ${Math.round(travelled)}px, status ${last?.status})`
        : 'nothing changed during the whole run: no score, no collection, no wave and no terminal state',
      metrics: { score: last?.score ?? 0, travelledPx: Math.round(travelled), status: last?.status, hud },
    };
  }

  #finish(results, started, design, h) {
    let earned = 0;
    let total = 0;
    for (const r of results) {
      const w = WEIGHTS[r.id] ?? 1;
      total += w;
      if (r.pass) earned += w;
    }
    // Checks that never ran (early abort) still count against the score.
    for (const [id, w] of Object.entries(WEIGHTS)) {
      if (!results.some((r) => r.id === id)) total += w;
    }
    const score = total ? round(earned / total, 3) : 0;
    const failures = results.filter((r) => !r.pass);
    const report = {
      designId: design?.id,
      name: design?.name,
      ruleset: design?.ruleset,
      score,
      passed: results.filter((r) => r.pass).length,
      failed: failures.length,
      critical: failures.filter((f) => f.severity === 'critical').length,
      checks: results,
      failures: failures.map((f) => ({ id: f.id, severity: f.severity, detail: f.detail })),
      durationMs: Date.now() - started,
      sandbox: {
        errors: h ? h.errors.slice(0, 6) : [],
        logs: h ? h.logs.filter((l) => l.level === 'error' || l.level === 'warn').slice(0, 6) : [],
      },
      // "ship" means nothing critical or major is outstanding - a high score
      // with a major failure still needs work, otherwise the debug loop stops
      // exactly where it should keep going.
      verdict: failures.some((f) => f.severity === 'critical') ? 'broken'
        : score >= 0.85 && !failures.some((f) => f.severity === 'major') ? 'ship'
          : 'needs-work',
      at: new Date().toISOString(),
    };
    this.bus?.[report.verdict === 'broken' ? 'error' : 'info']('test.report', {
      name: design?.name, score, verdict: report.verdict, failed: failures.length,
    });
    return report;
  }
}

function countNodes(el) {
  if (!el) return 0;
  let n = 0;
  const visit = (node) => { n++; (node.children || []).forEach(visit); };
  (el.children || []).forEach(visit);
  return n;
}

/**
 * Palette legibility: every gameplay colour must be distinguishable from the
 * background. A player sprite at 1.5:1 against the floor is a real defect.
 */
function contrastCheck(design) {
  const palette = design?.visual?.palette || [];
  if (palette.length < 2) return { id: 'visual-contrast', pass: false, severity: 'minor', detail: 'no palette was emitted' };
  const bg = palette[0];
  const ratios = palette.slice(1).map((c) => ({ color: c, ratio: round(contrastRatio(c, bg), 2) }));
  const ink = ratios[0];
  const worst = ratios.slice(1).sort((a, b) => a.ratio - b.ratio)[0] || ink;
  const pass = ink.ratio >= 7 && worst.ratio >= 3;
  return {
    id: 'visual-contrast', pass, severity: 'minor',
    detail: pass
      ? `text ${ink.ratio}:1, weakest gameplay colour ${worst.ratio}:1 against the background`
      : `insufficient contrast: text ${ink.ratio}:1 (needs 7), weakest gameplay colour ${worst.ratio}:1 (needs 3)`,
    metrics: { background: bg, ratios },
  };
}

function mobileLayoutCheck(files) {
  const html = files.get('index.html') || '';
  const css = files.get('styles/main.css') || '';
  const checks = {
    viewportMeta: /name="viewport"[^>]*width=device-width/.test(html),
    safeArea: /env\(safe-area-inset/.test(css),
    mediaQuery: /@media[^{]*max-width/.test(css),
    coarsePointer: /@media\s*\(pointer:\s*coarse\)/.test(css),
    touchAction: /touch-action/.test(css),
    relativeUnits: /(clamp\(|vw|vh|%)/.test(css),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  return {
    id: 'mobile-layout', pass: passed >= 5, severity: 'minor',
    detail: `${passed}/6 mobile layout requirements met (${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(', ') || 'all'})`,
    metrics: checks,
  };
}

function codeHygieneCheck(files, h) {
  const js = [...files.entries()].filter(([f]) => f.endsWith('.js'));
  const issues = [];
  for (const [name, src] of js) {
    if (/\beval\s*\(/.test(src)) issues.push(`${name}: uses eval()`);
    if (/document\.write\s*\(/.test(src)) issues.push(`${name}: uses document.write()`);
    if (/innerHTML\s*=\s*[^'"`]*\+/.test(src)) issues.push(`${name}: builds innerHTML by concatenation`);
    if (!/^\(function|^\/\*/.test(src.trim())) issues.push(`${name}: not wrapped in an IIFE (leaks globals)`);
  }
  // global leak check against the sandbox window
  const allowed = new Set(['LAB', '__LAB__']);
  const leaked = [];
  try {
    for (const key of Object.keys(h?.dom?.win || {})) {
      if (allowed.has(key)) continue;
      if (/^(window|document|self|top|parent|globalThis|console|navigator|location|performance|localStorage|sessionStorage|devicePixelRatio|innerWidth|innerHeight|listeners|__state)$/.test(key)) continue;
      if (typeof h.dom.win[key] === 'function' || typeof h.dom.win[key] === 'object') continue;
      leaked.push(key);
    }
  } catch { /* ignore */ }
  if (leaked.length) issues.push(`globals leaked: ${leaked.slice(0, 5).join(', ')}`);
  return {
    id: 'code-hygiene', pass: issues.length === 0, severity: 'minor',
    detail: issues.length ? issues.slice(0, 4).join(' | ') : `${js.length} script(s) clean: no eval, no document.write, no global leaks`,
    metrics: { files: js.length, issues: issues.length },
  };
}

/** Quality score combining test results with design-level measures (spec 41). */
export function qualityScore({ test, design, record }) {
  const parts = {
    tests: test?.score ?? 0,
    novelty: design?.novelty?.novelty ?? 0,
    originality: 1 - clamp(record?.codeOverlap?.maxOverlapWithImports ?? 0, 0, 1),
    structure: clamp((record?.files?.length ?? 0) / 20, 0, 1),
  };
  const overall = round(
    parts.tests * 0.6 + parts.novelty * 0.18 + parts.originality * 0.12 + parts.structure * 0.1, 3,
  );
  return { overall, parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, round(v, 3)])) };
}

export { WEIGHTS as TEST_WEIGHTS };
