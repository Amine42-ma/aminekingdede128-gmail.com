/**
 * Ruleset: STEALTH (top-down infiltration).
 *
 * Guards patrol routes with real vision cones that are blocked by walls; the
 * player has a detection meter rather than instant failure, so there is a
 * readable window to break line of sight. The map is generated as rooms or a
 * maze depending on the design's world trait, and the exit is only placed on a
 * tile proven reachable from the spawn.
 */

export function emitWorld(design) {
  const maze = design.traits.world === 'handcrafted-levels' || design.traits.genre === 'maze-escape';
  return `/* game/world.js - ${maze ? 'maze' : 'room'} layout with a verified exit */
(function (global) {
  'use strict';
  var LAB = global.LAB;

  LAB.buildWorld = function (cfg, rng, levelIndex) {
    var cols = cfg.world.cols, rows = cfg.world.rows, tile = cfg.world.tileSize;
    var built = ${maze
      ? `LAB.procgen.maze(rng, cols, rows)`
      : `LAB.procgen.rooms(rng, cols, rows, cfg.world.rooms || 6)`};
    var grid = built.grid;
    cols = built.cols; rows = built.rows;

    var floors = [];
    for (var y = 1; y < rows - 1; y++) for (var x = 1; x < cols - 1; x++) if (!grid[y * cols + x]) floors.push({ x: x, y: y });
    if (!floors.length) { /* fully blocked: carve a corridor so the level is playable */
      for (var cx = 1; cx < cols - 1; cx++) { grid[Math.floor(rows / 2) * cols + cx] = 0; floors.push({ x: cx, y: Math.floor(rows / 2) }); }
    }

    var start = floors[0];
    var reach = LAB.procgen.reachable(grid, cols, rows, start);

    /* exit = the reachable floor tile furthest from the spawn */
    var exit = start, bestD = -1;
    for (var i = 0; i < floors.length; i++) {
      var f = floors[i];
      if (!reach.seen[f.y * cols + f.x]) continue;
      var d = Math.abs(f.x - start.x) + Math.abs(f.y - start.y);
      if (d > bestD) { bestD = d; exit = f; }
    }

    /* guards start on reachable tiles away from the spawn */
    var guardSpots = [];
    var wanted = cfg.world.guards || 4;
    for (var g = 0; g < floors.length && guardSpots.length < wanted; g++) {
      var cand = floors[(g * 7 + 3) % floors.length];
      if (!reach.seen[cand.y * cols + cand.x]) continue;
      if (Math.abs(cand.x - start.x) + Math.abs(cand.y - start.y) < 5) continue;
      guardSpots.push(cand);
    }

    /* loot placed on reachable tiles, used by collect objectives */
    var loot = [];
    for (var l = 0; l < 6; l++) {
      var spot = floors[rng.int(0, floors.length - 1)];
      if (!reach.seen[spot.y * cols + spot.x]) continue;
      loot.push({ x: spot.x, y: spot.y, taken: false });
    }

    return {
      cols: cols, rows: rows, tile: tile, grid: grid,
      start: start, exit: exit, guardSpots: guardSpots, loot: loot,
      floors: floors, reachableCount: reach.count,
      width: cols * tile, height: rows * tile,
      level: levelIndex || 0,
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

export function emitRules(design) {
  const twist = design.twist.mechanic;
  const win = design.winCondition;
  const gridMove = design.traits.physics === 'grid-discrete';
  const levels = design.progression.stages.length;
  return `/* game/rules.js - stealth for "${design.name}" | movement: ${gridMove ? 'grid' : 'free'} | twist: ${design.traits.twist} */
(function (global) {
  'use strict';
  var LAB = global.LAB;
  var M = LAB.math;

  LAB.createGame = function (ctx) {
    var cfg = ctx.cfg, world = ctx.world, input = ctx.input, camera = ctx.camera;
    var particles = ctx.particles, audio = ctx.audio;

    var game = {
      status: 'playing', score: 0, elapsed: 0, detection: 0, level: 0,
      collected: 0, resource: 1, combo: 1, map: null, player: null, alarm: 0,
      stats: { spotted: 0, loot: 0, levels: 0 },
    };

    function solid(gx, gy) {
      var m = game.map;
      if (gx < 0 || gy < 0 || gx >= m.cols || gy >= m.rows) return true;
      return m.grid[gy * m.cols + gx] === 1;
    }
    function solidWorld(wx, wy) {
      return solid(Math.floor(wx / game.map.tile), Math.floor(wy / game.map.tile));
    }
    function centre(cell) {
      return { x: cell.x * game.map.tile + game.map.tile / 2, y: cell.y * game.map.tile + game.map.tile / 2 };
    }

    function loadLevel(index) {
      game.map = LAB.buildWorld(cfg, ctx.rng, index);
      game.level = index;
      world.clear();
      var m = game.map;
      var s = centre(m.start);
      game.player = world.spawn('player', {
        x: s.x, y: s.y, gx: m.start.x, gy: m.start.y, r: m.tile * 0.3,
        hp: 1, maxHp: 1, facing: 0,
      });
      for (var i = 0; i < m.guardSpots.length; i++) {
        var gp = centre(m.guardSpots[i]);
        var route = [];
        /* build a short patrol route out of nearby reachable floor tiles */
        for (var r2 = 0; r2 < 3; r2++) {
          var pick = m.floors[(i * 13 + r2 * 29 + 5) % m.floors.length];
          route.push(centre(pick));
        }
        world.spawn('guard', {
          x: gp.x, y: gp.y, r: m.tile * 0.3, facing: 0,
          speed: cfg.enemy.speed * 0.32, route: route, routeIndex: 0,
          waitAt: 0.7, waitTimer: 0, alerted: 0,
        });
      }
      camera.bounds = { x: 0, y: 0, w: m.width, h: m.height };
      camera.x = s.x; camera.y = s.y;
      game.detection = 0;
      game.collected = 0;
    }

    game.reset = function () {
      particles.clear();
      game.status = 'playing'; game.score = 0; game.elapsed = 0;
      game.resource = 1; game.combo = 1; game.alarm = 0;
      game.stats = { spotted: 0, loot: 0, levels: 0 };
      loadLevel(0);
    };

    function caught() {
      game.stats.spotted++;
      audio.play('lose');
      camera.kick(0.8);
${twist === 'one-hit' ? `      game.status = 'lost'; game.reason = 'Spotted';`
    : `      /* sent back to the entrance instead of an instant loss */
      var s = centre(game.map.start);
      game.player.x = s.x; game.player.y = s.y;
      game.player.gx = game.map.start.x; game.player.gy = game.map.start.y;
      game.player.moving = false;
      game.detection = 0;
      game.score = Math.max(0, game.score - 40);
      ctx.ui && ctx.ui.toast('Spotted - back to the entrance');
      if (game.stats.spotted >= 3) { game.status = 'lost'; game.reason = 'Spotted three times'; }`}
    }

    game.update = function (dt) {
      if (game.status !== 'playing') return;
      game.elapsed += dt;
      var p = game.player;
      var m = game.map;

${gridMove ? `      LAB.physics.integrate(p, dt);
      if (!p.moving) {
        var dx = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
        var dy = (input.down('down') ? 1 : 0) - (input.down('up') ? 1 : 0);
        if (dx && dy) dy = 0;
        if (dx || dy) {
          var nx = p.gx + dx, ny = p.gy + dy;
          if (!solid(nx, ny)) {
            p.gx = nx; p.gy = ny;
            p.facing = Math.atan2(dy, dx);
            LAB.physics.moveTo(p, nx * m.tile + m.tile / 2, ny * m.tile + m.tile / 2);
          }
        }
      }
      p.sprinting = false;`
    : `      var axis = input.axis();
      var sprint = input.down('secondary');
      p.sprinting = sprint && (axis.x !== 0 || axis.y !== 0);
      var moveCfg = { accel: cfg.physics.accel, maxSpeed: cfg.physics.maxSpeed * (sprint ? 1.6 : 0.85), friction: cfg.physics.friction };
      var prevX = p.x, prevY = p.y;
      LAB.physics.integrate(p, axis.x, axis.y, dt, moveCfg);
      /* wall resolution, one axis at a time so sliding along walls works */
      if (solidWorld(p.x, prevY)) { p.x = prevX; p.vx = 0; }
      if (solidWorld(p.x, p.y)) { p.y = prevY; p.vy = 0; }
      if (axis.x || axis.y) p.facing = Math.atan2(axis.y, axis.x);
      p.gx = Math.floor(p.x / m.tile); p.gy = Math.floor(p.y / m.tile);`}

      /* ---- guards: patrol, look, chase ---- */
      var seenThisFrame = false;
      world.each('guard', function (g) {
        g.age += dt;
        var visionRange = cfg.enemy.visionRange * (game.alarm > 0 ? 1.25 : 1);
        var canSee = LAB.ai.canSee(g, p, visionRange, cfg.enemy.visionAngle, solidWorld);
        if (canSee) {
          seenThisFrame = true;
          g.alerted = 2.2;
          LAB.ai.seek(g, p.x, p.y, dt, g.speed * 1.7);
          /* keep chasing guards out of walls */
          if (solidWorld(g.x, g.y)) { g.x -= g.vx * dt; g.y -= g.vy * dt; }
        } else if (g.alerted > 0) {
          g.alerted -= dt;
          LAB.ai.seek(g, p.x, p.y, dt, g.speed * 1.2);
          if (solidWorld(g.x, g.y)) { g.x -= g.vx * dt; g.y -= g.vy * dt; }
        } else {
          LAB.ai.patrol(g, dt, g.speed);
          if (solidWorld(g.x, g.y)) {
            g.x -= (g.vx || 0) * dt; g.y -= (g.vy || 0) * dt;
            g.routeIndex = (g.routeIndex + 1) % g.route.length; /* blocked: pick another waypoint */
          }
        }
      });

      /* detection meter: rises while seen, decays in cover */
      var rate = seenThisFrame ? (p.sprinting ? 1.6 : 1.0) : -0.55;
      game.detection = M.clamp(game.detection + rate * dt, 0, 1);
      game.alarm = Math.max(0, game.alarm - dt);
      if (seenThisFrame && game.detection > 0.35) game.alarm = 3;
      if (game.detection >= 1) { caught(); if (game.status !== 'playing') return; }

      /* ---- loot ---- */
      for (var i = 0; i < m.loot.length; i++) {
        var lt = m.loot[i];
        if (lt.taken) continue;
        var lc = centre(lt);
        if (M.dist2(p.x, p.y, lc.x, lc.y) < (m.tile * 0.5) * (m.tile * 0.5)) {
          lt.taken = true;
          game.collected++;
          game.stats.loot++;
          game.score += Math.round(cfg.scoring.pickup * game.combo);
${twist === 'combo' ? `          game.combo = Math.min(cfg.twist.comboMax, game.combo + cfg.twist.comboStep); game.comboTimer = cfg.twist.comboWindow;` : ''}
          audio.play('pickup');
          particles.emit(lc.x, lc.y, { count: 10, speed: 110, life: 0.4, color: cfg.palette[2], size: 2 });
        }
      }
${twist === 'combo' ? `      if (game.comboTimer > 0) { game.comboTimer -= dt; if (game.comboTimer <= 0) game.combo = 1; }` : ''}
${twist === 'resource-drain' || twist === 'light-radius' ? `      game.resource = Math.max(0, game.resource - cfg.twist.drainPerSecond * dt);
      if (game.resource <= 0) { game.status = 'lost'; game.reason = 'Power ran out'; audio.play('lose'); return; }` : ''}
${twist === 'time-scale' ? `      ctx.loop.timeScale = (input.down('action') && game.resource > 0) ? cfg.twist.slowFactor : 1;
      if (input.down('action')) game.resource = Math.max(0, game.resource - cfg.twist.drainPerSecond * dt);
      else game.resource = Math.min(1, game.resource + cfg.twist.rechargePerSecond * dt);` : ''}
${twist === 'shrink-bounds' ? `      game.sweepRadius = Math.max(140, (m.width + m.height) / 2 - game.elapsed * cfg.twist.shrinkRate);
      var sc = centre(m.exit);
      if (M.dist(p.x, p.y, sc.x, sc.y) > game.sweepRadius) game.detection = Math.min(1, game.detection + dt * 0.5);` : ''}

      /* ---- exit ---- */
      var ex = centre(m.exit);
      var atExit = M.dist2(p.x, p.y, ex.x, ex.y) < (m.tile * 0.55) * (m.tile * 0.55);
${win.type === 'collect' ? `      var allLoot = game.collected >= m.loot.length;`
    : `      var allLoot = true;`}
      if (atExit && allLoot) {
        game.stats.levels++;
        game.score += Math.max(50, cfg.scoring.level - Math.round(game.elapsed * 3));
        if (game.level + 1 >= ${levels}) {
          game.status = 'won';
          game.reason = '${win.constraint ? 'Slipped out' : 'Reached the exit'}' + (game.stats.spotted === 0 ? ' - never spotted' : '');
          audio.play('win');
        } else {
          ctx.ui && ctx.ui.toast('Sector ' + (game.level + 2));
          audio.play('win', { volume: 0.12 });
          loadLevel(game.level + 1);
        }
      }

      camera.follow(p, dt);
      world.sweep();
    };

    game.render = function (r, alpha) {
      var m = game.map, p = game.player, t = m.tile;
      camera.apply(r.ctx);

      for (var y = 0; y < m.rows; y++) {
        for (var x = 0; x < m.cols; x++) {
          var wall = m.grid[y * m.cols + x] === 1;
          if (wall) r.rect(x * t, y * t, t, t, cfg.palette[3]);
          else r.rect(x * t + 1, y * t + 1, t - 2, t - 2, cfg.palette[0]);
        }
      }

      var ex = m.exit;
      r.strokeRect(ex.x * t + 3, ex.y * t + 3, t - 6, t - 6, cfg.palette[2], 3);
      r.text('EXIT', ex.x * t + t / 2, ex.y * t + t / 2 + 4, { size: 9, align: 'center', color: cfg.palette[2] });

      for (var i = 0; i < m.loot.length; i++) {
        var lt = m.loot[i];
        if (lt.taken) continue;
        r.shape('diamond', lt.x * t + t / 2, lt.y * t + t / 2, t * 0.22, cfg.palette[2]);
      }

      /* vision cones, drawn as a translucent wedge */
      world.each('guard', function (g) {
        var range = cfg.enemy.visionRange;
        var half = cfg.enemy.visionAngle;
        var ctx2 = r.ctx;
        ctx2.fillStyle = g.alerted > 0 ? 'rgba(255,80,80,0.18)' : 'rgba(255,255,255,0.10)';
        ctx2.beginPath();
        ctx2.moveTo(g.x, g.y);
        for (var a = -half; a <= half; a += half / 6) {
          ctx2.lineTo(g.x + Math.cos((g.facing || 0) + a) * range, g.y + Math.sin((g.facing || 0) + a) * range);
        }
        ctx2.closePath();
        ctx2.fill();
        r.shape('square', g.x, g.y, g.r, g.alerted > 0 ? cfg.palette[4] : cfg.palette[3], g.facing || 0);
      });

      particles.render(r.ctx);
      if (p) r.shape('capsule', p.x, p.y, p.r, cfg.palette[2], p.facing || 0);
      camera.restore(r.ctx);
${twist === 'light-radius' ? `      if (p) { var s = camera.worldToScreen(p.x, p.y); r.lightMask(s.x, s.y, cfg.twist.lightBase + game.resource * cfg.twist.lightRange, 0.95); }` : ''}
      r.vignette(0.4);
    };

    game.hud = function () {
      return {
        score: game.score,
        health: 1 - game.detection,
        resource: game.resource,
        timer: Math.floor(game.elapsed),
        wave: (game.level + 1) + '/${levels}',
        moves: game.collected + '/' + (game.map ? game.map.loot.length : 0),
        combo: 'x' + game.combo.toFixed(1),
        fragile: game.detection > 0.6 ? 'SEEN' : 'hidden',
      };
    };

    game.onAction = function (name) { if (name === 'restart') game.reset(); };
    game.reset();
    return game;
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
}
