/**
 * Engine emitters, part 3: renderer, HUD/menus, procedural audio, save system,
 * and the optional three.js bootstrap for 3D designs.
 */

export function emitRender({ palette, dpr = true, style = 'neon-vector', lightBackground = false, layers = ['bg', 'world', 'fx'] }) {
  const pal = JSON.stringify(palette);
  // On a light background a black vignette reads as dirt, and glow washes out.
  const shade = lightBackground ? '0,0,0' : '0,0,0';
  const vignetteScale = lightBackground ? 0.35 : 1;
  const glow = !lightBackground && (style === 'neon-vector' || style === 'deep-sea' || style === 'retro-crt');
  return `/* engine/render.js - canvas renderer (${style})
 * ${dpr ? 'Backing store scales with devicePixelRatio, CSS size stays logical.' : 'Fixed-resolution backing store.'}
 */
(function (global) {
  'use strict';
  var LAB = global.LAB = global.LAB || {};
  var PALETTE = ${pal};

  function Renderer(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.palette = opts.palette || PALETTE;
    this.width = opts.width || 960;
    this.height = opts.height || 540;
    this.dpr = 1;
    this.drawCalls = 0;
    this.resize();
    var self = this;
    if (global.addEventListener) global.addEventListener('resize', function () { self.resize(); });
  }

  Renderer.prototype.resize = function () {
    var css = this.canvas.getBoundingClientRect ? this.canvas.getBoundingClientRect() : { width: this.width, height: this.height };
    var w = Math.max(320, Math.round(css.width || this.width));
    var h = Math.max(240, Math.round(css.height || this.height));
${dpr ? `    var dpr = Math.min(2.5, (global.devicePixelRatio || 1));
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);` : `    this.dpr = 1;
    this.canvas.width = w;
    this.canvas.height = h;`}
    this.width = w;
    this.height = h;
    if (this.onResize) this.onResize(w, h);
  };

  /** Called once per frame before drawing: resets transform and clears. */
  Renderer.prototype.begin = function () {
    var ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = this.palette[0];
    ctx.fillRect(0, 0, this.width, this.height);
    this.drawCalls = 0;
  };

  Renderer.prototype.circle = function (x, y, r, color) {
    var ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    this.drawCalls++;
  };

  Renderer.prototype.ring = function (x, y, r, color, width) {
    var ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    this.drawCalls++;
  };

  Renderer.prototype.rect = function (x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
    this.drawCalls++;
  };

  Renderer.prototype.strokeRect = function (x, y, w, h, color, width) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width || 2;
    this.ctx.strokeRect(x, y, w, h);
    this.drawCalls++;
  };

  Renderer.prototype.line = function (x1, y1, x2, y2, color, width) {
    var ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    this.drawCalls++;
  };

  Renderer.prototype.poly = function (points, color, close) {
    var ctx = this.ctx;
    if (!points.length) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    if (close !== false) ctx.closePath();
    ctx.fill();
    this.drawCalls++;
  };

  Renderer.prototype.text = function (str, x, y, opts) {
    opts = opts || {};
    var ctx = this.ctx;
    ctx.fillStyle = opts.color || this.palette[1];
    ctx.font = (opts.weight || '600') + ' ' + (opts.size || 16) + 'px ' + (opts.font || 'system-ui, -apple-system, Segoe UI, sans-serif');
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.baseline || 'alphabetic';
    ctx.fillText(str, x, y);
    this.drawCalls++;
  };

  /** Entity shape vocabulary: distinct silhouettes without any image assets. */
  Renderer.prototype.shape = function (kind, x, y, r, color, angle) {
    var ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    if (angle) ctx.rotate(angle);
${glow ? `    ctx.shadowColor = color;
    ctx.shadowBlur = r * 0.9;` : ''}
    ctx.fillStyle = color;
    switch (kind) {
      case 'triangle':
        ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r * 0.8, r * 0.7); ctx.lineTo(-r * 0.8, -r * 0.7); ctx.closePath(); ctx.fill();
        break;
      case 'diamond':
        ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill();
        break;
      case 'square':
        ctx.fillRect(-r, -r, r * 2, r * 2);
        break;
      case 'hex':
        ctx.beginPath();
        for (var i = 0; i < 6; i++) {
          var a = (i / 6) * Math.PI * 2;
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fill();
        break;
      case 'cross':
        ctx.fillRect(-r, -r * 0.32, r * 2, r * 0.64);
        ctx.fillRect(-r * 0.32, -r, r * 0.64, r * 2);
        break;
      case 'capsule':
        ctx.beginPath();
        ctx.arc(-r * 0.4, 0, r * 0.7, 0, Math.PI * 2);
        ctx.arc(r * 0.4, 0, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-r * 0.4, -r * 0.7, r * 0.8, r * 1.4);
        break;
      default:
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    this.drawCalls++;
  };

  /** Health/charge bar drawn in world space above an entity. */
  Renderer.prototype.bar = function (x, y, w, h, ratio, fg, bg) {
    this.rect(x - w / 2, y, w, h, bg || 'rgba(0,0,0,0.45)');
    this.rect(x - w / 2, y, w * Math.max(0, Math.min(1, ratio)), h, fg);
  };

  /** Parallax dot field: cheap depth cue, no assets. */
  Renderer.prototype.starfield = function (camera, rng, count, color) {
    if (!this._stars) {
      this._stars = [];
      for (var i = 0; i < (count || 90); i++) {
        this._stars.push({ x: rng.range(-2000, 2000), y: rng.range(-2000, 2000), z: rng.range(0.25, 1), s: rng.range(1, 2.4) });
      }
    }
    var ctx = this.ctx;
    ctx.fillStyle = color || this.palette[3] || '#ffffff';
    for (var j = 0; j < this._stars.length; j++) {
      var st = this._stars[j];
      var px = ((st.x - camera.x * st.z) % 2000 + 2000) % 2000 - 1000 + this.width / 2;
      var py = ((st.y - camera.y * st.z) % 2000 + 2000) % 2000 - 1000 + this.height / 2;
      ctx.globalAlpha = 0.25 + st.z * 0.5;
      ctx.fillRect(px, py, st.s, st.s);
    }
    ctx.globalAlpha = 1;
    this.drawCalls++;
  };

  /** Darkness mask with a hole around the player (light-radius designs). */
  Renderer.prototype.lightMask = function (sx, sy, radius, darkness) {
    var ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    var grd = ctx.createRadialGradient(sx, sy, Math.max(4, radius * 0.35), sx, sy, Math.max(8, radius));
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,' + (darkness === undefined ? 0.92 : darkness) + ')');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
    this.drawCalls++;
  };

  Renderer.prototype.vignette = function (strength) {
    strength = (strength === undefined ? 0.4 : strength) * ${vignetteScale};
    if (strength < 0.03) return;
    var ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    var g = ctx.createRadialGradient(this.width / 2, this.height / 2, this.height * 0.3, this.width / 2, this.height / 2, this.height * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(${shade},' + strength + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  };

  LAB.Renderer = Renderer;
  LAB.PALETTE = PALETTE;
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

export function emitUi({ elements, mobileControls = true, title = 'Game', controlsHelp = [] }) {
  const els = JSON.stringify(elements);
  const help = JSON.stringify(controlsHelp);
  return `/* engine/ui.js - DOM HUD, menus and mobile controls
 * HUD lives in the DOM rather than inside the canvas: text stays crisp at any
 * DPR, it is selectable by screen readers, and it costs no draw calls.
 */
(function (global) {
  'use strict';
  var LAB = global.LAB = global.LAB || {};
  var ELEMENTS = ${els};
  var HELP = ${help};

  function el(tag, cls, text) {
    var d = global.document.createElement(tag);
    if (cls) d.className = cls;
    if (text !== undefined) d.textContent = text;
    return d;
  }

  function UI(root, opts) {
    opts = opts || {};
    this.root = root;
    this.nodes = {};
    this.onAction = opts.onAction || function () {};
    this.build();
  }

  UI.prototype.build = function () {
    var self = this;
    var hud = el('div', 'hud');
    for (var i = 0; i < ELEMENTS.length; i++) {
      var e = ELEMENTS[i];
      if (e.kind === 'overlay') continue;
      var box = el('div', 'hud-item hud-' + e.kind);
      var label = el('span', 'hud-label', e.label);
      box.appendChild(label);
      if (e.kind === 'bar') {
        var track = el('div', 'hud-bar');
        var fill = el('div', 'hud-bar-fill');
        track.appendChild(fill);
        box.appendChild(track);
        this.nodes[e.id] = fill;
      } else {
        var v = el('span', 'hud-value', '0');
        box.appendChild(v);
        this.nodes[e.id] = v;
      }
      hud.appendChild(box);
    }
    this.root.appendChild(hud);
    this.hud = hud;

    var overlay = el('div', 'overlay');
    var card = el('div', 'overlay-card');
    this.overlayTitle = el('h1', 'overlay-title', ${JSON.stringify(title)});
    this.overlayText = el('p', 'overlay-text', '');
    this.overlayHelp = el('ul', 'overlay-help');
    for (var h = 0; h < HELP.length; h++) this.overlayHelp.appendChild(el('li', null, HELP[h]));
    this.overlayButton = el('button', 'btn primary', 'Start');
    this.overlayButton.addEventListener('click', function () { self.onAction('primary'); });
    var secondary = el('button', 'btn ghost', 'Restart');
    secondary.addEventListener('click', function () { self.onAction('restart'); });
    card.appendChild(this.overlayTitle);
    card.appendChild(this.overlayText);
    card.appendChild(this.overlayHelp);
    var row = el('div', 'overlay-actions');
    row.appendChild(this.overlayButton);
    row.appendChild(secondary);
    card.appendChild(row);
    overlay.appendChild(card);
    this.root.appendChild(overlay);
    this.overlay = overlay;

    var bar = el('div', 'topbar');
    this.pauseBtn = el('button', 'btn small', 'Pause');
    this.pauseBtn.addEventListener('click', function () { self.onAction('pause'); });
    this.muteBtn = el('button', 'btn small', 'Sound on');
    this.muteBtn.addEventListener('click', function () { self.onAction('mute'); });
    bar.appendChild(this.pauseBtn);
    bar.appendChild(this.muteBtn);
    this.root.appendChild(bar);

    this.toastNode = el('div', 'toast');
    this.root.appendChild(this.toastNode);
${mobileControls ? `
    /* Touch controls are always in the DOM but only shown on coarse pointers,
       so the same build works on desktop and phone. */
    var pad = el('div', 'touchpad');
    this.stickZone = el('div', 'stick-zone');
    this.stickNub = el('div', 'stick-nub');
    this.stickZone.appendChild(this.stickNub);
    this.actionBtn = el('button', 'touch-action', 'A');
    pad.appendChild(this.stickZone);
    pad.appendChild(this.actionBtn);
    this.root.appendChild(pad);
    this.touchpad = pad;` : ''}
  };

  UI.prototype.set = function (id, value) {
    var node = this.nodes[id];
    if (!node) return;
    if (node.className === 'hud-bar-fill') node.style.width = Math.max(0, Math.min(100, value * 100)) + '%';
    else node.textContent = String(value);
  };

  UI.prototype.showOverlay = function (title, text, button) {
    this.overlayTitle.textContent = title;
    this.overlayText.textContent = text || '';
    this.overlayButton.textContent = button || 'Start';
    this.overlay.classList.add('visible');
  };

  UI.prototype.hideOverlay = function () { this.overlay.classList.remove('visible'); };

  UI.prototype.toast = function (msg, ms) {
    var self = this;
    this.toastNode.textContent = msg;
    this.toastNode.classList.add('visible');
    if (this._toastTimer) global.clearTimeout(this._toastTimer);
    this._toastTimer = global.setTimeout(function () { self.toastNode.classList.remove('visible'); }, ms || 1400);
  };

  UI.prototype.setPaused = function (paused) { this.pauseBtn.textContent = paused ? 'Resume' : 'Pause'; };
  UI.prototype.setMuted = function (muted) { this.muteBtn.textContent = muted ? 'Sound off' : 'Sound on'; };

  LAB.UI = UI;
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

export function emitAudio({ cues = [], enabled = true }) {
  if (!enabled) {
    return `/* engine/audio.js - silent design: no-op API so callers need no branches */
(function (global) {
  'use strict';
  var LAB = global.LAB = global.LAB || {};
  function Audio() { this.muted = true; this.silent = true; }
  Audio.prototype.play = function () {};
  Audio.prototype.unlock = function () {};
  Audio.prototype.toggle = function () { return true; };
  LAB.Audio = Audio;
})(typeof window !== 'undefined' ? window : globalThis);
`;
  }
  return `/* engine/audio.js - procedural WebAudio cues (no audio files needed)
 * Every sound is synthesised, which keeps the generated project asset-free and
 * avoids shipping anything whose licence we cannot verify.
 */
(function (global) {
  'use strict';
  var LAB = global.LAB = global.LAB || {};
  var CUES = ${JSON.stringify(cues)};

  function Audio() {
    this.ctx = null;
    this.muted = false;
    this.silent = false;
    this.cues = {};
    for (var i = 0; i < CUES.length; i++) this.cues[CUES[i].id] = CUES[i];
    try {
      var saved = global.localStorage && global.localStorage.getItem('audio.muted');
      if (saved === '1') this.muted = true;
    } catch (err) { /* storage blocked */ }
  }

  Audio.prototype.unlock = function () {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume();
      return;
    }
    var Ctor = global.AudioContext || global.webkitAudioContext;
    if (!Ctor) return;
    try { this.ctx = new Ctor(); } catch (err) { this.ctx = null; }
  };

  Audio.prototype.play = function (id, opts) {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;
    var cue = this.cues[id];
    if (!cue) return;
    opts = opts || {};
    try {
      var t = this.ctx.currentTime;
      var osc = this.ctx.createOscillator();
      var gain = this.ctx.createGain();
      osc.type = cue.wave || 'square';
      var freq = (cue.freq || 440) * (opts.pitch || 1);
      osc.frequency.setValueAtTime(freq, t);
      if (cue.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * cue.slide), t + cue.ms / 1000);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime((opts.volume || 0.22), t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + cue.ms / 1000);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + cue.ms / 1000 + 0.02);
    } catch (err) { /* audio must never break gameplay */ }
  };

  Audio.prototype.toggle = function () {
    this.muted = !this.muted;
    try { global.localStorage && global.localStorage.setItem('audio.muted', this.muted ? '1' : '0'); } catch (err) { /* ignore */ }
    return this.muted;
  };

  LAB.Audio = Audio;
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

export function emitSave({ key = 'lab.save', version = 1, fields = ['best', 'runs', 'unlocks'] }) {
  return `/* engine/save.js - versioned localStorage save with migration and guards
 * Storage can throw (private mode, blocked cookies) or contain data written by
 * an older build, so every path is defensive and the game runs fine without it.
 */
(function (global) {
  'use strict';
  var LAB = global.LAB = global.LAB || {};
  var KEY = ${JSON.stringify(key)};
  var VERSION = ${version};
  var DEFAULTS = ${JSON.stringify(Object.fromEntries(fields.map((f) => [f, f === 'unlocks' ? [] : 0])))};

  function Save() {
    this.data = this.load();
    this.available = this.probe();
  }

  Save.prototype.probe = function () {
    try {
      if (!global.localStorage) return false;
      global.localStorage.setItem(KEY + '.probe', '1');
      global.localStorage.removeItem(KEY + '.probe');
      return true;
    } catch (err) { return false; }
  };

  Save.prototype.load = function () {
    var out = JSON.parse(JSON.stringify(DEFAULTS));
    try {
      var raw = global.localStorage && global.localStorage.getItem(KEY);
      if (!raw) return out;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return out;
      if (parsed.v !== VERSION) return this.migrate(parsed, out);
      for (var k in DEFAULTS) if (parsed[k] !== undefined) out[k] = parsed[k];
      return out;
    } catch (err) { return out; }
  };

  Save.prototype.migrate = function (old, defaults) {
    /* Unknown/older schema: keep whatever still matches, drop the rest. */
    for (var k in defaults) if (old[k] !== undefined && typeof old[k] === typeof defaults[k]) defaults[k] = old[k];
    return defaults;
  };

  Save.prototype.save = function () {
    try {
      var payload = { v: VERSION };
      for (var k in this.data) payload[k] = this.data[k];
      global.localStorage && global.localStorage.setItem(KEY, JSON.stringify(payload));
      return true;
    } catch (err) { return false; }
  };

  Save.prototype.record = function (field, value, mode) {
    if (mode === 'max') this.data[field] = Math.max(this.data[field] || 0, value);
    else if (mode === 'add') this.data[field] = (this.data[field] || 0) + value;
    else this.data[field] = value;
    this.save();
    return this.data[field];
  };

  Save.prototype.reset = function () {
    this.data = JSON.parse(JSON.stringify(DEFAULTS));
    this.save();
  };

  LAB.Save = Save;
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

export function emitThree({ models = [], cdn = 'https://cdn.jsdelivr.net/npm/three@0.160.0' }) {
  return `/* engine/three.js - 3D bootstrap (three.js loaded as an ES module)
 *
 * HONEST LIMITATION: this module needs a network fetch for three.js the first
 * time (or a local copy placed in vendor/). It also cannot be verified by the
 * lab's headless sandbox, which has no WebGL - 3D builds are checked
 * statically and must be opened in a browser to confirm rendering.
 */
(function (global) {
  'use strict';
  var LAB = global.LAB = global.LAB || {};
  var CDN = ${JSON.stringify(cdn)};
  var MODELS = ${JSON.stringify(models)};

  LAB.three = {
    cdn: CDN,
    models: MODELS,
    ready: false,
    /**
     * Loads three.js + GLTFLoader. Resolves with { THREE, GLTFLoader } or
     * rejects with a message the UI shows to the player.
     */
    load: function () {
      if (this._promise) return this._promise;
      this._promise = Promise.all([
        import(CDN + '/build/three.module.js'),
        import(CDN + '/examples/jsm/loaders/GLTFLoader.js'),
      ]).then(function (mods) {
        LAB.three.ready = true;
        LAB.three.THREE = mods[0];
        LAB.three.GLTFLoader = mods[1].GLTFLoader;
        return { THREE: mods[0], GLTFLoader: mods[1].GLTFLoader };
      }).catch(function (err) {
        LAB.three.error = 'three.js could not be loaded (offline?). Place a copy in vendor/three.module.js and update engine/three.js. Details: ' + err.message;
        throw new Error(LAB.three.error);
      });
      return this._promise;
    },

    /** Loads a GLB and returns { scene, animations, box }. */
    loadModel: function (url) {
      return this.load().then(function (m) {
        return new Promise(function (resolve, reject) {
          var loader = new m.GLTFLoader();
          loader.load(url, function (gltf) {
            var box = new m.THREE.Box3().setFromObject(gltf.scene);
            resolve({ scene: gltf.scene, animations: gltf.animations || [], box: box });
          }, undefined, function (err) { reject(err); });
        });
      });
    },

    /** Placeholder used when a model is missing or its licence is unverified. */
    placeholder: function (THREE, color) {
      var geo = new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.35, 0.9, 4, 8) : new THREE.BoxGeometry(0.7, 1.6, 0.7);
      var mat = new THREE.MeshStandardMaterial({ color: color || 0x7c5cff, roughness: 0.6 });
      return new THREE.Mesh(geo, mat);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
}
