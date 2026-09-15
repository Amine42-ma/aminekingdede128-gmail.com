// Minimal fixed-timestep engine with pooling and a spatial hash.
const FIXED_STEP = 1 / 60;
class Pool {
  constructor(factory, size) { this.factory = factory; this.free = []; for (let i = 0; i < size; i++) this.free.push(factory()); }
  acquire() { return this.free.pop() || this.factory(); }
  release(o) { this.free.push(o); }
}
class SpatialHash {
  constructor(cell) { this.cell = cell; this.grid = new Map(); }
  key(x, y) { return ((x / this.cell) | 0) + ':' + ((y / this.cell) | 0); }
  insert(e) { const k = this.key(e.x, e.y); if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(e); }
  clear() { this.grid.clear(); }
  near(e) { return this.grid.get(this.key(e.x, e.y)) || []; }
}
class StateMachine {
  constructor(initial) { this.state = initial; this.handlers = new Map(); }
  on(state, fn) { this.handlers.set(state, fn); return this; }
  set(state) { this.state = state; }
  tick(dt) { const h = this.handlers.get(this.state); if (h) h(dt); }
}
function lerp(a, b, t) { return a + (b - a) * t; }
function aabb(a, b) { return Math.abs(a.x - b.x) < (a.r + b.r) && Math.abs(a.y - b.y) < (a.r + b.r); }
window.Engine = { Pool, SpatialHash, StateMachine, lerp, aabb, FIXED_STEP };
