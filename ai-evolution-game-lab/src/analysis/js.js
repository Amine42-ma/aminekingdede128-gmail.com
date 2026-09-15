/**
 * JavaScript structural analyzer.
 *
 * This is deliberately NOT a full parser. A full ES parser would be a large
 * dependency and we do not need an exact AST: what the lab needs is a reliable
 * inventory of *structure and idiom* — declarations, call relationships, which
 * browser APIs are used and how, loop style, numeric tuning constants — so the
 * knowledge engine can learn patterns rather than store code.
 *
 * The tokenizer below is exact enough for that: it correctly skips comments,
 * strings, template literals (with nesting) and regex literals, which is where
 * naive regex-based scanners produce garbage.
 */

const KEYWORDS = new Set([
  'var', 'let', 'const', 'function', 'class', 'extends', 'return', 'if', 'else', 'for', 'while',
  'do', 'switch', 'case', 'default', 'break', 'continue', 'new', 'delete', 'typeof', 'instanceof',
  'in', 'of', 'this', 'super', 'try', 'catch', 'finally', 'throw', 'import', 'export', 'from',
  'async', 'await', 'yield', 'static', 'get', 'set', 'null', 'true', 'false', 'void',
]);

const ID_START = /[A-Za-z_$]/;
const ID_PART = /[A-Za-z0-9_$]/;

/** Tokenize JS source. Returns a flat array of tokens with source offsets. */
export function tokenize(src) {
  const tokens = [];
  let i = 0;
  const n = src.length;
  let lastSignificant = null;

  const regexAllowed = () => {
    if (!lastSignificant) return true;
    const { t, v } = lastSignificant;
    if (t === 'num' || t === 'str' || t === 'tmpl' || t === 'regex') return false;
    if (t === 'id') return false;
    if (t === 'kw') return !['this', 'null', 'true', 'false', 'super'].includes(v);
    if (t === 'punc') return ![')', ']', '}', '++', '--'].includes(v);
    return true;
  };

  while (i < n) {
    const c = src[i];

    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { i++; continue; }

    // comments
    if (c === '/' && src[i + 1] === '/') {
      const start = i; while (i < n && src[i] !== '\n') i++;
      tokens.push({ t: 'comment', v: src.slice(start, i), i: start });
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const start = i; i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i = Math.min(n, i + 2);
      tokens.push({ t: 'comment', v: src.slice(start, i), i: start });
      continue;
    }

    // strings
    if (c === '"' || c === "'") {
      const start = i; const quote = c; i++;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === quote) { i++; break; }
        if (src[i] === '\n') break;
        i++;
      }
      const tok = { t: 'str', v: src.slice(start, i), i: start, value: src.slice(start + 1, i - 1) };
      tokens.push(tok); lastSignificant = tok;
      continue;
    }

    // template literal (tracks ${ } nesting)
    if (c === '`') {
      const start = i; i++;
      let depth = 0;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '$' && src[i + 1] === '{') { depth++; i += 2; continue; }
        if (depth > 0 && src[i] === '}') { depth--; i++; continue; }
        if (depth === 0 && src[i] === '`') { i++; break; }
        i++;
      }
      const tok = { t: 'tmpl', v: src.slice(start, i), i: start };
      tokens.push(tok); lastSignificant = tok;
      continue;
    }

    // regex literal
    if (c === '/' && regexAllowed()) {
      const start = i; i++;
      let inClass = false, ok = false;
      while (i < n) {
        const ch = src[i];
        if (ch === '\\') { i += 2; continue; }
        if (ch === '\n') break;
        if (ch === '[') inClass = true;
        else if (ch === ']') inClass = false;
        else if (ch === '/' && !inClass) { i++; ok = true; break; }
        i++;
      }
      if (ok) {
        while (i < n && /[gimsuyd]/.test(src[i])) i++;
        const tok = { t: 'regex', v: src.slice(start, i), i: start };
        tokens.push(tok); lastSignificant = tok;
        continue;
      }
      i = start; // not a regex after all, fall through as punctuation
    }

    // numbers
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const start = i;
      if (c === '0' && /[xXbBoO]/.test(src[i + 1] || '')) {
        i += 2; while (i < n && /[0-9a-fA-F_]/.test(src[i])) i++;
      } else {
        while (i < n && /[0-9_]/.test(src[i])) i++;
        if (src[i] === '.') { i++; while (i < n && /[0-9_]/.test(src[i])) i++; }
        if (/[eE]/.test(src[i] || '')) { i++; if (/[+-]/.test(src[i] || '')) i++; while (i < n && /[0-9]/.test(src[i])) i++; }
      }
      const raw = src.slice(start, i);
      const tok = { t: 'num', v: raw, i: start, value: Number(raw.replace(/_/g, '')) };
      tokens.push(tok); lastSignificant = tok;
      continue;
    }

    // identifiers / keywords
    if (ID_START.test(c)) {
      const start = i;
      while (i < n && ID_PART.test(src[i])) i++;
      const v = src.slice(start, i);
      const tok = { t: KEYWORDS.has(v) ? 'kw' : 'id', v, i: start };
      tokens.push(tok); lastSignificant = tok;
      continue;
    }

    // punctuation (longest match first)
    const three = src.substr(i, 3);
    const two = src.substr(i, 2);
    let v = c;
    if (['===', '!==', '**=', '...', '<<=', '>>=', '&&=', '||=', '??='].includes(three)) v = three;
    else if (['==', '!=', '<=', '>=', '&&', '||', '??', '?.', '=>', '++', '--', '+=', '-=', '*=', '/=', '%=', '**', '<<', '>>', '&=', '|=', '^='].includes(two)) v = two;
    const tok = { t: 'punc', v, i };
    i += v.length;
    tokens.push(tok); lastSignificant = tok;
  }
  return tokens;
}

const BROWSER_APIS = Object.assign(Object.create(null), {
  // rendering
  getContext: 'canvas-context', createImageBitmap: 'image-bitmap', ImageData: 'imagedata',
  OffscreenCanvas: 'offscreen-canvas', WebGLRenderingContext: 'webgl', WebGL2RenderingContext: 'webgl2',
  // loop / timing
  requestAnimationFrame: 'raf', cancelAnimationFrame: 'raf', setInterval: 'interval',
  setTimeout: 'timeout', performance: 'perf-now', requestIdleCallback: 'idle-callback',
  // input
  addEventListener: 'events', PointerEvent: 'pointer', TouchEvent: 'touch',
  getGamepads: 'gamepad', requestPointerLock: 'pointer-lock', DeviceOrientationEvent: 'device-orientation',
  // storage
  localStorage: 'local-storage', sessionStorage: 'session-storage', indexedDB: 'indexeddb',
  // audio
  AudioContext: 'webaudio', webkitAudioContext: 'webaudio', Audio: 'audio-element',
  // network / workers
  fetch: 'fetch', XMLHttpRequest: 'xhr', WebSocket: 'websocket', Worker: 'web-worker',
  SharedWorker: 'shared-worker', navigator: 'navigator', serviceWorker: 'service-worker',
  // misc
  matchMedia: 'media-query', ResizeObserver: 'resize-observer', IntersectionObserver: 'intersection-observer',
  requestFullscreen: 'fullscreen', structuredClone: 'structured-clone', crypto: 'crypto',
});

const LIB_HINTS = Object.assign(Object.create(null), {
  THREE: 'three.js', BABYLON: 'babylon.js', Phaser: 'phaser', PIXI: 'pixi.js', Matter: 'matter.js',
  planck: 'planck.js', CANNON: 'cannon.js', Ammo: 'ammo.js', p5: 'p5.js', createjs: 'createjs',
  gsap: 'gsap', TweenMax: 'gsap', Howl: 'howler.js', Tone: 'tone.js', d3: 'd3',
  React: 'react', Vue: 'vue', Svelte: 'svelte', Kaboom: 'kaboom', ex: 'excalibur',
});

/** Tuning constants we want distributions for (spec 8: learn parameters, not code). */
const TUNING_KEYS = [
  'gravity', 'speed', 'accel', 'acceleration', 'friction', 'damping', 'drag', 'jump', 'jumpforce',
  'maxspeed', 'velocity', 'health', 'hp', 'damage', 'cooldown', 'spawnrate', 'radius', 'size',
  'fov', 'zoom', 'sensitivity', 'bounce', 'restitution', 'mass', 'tilesize', 'gridsize', 'lives',
  'score', 'timescale', 'fixedstep', 'stepsize', 'turnspeed', 'rotationspeed', 'range', 'reload',
];

function matchesTuningKey(name) {
  const lower = name.toLowerCase().replace(/[_-]/g, '');
  return TUNING_KEYS.find((k) => lower === k || lower.endsWith(k) || lower.startsWith(k)) || null;
}

/**
 * Analyze one JS source file.
 * @returns structural inventory; never the full source.
 */
export function analyzeJs(src, { file = 'inline.js' } = {}) {
  const tokens = tokenize(src);
  const code = tokens.filter((t) => t.t !== 'comment');
  const out = {
    file,
    loc: src.split('\n').length,
    bytes: Buffer.byteLength(src),
    functions: [],
    classes: [],
    variables: [],
    events: [],
    apis: Object.create(null),
    libraries: Object.create(null),
    tuning: Object.create(null),
    imports: [],
    exports: [],
    moduleStyle: 'script',
    loopStyle: null,
    metrics: { cyclomatic: 1, maxDepth: 0, comments: tokens.length - code.length, asyncCount: 0, tokens: code.length },
    stringLiterals: 0,
    magicNumbers: 0,
    dataStructures: Object.create(null),
    patterns: new Set(),
  };

  let depth = 0;
  const scopeStack = [];
  const callEdges = [];
  // Pre-scan declarations so the call graph sees hoisted functions that are
  // called before the line that declares them.
  const declaredFns = new Set();
  for (let k = 0; k < code.length; k++) {
    const t = code[k];
    if (t.t !== 'kw') continue;
    if (t.v === 'function' && code[k + 1]?.t === 'id') declaredFns.add(code[k + 1].v);
    if (['const', 'let', 'var'].includes(t.v) && code[k + 1]?.t === 'id' && code[k + 2]?.v === '=' && findArrow(code, k + 3, 12) > 0) {
      declaredFns.add(code[k + 1].v);
    }
  }

  const nameAt = (idx) => (code[idx] && (code[idx].t === 'id' || code[idx].t === 'kw') ? code[idx].v : null);

  for (let k = 0; k < code.length; k++) {
    const tk = code[k];
    const prev = code[k - 1];
    const next = code[k + 1];

    if (tk.t === 'punc') {
      if (tk.v === '{') { depth++; out.metrics.maxDepth = Math.max(out.metrics.maxDepth, depth); }
      else if (tk.v === '}') { depth = Math.max(0, depth - 1); if (scopeStack.length && scopeStack[scopeStack.length - 1].depth >= depth) scopeStack.pop(); }
      else if (['&&', '||', '??', '?'].includes(tk.v)) out.metrics.cyclomatic++;
      continue;
    }

    if (tk.t === 'str') out.stringLiterals++;
    if (tk.t === 'num' && Math.abs(tk.value) > 1 && prev && prev.t === 'punc' && !['=', ':', '('].includes(prev.v)) out.magicNumbers++;

    if (tk.t === 'kw') {
      if (['if', 'for', 'while', 'case', 'catch'].includes(tk.v)) out.metrics.cyclomatic++;
      if (tk.v === 'async') out.metrics.asyncCount++;

      if (tk.v === 'import') { out.moduleStyle = 'esm'; collectImport(code, k, out); continue; }
      if (tk.v === 'export') { out.moduleStyle = 'esm'; if (next) out.exports.push(next.v); continue; }

      if (tk.v === 'function') {
        const name = next && next.t === 'id' ? next.v : (prev && prev.t === 'punc' && prev.v === '=' && code[k - 2]?.t === 'id' ? code[k - 2].v : '(anonymous)');
        out.functions.push({ name, kind: 'function', at: tk.i });
        if (name !== '(anonymous)') scopeStack.push({ name, depth });
        continue;
      }

      if (tk.v === 'class') {
        const name = next && next.t === 'id' ? next.v : '(anonymous)';
        let parent = null;
        if (code[k + 2]?.v === 'extends') parent = code[k + 3]?.v || null;
        out.classes.push({ name, extends: parent, methods: [], at: tk.i });
        scopeStack.push({ name, depth, isClass: true });
        continue;
      }

      if (['const', 'let', 'var'].includes(tk.v) && next && next.t === 'id') {
        const varName = next.v;
        out.variables.push({ name: varName, kind: tk.v, scope: depth === 0 ? 'module' : 'local' });
        // arrow function assigned to a name => a declared function
        if (code[k + 2]?.v === '=' ) {
          const a = code[k + 3];
          if (a && (a.v === '(' || a.t === 'id' || a.v === 'async')) {
            const arrowIdx = findArrow(code, k + 3, 12);
            if (arrowIdx > 0) out.functions.push({ name: varName, kind: 'arrow', at: tk.i });
          }
          if (a && a.v === 'new' && code[k + 4]) {
            const ctor = code[k + 4].v;
            out.dataStructures[ctor] = (out.dataStructures[ctor] || 0) + 1;
          }
          if (a && (a.v === '[' )) out.dataStructures.Array = (out.dataStructures.Array || 0) + 1;
          if (a && (a.v === '{')) out.dataStructures.Object = (out.dataStructures.Object || 0) + 1;
        }
        // tuning constants: `const gravity = 0.5`
        const tuneKey = matchesTuningKey(varName);
        if (tuneKey && code[k + 2]?.v === '=' && code[k + 3]?.t === 'num') {
          (out.tuning[tuneKey] ||= []).push(code[k + 3].value);
        }
        continue;
      }
      continue;
    }

    if (tk.t === 'id') {
      // object property tuning: `gravity: 0.5`
      const declared = prev?.t === 'kw' && ['const', 'let', 'var'].includes(prev.v);
      const tuneKey = declared ? null : matchesTuningKey(tk.v);
      if (tuneKey && next?.v === ':' && code[k + 2]?.t === 'num') (out.tuning[tuneKey] ||= []).push(code[k + 2].value);
      if (tuneKey && next?.v === '=' && code[k + 2]?.t === 'num') (out.tuning[tuneKey] ||= []).push(code[k + 2].value);

      if (BROWSER_APIS[tk.v]) {
        const api = BROWSER_APIS[tk.v];
        out.apis[api] = (out.apis[api] || 0) + 1;
      }
      if (LIB_HINTS[tk.v]) {
        const lib = LIB_HINTS[tk.v];
        out.libraries[lib] = (out.libraries[lib] || 0) + 1;
      }
      if (['Map', 'Set', 'WeakMap', 'Float32Array', 'Int32Array', 'Uint8Array', 'Array'].includes(tk.v)) {
        out.dataStructures[tk.v] = (out.dataStructures[tk.v] || 0) + 1;
      }
      if (tk.v === 'addEventListener' && code[k + 1]?.v === '(' && code[k + 2]?.t === 'str') {
        out.events.push(code[k + 2].value);
      }
      // method definitions inside a class body
      const owner = scopeStack[scopeStack.length - 1];
      if (owner?.isClass && next?.v === '(' && prev && (prev.v === '{' || prev.v === '}' || prev.v === ';' || prev.v === 'static' || prev.t === 'kw')) {
        const cls = out.classes.find((c) => c.name === owner.name);
        if (cls && !cls.methods.includes(tk.v)) cls.methods.push(tk.v);
        continue; // a method definition is not a call site
      }
      // call graph edge
      if (next?.v === '(' && declaredFns.has(tk.v)) {
        const caller = [...scopeStack].reverse().find((s) => !s.isClass)?.name || (owner?.name ?? '(top)');
        if (caller !== tk.v) callEdges.push([caller, tk.v]);
      }
      continue;
    }
  }

  // --- derived idioms -------------------------------------------------------
  const text = src;
  if (out.apis.raf) {
    const hasDelta = /(\bdt\b|\bdelta\b|deltaTime|elapsed|lastTime|last\s*=|now\s*-\s*)/.test(text);
    const hasFixed = /(accumulator|fixedStep|FIXED_STEP|step\s*=\s*1\s*\/\s*60|while\s*\(\s*acc)/i.test(text);
    out.loopStyle = hasFixed ? 'fixed-timestep-accumulator' : hasDelta ? 'raf-delta' : 'raf-naive';
  } else if (out.apis.interval) {
    out.loopStyle = 'setInterval';
  }
  if (out.moduleStyle === 'script') {
    if (/module\.exports|require\s*\(/.test(text)) out.moduleStyle = 'commonjs';
    else if (/^\s*\(\s*function\s*\(|\(\s*\(\s*\)\s*=>\s*\{/m.test(text)) out.moduleStyle = 'iife';
  }

  const pat = out.patterns;
  if (out.classes.length && out.functions.length) pat.add('mixed-class-and-function');
  if (out.classes.some((c) => c.extends)) pat.add('inheritance');
  if (/\bswitch\s*\(\s*(state|mode|phase|screen)/i.test(text)) pat.add('state-machine-switch');
  if (/(states|SCENES|screens)\s*=\s*\{/.test(text)) pat.add('state-table');
  if (/\bentities\b|\bactors\b|\bgameObjects\b|\benemies\b|\bobstacles\b|\bbullets\b|\bsprites\b/i.test(text)) pat.add('entity-list');
  if (/components?\s*\[|\bECS\b|addComponent/i.test(text)) pat.add('entity-component');
  if (/pool|recycle|freeList/i.test(text)) pat.add('object-pooling');
  if (/spatialHash|quadtree|QuadTree|grid\[/i.test(text)) pat.add('spatial-partitioning');
  if (/\bAABB\b|intersects?\b|overlap|collide|collision|hitTest|hitbox/i.test(text)) pat.add('collision-detection');
  if (/lerp|damp|smoothstep|easeIn|easeOut/i.test(text)) pat.add('interpolation-easing');
  if (/devicePixelRatio/.test(text)) pat.add('dpr-scaling');
  if (/(touchstart|pointerdown).*(joystick|stick|dpad)/is.test(text)) pat.add('mobile-controls');
  // Writing a save counts as persistence even if this file never reads it back.
  if (/localStorage\.(getItem|setItem)|sessionStorage\.(getItem|setItem)|indexedDB/.test(text)) pat.add('save-load');
  if (/new\s+Worker|postMessage/.test(text)) pat.add('worker-offload');
  if (/seed|mulberry|xorshift|PRNG/i.test(text)) pat.add('seeded-random');
  if (/noise|perlin|simplex/i.test(text)) pat.add('noise-procgen');
  if (/astar|aStar|A\*|dijkstra|bfs|pathfind/i.test(text)) pat.add('pathfinding');
  if (/visibilitychange|blur.*pause|pause.*blur/i.test(text)) pat.add('pause-on-blur');
  if (/GLTFLoader|\.glb|\.gltf/i.test(text)) pat.add('gltf-loading');
  if (/InstancedMesh|instancing/i.test(text)) pat.add('gpu-instancing');
  if (/shaderSource|createShader|ShaderMaterial|fragmentShader/i.test(text)) pat.add('custom-shaders');

  out.patterns = [...pat];
  out.callGraph = dedupeEdges(callEdges);
  out.tuning = Object.fromEntries(Object.entries(out.tuning).map(([k, v]) => [k, v.slice(0, 64)]));
  out.apis = { ...out.apis };
  out.libraries = { ...out.libraries };
  out.dataStructures = { ...out.dataStructures };
  return out;
}

function findArrow(code, from, limit) {
  let par = 0;
  for (let i = from; i < Math.min(code.length, from + limit); i++) {
    const v = code[i].v;
    if (v === '(') par++;
    else if (v === ')') { par--; if (par === 0 && code[i + 1]?.v === '=>') return i + 1; }
    else if (v === '=>') return i;
    else if (par === 0 && (v === ';' || v === '{')) return -1;
  }
  return -1;
}

function collectImport(code, k, out) {
  for (let i = k; i < Math.min(code.length, k + 40); i++) {
    if (code[i].t === 'str') { out.imports.push(code[i].value); return; }
    if (code[i].v === ';') return;
  }
}

function dedupeEdges(edges) {
  const seen = new Set();
  const out = [];
  for (const [a, b] of edges) {
    const key = `${a}>${b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ from: a, to: b });
  }
  return out.slice(0, 400);
}

/**
 * Normalized token stream for near-duplicate detection: identifiers and literals
 * are replaced by role markers so that renaming variables does not hide a copy.
 */
export function normalizedTokens(src) {
  return tokenize(src)
    .filter((t) => t.t !== 'comment')
    .map((t) => {
      if (t.t === 'id') return 'ID';
      if (t.t === 'num') return 'N';
      if (t.t === 'str' || t.t === 'tmpl') return 'S';
      if (t.t === 'regex') return 'R';
      return t.v;
    });
}
