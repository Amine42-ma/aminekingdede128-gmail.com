/* ============================================================================
   SPEED CITY — أدوات مساعدة عامة (Utilities)
   ========================================================================== */
window.SC = window.SC || {};

SC.util = (function () {
  const TAU = Math.PI * 2;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const invLerp = (a, b, v) => (b - a === 0 ? 0 : (v - a) / (b - a));
  const smoothstep = (t) => t * t * (3 - 2 * t);

  /* تنعيم مستقل عن معدّل الإطارات (frame-rate independent damping) */
  const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

  /* أقصر فرق بين زاويتين بالراديان */
  function angleDelta(a, b) {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  }

  const moveToward = (cur, target, maxStep) => {
    const d = target - cur;
    return Math.abs(d) <= maxStep ? target : cur + Math.sign(d) * maxStep;
  };

  /* مولّد أرقام عشوائية ثابت البذرة — نفس المدينة في كل مرة */
  function rng(seed) {
    let s = seed >>> 0;
    const f = function () {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = (a, b) => a + f() * (b - a);
    f.int = (a, b) => Math.floor(f.range(a, b + 1));
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.chance = (p) => f() < p;
    return f;
  }

  /* تنسيق الأرقام */
  const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
  function time(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const cs = Math.floor((sec * 100) % 100);
    return m + ':' + String(s).padStart(2, '0') + '.' + String(cs).padStart(2, '0');
  }
  const clock = (sec) => {
    const m = Math.floor(Math.max(0, sec) / 60), s = Math.floor(Math.max(0, sec) % 60);
    return m + ':' + String(s).padStart(2, '0');
  };
  const distText = (m) => (m >= 1000 ? (m / 1000).toFixed(1) + ' كم' : Math.round(m) + ' م');

  /* DOM */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* حفظ محلي آمن (قد يكون معطّلاً في وضع التصفح الخاص) */
  const store = {
    get(key, dflt) {
      try { const v = localStorage.getItem(key); return v == null ? dflt : JSON.parse(v); }
      catch (e) { return dflt; }
    },
    set(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
    },
    del(key) { try { localStorage.removeItem(key); } catch (e) {} }
  };

  /* كشف الجهاز */
  const isTouch = (('ontouchstart' in window) || navigator.maxTouchPoints > 0);
  const isMobile = isTouch && Math.min(screen.width, screen.height) < 900;

  function vibrate(ms) {
    try { if (navigator.vibrate && SC.settings && SC.settings.haptics) navigator.vibrate(ms); } catch (e) {}
  }

  return { TAU, clamp, lerp, invLerp, smoothstep, damp, angleDelta, moveToward, rng,
           money, time, clock, distText, $, $$, el, store, isTouch, isMobile, vibrate };
})();
