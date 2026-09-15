/**
 * Small dependency-free helpers: ids, hashing, deterministic RNG, set/vector math.
 * Determinism matters here: generation, benchmarks and experiments must be
 * reproducible from a seed, otherwise "v2 is better than v1" means nothing.
 */

export function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function hashHex(str) {
  const a = hash32(str);
  const b = hash32(str + '#salt');
  return (a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0'));
}

let counter = 0;
export function id(prefix = 'id') {
  counter = (counter + 1) % 0xffff;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36).padStart(3, '0')}${Math.floor(Math.random() * 0xfff).toString(36)}`;
}

/** Mulberry32 - tiny, fast, seedable. */
export function rng(seed) {
  let a = typeof seed === 'string' ? hash32(seed) : (seed >>> 0) || 1;
  const next = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (min, max) => min + Math.floor(next() * (max - min + 1));
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.chance = (p) => next() < p;
  next.shuffle = (arr) => {
    const a2 = arr.slice();
    for (let i = a2.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [a2[i], a2[j]] = [a2[j], a2[i]];
    }
    return a2;
  };
  /** Weighted pick: items = [{value, weight}] */
  next.weighted = (items) => {
    const total = items.reduce((s, it) => s + Math.max(0, it.weight || 0), 0);
    if (total <= 0) return next.pick(items).value;
    let r = next() * total;
    for (const it of items) {
      r -= Math.max(0, it.weight || 0);
      if (r <= 0) return it.value;
    }
    return items[items.length - 1].value;
  };
  next.sample = (arr, n) => next.shuffle(arr).slice(0, n);
  next.range = (min, max) => min + next() * (max - min);
  return next;
}

export function jaccard(aSet, bSet) {
  const a = aSet instanceof Set ? aSet : new Set(aSet);
  const b = bSet instanceof Set ? bSet : new Set(bSet);
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const v of a) if (b.has(v)) inter++;
  return inter / (a.size + b.size - inter);
}

export function cosine(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, na = 0, nb = 0;
  for (const k of keys) {
    const x = a[k] || 0, y = b[k] || 0;
    dot += x * y; na += x * x; nb += y * y;
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Token n-gram shingles, used for near-duplicate code detection. */
export function shingles(tokens, n = 5) {
  const out = new Set();
  for (let i = 0; i + n <= tokens.length; i++) out.add(tokens.slice(i, i + n).join(' '));
  return out;
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export function mean(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }

export function median(arr) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

export function round(v, digits = 3) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

export function slug(s, max = 48) {
  return String(s).toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max) || 'item';
}

export function titleCase(s) {
  return String(s).replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function nowIso() { return new Date().toISOString(); }

export function bytes(n) {
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${Math.round(v * 10) / 10}${u[i]}`;
}

export function groupBy(arr, fn) {
  const map = new Map();
  for (const item of arr) {
    const k = fn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

export function topN(counts, n) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n);
}
