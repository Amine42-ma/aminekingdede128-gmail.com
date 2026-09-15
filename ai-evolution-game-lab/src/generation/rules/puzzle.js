/**
 * Ruleset: PUZZLE (grid logic, push-to-target).
 *
 * Levels are generated *backwards* from a solved state: blocks start on their
 * targets and are pulled away by legal reverse moves. Every generated board is
 * therefore solvable by construction, and the pull count gives a known
 * lower-bound difficulty.
 */

export function emitWorld(design) {
  return `/* game/world.js - reverse-generated sokoban board (solvable by construction) */
(function (global) {
  'use strict';
  var LAB = global.LAB;

  LAB.buildWorld = function (cfg, rng, levelIndex) {
    var cols = cfg.world.cols, rows = cfg.world.rows;
    var tile = cfg.world.tileSize;
    var level = levelIndex || 0;
    var grid = new Uint8Array(cols * rows);
    var idx = function (x, y) { return y * cols + x; };

    /* border walls + a few interior blocks */
    for (var x = 0; x < cols; x++) { grid[idx(x, 0)] = 1; grid[idx(x, rows - 1)] = 1; }
    for (var y = 0; y < rows; y++) { grid[idx(0, y)] = 1; grid[idx(cols - 1, y)] = 1; }
    var wallCount = Math.min(Math.floor(cols * rows * 0.08) + level, Math.floor(cols * rows * 0.16));
    for (var w = 0; w < wallCount; w++) {
      var wx = rng.int(2, cols - 3), wy = rng.int(2, rows - 3);
      grid[idx(wx, wy)] = 1;
    }

    var free = [];
    for (var fy = 1; fy < rows - 1; fy++) for (var fx = 1; fx < cols - 1; fx++) if (!grid[idx(fx, fy)]) free.push({ x: fx, y: fy });
    if (free.length < 8) { /* degenerate board: clear the interior */
      for (var cy = 1; cy < rows - 1; cy++) for (var cx = 1; cx < cols - 1; cx++) grid[idx(cx, cy)] = 0;
      free = [];
      for (var gy = 1; gy < rows - 1; gy++) for (var gx = 1; gx < cols - 1; gx++) free.push({ x: gx, y: gy });
    }

    var boxCount = Math.min(cfg.world.movableBlocks || 3, Math.max(2, Math.floor(free.length / 6)));
    var targets = [];
    var boxes = [];
    var used = Object.create(null);
    for (var b = 0; b < boxCount; b++) {
      var spot;
      var guard = 0;
      do { spot = free[rng.int(0, free.length - 1)]; guard++; } while (used[spot.x + ',' + spot.y] && guard < 200);
      used[spot.x + ',' + spot.y] = true;
      targets.push({ x: spot.x, y: spot.y });
      boxes.push({ x: spot.x, y: spot.y });
    }

    /* player starts next to a box, then we pull everything backwards */
    var player = { x: boxes[0].x, y: boxes[0].y };
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    var occupied = function (x, y) {
      if (grid[idx(x, y)]) return true;
      for (var i = 0; i < boxes.length; i++) if (boxes[i].x === x && boxes[i].y === y) return true;
      return false;
    };
    var pulls = 6 + level * 4;
    var done = 0;
    var attempts = 0;
    while (done < pulls && attempts++ < pulls * 40) {
      var bi = rng.int(0, boxes.length - 1);
      var box = boxes[bi];
      var d = dirs[rng.int(0, 3)];
      /* to pull a box, the cell behind the box and the cell behind that must be free */
      var bx = box.x - d[0], by = box.y - d[1];
      var px = box.x - d[0] * 2, py = box.y - d[1] * 2;
      if (bx < 1 || by < 1 || bx > cols - 2 || by > rows - 2) continue;
      if (px < 1 || py < 1 || px > cols - 2 || py > rows - 2) continue;
      if (occupied(bx, by) || occupied(px, py)) continue;
      box.x = bx; box.y = by;
      player.x = px; player.y = py;
      done++;
    }

    return {
      cols: cols, rows: rows, tile: tile, grid: grid,
      targets: targets, boxes: boxes, start: player,
      level: level, minimumPulls: done,
      width: cols * tile, height: rows * tile,
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

export function emitRules(design) {
  const twist = design.twist.mechanic;
  const levels = design.progression.stages.length;
  return `/* game/rules.js - grid puzzle for "${design.name}" | levels: ${levels} | twist: ${design.traits.twist} */
(function (global) {
  'use strict';
  var LAB = global.LAB;
  var M = LAB.math;

  LAB.createGame = function (ctx) {
    var cfg = ctx.cfg, world = ctx.world, input = ctx.input, camera = ctx.camera;
    var particles = ctx.particles, audio = ctx.audio;

    var game = {
      status: 'playing', score: 0, moves: 0, elapsed: 0, level: 0, combo: 1, comboTimer: 0,
      history: [], map: null, player: null, solvedBoxes: 0, resource: 1,
      stats: { pushes: 0, undos: 0, levelsCleared: 0 },
    };

    function loadLevel(index) {
      game.map = LAB.buildWorld(cfg, ctx.rng, index);
      game.level = index;
      game.moves = 0;
      game.history = [];
      world.clear();
      game.player = world.spawn('player', {
        gx: game.map.start.x, gy: game.map.start.y,
        x: game.map.start.x * game.map.tile + game.map.tile / 2,
        y: game.map.start.y * game.map.tile + game.map.tile / 2,
        r: game.map.tile * 0.34,
      });
      camera.bounds = { x: 0, y: 0, w: game.map.width, h: game.map.height };
      camera.x = game.map.width / 2;
      camera.y = game.map.height / 2;
      updateSolved();
    }

    function cellBlocked(x, y) {
      var m = game.map;
      if (x < 0 || y < 0 || x >= m.cols || y >= m.rows) return true;
      return m.grid[y * m.cols + x] === 1;
    }
    function boxAt(x, y) {
      var m = game.map;
      for (var i = 0; i < m.boxes.length; i++) if (m.boxes[i].x === x && m.boxes[i].y === y) return m.boxes[i];
      return null;
    }
    function isTarget(x, y) {
      var m = game.map;
      for (var i = 0; i < m.targets.length; i++) if (m.targets[i].x === x && m.targets[i].y === y) return true;
      return false;
    }
    function updateSolved() {
      var n = 0;
      for (var i = 0; i < game.map.boxes.length; i++) {
        var b = game.map.boxes[i];
        if (isTarget(b.x, b.y)) n++;
      }
      game.solvedBoxes = n;
      return n;
    }

    function tryMove(dx, dy) {
      if (game.status !== 'playing') return false;
      var p = game.player;
      if (p.moving) return false;
      var nx = p.gx + dx, ny = p.gy + dy;
      if (cellBlocked(nx, ny)) { audio.play('hit', { volume: 0.08 }); return false; }
      var box = boxAt(nx, ny);
      var snapshot = { px: p.gx, py: p.gy, boxes: game.map.boxes.map(function (b) { return { x: b.x, y: b.y }; }) };
      if (box) {
        var bx = nx + dx, by = ny + dy;
        if (cellBlocked(bx, by) || boxAt(bx, by)) { audio.play('hit', { volume: 0.08 }); return false; }
        box.x = bx; box.y = by;
        game.stats.pushes++;
        var landed = isTarget(bx, by);
        audio.play(landed ? 'pickup' : 'action');
        if (landed) {
          game.score += Math.round(cfg.scoring.pickup * game.combo);
${twist === 'combo' ? `          game.combo = Math.min(cfg.twist.comboMax, game.combo + cfg.twist.comboStep); game.comboTimer = cfg.twist.comboWindow;` : ''}
          particles.emit(bx * game.map.tile + game.map.tile / 2, by * game.map.tile + game.map.tile / 2,
            { count: 12, speed: 110, life: 0.4, color: cfg.palette[2], size: 3 });
        }
      } else {
        audio.play('action', { volume: 0.06 });
      }
      game.history.push(snapshot);
      if (game.history.length > 200) game.history.shift();
      p.gx = nx; p.gy = ny;
      LAB.physics.moveTo(p, nx * game.map.tile + game.map.tile / 2, ny * game.map.tile + game.map.tile / 2);
      game.moves++;
      updateSolved();
      return true;
    }

    function undo() {
      var snap = game.history.pop();
      if (!snap) return;
      game.stats.undos++;
      var p = game.player;
      p.gx = snap.px; p.gy = snap.py;
      p.x = p.gx * game.map.tile + game.map.tile / 2;
      p.y = p.gy * game.map.tile + game.map.tile / 2;
      p.moving = false;
      for (var i = 0; i < snap.boxes.length; i++) {
        game.map.boxes[i].x = snap.boxes[i].x;
        game.map.boxes[i].y = snap.boxes[i].y;
      }
      game.moves++;
${twist === 'combo' ? `      game.combo = 1;` : ''}
      updateSolved();
    }

    game.reset = function () {
      particles.clear();
      game.status = 'playing'; game.score = 0; game.elapsed = 0; game.combo = 1;
      game.stats = { pushes: 0, undos: 0, levelsCleared: 0 };
      game.resource = 1;
      loadLevel(0);
    };

    game.update = function (dt) {
      if (game.status !== 'playing') return;
      game.elapsed += dt;
      var p = game.player;
      LAB.physics.integrate(p, dt);

      if (input.pressed('left')) tryMove(-1, 0);
      else if (input.pressed('right')) tryMove(1, 0);
      else if (input.pressed('up')) tryMove(0, -1);
      else if (input.pressed('down')) tryMove(0, 1);
      if (input.pressed('undo') || input.pressed('secondary')) undo();
${design.controls.scheme === 'point-and-click' || design.controls.scheme === 'drag-select' ? `
      if (input.pressed('action')) {
        var wp = camera.screenToWorld(input.pointer.x, input.pointer.y);
        var tx = Math.floor(wp.x / game.map.tile), ty = Math.floor(wp.y / game.map.tile);
        var dx = tx - p.gx, dy = ty - p.gy;
        /* step toward the click; if the dominant axis is blocked, try the other */
        var moved = false;
        if (Math.abs(dx) >= Math.abs(dy) && dx) moved = tryMove(M.sign(dx), 0);
        if (!moved && dy) moved = tryMove(0, M.sign(dy));
        if (!moved && dx) tryMove(M.sign(dx), 0);
      }` : ''}
${twist === 'combo' ? `      if (game.comboTimer > 0) { game.comboTimer -= dt; if (game.comboTimer <= 0) game.combo = 1; }` : ''}
${twist === 'terrain-mutation' ? `      game.mutateTimer = (game.mutateTimer || cfg.twist.mutateInterval) - dt;
      if (game.mutateTimer <= 0) {
        game.mutateTimer = cfg.twist.mutateInterval;
        /* toggle one interior wall that is not under a box or the player */
        for (var tries = 0; tries < 20; tries++) {
          var mx = ctx.rng.int(2, game.map.cols - 3), my = ctx.rng.int(2, game.map.rows - 3);
          if (boxAt(mx, my) || (p.gx === mx && p.gy === my) || isTarget(mx, my)) continue;
          game.map.grid[my * game.map.cols + mx] = game.map.grid[my * game.map.cols + mx] ? 0 : 1;
          break;
        }
      }` : ''}
${twist === 'resource-drain' || twist === 'light-radius' ? `      game.resource = Math.max(0, game.resource - cfg.twist.drainPerSecond * dt);
      if (game.resource <= 0) { game.status = 'lost'; game.reason = 'Ran out of power'; audio.play('lose'); }` : ''}

      if (game.solvedBoxes === game.map.boxes.length) {
        game.stats.levelsCleared++;
        game.score += Math.max(20, cfg.scoring.level - game.moves * 4);
        if (game.level + 1 >= ${levels}) {
          game.status = 'won';
          game.reason = 'All ${levels} boards solved in ' + Math.round(game.elapsed) + 's';
          audio.play('win');
        } else {
          ctx.ui && ctx.ui.toast('Board ' + (game.level + 2));
          audio.play('win', { volume: 0.12 });
          loadLevel(game.level + 1);
        }
      }
      world.sweep();
    };

    game.render = function (r, alpha) {
      var m = game.map;
      camera.follow(null, 1 / 60);
      camera.apply(r.ctx);
      var t = m.tile;

      for (var y = 0; y < m.rows; y++) {
        for (var x = 0; x < m.cols; x++) {
          var wall = m.grid[y * m.cols + x] === 1;
          r.rect(x * t + 1, y * t + 1, t - 2, t - 2, wall ? cfg.palette[3] : cfg.palette[0]);
          if (!wall) r.strokeRect(x * t + 1, y * t + 1, t - 2, t - 2, 'rgba(255,255,255,0.05)', 1);
        }
      }
      for (var ti = 0; ti < m.targets.length; ti++) {
        var tg = m.targets[ti];
        r.ring(tg.x * t + t / 2, tg.y * t + t / 2, t * 0.28, cfg.palette[2], 3);
      }
      for (var bi = 0; bi < m.boxes.length; bi++) {
        var b = m.boxes[bi];
        var on = isTarget(b.x, b.y);
        r.rect(b.x * t + t * 0.14, b.y * t + t * 0.14, t * 0.72, t * 0.72, on ? cfg.palette[2] : cfg.palette[4]);
        r.strokeRect(b.x * t + t * 0.14, b.y * t + t * 0.14, t * 0.72, t * 0.72, cfg.palette[1], 1);
      }
      particles.render(r.ctx);
      var p = game.player;
      if (p) r.shape('hex', p.x, p.y, t * 0.3, cfg.palette[1]);
      camera.restore(r.ctx);
${twist === 'light-radius' ? `      if (p) { var s = camera.worldToScreen(p.x, p.y); r.lightMask(s.x, s.y, cfg.twist.lightBase + game.resource * cfg.twist.lightRange, 0.9); }` : ''}
    };

    game.hud = function () {
      return {
        score: game.score,
        moves: game.moves,
        wave: (game.level + 1) + '/${levels}',
        timer: Math.floor(game.elapsed),
        health: 1,
        resource: game.resource,
        combo: 'x' + game.combo.toFixed(1),
        fragile: game.solvedBoxes + '/' + (game.map ? game.map.boxes.length : 0),
      };
    };

    game.onAction = function (name) { if (name === 'restart') game.reset(); };
    game.reset();
    return game;
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
}
