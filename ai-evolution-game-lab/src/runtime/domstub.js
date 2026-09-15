/**
 * Minimal browser environment for headless execution (spec 27).
 *
 * This is not a browser and does not pretend to be one: there is no layout
 * engine, no CSS cascade and no WebGL. What it provides is exactly what a
 * canvas game touches - DOM element stubs, a recording 2D context with a real
 * transform stack, rAF driven by a virtual clock, localStorage, and event
 * dispatch - which is enough to actually *run* a generated game, press its
 * keys and watch what it draws.
 */

class ClassList {
  constructor() { this.set = new Set(); }
  add(...c) { for (const x of c) this.set.add(x); }
  remove(...c) { for (const x of c) this.set.delete(x); }
  toggle(c, force) { if (force === undefined) { this.set.has(c) ? this.set.delete(c) : this.set.add(c); } else if (force) this.set.add(c); else this.set.delete(c); }
  contains(c) { return this.set.has(c); }
  get value() { return [...this.set].join(' '); }
  toString() { return this.value; }
}

class Element {
  constructor(tag, doc) {
    this.tagName = String(tag).toUpperCase();
    this.ownerDocument = doc;
    this.children = [];
    this.parentNode = null;
    this.style = new Proxy({}, { get: (t, k) => t[k] ?? '', set: (t, k, v) => { t[k] = v; return true; } });
    this.classList = new ClassList();
    this.dataset = {};
    this.attributes = {};
    this._text = '';
    this.listeners = new Map();
    this.width = 0;
    this.height = 0;
    this.rect = { left: 0, top: 0, width: 960, height: 540, right: 960, bottom: 540 };
    this.hidden = false;
    this.disabled = false;
  }
  set className(v) { this.classList.set = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return this.classList.value; }
  set textContent(v) { this._text = String(v); this.children.length = 0; }
  get textContent() { return this._text || this.children.map((c) => c.textContent).join(''); }
  set innerHTML(v) { this._text = ''; this.children.length = 0; if (v) this._text = String(v).replace(/<[^>]*>/g, ''); }
  get innerHTML() { return this._text; }
  appendChild(child) { child.parentNode = this; this.children.push(child); if (child.id) this.ownerDocument?.register(child); return child; }
  insertBefore(child, ref) {
    child.parentNode = this;
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i >= 0) this.children.splice(i, 0, child); else this.children.push(child);
    if (child.id) this.ownerDocument?.register(child);
    return child;
  }
  prepend(child) { return this.insertBefore(child, this.children[0]); }
  get firstChild() { return this.children[0] || null; }
  get lastChild() { return this.children[this.children.length - 1] || null; }
  contains(node) { return node === this || this.children.some((c) => c.contains && c.contains(node)); }
  removeChild(child) { const i = this.children.indexOf(child); if (i >= 0) this.children.splice(i, 1); return child; }
  remove() { this.parentNode?.removeChild(this); }
  setAttribute(k, v) { this.attributes[k] = String(v); if (k === 'id') { this.id = String(v); this.ownerDocument?.register(this); } }
  getAttribute(k) { return this.attributes[k] ?? null; }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(fn); }
  removeEventListener(type, fn) {
    const l = this.listeners.get(type); if (!l) return;
    const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1);
  }
  dispatchEvent(evt) {
    const l = this.listeners.get(evt.type) || [];
    for (const fn of l) fn(evt);
    return true;
  }
  getBoundingClientRect() { return { ...this.rect }; }
  get clientWidth() { return this.rect.width; }
  get clientHeight() { return this.rect.height; }
  requestPointerLock() { this.ownerDocument.pointerLockElement = this; }
  focus() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  getContext(kind) {
    if (kind !== '2d') return null;
    if (!this._ctx) this._ctx = new Recording2D(this);
    return this._ctx;
  }
}

/**
 * Canvas 2D context that records what was drawn, including a real transform
 * stack, so tests can answer "did the player actually appear on screen".
 */
class Recording2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ops = Object.create(null);
    this.total = 0;
    this.m = [1, 0, 0, 1, 0, 0];
    this.stack = [];
    this.path = [];
    this.fillStyle = '#000';
    this.strokeStyle = '#000';
    this.lineWidth = 1;
    this.globalAlpha = 1;
    this.font = '';
    this.textAlign = 'left';
    this.textBaseline = 'alphabetic';
    this.shadowBlur = 0;
    this.shadowColor = '';
    this.gridW = 32;
    this.gridH = 18;
    this.coverage = new Float32Array(this.gridW * this.gridH);
    this.texts = [];
    this.colors = Object.create(null);
    this.outOfBounds = 0;
    this.nonFinite = 0;
  }
  count(op) { this.ops[op] = (this.ops[op] || 0) + 1; this.total++; }
  apply(x, y) {
    const m = this.m;
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  }
  mark(x, y, w = 1, h = 1, color) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) { this.nonFinite++; return; }
    const cw = this.canvas.width || 960;
    const ch = this.canvas.height || 540;
    const [sx, sy] = this.apply(x, y);
    const [ex, ey] = this.apply(x + w, y + h);
    const x0 = Math.min(sx, ex), x1 = Math.max(sx, ex);
    const y0 = Math.min(sy, ey), y1 = Math.max(sy, ey);
    if (x1 < 0 || y1 < 0 || x0 > cw || y0 > ch) { this.outOfBounds++; return; }
    if (color) this.colors[color] = (this.colors[color] || 0) + 1;
    const gx0 = Math.max(0, Math.floor((x0 / cw) * this.gridW));
    const gx1 = Math.min(this.gridW - 1, Math.floor((x1 / cw) * this.gridW));
    const gy0 = Math.max(0, Math.floor((y0 / ch) * this.gridH));
    const gy1 = Math.min(this.gridH - 1, Math.floor((y1 / ch) * this.gridH));
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) this.coverage[gy * this.gridW + gx] += this.globalAlpha;
    }
  }
  save() { this.stack.push([...this.m, this.globalAlpha]); this.count('save'); }
  restore() { const s = this.stack.pop(); if (s) { this.m = s.slice(0, 6); this.globalAlpha = s[6]; } this.count('restore'); }
  setTransform(a, b, c, d, e, f) { this.m = [a, b, c, d, e, f]; this.count('setTransform'); }
  resetTransform() { this.m = [1, 0, 0, 1, 0, 0]; }
  transform(a, b, c, d, e, f) { this.multiply([a, b, c, d, e, f]); }
  multiply(n) {
    const m = this.m;
    this.m = [
      m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
    ];
  }
  translate(x, y) { this.multiply([1, 0, 0, 1, x, y]); this.count('translate'); }
  scale(x, y) { this.multiply([x, 0, 0, y, 0, 0]); this.count('scale'); }
  rotate(a) { const c = Math.cos(a), s = Math.sin(a); this.multiply([c, s, -s, c, 0, 0]); this.count('rotate'); }
  clearRect(x, y, w, h) { this.count('clearRect'); }
  fillRect(x, y, w, h) { this.count('fillRect'); this.mark(x, y, w, h, this.fillStyle); }
  strokeRect(x, y, w, h) { this.count('strokeRect'); this.mark(x, y, w, h, this.strokeStyle); }
  beginPath() { this.path = []; this.count('beginPath'); }
  closePath() { this.count('closePath'); }
  moveTo(x, y) { this.path.push([x, y]); }
  lineTo(x, y) { this.path.push([x, y]); }
  arc(x, y, r) { this.path.push([x - r, y - r], [x + r, y + r]); this.count('arc'); }
  arcTo() { this.count('arcTo'); }
  ellipse(x, y, rx, ry) { this.path.push([x - rx, y - ry], [x + rx, y + ry]); }
  rect(x, y, w, h) { this.path.push([x, y], [x + w, y + h]); }
  quadraticCurveTo(cx, cy, x, y) { this.path.push([x, y]); }
  bezierCurveTo(a, b, c, d, x, y) { this.path.push([x, y]); }
  fill() { this.count('fill'); this.#paintPath(this.fillStyle); }
  stroke() { this.count('stroke'); this.#paintPath(this.strokeStyle); }
  clip() { this.count('clip'); }
  #paintPath(color) {
    if (!this.path.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of this.path) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) { this.nonFinite++; continue; }
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    if (Number.isFinite(x0)) this.mark(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0), color);
  }
  fillText(text, x, y) { this.count('fillText'); this.texts.push({ text: String(text), x, y }); this.mark(x, y - 10, Math.max(8, String(text).length * 8), 14, this.fillStyle); }
  strokeText(text, x, y) { this.fillText(text, x, y); }
  measureText(t) { return { width: String(t).length * 8, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 3 }; }
  createRadialGradient() { return { addColorStop() {} }; }
  createLinearGradient() { return { addColorStop() {} }; }
  createPattern() { return null; }
  drawImage() { this.count('drawImage'); }
  putImageData() { this.count('putImageData'); }
  getImageData(x, y, w, h) { return { data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }; }
  setLineDash() {}
  roundRect(x, y, w, h) { this.rect(x, y, w, h); }

  /** Fraction of the screen grid that received any paint. */
  coverageRatio() {
    let filled = 0;
    for (let i = 0; i < this.coverage.length; i++) if (this.coverage[i] > 0.02) filled++;
    return filled / this.coverage.length;
  }
  resetFrame() {
    this.coverage.fill(0);
    this.texts.length = 0;
    this.ops = Object.create(null);
    this.total = 0;
    this.outOfBounds = 0;
    this.colors = Object.create(null);
  }
}

class Document extends Element {
  constructor() {
    super('#document', null);
    this.ownerDocument = this;
    this.byId = new Map();
    this.readyState = 'complete';
    this.hidden = false;
    this.body = new Element('body', this);
    this.documentElement = new Element('html', this);
    this.head = new Element('head', this);
    this.appendChild(this.documentElement);
    this.appendChild(this.body);
  }
  register(el) { if (el.id) this.byId.set(el.id, el); }
  createElement(tag) { return new Element(tag, this); }
  createTextNode(t) { const e = new Element('#text', this); e.textContent = t; return e; }
  getElementById(id) { return this.byId.get(id) || null; }
  getElementsByTagName(tag) {
    const out = [];
    const visit = (n) => { if (n.tagName === String(tag).toUpperCase()) out.push(n); n.children.forEach(visit); };
    visit(this);
    return out;
  }
  querySelector(sel) {
    if (sel.startsWith('#')) return this.getElementById(sel.slice(1));
    const tag = sel.replace(/[.#].*/, '');
    return this.getElementsByTagName(tag)[0] || null;
  }
}

/**
 * Creates a sandbox global object. `clock` is virtual: nothing here uses real
 * time, so a test run is deterministic and takes milliseconds.
 */
export function createDom({ width = 960, height = 540, dpr = 1, seedTime = 1000 } = {}) {
  const doc = new Document();
  const stage = doc.createElement('canvas');
  stage.id = 'stage';
  stage.rect = { left: 0, top: 0, width, height, right: width, bottom: height };
  stage.width = width * dpr;
  stage.height = height * dpr;
  doc.body.appendChild(stage);
  doc.register(stage);
  const ui = doc.createElement('div');
  ui.id = 'ui';
  ui.rect = { left: 0, top: 0, width, height, right: width, bottom: height };
  doc.body.appendChild(ui);
  doc.register(ui);

  const state = {
    time: seedTime,
    rafQueue: [],
    rafId: 1,
    timers: [],
    timerId: 1,
    errors: [],
    logs: [],
  };

  const storage = new Map();
  const localStorage = {
    getItem: (k) => (storage.has(String(k)) ? storage.get(String(k)) : null),
    setItem: (k, v) => { storage.set(String(k), String(v)); },
    removeItem: (k) => { storage.delete(String(k)); },
    clear: () => storage.clear(),
    key: (i) => [...storage.keys()][i] ?? null,
    get length() { return storage.size; },
  };

  class AudioParamStub {
    constructor() { this.value = 0; }
    setValueAtTime() { return this; }
    exponentialRampToValueAtTime() { return this; }
    linearRampToValueAtTime() { return this; }
  }
  class AudioContextStub {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; this.created = 0; }
    createOscillator() { this.created++; return { type: 'sine', frequency: new AudioParamStub(), connect() {}, start() {}, stop() {}, disconnect() {} }; }
    createGain() { return { gain: new AudioParamStub(), connect() {}, disconnect() {} }; }
    createBuffer() { return { getChannelData: () => new Float32Array(1) }; }
    createBufferSource() { return { buffer: null, connect() {}, start() {}, stop() {} }; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }

  const win = {
    document: doc,
    devicePixelRatio: dpr,
    innerWidth: width,
    innerHeight: height,
    localStorage,
    sessionStorage: localStorage,
    navigator: { userAgent: 'LabSandbox/1.0', getGamepads: () => [], maxTouchPoints: 0, language: 'en' },
    location: { href: 'file:///game/index.html', protocol: 'file:', search: '', hash: '' },
    performance: { now: () => state.time },
    AudioContext: AudioContextStub,
    webkitAudioContext: AudioContextStub,
    Image: class { constructor() { this.width = 1; this.height = 1; } set src(v) { this._src = v; if (this.onload) setTimeout(() => this.onload(), 0); } get src() { return this._src; } },
    Audio: class { play() { return Promise.resolve(); } pause() {} },
    listeners: new Map(),
    console: {
      log: (...a) => state.logs.push({ level: 'log', msg: a.map(String).join(' ') }),
      warn: (...a) => state.logs.push({ level: 'warn', msg: a.map(String).join(' ') }),
      error: (...a) => state.logs.push({ level: 'error', msg: a.map(String).join(' ') }),
      info: (...a) => state.logs.push({ level: 'info', msg: a.map(String).join(' ') }),
      debug: () => {},
    },
    requestAnimationFrame(fn) { const id = state.rafId++; state.rafQueue.push({ id, fn }); return id; },
    cancelAnimationFrame(id) { state.rafQueue = state.rafQueue.filter((r) => r.id !== id); },
    setTimeout(fn, ms) { const id = state.timerId++; state.timers.push({ id, at: state.time + (ms || 0), fn }); return id; },
    clearTimeout(id) { state.timers = state.timers.filter((t) => t.id !== id); },
    setInterval(fn, ms) { const id = state.timerId++; state.timers.push({ id, at: state.time + (ms || 0), fn, every: Math.max(1, ms || 16) }); return id; },
    clearInterval(id) { state.timers = state.timers.filter((t) => t.id !== id); },
    requestIdleCallback(fn) { return win.setTimeout(() => fn({ timeRemaining: () => 5 }), 1); },
    matchMedia: (q) => ({ matches: /coarse/.test(q) ? false : true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    addEventListener(type, fn) { if (!win.listeners.has(type)) win.listeners.set(type, []); win.listeners.get(type).push(fn); },
    removeEventListener(type, fn) {
      const l = win.listeners.get(type); if (!l) return;
      const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1);
    },
    dispatchEvent(evt) {
      for (const fn of win.listeners.get(evt.type) || []) fn(evt);
      return true;
    },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
    structuredClone: (v) => JSON.parse(JSON.stringify(v)),
    alert: () => {}, confirm: () => true, prompt: () => null,
    __state: state,
  };
  win.window = win;
  win.globalThis = win;
  win.self = win;
  win.top = win;
  win.parent = win;
  doc.defaultView = win;

  return { win, doc, state, stage, ui, ctx: () => stage.getContext('2d') };
}

/** Dispatches an event to both document and window listeners. */
export function fire(win, type, props = {}) {
  const evt = { type, preventDefault() {}, stopPropagation() {}, ...props };
  win.document.dispatchEvent(evt);
  win.dispatchEvent(evt);
  return evt;
}
