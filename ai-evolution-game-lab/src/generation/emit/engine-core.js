/**
 * Engine emitters, part 1: core loop, math, input, entity store.
 *
 * These emit the *runtime* of a generated game. They are the lab's own code
 * generators - nothing here is copied from imported projects; what the corpus
 * influences is which variant is emitted (fixed vs delta loop, spatial hash vs
 * pairwise, pooling on/off, ...) and the parameters baked into game/config.js.
 *
 * Emitted code targets classic <script> tags and a global `LAB` namespace, on
 * purpose: generated projects then run straight from file:// with no server,
 * no bundler and no import-map, and the headless sandbox can load them too.
 */

export function emitCore({ loopStyle = 'raf-delta', dtClamp = 0.05, fixedStep = 1 / 60, pauseOnBlur = true }) {
  const fixed = loopStyle === 'fixed-timestep-accumulator';
  return `/* engine/core.js - loop, timing, state machine, seeded rng, events
 * loop style: ${loopStyle}${fixed ? ` (fixed step ${fixedStep.toFixed(5)}s)` : ` (delta clamped to ${dtClamp}s)`}
 */
(function (global) {
  'use strict';
  var LAB = global.LAB = global.LAB || {};

  function Events() { this.map = {}; }
  Events.prototype.on = function (type, fn) { (this.map[type] = this.map[type] || []).push(fn); return this; };
  Events.prototype.off = function (type, fn) {
    var l = this.map[type]; if (!l) return this;
    var i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); return this;
  };
  Events.prototype.emit = function (type, data) {
    var l = this.map[type]; if (!l) return;
    for (var i = 0; i < l.length; i++) l[i](data);
  };

  /* Mulberry32: small, fast, seedable. Every generated game is reproducible
     from its seed, which is what makes the lab's tests meaningful. */
  function Rng(seed) {
    this.seed = seed >>> 0 || 1;
    this.state = this.seed;
  }
  Rng.prototype.next = function () {
    this.state = (this.state + 0x6d2b79f5) | 0;
    var t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Rng.prototype.range = function (a, b) { return a + this.next() * (b - a); };
  Rng.prototype.int = function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); };
  Rng.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };
  Rng.prototype.chance = function (p) { return this.next() < p; };
  Rng.prototype.reset = function (seed) { this.state = (seed === undefined ? this.seed : seed) >>> 0; return this; };

  function StateMachine(initial) {
    this.state = initial || 'boot';
    this.prev = null;
    this.states = {};
    this.time = 0;
  }
  StateMachine.prototype.define = function (name, handlers) { this.states[name] = handlers || {}; return this; };
  StateMachine.prototype.set = function (name, payload) {
    if (name === this.state) return;
    var cur = this.states[this.state];
    if (cur && cur.exit) cur.exit(name);
    this.prev = this.state;
    this.state = name;
    this.time = 0;
    var nxt = this.states[name];
    if (nxt && nxt.enter) nxt.enter(payload, this.prev);
  };
  StateMachine.prototype.is = function (name) { return this.state === name; };
  StateMachine.prototype.update = function (dt) {
    this.time += dt;
    var s = this.states[this.state];
    if (s && s.update) s.update(dt);
  };
  StateMachine.prototype.render = function (ctx, alpha) {
    var s = this.states[this.state];
    if (s && s.render) s.render(ctx, alpha);
  };

  function Loop(opts) {
    opts = opts || {};
    this.update = opts.update || function () {};
    this.render = opts.render || function () {};
    this.onPause = opts.onPause || null;
    this.running = false;
    this.paused = false;
    this.last = 0;
    this.acc = 0;
    this.frame = 0;
    this.elapsed = 0;
    this.timeScale = 1;
    this.fps = 60;
    this.fpsSamples = [];
    this.step = ${fixed ? fixedStep.toFixed(6) : '1 / 60'};
    this.maxDelta = ${dtClamp};
  }
  Loop.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this.last = LAB.now();
    var self = this;
    this.rafId = global.requestAnimationFrame(function tick(now) {
      self.tick(now);
      if (self.running) self.rafId = global.requestAnimationFrame(tick);
    });
  };
  Loop.prototype.stop = function () {
    this.running = false;
    if (this.rafId) global.cancelAnimationFrame(this.rafId);
  };
  Loop.prototype.setPaused = function (v) {
    this.paused = !!v;
    this.last = LAB.now();
    this.acc = 0;
    if (this.onPause) this.onPause(this.paused);
  };
  Loop.prototype.tick = function (now) {
    var raw = (now - this.last) / 1000;
    this.last = now;
    /* Clamping matters: a backgrounded tab or a GC pause produces a huge delta
       that would otherwise teleport entities through walls. */
    var dt = Math.min(this.maxDelta, Math.max(0, raw)) * this.timeScale;
    this.frame++;
    if (raw > 0) {
      this.fpsSamples.push(1 / raw);
      if (this.fpsSamples.length > 60) this.fpsSamples.shift();
      var sum = 0;
      for (var i = 0; i < this.fpsSamples.length; i++) sum += this.fpsSamples[i];
      this.fps = sum / this.fpsSamples.length;
    }
    if (this.paused) { this.render(0); return; }
    this.elapsed += dt;
${fixed
    ? `    this.acc += dt;
    var guard = 0;
    while (this.acc >= this.step && guard < 8) { this.update(this.step); this.acc -= this.step; guard++; }
    if (guard >= 8) this.acc = 0; /* give up catching up rather than spiralling */
    this.render(this.acc / this.step);`
    : `    this.update(dt);
    this.render(1);`}
  };

  LAB.now = function () {
    return (global.performance && global.performance.now) ? global.performance.now() : Date.now();
  };
  LAB.Events = Events;
  LAB.Rng = Rng;
  LAB.StateMachine = StateMachine;
  LAB.Loop = Loop;
  LAB.version = '1.0.0';
${pauseOnBlur ? `
  /* Pause when the tab is hidden: prevents the delta spike on return. */
  LAB.bindLifecycle = function (loop, onHide) {
    if (!global.document || !global.document.addEventListener) return;
    global.document.addEventListener('visibilitychange', function () {
      if (global.document.hidden) { loop.setPaused(true); if (onHide) onHide(); }
    });
    global.addEventListener('blur', function () { loop.setPaused(true); if (onHide) onHide(); });
  };` : `
  LAB.bindLifecycle = function () {};`}
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

export function emitMath({ spatialHash = true }) {
  return `/* engine/math.js - vectors, easing, overlap tests${spatialHash ? ', uniform-grid broadphase' : ''} */
(function (global) {
  'use strict';
  var LAB = global.LAB = global.LAB || {};
  var M = LAB.math = {};

  M.TAU = Math.PI * 2;
  M.clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  M.lerp = function (a, b, t) { return a + (b - a) * t; };
  /* Frame-rate independent smoothing - the naive lerp(a,b,0.1) is not. */
  M.damp = function (a, b, lambda, dt) { return M.lerp(a, b, 1 - Math.exp(-lambda * dt)); };
  M.dist = function (ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); };
  M.dist2 = function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
  M.angle = function (ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); };
  M.angleLerp = function (a, b, t) {
    var d = ((b - a + Math.PI) % M.TAU + M.TAU) % M.TAU - Math.PI;
    return a + d * t;
  };
  M.sign = function (v) { return v < 0 ? -1 : v > 0 ? 1 : 0; };
  M.approach = function (v, target, delta) {
    if (v < target) return Math.min(v + delta, target);
    if (v > target) return Math.max(v - delta, target);
    return target;
  };
  M.circleOverlap = function (a, b) {
    var r = (a.r || 0) + (b.r || 0);
    return M.dist2(a.x, a.y, b.x, b.y) <= r * r;
  };
  M.rectOverlap = function (a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  };
  M.circleRect = function (c, r) {
    var cx = M.clamp(c.x, r.x, r.x + r.w);
    var cy = M.clamp(c.y, r.y, r.y + r.h);
    return M.dist2(c.x, c.y, cx, cy) <= (c.r || 0) * (c.r || 0);
  };
  M.pointInRect = function (px, py, r) { return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h; };
  M.ease = {
    inQuad: function (t) { return t * t; },
    outQuad: function (t) { return t * (2 - t); },
    inOutQuad: function (t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; },
    outBack: function (t) { var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    outElastic: function (t) { return t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (M.TAU / 3)) + 1; },
  };
${spatialHash ? `
  /* Uniform grid broadphase: turns O(n^2) pair testing into O(n) for the
     entity counts these games produce. */
  function Grid(cell) { this.cell = cell || 64; this.map = new Map(); }
  Grid.prototype.key = function (x, y) {
    return (Math.floor(x / this.cell)) + ',' + (Math.floor(y / this.cell));
  };
  Grid.prototype.clear = function () { this.map.clear(); };
  Grid.prototype.insert = function (e) {
    var k = this.key(e.x, e.y);
    var bucket = this.map.get(k);
    if (!bucket) { bucket = []; this.map.set(k, bucket); }
    bucket.push(e);
  };
  Grid.prototype.query = function (x, y, radius, out) {
    out = out || [];
    out.length = 0;
    var r = Math.max(1, Math.ceil(radius / this.cell));
    var cx = Math.floor(x / this.cell), cy = Math.floor(y / this.cell);
    for (var gx = cx - r; gx <= cx + r; gx++) {
      for (var gy = cy - r; gy <= cy + r; gy++) {
        var bucket = this.map.get(gx + ',' + gy);
        if (!bucket) continue;
        for (var i = 0; i < bucket.length; i++) out.push(bucket[i]);
      }
    }
    return out;
  };
  M.Grid = Grid;` : `
  /* Pairwise broadphase (no spatial structure): entity counts here stay small. */
  M.Grid = function () {
    this.items = [];
    this.clear = function () { this.items.length = 0; };
    this.insert = function (e) { this.items.push(e); };
    this.query = function (x, y, radius, out) {
      out = out || []; out.length = 0;
      for (var i = 0; i < this.items.length; i++) out.push(this.items[i]);
      return out;
    };
  };`}
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

export function emitInput({ bindings, pointerAim = false, virtualStick = false, gamepad = true, bufferMs = 120 }) {
  const bindingJson = JSON.stringify(bindings, null, 2).replace(/\n/g, '\n  ');
  return `/* engine/input.js - action mapping, edge detection, input buffering${virtualStick ? ', touch stick' : ''}
 * Events only record state; the update loop samples it. That keeps input
 * frame-rate independent and makes headless testing possible.
 */
(function (global) {
  'use strict';
  var LAB = global.LAB = global.LAB || {};

  var BINDINGS = ${bindingJson};

  function Input(opts) {
    opts = opts || {};
    this.el = opts.element || global.document;
    this.bindings = opts.bindings || BINDINGS;
    this.keys = Object.create(null);
    this.prev = Object.create(null);
    this.buffer = Object.create(null);
    this.bufferMs = ${bufferMs};
    this.pointer = { x: 0, y: 0, worldX: 0, worldY: 0, down: false, justDown: false, justUp: false };
    this.stick = { x: 0, y: 0, active: false, id: null, originX: 0, originY: 0 };
    this.enabled = true;
    this.anyKeyPressed = false;
    this.bind();
  }

  Input.prototype.bind = function () {
    var self = this;
    var doc = global.document;
    if (!doc || !doc.addEventListener) return;
    doc.addEventListener('keydown', function (e) {
      if (!self.enabled) return;
      if (!self.keys[e.code]) self.buffer[e.code] = LAB.now();
      self.keys[e.code] = true;
      self.anyKeyPressed = true;
      if (self.isBound(e.code)) { if (e.preventDefault) e.preventDefault(); }
    });
    doc.addEventListener('keyup', function (e) { self.keys[e.code] = false; });
    global.addEventListener('blur', function () { self.releaseAll(); });

    var target = self.el && self.el.addEventListener ? self.el : doc;
    target.addEventListener('pointermove', function (e) { self.setPointer(e); });
    target.addEventListener('pointerdown', function (e) {
      self.setPointer(e);
      self.pointer.down = true;
      self.keys['Mouse' + (e.button || 0)] = true;
      self.buffer['Mouse' + (e.button || 0)] = LAB.now();
      ${virtualStick ? `self.beginStick(e);` : ''}
    });
    target.addEventListener('pointerup', function (e) {
      self.pointer.down = false;
      self.keys['Mouse' + (e.button || 0)] = false;
      ${virtualStick ? `self.endStick(e);` : ''}
    });
    ${virtualStick ? `target.addEventListener('pointercancel', function (e) { self.endStick(e); self.pointer.down = false; });` : ''}
    target.addEventListener('contextmenu', function (e) { if (e.preventDefault) e.preventDefault(); });
  };

  Input.prototype.isBound = function (code) {
    for (var a in this.bindings) {
      var list = this.bindings[a];
      for (var i = 0; i < list.length; i++) if (list[i] === code) return true;
    }
    return false;
  };

  Input.prototype.setPointer = function (e) {
    var rect = this.el && this.el.getBoundingClientRect ? this.el.getBoundingClientRect() : { left: 0, top: 0, width: 1, height: 1 };
    this.pointer.x = (e.clientX || 0) - rect.left;
    this.pointer.y = (e.clientY || 0) - rect.top;
  };

  Input.prototype.releaseAll = function () {
    for (var k in this.keys) this.keys[k] = false;
    this.pointer.down = false;
    this.stick.active = false; this.stick.x = 0; this.stick.y = 0;
  };
${virtualStick ? `
  Input.prototype.beginStick = function (e) {
    if (this.stick.active) return;
    this.stick.active = true;
    this.stick.id = e.pointerId;
    this.stick.originX = this.pointer.x;
    this.stick.originY = this.pointer.y;
    this.stick.x = 0; this.stick.y = 0;
  };
  Input.prototype.endStick = function (e) {
    if (!this.stick.active) return;
    if (e && e.pointerId !== undefined && e.pointerId !== this.stick.id) return;
    this.stick.active = false; this.stick.x = 0; this.stick.y = 0;
  };
  Input.prototype.updateStick = function () {
    if (!this.stick.active) return;
    var dx = this.pointer.x - this.stick.originX;
    var dy = this.pointer.y - this.stick.originY;
    var len = Math.hypot(dx, dy) || 1;
    var max = 64;
    var k = Math.min(1, len / max);
    this.stick.x = (dx / len) * k;
    this.stick.y = (dy / len) * k;
  };` : ''}

  /** Held this frame. */
  Input.prototype.down = function (action) {
    var list = this.bindings[action];
    if (!list) return false;
    for (var i = 0; i < list.length; i++) if (this.keys[list[i]]) return true;
    return false;
  };
  /** Went down this frame (edge). */
  Input.prototype.pressed = function (action) {
    var list = this.bindings[action];
    if (!list) return false;
    for (var i = 0; i < list.length; i++) if (this.keys[list[i]] && !this.prev[list[i]]) return true;
    return false;
  };
  Input.prototype.released = function (action) {
    var list = this.bindings[action];
    if (!list) return false;
    for (var i = 0; i < list.length; i++) if (!this.keys[list[i]] && this.prev[list[i]]) return true;
    return false;
  };
  /**
   * Buffered press: a press that happened up to bufferMs ago still counts.
   * This is what makes jumps feel responsive near a landing.
   */
  Input.prototype.buffered = function (action, consume) {
    var list = this.bindings[action];
    if (!list) return false;
    var now = LAB.now();
    for (var i = 0; i < list.length; i++) {
      var t = this.buffer[list[i]];
      if (t !== undefined && now - t <= this.bufferMs) {
        if (consume !== false) this.buffer[list[i]] = undefined;
        return true;
      }
    }
    return false;
  };

  /** Normalized movement vector from keys${virtualStick ? ' or the touch stick' : ''}. */
  Input.prototype.axis = function () {
    var x = 0, y = 0;
    if (this.down('left')) x -= 1;
    if (this.down('right')) x += 1;
    if (this.down('up')) y -= 1;
    if (this.down('down')) y += 1;
${virtualStick ? `    if (this.stick.active && (Math.abs(this.stick.x) > 0.12 || Math.abs(this.stick.y) > 0.12)) {
      x = this.stick.x; y = this.stick.y;
    }` : ''}
${gamepad ? `    var pads = (global.navigator && global.navigator.getGamepads) ? global.navigator.getGamepads() : null;
    if (pads && pads[0] && pads[0].axes && pads[0].axes.length >= 2) {
      var gx = pads[0].axes[0], gy = pads[0].axes[1];
      if (Math.abs(gx) > 0.18 || Math.abs(gy) > 0.18) { x = gx; y = gy; }
    }` : ''}
    var len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x: x, y: y, length: Math.min(1, len) };
  };

  Input.prototype.update = function () {
${virtualStick ? `    this.updateStick();` : ''}
    for (var k in this.keys) this.prev[k] = this.keys[k];
    this.pointer.justDown = false;
    this.pointer.justUp = false;
  };

  Input.prototype.describe = function () {
    var out = [];
    for (var a in this.bindings) out.push(a + ': ' + this.bindings[a].join(' / '));
    return out;
  };

  LAB.Input = Input;
  LAB.BINDINGS = BINDINGS;
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

export function emitEntities({ pooling = true, maxEntities = 2000 }) {
  return `/* engine/entities.js - entity store with tag queries${pooling ? ' and pooling' : ''}
 * Flat arrays + a free list: predictable iteration order, no per-frame
 * allocation${pooling ? ', dead entities are recycled instead of garbage' : ''}.
 */
(function (global) {
  'use strict';
  var LAB = global.LAB = global.LAB || {};

  function World(opts) {
    opts = opts || {};
    this.items = [];
    this.byTag = Object.create(null);
    this.free = [];
    this.max = ${maxEntities};
    this.nextId = 1;
    this.stats = { created: 0, recycled: 0, removed: 0, peak: 0 };
  }

  World.prototype.spawn = function (tag, props) {
    var e;
${pooling ? `    if (this.free.length) {
      e = this.free.pop();
      for (var k in e) if (k !== 'id') delete e[k];
      this.stats.recycled++;
    } else {
      if (this.items.length >= this.max) return null;
      e = { id: this.nextId++ };
      this.stats.created++;
    }` : `    if (this.items.length >= this.max) return null;
    e = { id: this.nextId++ };
    this.stats.created++;`}
    e.tag = tag;
    e.alive = true;
    e.x = 0; e.y = 0; e.vx = 0; e.vy = 0; e.r = 8; e.age = 0;
    if (props) for (var p in props) e[p] = props[p];
    this.items.push(e);
    (this.byTag[tag] = this.byTag[tag] || []).push(e);
    if (this.items.length > this.stats.peak) this.stats.peak = this.items.length;
    return e;
  };

  World.prototype.kill = function (e) { if (e) e.alive = false; };

  World.prototype.get = function (tag) { return this.byTag[tag] || []; };

  World.prototype.first = function (tag) {
    var l = this.byTag[tag];
    return l && l.length ? l[0] : null;
  };

  World.prototype.count = function (tag) { return tag ? (this.byTag[tag] || []).length : this.items.length; };

  World.prototype.each = function (tag, fn) {
    var list = tag ? (this.byTag[tag] || []) : this.items;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.alive) fn(e, i);
    }
  };

  /** Compacts the arrays once per frame; keeps iteration cheap and stable. */
  World.prototype.sweep = function () {
    var keep = [];
    for (var i = 0; i < this.items.length; i++) {
      var e = this.items[i];
      if (e.alive) { keep.push(e); continue; }
      this.stats.removed++;
${pooling ? `      if (this.free.length < 512) this.free.push(e);` : ''}
    }
    this.items = keep;
    for (var tag in this.byTag) {
      var list = this.byTag[tag];
      var out = [];
      for (var j = 0; j < list.length; j++) if (list[j].alive) out.push(list[j]);
      this.byTag[tag] = out;
    }
  };

  World.prototype.clear = function () {
    this.items.length = 0;
    this.byTag = Object.create(null);
    this.free.length = 0;
  };

  LAB.World = World;
})(typeof window !== 'undefined' ? window : globalThis);
`;
}
