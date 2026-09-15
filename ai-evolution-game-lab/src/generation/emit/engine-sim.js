/**
 * Engine emitters, part 2: physics integrators, collision, camera, AI, procgen,
 * particles. Which integrator is emitted depends on the design's physics trait,
 * so a platformer and a racer genuinely get different movement code rather than
 * one generic blob with flags.
 */

export function emitPhysics({ model = 'topdown-friction', params = {}, twist = null }) {
  const p = (k, d) => (Number.isFinite(params[k]) ? params[k] : d);
  const bodies = {
    'topdown-friction': `
  /* Acceleration toward the input direction with exponential friction:
     stops feel snappy, diagonal speed is normalized by the input axis. */
  P.integrate = function (e, ax, ay, dt, cfg) {
    var accel = (cfg && cfg.accel) || ${p('accel', 1800)};
    var maxSpeed = (cfg && cfg.maxSpeed) || ${p('maxSpeed', 260)};
    var friction = (cfg && cfg.friction) || ${p('friction', 8.5)};
    e.vx += ax * accel * dt;
    e.vy += ay * accel * dt;
    var damp = Math.exp(-friction * dt);
    if (!ax) e.vx *= damp;
    if (!ay) e.vy *= damp;
    var sp = Math.hypot(e.vx, e.vy);
    if (sp > maxSpeed) { e.vx = (e.vx / sp) * maxSpeed; e.vy = (e.vy / sp) * maxSpeed; }
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.speed = sp;
  };`,
    'float-inertia': `
  /* Low friction: momentum carries, which makes precision a skill. */
  P.integrate = function (e, ax, ay, dt, cfg) {
    var accel = (cfg && cfg.accel) || ${p('accel', 900)};
    var maxSpeed = (cfg && cfg.maxSpeed) || ${p('maxSpeed', 300)};
    var drag = (cfg && cfg.drag) || ${p('drag', 0.985)};
    e.vx = (e.vx + ax * accel * dt) * Math.pow(drag, dt * 60);
    e.vy = (e.vy + ay * accel * dt) * Math.pow(drag, dt * 60);
    var sp = Math.hypot(e.vx, e.vy);
    if (sp > maxSpeed) { e.vx = (e.vx / sp) * maxSpeed; e.vy = (e.vy / sp) * maxSpeed; }
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.speed = sp;
  };`,
    'platform-gravity': `
  /* Platformer feel: separate horizontal acceleration from gravity, plus
     coyote time and a terminal fall speed. Jump cut shortens the arc when the
     button is released early. */
  P.integrate = function (e, ax, wantJump, dt, cfg) {
    cfg = cfg || {};
    var gravity = cfg.gravity || ${p('gravity', 2000)};
    var moveSpeed = cfg.moveSpeed || ${p('moveSpeed', 240)};
    var accel = cfg.accel || ${p('accel', 2200)};
    var friction = cfg.friction || ${p('friction', 12)};
    var jumpV = cfg.jumpVelocity || ${p('jumpVelocity', 620)};
    var maxFall = cfg.maxFall || ${p('maxFall', 900)};
    var coyote = (cfg.coyoteMs || ${p('coyoteMs', 90)}) / 1000;

    var target = ax * moveSpeed;
    var rate = ax ? accel : friction * Math.abs(e.vx) + accel * 0.5;
    e.vx = LAB.math.approach(e.vx, target, rate * dt);

    e.coyote = e.onGround ? coyote : Math.max(0, (e.coyote || 0) - dt);
    if (wantJump && (e.onGround || e.coyote > 0)) {
      e.vy = -jumpV;
      e.onGround = false;
      e.coyote = 0;
      e.jumping = true;
    }
    if (e.jumping && !wantJump && e.vy < -jumpV * 0.35) { e.vy = -jumpV * 0.35; e.jumping = false; }
    e.vy = Math.min(maxFall, e.vy + gravity * dt);
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.speed = Math.abs(e.vx);
  };`,
    'vehicle-drift': `
  /* Car model: forward thrust along heading, grip split into forward and
     lateral components. Lower lateral grip = more drift. */
  P.integrate = function (e, steer, throttle, dt, cfg) {
    cfg = cfg || {};
    var engine = cfg.engine || ${p('engine', 520)};
    var turnRate = cfg.turnRate || ${p('turnRate', 2.6)};
    var gripF = cfg.gripForward || ${p('gripForward', 0.97)};
    var gripL = cfg.gripLateral || ${p('gripLateral', 0.86)};
    var maxSpeed = cfg.maxSpeed || ${p('maxSpeed', 430)};
    var brake = cfg.brake || ${p('brake', 900)};

    var speed = Math.hypot(e.vx, e.vy);
    var steerScale = Math.min(1, speed / 60);
    e.angle = (e.angle || 0) + steer * turnRate * steerScale * dt;

    var fx = Math.cos(e.angle), fy = Math.sin(e.angle);
    if (throttle > 0) { e.vx += fx * engine * throttle * dt; e.vy += fy * engine * throttle * dt; }
    else if (throttle < 0) {
      var s = Math.hypot(e.vx, e.vy);
      if (s > 1) { e.vx -= (e.vx / s) * brake * dt * -throttle; e.vy -= (e.vy / s) * brake * dt * -throttle; }
    }
    /* split velocity into forward / lateral and apply different grip */
    var fwd = e.vx * fx + e.vy * fy;
    var latX = e.vx - fx * fwd, latY = e.vy - fy * fwd;
    fwd *= Math.pow(gripF, dt * 60);
    var lk = Math.pow(gripL, dt * 60);
    e.vx = fx * fwd + latX * lk;
    e.vy = fy * fwd + latY * lk;
    var sp = Math.hypot(e.vx, e.vy);
    if (sp > maxSpeed) { e.vx = (e.vx / sp) * maxSpeed; e.vy = (e.vy / sp) * maxSpeed; }
    e.drift = Math.hypot(latX, latY);
    e.speed = sp;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
  };`,
    'grid-discrete': `
  /* Discrete movement: entities glide between cell centres over stepMs, so
     input is turn-based but motion still reads as animation. */
  P.stepMs = ${p('stepMs', 120)};
  P.integrate = function (e, dt) {
    if (!e.moving) return;
    e.stepT = Math.min(1, (e.stepT || 0) + dt * (1000 / P.stepMs));
    var t = LAB.math.ease.inOutQuad(e.stepT);
    e.x = LAB.math.lerp(e.fromX, e.toX, t);
    e.y = LAB.math.lerp(e.fromY, e.toY, t);
    if (e.stepT >= 1) { e.moving = false; e.stepT = 0; e.x = e.toX; e.y = e.toY; }
  };
  P.moveTo = function (e, x, y) {
    if (e.moving) return false;
    e.fromX = e.x; e.fromY = e.y; e.toX = x; e.toY = y;
    e.moving = true; e.stepT = 0;
    return true;
  };`,
    'kinematic-3d': `
  /* 3D kinematic walk: horizontal velocity from the camera basis, vertical
     handled by gravity with a ground plane test supplied by the caller. */
  P.integrate = function (e, ax, az, dt, cfg) {
    cfg = cfg || {};
    var speed = cfg.moveSpeed || ${p('moveSpeed', 6.5)};
    var gravity = cfg.gravity || ${p('gravity', 22)};
    e.vx = ax * speed;
    e.vz = az * speed;
    e.vy -= gravity * dt;
    e.x += e.vx * dt;
    e.z += e.vz * dt;
    e.y += e.vy * dt;
    if (e.y <= e.groundY) { e.y = e.groundY; e.vy = 0; e.onGround = true; } else e.onGround = false;
    e.speed = Math.hypot(e.vx, e.vz);
  };`,
  };

  const boundsCode = `
  /** World bounds behaviour: clamp, wrap or a shrinking safe zone. */
  P.applyBounds = function (e, bounds, mode) {
    if (!bounds) return false;
    var hit = false;
    if (mode === 'wrap') {
      if (e.x < bounds.x) { e.x = bounds.x + bounds.w; }
      else if (e.x > bounds.x + bounds.w) { e.x = bounds.x; }
      if (e.y < bounds.y) { e.y = bounds.y + bounds.h; }
      else if (e.y > bounds.y + bounds.h) { e.y = bounds.y; }
    } else {
      var r = e.r || 0;
      if (e.x < bounds.x + r) { e.x = bounds.x + r; e.vx = Math.abs(e.vx) * (mode === 'bounce' ? 0.6 : 0); hit = true; }
      if (e.x > bounds.x + bounds.w - r) { e.x = bounds.x + bounds.w - r; e.vx = -Math.abs(e.vx) * (mode === 'bounce' ? 0.6 : 0); hit = true; }
      if (e.y < bounds.y + r) { e.y = bounds.y + r; e.vy = Math.abs(e.vy) * (mode === 'bounce' ? 0.6 : 0); hit = true; }
      if (e.y > bounds.y + bounds.h - r) { e.y = bounds.y + bounds.h - r; e.vy = -Math.abs(e.vy) * (mode === 'bounce' ? 0.6 : 0); hit = true; }
    }
    return hit;
  };`;

  return `/* engine/physics.js - ${model} integrator${twist ? ` (+ ${twist} modifier)` : ''} */
(function (global) {
  'use strict';
  var LAB = global.LAB = global.LAB || {};
  var P = LAB.physics = {};
  P.model = '${model}';
${bodies[model] || bodies['topdown-friction']}
${boundsCode}
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

export function emitCollision({ spatialHash = true, swept = true, cell = 64 }) {
  return `/* engine/collision.js - broadphase + narrowphase + resolution
 * broadphase: ${spatialHash ? `uniform grid (cell ${cell})` : 'pairwise'}
 * ${swept ? 'swept circle test guards against tunnelling at high speed' : 'discrete overlap test'}
 */
(function (global) {
  'use strict';
  var LAB = global.LAB = global.LAB || {};
  var M = LAB.math;

  function Collision(opts) {
    opts = opts || {};
    this.grid = new M.Grid(${cell});
    this.scratch = [];
    this.checks = 0;
    this.hits = 0;
  }

  Collision.prototype.rebuild = function (list) {
    this.grid.clear();
    for (var i = 0; i < list.length; i++) if (list[i].alive) this.grid.insert(list[i]);
  };

  /** Circle vs circle, optionally swept along this frame's motion. */
  Collision.prototype.test = function (a, b, dt) {
    this.checks++;
    var r = (a.r || 0) + (b.r || 0);
${swept ? `    /* Swept test: sample the segment a moved along this frame. Cheap, and it
       stops fast projectiles from stepping over small targets. */
    var dx = (a.vx || 0) * (dt || 0), dy = (a.vy || 0) * (dt || 0);
    var travel = Math.hypot(dx, dy);
    if (travel > r * 0.75) {
      var steps = Math.min(6, Math.ceil(travel / Math.max(1, r * 0.75)));
      for (var s = 0; s <= steps; s++) {
        var t = s / steps;
        var px = a.x - dx * (1 - t), py = a.y - dy * (1 - t);
        if (M.dist2(px, py, b.x, b.y) <= r * r) { this.hits++; return true; }
      }
      return false;
    }` : ''}
    var hit = M.dist2(a.x, a.y, b.x, b.y) <= r * r;
    if (hit) this.hits++;
    return hit;
  };

  /** Every entity of tagA against every nearby entity of tagB. */
  Collision.prototype.pairs = function (listA, listB, dt, fn) {
    this.rebuild(listB);
    for (var i = 0; i < listA.length; i++) {
      var a = listA[i];
      if (!a.alive) continue;
      var near = this.grid.query(a.x, a.y, (a.r || 0) + 64, this.scratch);
      for (var j = 0; j < near.length; j++) {
        var b = near[j];
        if (b === a || !b.alive) continue;
        if (this.test(a, b, dt)) fn(a, b);
      }
    }
  };

  /** Separate two circles that overlap (equal mass, positional correction). */
  Collision.prototype.separate = function (a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var d = Math.hypot(dx, dy) || 0.001;
    var overlap = (a.r + b.r) - d;
    if (overlap <= 0) return false;
    var nx = dx / d, ny = dy / d;
    a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5;
    b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5;
    return true;
  };

  /**
   * Axis-separated resolution against static rectangles (platformer style):
   * resolve X, then Y, so walls do not cancel a jump.
   */
  Collision.prototype.resolveRects = function (e, rects, prevX, prevY) {
    var grounded = false;
    var box = { x: 0, y: 0, w: 0, h: 0 };
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      box.x = e.x - e.hw; box.y = prevY - e.hh; box.w = e.hw * 2; box.h = e.hh * 2;
      if (M.rectOverlap(box, r)) {
        if (e.vx > 0) e.x = r.x - e.hw; else if (e.vx < 0) e.x = r.x + r.w + e.hw;
        e.vx = 0;
      }
    }
    for (var k = 0; k < rects.length; k++) {
      var r2 = rects[k];
      box.x = e.x - e.hw; box.y = e.y - e.hh; box.w = e.hw * 2; box.h = e.hh * 2;
      if (M.rectOverlap(box, r2)) {
        if (e.vy > 0) { e.y = r2.y - e.hh; e.vy = 0; grounded = true; e.jumping = false; }
        else if (e.vy < 0) { e.y = r2.y + r2.h + e.hh; e.vy = 0; }
      }
    }
    return grounded;
  };

  Collision.prototype.resetStats = function () { this.checks = 0; this.hits = 0; };

  LAB.Collision = Collision;
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

export function emitCamera({ mode = 'follow-smooth', isometric = false }) {
  return `/* engine/camera.js - ${mode}${isometric ? ' with isometric projection' : ''} */
(function (global) {
  'use strict';
  var LAB = global.LAB = global.LAB || {};
  var M = LAB.math;

  function Camera(opts) {
    opts = opts || {};
    this.x = 0; this.y = 0;
    this.targetX = 0; this.targetY = 0;
    this.zoom = opts.zoom || 1;
    this.targetZoom = this.zoom;
    this.shake = 0;
    this.shakeX = 0; this.shakeY = 0;
    this.viewW = opts.width || 960;
    this.viewH = opts.height || 540;
    this.mode = '${mode}';
    this.deadzone = { w: opts.deadzoneW || 120, h: opts.deadzoneH || 90 };
    this.bounds = opts.bounds || null;
    this.lambda = opts.lambda || 6;
    this.rng = opts.rng || Math;
  }

  Camera.prototype.resize = function (w, h) { this.viewW = w; this.viewH = h; };

  Camera.prototype.follow = function (target, dt) {
    if (!target) return;
${mode === 'fixed' ? `    /* fixed camera: stays centred on the world, target only affects shake */
    this.x = this.targetX; this.y = this.targetY;`
  : mode === 'follow-deadzone' ? `    var dx = target.x - this.x, dy = target.y - this.y;
    if (dx > this.deadzone.w) this.x = target.x - this.deadzone.w;
    else if (dx < -this.deadzone.w) this.x = target.x + this.deadzone.w;
    if (dy > this.deadzone.h) this.y = target.y - this.deadzone.h;
    else if (dy < -this.deadzone.h) this.y = target.y + this.deadzone.h;`
  : mode === 'side-scroll-lock' ? `    this.x = M.damp(this.x, target.x + 120, this.lambda, dt);
    this.y = M.damp(this.y, this.targetY || target.y, this.lambda * 0.5, dt);`
  : mode === 'rotating-chase' ? `    var lead = 0.22;
    this.x = M.damp(this.x, target.x + (target.vx || 0) * lead, this.lambda, dt);
    this.y = M.damp(this.y, target.y + (target.vy || 0) * lead, this.lambda, dt);
    this.angle = M.angleLerp(this.angle || 0, (target.angle || 0) + Math.PI / 2, 1 - Math.exp(-4 * dt));`
  : `    this.x = M.damp(this.x, target.x, this.lambda, dt);
    this.y = M.damp(this.y, target.y, this.lambda, dt);`}
    this.zoom = M.damp(this.zoom, this.targetZoom, 4, dt);
    if (this.bounds) this.clampToBounds();
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.4);
      var amp = this.shake * 12;
      this.shakeX = (Math.random() * 2 - 1) * amp;
      this.shakeY = (Math.random() * 2 - 1) * amp;
    } else { this.shakeX = 0; this.shakeY = 0; }
  };

  Camera.prototype.clampToBounds = function () {
    var b = this.bounds;
    var hw = this.viewW / (2 * this.zoom), hh = this.viewH / (2 * this.zoom);
    if (b.w > hw * 2) this.x = M.clamp(this.x, b.x + hw, b.x + b.w - hw);
    else this.x = b.x + b.w / 2;
    if (b.h > hh * 2) this.y = M.clamp(this.y, b.y + hh, b.y + b.h - hh);
    else this.y = b.y + b.h / 2;
  };

  Camera.prototype.kick = function (amount) { this.shake = Math.min(1.4, this.shake + amount); };

  Camera.prototype.apply = function (ctx) {
    ctx.save();
    ctx.translate(this.viewW / 2 + this.shakeX, this.viewH / 2 + this.shakeY);
    ctx.scale(this.zoom, this.zoom);
${mode === 'rotating-chase' ? `    ctx.rotate(-(this.angle || 0));` : ''}
    ctx.translate(-this.x, -this.y);
  };

  Camera.prototype.restore = function (ctx) { ctx.restore(); };

  Camera.prototype.screenToWorld = function (sx, sy) {
    var x = (sx - this.viewW / 2) / this.zoom + this.x;
    var y = (sy - this.viewH / 2) / this.zoom + this.y;
    return { x: x, y: y };
  };
  Camera.prototype.worldToScreen = function (wx, wy) {
    return { x: (wx - this.x) * this.zoom + this.viewW / 2, y: (wy - this.y) * this.zoom + this.viewH / 2 };
  };
${isometric ? `
  /* Isometric helpers: world (grid) -> screen projection. */
  Camera.prototype.iso = function (gx, gy, tile) {
    return { x: (gx - gy) * tile * 0.5, y: (gx + gy) * tile * 0.25 };
  };
  Camera.prototype.unIso = function (sx, sy, tile) {
    var gx = (sy / (tile * 0.25) + sx / (tile * 0.5)) / 2;
    var gy = (sy / (tile * 0.25) - sx / (tile * 0.5)) / 2;
    return { x: gx, y: gy };
  };` : ''}

  LAB.Camera = Camera;
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

export function emitAi({ behaviours = ['seek'], grid = false }) {
  const wants = new Set(behaviours);
  return `/* engine/ai.js - steering behaviours${grid ? ' + grid pathfinding (A*)' : ''}
 * Behaviours emitted for this design: ${behaviours.join(', ')}
 */
(function (global) {
  'use strict';
  var LAB = global.LAB = global.LAB || {};
  var M = LAB.math;
  var AI = LAB.ai = {};

  AI.seek = function (e, tx, ty, dt, speed) {
    var dx = tx - e.x, dy = ty - e.y;
    var d = Math.hypot(dx, dy) || 1;
    e.vx = (dx / d) * speed;
    e.vy = (dy / d) * speed;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.facing = Math.atan2(dy, dx);
    return d;
  };

  AI.flee = function (e, tx, ty, dt, speed) {
    var dx = e.x - tx, dy = e.y - ty;
    var d = Math.hypot(dx, dy) || 1;
    e.vx = (dx / d) * speed; e.vy = (dy / d) * speed;
    e.x += e.vx * dt; e.y += e.vy * dt;
    return d;
  };

  /** Keeps a preferred distance - used by ranged attackers. */
  AI.standOff = function (e, tx, ty, dt, speed, preferred) {
    var dx = tx - e.x, dy = ty - e.y;
    var d = Math.hypot(dx, dy) || 1;
    var dir = d > preferred * 1.15 ? 1 : d < preferred * 0.85 ? -1 : 0;
    var strafe = Math.sin((e.age || 0) * 1.7) * 0.5;
    e.vx = ((dx / d) * dir + (-dy / d) * strafe) * speed;
    e.vy = ((dy / d) * dir + (dx / d) * strafe) * speed;
    e.x += e.vx * dt; e.y += e.vy * dt;
    e.facing = Math.atan2(dy, dx);
    return d;
  };

  AI.wander = function (e, dt, speed, rng) {
    e.wanderAngle = (e.wanderAngle || 0) + ((rng ? rng.next() : Math.random()) - 0.5) * 2.2 * dt;
    e.vx = Math.cos(e.wanderAngle) * speed;
    e.vy = Math.sin(e.wanderAngle) * speed;
    e.x += e.vx * dt; e.y += e.vy * dt;
  };
${wants.has('patrol') ? `
  /** Walks a closed route, pausing briefly at each waypoint. */
  AI.patrol = function (e, dt, speed) {
    if (!e.route || !e.route.length) return;
    var wp = e.route[e.routeIndex || 0];
    if (e.waitTimer > 0) { e.waitTimer -= dt; e.vx = 0; e.vy = 0; return; }
    var d = AI.seek(e, wp.x, wp.y, dt, speed);
    if (d < 8) {
      e.routeIndex = ((e.routeIndex || 0) + 1) % e.route.length;
      e.waitTimer = e.waitAt || 0.6;
    }
  };

  /** Vision cone test with an optional blocking predicate. */
  AI.canSee = function (e, target, range, halfAngle, blocked) {
    var dx = target.x - e.x, dy = target.y - e.y;
    var d = Math.hypot(dx, dy);
    if (d > range) return false;
    var a = Math.atan2(dy, dx);
    var diff = Math.abs(((a - (e.facing || 0) + Math.PI) % M.TAU + M.TAU) % M.TAU - Math.PI);
    if (diff > halfAngle) return false;
    if (blocked) {
      var steps = Math.ceil(d / 12);
      for (var i = 1; i < steps; i++) {
        var t = i / steps;
        if (blocked(e.x + dx * t, e.y + dy * t)) return false;
      }
    }
    return true;
  };` : ''}
${grid ? `
  /**
   * A* over a uniform grid. Returns an array of {x,y} cell coordinates.
   * Kept allocation-light: one open list, reused closed set per call.
   */
  AI.findPath = function (gridData, cols, rows, start, goal, passable) {
    passable = passable || function (v) { return v === 0; };
    var idx = function (x, y) { return y * cols + x; };
    if (start.x === goal.x && start.y === goal.y) return [];
    var open = [{ x: start.x, y: start.y, g: 0, f: 0, p: null }];
    var seen = new Map();
    seen.set(idx(start.x, start.y), 0);
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    var guard = 0;
    while (open.length && guard++ < 20000) {
      var bi = 0;
      for (var i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      var cur = open.splice(bi, 1)[0];
      if (cur.x === goal.x && cur.y === goal.y) {
        var path = [];
        while (cur) { path.push({ x: cur.x, y: cur.y }); cur = cur.p; }
        return path.reverse();
      }
      for (var d = 0; d < dirs.length; d++) {
        var nx = cur.x + dirs[d][0], ny = cur.y + dirs[d][1];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        if (!passable(gridData[idx(nx, ny)])) continue;
        var ng = cur.g + 1;
        var key = idx(nx, ny);
        if (seen.has(key) && seen.get(key) <= ng) continue;
        seen.set(key, ng);
        var h = Math.abs(goal.x - nx) + Math.abs(goal.y - ny);
        open.push({ x: nx, y: ny, g: ng, f: ng + h, p: cur });
      }
    }
    return null;
  };

  /** Follows a path of cell centres, advancing when close enough. */
  AI.followPath = function (e, dt, speed, tileSize, offset) {
    if (!e.path || e.pathIndex >= e.path.length) return false;
    var cell = e.path[e.pathIndex];
    var tx = cell.x * tileSize + tileSize / 2 + (offset ? offset.x : 0);
    var ty = cell.y * tileSize + tileSize / 2 + (offset ? offset.y : 0);
    var d = AI.seek(e, tx, ty, dt, speed);
    if (d < tileSize * 0.35) e.pathIndex++;
    return true;
  };` : ''}
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

export function emitProcgen({ features = ['noise'] }) {
  const f = new Set(features);
  return `/* engine/procgen.js - seeded generators: ${features.join(', ')}
 * Everything is driven by the game's seed so a level can be reproduced exactly,
 * which is what lets the test agent replay a failure.
 */
(function (global) {
  'use strict';
  var LAB = global.LAB = global.LAB || {};
  var G = LAB.procgen = {};

  /** Value noise with smooth interpolation - enough for terrain and variation. */
  G.noise2 = function (rng, scale) {
    var perm = new Uint8Array(512);
    for (var i = 0; i < 256; i++) perm[i] = i;
    for (var j = 255; j > 0; j--) {
      var k = rng.int(0, j);
      var t = perm[j]; perm[j] = perm[k]; perm[k] = t;
    }
    for (var m = 0; m < 256; m++) perm[m + 256] = perm[m];
    var grad = function (h, x, y) {
      switch (h & 3) {
        case 0: return x + y; case 1: return -x + y; case 2: return x - y; default: return -x - y;
      }
    };
    var fade = function (t) { return t * t * t * (t * (t * 6 - 15) + 10); };
    scale = scale || 0.08;
    return function (x, y) {
      x *= scale; y *= scale;
      var xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
      var xf = x - Math.floor(x), yf = y - Math.floor(y);
      var u = fade(xf), v = fade(yf);
      var aa = perm[perm[xi] + yi], ab = perm[perm[xi] + yi + 1];
      var ba = perm[perm[xi + 1] + yi], bb = perm[perm[xi + 1] + yi + 1];
      var x1 = grad(aa, xf, yf) * (1 - u) + grad(ba, xf - 1, yf) * u;
      var x2 = grad(ab, xf, yf - 1) * (1 - u) + grad(bb, xf - 1, yf - 1) * u;
      return ((x1 * (1 - v) + x2 * v) + 2) / 4;
    };
  };
${f.has('maze') ? `
  /** Recursive-backtracker maze on an odd-sized grid. 1 = wall, 0 = floor. */
  G.maze = function (rng, cols, rows) {
    cols = cols % 2 ? cols : cols - 1;
    rows = rows % 2 ? rows : rows - 1;
    var g = new Uint8Array(cols * rows).fill(1);
    var idx = function (x, y) { return y * cols + x; };
    var stack = [{ x: 1, y: 1 }];
    g[idx(1, 1)] = 0;
    while (stack.length) {
      var c = stack[stack.length - 1];
      var options = [];
      var dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]];
      for (var i = 0; i < dirs.length; i++) {
        var nx = c.x + dirs[i][0], ny = c.y + dirs[i][1];
        if (nx > 0 && ny > 0 && nx < cols - 1 && ny < rows - 1 && g[idx(nx, ny)] === 1) options.push({ x: nx, y: ny, dx: dirs[i][0], dy: dirs[i][1] });
      }
      if (!options.length) { stack.pop(); continue; }
      var pick = options[rng.int(0, options.length - 1)];
      g[idx(c.x + pick.dx / 2, c.y + pick.dy / 2)] = 0;
      g[idx(pick.x, pick.y)] = 0;
      stack.push({ x: pick.x, y: pick.y });
    }
    return { grid: g, cols: cols, rows: rows };
  };` : ''}
${f.has('rooms') ? `
  /** BSP rooms joined by L-corridors. 1 = wall, 0 = floor. */
  G.rooms = function (rng, cols, rows, count) {
    var g = new Uint8Array(cols * rows).fill(1);
    var idx = function (x, y) { return y * cols + x; };
    var rooms = [];
    var attempts = 0;
    while (rooms.length < count && attempts++ < count * 30) {
      var w = rng.int(4, Math.max(5, Math.floor(cols / 4)));
      var h = rng.int(4, Math.max(5, Math.floor(rows / 4)));
      var x = rng.int(1, cols - w - 2);
      var y = rng.int(1, rows - h - 2);
      var room = { x: x, y: y, w: w, h: h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) };
      var clash = false;
      for (var i = 0; i < rooms.length; i++) {
        var o = rooms[i];
        if (x < o.x + o.w + 1 && x + w + 1 > o.x && y < o.y + o.h + 1 && y + h + 1 > o.y) { clash = true; break; }
      }
      if (clash) continue;
      for (var ry = y; ry < y + h; ry++) for (var rx = x; rx < x + w; rx++) g[idx(rx, ry)] = 0;
      if (rooms.length) {
        var prev = rooms[rooms.length - 1];
        var cx = prev.cx, cy = prev.cy;
        while (cx !== room.cx) { g[idx(cx, cy)] = 0; cx += cx < room.cx ? 1 : -1; }
        while (cy !== room.cy) { g[idx(cx, cy)] = 0; cy += cy < room.cy ? 1 : -1; }
        g[idx(cx, cy)] = 0;
      }
      rooms.push(room);
    }
    return { grid: g, cols: cols, rows: rows, rooms: rooms };
  };` : ''}
${f.has('track') ? `
  /** Closed racing track: jittered radial points smoothed into a loop. */
  G.track = function (rng, points, radius, jitter) {
    var pts = [];
    for (var i = 0; i < points; i++) {
      var a = (i / points) * Math.PI * 2;
      var r = radius * (1 - jitter / 2 + rng.next() * jitter);
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.72 });
    }
    /* Chaikin smoothing keeps corners drivable. */
    for (var pass = 0; pass < 3; pass++) {
      var next = [];
      for (var j = 0; j < pts.length; j++) {
        var p0 = pts[j], p1 = pts[(j + 1) % pts.length];
        next.push({ x: p0.x * 0.75 + p1.x * 0.25, y: p0.y * 0.75 + p1.y * 0.25 });
        next.push({ x: p0.x * 0.25 + p1.x * 0.75, y: p0.y * 0.25 + p1.y * 0.75 });
      }
      pts = next;
    }
    return pts;
  };` : ''}
${f.has('platforms') ? `
  /**
   * Platform layout with a reachability guarantee: every gap is generated
   * inside the jump envelope implied by the physics parameters, then verified.
   */
  G.platforms = function (rng, opts) {
    var jumpH = (opts.jumpVelocity * opts.jumpVelocity) / (2 * opts.gravity);
    var airTime = (2 * opts.jumpVelocity) / opts.gravity;
    var jumpW = opts.moveSpeed * airTime * 0.82;
    var list = [{ x: 0, y: opts.baseY, w: 320, h: 24 }];
    var x = 320;
    var y = opts.baseY;
    while (x < opts.width) {
      var gap = rng.range(opts.minGap, Math.max(opts.minGap + 10, jumpW * opts.gapBias));
      var rise = rng.range(-jumpH * 0.55, jumpH * 0.72);
      y = Math.max(opts.minY, Math.min(opts.baseY + 60, y - rise));
      var w = rng.range(90, 230);
      x += gap;
      list.push({ x: x, y: y, w: w, h: 22 });
      x += w;
    }
    return { platforms: list, jumpWidth: jumpW, jumpHeight: jumpH };
  };

  /** Verifies each consecutive gap is inside the jump envelope. */
  G.validatePlatforms = function (list, jumpW, jumpH) {
    for (var i = 1; i < list.length; i++) {
      var prev = list[i - 1], cur = list[i];
      var gap = cur.x - (prev.x + prev.w);
      var rise = prev.y - cur.y;
      if (gap > jumpW * 1.02 || rise > jumpH * 0.95) return { ok: false, at: i, gap: gap, rise: rise };
    }
    return { ok: true };
  };` : ''}
${f.has('path') ? `
  /** Orthogonal creep path across a board, from the left edge to the right. */
  G.path = function (rng, cols, rows, turns) {
    var cells = [];
    var x = 0, y = rng.int(1, rows - 2);
    cells.push({ x: x, y: y });
    var segments = Math.max(2, turns);
    var stepX = Math.max(2, Math.floor(cols / segments));
    while (x < cols - 1) {
      var nx = Math.min(cols - 1, x + rng.int(Math.max(1, stepX - 1), stepX + 1));
      for (var i = x + 1; i <= nx; i++) cells.push({ x: i, y: y });
      x = nx;
      if (x >= cols - 1) break;
      var ny = Math.max(1, Math.min(rows - 2, y + rng.int(-3, 3)));
      var dir = ny > y ? 1 : -1;
      for (var j = y + dir; j !== ny + dir; j += dir) cells.push({ x: x, y: j });
      y = ny;
    }
    return cells;
  };` : ''}

  /** Flood fill used to prove a generated layout is actually traversable. */
  G.reachable = function (grid, cols, rows, start, passable) {
    passable = passable || function (v) { return v === 0; };
    var seen = new Uint8Array(cols * rows);
    var queue = [start];
    var count = 0;
    seen[start.y * cols + start.x] = 1;
    while (queue.length) {
      var c = queue.pop();
      count++;
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var i = 0; i < 4; i++) {
        var nx = c.x + dirs[i][0], ny = c.y + dirs[i][1];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        var k = ny * cols + nx;
        if (seen[k] || !passable(grid[k])) continue;
        seen[k] = 1;
        queue.push({ x: nx, y: ny });
      }
    }
    return { count: count, seen: seen };
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

export function emitParticles({ pooling = true, max = 600 }) {
  return `/* engine/particles.js - pooled particle bursts and trails */
(function (global) {
  'use strict';
  var LAB = global.LAB = global.LAB || {};

  function Particles(max) {
    this.max = max || ${max};
    this.items = [];
    this.free = [];
    for (var i = 0; i < this.max; i++) {
      var p = { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', alive: false };
      this.items.push(p);
      this.free.push(p);
    }
  }

  Particles.prototype.emit = function (x, y, opts) {
    opts = opts || {};
    var n = opts.count || 8;
    for (var i = 0; i < n; i++) {
      var p = this.free.pop();
      if (!p) return; /* pool exhausted: drop extras rather than allocate */
      var a = opts.angle !== undefined ? opts.angle + (Math.random() - 0.5) * (opts.spread || Math.PI * 2) : Math.random() * Math.PI * 2;
      var sp = (opts.speed || 120) * (0.4 + Math.random() * 0.8);
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
      p.maxLife = p.life = (opts.life || 0.5) * (0.6 + Math.random() * 0.8);
      p.size = opts.size || 3;
      p.color = opts.color || '#ffffff';
      p.gravity = opts.gravity || 0;
      p.alive = true;
    }
  };

  Particles.prototype.update = function (dt) {
    for (var i = 0; i < this.items.length; i++) {
      var p = this.items[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; this.free.push(p); continue; }
      p.vy += (p.gravity || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.92, dt * 60);
      p.vy *= Math.pow(0.92, dt * 60);
    }
  };

  Particles.prototype.render = function (ctx) {
    for (var i = 0; i < this.items.length; i++) {
      var p = this.items[i];
      if (!p.alive) continue;
      var t = p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, t);
      ctx.fillStyle = p.color;
      var s = p.size * (0.4 + t * 0.9);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  };

  Particles.prototype.activeCount = function () {
    var n = 0;
    for (var i = 0; i < this.items.length; i++) if (this.items[i].alive) n++;
    return n;
  };

  Particles.prototype.clear = function () {
    this.free.length = 0;
    for (var i = 0; i < this.items.length; i++) { this.items[i].alive = false; this.free.push(this.items[i]); }
  };

  LAB.Particles = Particles;
})(typeof window !== 'undefined' ? window : globalThis);
`;
}
