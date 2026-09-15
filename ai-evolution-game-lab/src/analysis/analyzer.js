/**
 * Project analyzer (spec 7).
 *
 * Reads every file of one imported project, dispatches it to the right
 * analyzer, then produces the project record: summary, architecture, features,
 * concepts, dependencies, assets, mechanics, UI systems, problems and
 * optimization opportunities. Source code is never copied into the record.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { analyzeJs, normalizedTokens } from './js.js';
import { analyzeHtml } from './html.js';
import { analyzeCss } from './css.js';
import { analyzeGlb } from './glb.js';
import { analyzeImageStructure, readDimensions } from './image.js';
import { extractConcepts } from './concepts.js';
import { buildRelations } from './relations.js';
import { detectLicenseFromFiles, licenseProfile } from '../licensing/license.js';
import { shingles, hashHex, round, bytes as fmtBytes } from '../core/util.js';

const TEXT_EXT = new Set(['html', 'htm', 'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'css', 'scss', 'json', 'txt', 'md', 'dart', 'xml', 'svg', 'glsl', 'vert', 'frag', 'yml', 'yaml', 'csv']);
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif', 'svg', 'ico']);
const MODEL_EXT = new Set(['glb', 'gltf', 'obj', 'fbx', 'stl', 'dae', 'ply']);
const AUDIO_EXT = new Set(['mp3', 'wav', 'ogg', 'm4a', 'flac', 'opus']);
const FONT_EXT = new Set(['ttf', 'otf', 'woff', 'woff2', 'eot']);
const VIDEO_EXT = new Set(['mp4', 'webm', 'mov', 'avi', 'mkv']);

export function classifyFile(rel) {
  const e = path.extname(rel).toLowerCase().replace('.', '');
  if (IMAGE_EXT.has(e)) return 'image';
  if (MODEL_EXT.has(e)) return 'model';
  if (AUDIO_EXT.has(e)) return 'audio';
  if (FONT_EXT.has(e)) return 'font';
  if (VIDEO_EXT.has(e)) return 'video';
  if (TEXT_EXT.has(e)) return 'text';
  return 'binary';
}

const CDN_LIBS = [
  [/three(\.min)?\.(module\.)?js|cdn.*three/i, 'three.js'],
  [/cannon|ammo|rapier/i, 'physics-engine'],
  [/matter(\.min)?\.js/i, 'matter.js'],
  [/phaser/i, 'phaser'],
  [/pixi/i, 'pixi.js'],
  [/howler/i, 'howler.js'],
  [/gsap|TweenMax/i, 'gsap'],
  [/tailwind/i, 'tailwindcss'],
  [/bootstrap/i, 'bootstrap'],
  [/jquery/i, 'jquery'],
  [/react|vue|svelte|preact/i, 'ui-framework'],
  [/fonts\.googleapis|fonts\.gstatic/i, 'google-fonts'],
];

function libFromUrl(url) {
  for (const [re, name] of CDN_LIBS) if (re.test(url)) return name;
  try {
    const u = new URL(url, 'https://x.invalid');
    if (u.hostname !== 'x.invalid') return u.hostname;
  } catch { /* relative path */ }
  return null;
}

/**
 * @param {{id:string,name:string,root:string,files:Array<{rel:string,abs:string,size:number}>}} project
 */
export async function analyzeProject(project, { limits = {}, onProgress } = {}) {
  const maxBytes = limits.maxFileBytes || 4 * 1024 * 1024;
  const bundle = { js: [], css: [], html: [], glb: [], json: [], images: [], audio: [], fonts: [], other: [] };
  const assets = [];
  const licenseInputs = [];
  const codeShingles = new Set();
  let totalBytes = 0;
  let analyzed = 0;

  for (const f of project.files) {
    const kind = classifyFile(f.rel);
    totalBytes += f.size;
    const ext = path.extname(f.rel).toLowerCase().replace('.', '');
    try {
      if (kind === 'text' && f.size <= maxBytes) {
        const text = await fs.readFile(f.abs, 'utf8');
        if (/^(license|licence|copying|notice)/i.test(path.basename(f.rel)) || /package\.json$/.test(f.rel) || licenseInputs.length < 60) {
          licenseInputs.push({ rel: f.rel, text: text.slice(0, 8000) });
        }
        if (ext === 'html' || ext === 'htm') {
          const h = analyzeHtml(text, { file: f.rel });
          bundle.html.push(h);
          for (const js of h.inlineSources.js) {
            const a = analyzeJs(js, { file: `${f.rel}#inline` });
            bundle.js.push(a);
            addShingles(codeShingles, js);
          }
          for (const css of h.inlineSources.css) bundle.css.push(analyzeCss(css, { file: `${f.rel}#inline` }));
          delete h.inlineSources;
        } else if (['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx'].includes(ext)) {
          bundle.js.push(analyzeJs(text, { file: f.rel }));
          addShingles(codeShingles, text);
        } else if (['css', 'scss'].includes(ext)) {
          bundle.css.push(analyzeCss(text, { file: f.rel }));
        } else if (ext === 'json') {
          let keys = 0, shape = 'unknown';
          try {
            const j = JSON.parse(text);
            keys = j && typeof j === 'object' ? Object.keys(j).length : 0;
            shape = Array.isArray(j) ? 'array' : typeof j;
          } catch { shape = 'invalid'; }
          bundle.json.push({ file: f.rel, keys, shape, bytes: f.size });
        } else {
          bundle.other.push({ file: f.rel, ext, bytes: f.size });
        }
      } else if (kind === 'model') {
        if (['glb', 'gltf'].includes(ext) && f.size <= 64 * 1024 * 1024) {
          const buf = await fs.readFile(f.abs);
          try {
            const g = analyzeGlb(buf, { file: f.rel });
            bundle.glb.push(g);
            assets.push({ rel: f.rel, kind: 'model', bytes: f.size, modelType: g.modelType, animations: g.animationClips.length, triangles: g.counts.triangles });
          } catch (err) {
            bundle.other.push({ file: f.rel, ext, bytes: f.size, error: String(err.message) });
            assets.push({ rel: f.rel, kind: 'model', bytes: f.size, error: 'could not parse' });
          }
        } else {
          assets.push({ rel: f.rel, kind: 'model', bytes: f.size, note: `${ext.toUpperCase()} is recorded but not parsed by this build` });
        }
      } else if (kind === 'image') {
        if (f.size <= maxBytes) {
          const buf = await fs.readFile(f.abs);
          const info = ext === 'png' && f.size < 2 * 1024 * 1024
            ? analyzeImageStructure(buf, { file: f.rel })
            : { file: f.rel, ...readDimensions(buf), bytes: f.size, decoded: false };
          bundle.images.push(info);
          assets.push({ rel: f.rel, kind: 'image', bytes: f.size, width: info.width, height: info.height });
        } else {
          assets.push({ rel: f.rel, kind: 'image', bytes: f.size });
        }
      } else if (kind === 'audio') {
        bundle.audio.push({ file: f.rel, ext, bytes: f.size });
        assets.push({ rel: f.rel, kind: 'audio', bytes: f.size });
      } else if (kind === 'font') {
        bundle.fonts.push({ file: f.rel, ext, bytes: f.size });
        assets.push({ rel: f.rel, kind: 'font', bytes: f.size });
      } else {
        assets.push({ rel: f.rel, kind, bytes: f.size });
      }
      analyzed++;
      if (onProgress && analyzed % 25 === 0) onProgress({ analyzed, total: project.files.length });
    } catch (err) {
      bundle.other.push({ file: f.rel, ext, bytes: f.size, error: String(err.message) });
    }
  }

  const concepts = extractConcepts(bundle);
  const relations = buildRelations(bundle.js);
  const lic = detectLicenseFromFiles(licenseInputs);
  const licenseInfo = { ...licenseProfile(lic.license), detectedIn: lic.source, method: lic.method };

  // ---- dependencies -------------------------------------------------------
  const deps = new Map();
  for (const h of bundle.html) {
    for (const url of [...h.scripts.external, ...h.styles.external]) {
      const lib = libFromUrl(url);
      if (!lib) continue;
      const rec = deps.get(lib) || { name: lib, external: /^https?:/.test(url), urls: new Set() };
      rec.urls.add(url.slice(0, 160));
      deps.set(lib, rec);
    }
  }
  for (const j of bundle.js) {
    for (const [lib, n] of Object.entries(j.libraries)) {
      const rec = deps.get(lib) || { name: lib, external: false, urls: new Set() };
      rec.uses = (rec.uses || 0) + n;
      deps.set(lib, rec);
    }
    for (const spec of j.imports) {
      if (spec.startsWith('.') || spec.startsWith('/')) continue;
      const rec = deps.get(spec) || { name: spec, external: true, urls: new Set() };
      deps.set(spec, rec);
    }
  }
  const dependencies = [...deps.values()].map((d) => ({ name: d.name, external: d.external, uses: d.uses || 0, urls: [...d.urls].slice(0, 3) }));

  // ---- aggregate metrics ---------------------------------------------------
  const jsLoc = bundle.js.reduce((s, j) => s + j.loc, 0);
  const funcCount = bundle.js.reduce((s, j) => s + j.functions.length, 0);
  const classCount = bundle.js.reduce((s, j) => s + j.classes.length, 0);
  const cyclomatic = bundle.js.reduce((s, j) => s + j.metrics.cyclomatic, 0);
  const apis = {};
  for (const j of bundle.js) for (const [k, v] of Object.entries(j.apis)) apis[k] = (apis[k] || 0) + v;
  const patterns = {};
  for (const j of bundle.js) for (const p of j.patterns) patterns[p] = (patterns[p] || 0) + 1;
  const tuning = {};
  for (const j of bundle.js) {
    for (const [k, vals] of Object.entries(j.tuning)) (tuning[k] ||= []).push(...vals);
  }

  const kind = inferProjectKind({ bundle, concepts, apis, patterns });
  const architecture = describeArchitecture({ bundle, relations, concepts, apis });
  const problems = findProblems({ bundle, concepts, apis, patterns, assets });
  const optimizations = findOptimizations({ bundle, concepts, apis, patterns, assets });
  const mechanics = inferMechanics({ concepts, patterns, apis, relations });

  return {
    projectId: project.id,
    name: project.name,
    root: project.root,
    kind,
    summary: buildSummary({ project, kind, bundle, jsLoc, concepts, dependencies, assets }),
    architecture,
    features: featureList({ concepts, bundle, apis }),
    concepts,
    relations,
    dependencies,
    mechanics,
    uiSystems: uiSystems({ bundle, concepts }),
    problems,
    optimizations,
    license: licenseInfo,
    assets,
    stats: {
      files: project.files.length,
      analyzedFiles: analyzed,
      bytes: totalBytes,
      bytesHuman: fmtBytes(totalBytes),
      html: bundle.html.length,
      css: bundle.css.length,
      js: bundle.js.length,
      models: bundle.glb.length,
      images: bundle.images.length,
      audio: bundle.audio.length,
      jsLoc,
      functions: funcCount,
      classes: classCount,
      cyclomatic,
      avgComplexity: funcCount ? round(cyclomatic / funcCount, 2) : 0,
      apis,
      patterns,
    },
    tuningPriors: Object.fromEntries(Object.entries(tuning).map(([k, v]) => [k, summarizeNumbers(v)])),
    fingerprint: {
      // Used by the diversity engine to detect accidental near-copies of the
      // user's own imported code in generated output.
      shingleCount: codeShingles.size,
      sample: [...codeShingles].slice(0, 2000),
      digest: hashHex([...codeShingles].slice(0, 500).join('|')),
    },
    analyzedAt: new Date().toISOString(),
  };
}

function addShingles(set, code) {
  try {
    const toks = normalizedTokens(code);
    for (const s of shingles(toks, 9)) {
      set.add(s);
      if (set.size > 20000) return;
    }
  } catch { /* unparseable file, skip fingerprint */ }
}

function summarizeNumbers(vals) {
  const nums = vals.filter((v) => Number.isFinite(v));
  if (!nums.length) return null;
  const sorted = nums.slice().sort((a, b) => a - b);
  return {
    n: nums.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: sorted[sorted.length >> 1],
    samples: sorted.slice(0, 12),
  };
}

function inferProjectKind({ bundle, concepts, apis, patterns }) {
  const has = (id) => concepts.some((c) => c.key === id);
  const score = {
    '3d-game': (has('3d.threejs') ? 3 : 0) + (apis['pointer-lock'] ? 1 : 0) + (bundle.glb.length ? 2 : 0),
    '2d-game': (apis['canvas-context'] ? 2 : 0) + (patterns['entity-list'] ? 2 : 0) + (has('physics.collision') ? 2 : 0) + (apis.raf ? 1 : 0),
    'simulation': (patterns['noise-procgen'] ? 2 : 0) + (apis['canvas-context'] ? 1 : 0),
    'tool-app': (bundle.html.length && !apis.raf ? 3 : 0) + (bundle.css.length > 1 ? 1 : 0),
    'ui-experiment': (bundle.css.reduce((s, c) => s + c.keyframes.length, 0) > 2 && !apis.raf ? 2 : 0),
    'library': (bundle.js.some((j) => j.moduleStyle === 'esm' && j.exports.length > 3) && !bundle.html.length ? 3 : 0),
  };
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : 'unknown';
}

function describeArchitecture({ bundle, relations, concepts, apis }) {
  const moduleStyles = {};
  for (const j of bundle.js) moduleStyles[j.moduleStyle] = (moduleStyles[j.moduleStyle] || 0) + 1;
  const loopStyles = {};
  for (const j of bundle.js) if (j.loopStyle) loopStyles[j.loopStyle] = (loopStyles[j.loopStyle] || 0) + 1;
  const has = (id) => concepts.some((c) => c.key === id);
  return {
    fileLayout: bundle.html.length === 1 && bundle.js.length <= 1 ? 'single-file' : bundle.js.length > 4 ? 'multi-module' : 'small-multi-file',
    moduleStyles,
    loopStyles,
    dominantLoop: Object.entries(loopStyles).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    composition: has('arch.ecs') ? 'entity-component' : has('arch.inheritance') ? 'class-hierarchy' : has('arch.entity-list') ? 'entity-list' : 'procedural',
    stateHandling: has('arch.state-machine') ? 'explicit-state-machine' : 'implicit-flags',
    rendering: apis.webgl || apis.webgl2 ? 'webgl' : apis['canvas-context'] ? 'canvas-2d' : 'dom',
    pipeline: relations.pipeline,
    layers: relations.nodes.map((n) => n.role),
  };
}

function featureList({ concepts, bundle, apis }) {
  const features = concepts.filter((c) => !c.negative).map((c) => c.title);
  if (bundle.glb.length) features.push(`${bundle.glb.length} 3D model(s) bundled`);
  if (apis['web-worker']) features.push('Background worker');
  if (bundle.audio.length) features.push(`${bundle.audio.length} audio asset(s)`);
  return [...new Set(features)];
}

function uiSystems({ bundle, concepts }) {
  const out = [];
  const has = (id) => concepts.some((c) => c.key === id);
  if (has('ui.hud-overlay')) out.push({ system: 'DOM HUD over canvas', note: 'text stays crisp and accessible' });
  if (has('ui.flex-grid')) out.push({ system: 'Flex/Grid layout', note: 'modern layout primitives' });
  if (has('ui.design-tokens')) out.push({ system: 'CSS custom property tokens', note: 'themable' });
  if (has('ui.animation-css')) out.push({ system: 'CSS keyframe animation', note: 'GPU-friendly UI motion' });
  if (has('ui.responsive')) out.push({ system: 'Responsive breakpoints', note: 'adapts to phone/desktop' });
  const menus = bundle.html.reduce((s, h) => s + (h.tagCounts.button || 0), 0);
  if (menus) out.push({ system: `${menus} button element(s)`, note: 'DOM-driven interaction' });
  return out;
}

function inferMechanics({ concepts, patterns, apis, relations }) {
  const has = (id) => concepts.some((c) => c.key === id);
  const roles = new Set(relations.nodes.map((n) => n.role));
  const mech = [];
  if (has('physics.collision')) mech.push('collision-response');
  if (patterns['object-pooling']) mech.push('projectiles-or-particles');
  if (roles.has('ai')) mech.push('enemy-behaviour');
  if (has('ai.pathfinding')) mech.push('navigation');
  if (has('procgen.noise') || roles.has('procgen')) mech.push('procedural-content');
  if (has('data.save-localstorage')) mech.push('progress-persistence');
  if (roles.has('camera')) mech.push('camera-follow');
  if (apis.gamepad) mech.push('gamepad-control');
  if (roles.has('particles')) mech.push('particle-feedback');
  if (roles.has('spawn')) mech.push('spawning-waves');
  return mech;
}

function findProblems({ bundle, concepts, apis, patterns, assets }) {
  const problems = [];
  const has = (id) => concepts.some((c) => c.key === id);
  if (has('game-loop.naive')) problems.push({ severity: 'high', issue: 'Frame-rate dependent movement', detail: 'The loop does not scale movement by delta time, so the game runs faster on high-refresh displays.', fix: 'Measure elapsed time per frame and multiply velocities by it, or use a fixed-timestep accumulator.' });
  if (apis.raf && !patterns['pause-on-blur']) problems.push({ severity: 'medium', issue: 'No pause on tab blur', detail: 'Returning to a backgrounded tab produces one enormous delta, which can teleport entities through walls.', fix: 'Clamp delta time and pause on visibilitychange.' });
  if (apis['canvas-context'] && !patterns['dpr-scaling']) problems.push({ severity: 'low', issue: 'Canvas ignores devicePixelRatio', detail: 'Rendering is blurry on high-density screens.', fix: 'Scale the backing store by devicePixelRatio and set CSS size separately.' });
  for (const h of bundle.html) {
    if (!h.hasViewport) problems.push({ severity: 'medium', issue: `No viewport meta in ${h.file}`, detail: 'Mobile browsers render at desktop width and zoom out.', fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.' });
    if (h.inlineHandlers.length > 8) problems.push({ severity: 'low', issue: `${h.inlineHandlers.length} inline event handlers in ${h.file}`, detail: 'Inline handlers mix markup with behaviour and break under strict CSP.', fix: 'Bind listeners in script instead.' });
  }
  for (const j of bundle.js) {
    if (j.metrics.maxDepth > 8) problems.push({ severity: 'low', issue: `Deep nesting in ${j.file}`, detail: `Maximum block depth ${j.metrics.maxDepth}.`, fix: 'Extract helper functions / early returns.' });
    if (j.loc > 1500 && j.functions.length < 10) problems.push({ severity: 'medium', issue: `Monolithic file ${j.file}`, detail: `${j.loc} lines with only ${j.functions.length} functions.`, fix: 'Split into modules by responsibility.' });
  }
  const big = assets.filter((a) => a.bytes > 5 * 1024 * 1024);
  for (const a of big.slice(0, 5)) problems.push({ severity: 'medium', issue: `Large asset ${a.rel}`, detail: `${fmtBytes(a.bytes)} will dominate load time.`, fix: 'Compress, resize, or load it lazily.' });
  return problems;
}

function findOptimizations({ bundle, concepts, apis, patterns, assets }) {
  const out = [];
  const has = (id) => concepts.some((c) => c.key === id);
  const entities = patterns['entity-list'] || 0;
  if (entities && !patterns['spatial-partitioning']) out.push({ area: 'collision', opportunity: 'Add a uniform grid or quadtree', why: 'Entity-vs-entity checks are O(n^2) without spatial partitioning.' });
  if (!patterns['object-pooling'] && (patterns['entity-list'] || apis['canvas-context'])) out.push({ area: 'memory', opportunity: 'Pool short-lived objects (bullets, particles)', why: 'Per-frame allocation causes GC hitches.' });
  if (apis['canvas-context'] && !patterns['gpu-instancing'] && entities > 1) out.push({ area: 'rendering', opportunity: 'Batch draws / use offscreen canvas for static layers', why: 'Redrawing static content every frame wastes fill rate.' });
  if (bundle.glb.some((g) => g.counts.triangles > 100000)) out.push({ area: '3d', opportunity: 'Decimate or LOD the heaviest models', why: 'Triangle counts above ~100k per model hurt mobile GPUs.' });
  if (bundle.glb.some((g) => g.embeddedTextureBytes > 4e6)) out.push({ area: 'assets', opportunity: 'Compress embedded textures (KTX2/Basis)', why: 'Embedded PNG textures inflate GLB size and VRAM.' });
  if (!has('opt.worker') && bundle.js.some((j) => j.loc > 2000)) out.push({ area: 'threading', opportunity: 'Move generation/pathfinding into a Worker', why: 'Long synchronous work blocks the frame.' });
  const totalAssets = assets.reduce((s, a) => s + a.bytes, 0);
  if (totalAssets > 20 * 1024 * 1024) out.push({ area: 'loading', opportunity: 'Stream assets and show a loading state', why: `${fmtBytes(totalAssets)} of assets is a long first load.` });
  return out;
}

function buildSummary({ project, kind, bundle, jsLoc, concepts, dependencies, assets }) {
  const parts = [];
  parts.push(`${project.name} is a ${kind.replace('-', ' ')} built from ${project.files.length} file(s)`);
  if (bundle.html.length) parts.push(`${bundle.html.length} HTML page(s)`);
  if (jsLoc) parts.push(`${jsLoc} lines of JavaScript`);
  if (bundle.glb.length) parts.push(`${bundle.glb.length} 3D model(s)`);
  if (assets.length) parts.push(`${assets.length} asset file(s)`);
  const top = concepts.filter((c) => !c.negative).slice(0, 5).map((c) => c.title.toLowerCase());
  const deps = dependencies.filter((d) => d.external).slice(0, 4).map((d) => d.name);
  let s = parts.join(', ') + '.';
  if (top.length) s += ` Demonstrates ${top.join('; ')}.`;
  if (deps.length) s += ` External dependencies: ${deps.join(', ')}.`;
  return s;
}
