/**
 * Ruleset: DEFENSE (tower defense).
 *
 * Creeps walk a generated path; the player spends currency placing towers on
 * buildable cells; towers acquire targets, fire, and the core loses life when a
 * creep reaches the end. Waves escalate from the design's progression stages.
 */

export function emitWorld(design) {
  return `/* game/world.js - board + creep path */
(function (global) {
  'use strict';
  var LAB = global.LAB;

  LAB.buildWorld = function (cfg, rng) {
    var cols = cfg.world.cols, rows = cfg.world.rows, tile = cfg.world.tileSize;
    var cells = LAB.procgen.path(rng, cols, rows, cfg.world.pathTurns || 5);

    var grid = new Uint8Array(cols * rows); /* 0 = buildable, 1 = path, 2 = blocked */
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      if (c.x >= 0 && c.y >= 0 && c.x < cols && c.y < rows) grid[c.y * cols + c.x] = 1;
    }
    /* scatter a few unbuildable decorations so placement has real constraints */
    var blocked = Math.floor(cols * rows * (1 - (cfg.world.buildableRatio || 0.6)) * 0.5);
    for (var b = 0; b < blocked; b++) {
      var x = rng.int(0, cols - 1), y = rng.int(0, rows - 1);
      if (grid[y * cols + x] === 0) grid[y * cols + x] = 2;
    }

    var waypoints = cells.map(function (c) {
      return { x: c.x * tile + tile / 2, y: c.y * tile + tile / 2 };
    });

    return {
      cols: cols, rows: rows, tile: tile, grid: grid,
      path: cells, waypoints: waypoints,
      width: cols * tile, height: rows * tile,
      spawn: waypoints[0],
      goal: waypoints[waypoints.length - 1],
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

export function emitRules(design) {
  const twist = design.twist.mechanic;
  const stages = design.progression.stages.length;
  const tower = design.entities.find((e) => e.role === 'buildable') || { cost: 30, range: 130, fireRate: 1.1, damage: 8 };
  return `/* game/rules.js - tower defense for "${design.name}" | ${stages} waves | twist: ${design.traits.twist} */
(function (global) {
  'use strict';
  var LAB = global.LAB;
  var M = LAB.math;

  LAB.createGame = function (ctx) {
    var cfg = ctx.cfg, world = ctx.world, input = ctx.input, camera = ctx.camera;
    var particles = ctx.particles, audio = ctx.audio;
    var map = LAB.buildWorld(cfg, ctx.rng);

    var TOWER = { cost: ${tower.cost}, range: ${tower.range}, fireRate: ${tower.fireRate}, damage: ${tower.damage} };

    var game = {
      status: 'playing', score: 0, elapsed: 0, wave: 0, waveTimer: 3,
      spawnQueue: 0, spawnTimer: 0, lives: 12, credits: ${design.progression.economy?.startingCurrency || 70},
      combo: 1, comboTimer: 0, map: map, player: null, hover: null, resource: 1,
      stats: { built: 0, killed: 0, leaked: 0 },
    };

    camera.bounds = { x: 0, y: 0, w: map.width, h: map.height };
    camera.x = map.width / 2;
    camera.y = map.height / 2;

    function cellAt(wx, wy) {
      var x = Math.floor(wx / map.tile), y = Math.floor(wy / map.tile);
      if (x < 0 || y < 0 || x >= map.cols || y >= map.rows) return null;
      return { x: x, y: y, type: map.grid[y * map.cols + x] };
    }

    function towerAt(cx, cy) {
      var list = world.get('tower');
      for (var i = 0; i < list.length; i++) if (list[i].cx === cx && list[i].cy === cy) return list[i];
      return null;
    }

    function build(cx, cy) {
      if (map.grid[cy * map.cols + cx] !== 0) { ctx.ui && ctx.ui.toast('Cannot build there'); return false; }
      if (towerAt(cx, cy)) { upgrade(towerAt(cx, cy)); return false; }
      if (game.credits < TOWER.cost) { ctx.ui && ctx.ui.toast('Not enough credits'); return false; }
      game.credits -= TOWER.cost;
      game.stats.built++;
      world.spawn('tower', {
        cx: cx, cy: cy, x: cx * map.tile + map.tile / 2, y: cy * map.tile + map.tile / 2,
        r: map.tile * 0.32, range: TOWER.range, cooldown: 0, level: 1, damage: TOWER.damage,
      });
      audio.play('build');
      particles.emit(cx * map.tile + map.tile / 2, cy * map.tile + map.tile / 2, { count: 10, speed: 90, life: 0.35, color: cfg.palette[2], size: 2 });
      return true;
    }

    function upgrade(t) {
      var cost = Math.round(TOWER.cost * 0.8 * t.level);
      if (game.credits < cost) { ctx.ui && ctx.ui.toast('Upgrade costs ' + cost); return; }
      game.credits -= cost;
      t.level++;
      t.damage = Math.round(TOWER.damage * (1 + 0.55 * (t.level - 1)));
      t.range = Math.round(TOWER.range * (1 + 0.12 * (t.level - 1)));
      audio.play('build', { pitch: 1.3 });
      ctx.ui && ctx.ui.toast('Tower level ' + t.level);
    }

    function spawnCreep(waveIndex) {
      var stage = cfg.progression.stages[Math.min(waveIndex, cfg.progression.stages.length - 1)];
      world.spawn('creep', {
        x: map.spawn.x, y: map.spawn.y, r: map.tile * 0.26,
        hp: Math.round(cfg.enemy.hp * 6 * (1 + waveIndex * 0.45)),
        maxHp: Math.round(cfg.enemy.hp * 6 * (1 + waveIndex * 0.45)),
        speed: cfg.enemy.speed * 0.45 * (stage.enemySpeed || 1),
        wp: 1, bounty: Math.round(6 + waveIndex * 2),
      });
    }

    function startWave() {
      var stage = cfg.progression.stages[Math.min(game.wave, cfg.progression.stages.length - 1)];
      game.spawnQueue = stage.enemyCount;
      game.spawnTimer = 0;
      ctx.ui && ctx.ui.toast(stage.label);
    }

    game.reset = function () {
      world.clear(); particles.clear();
      game.status = 'playing'; game.score = 0; game.elapsed = 0;
      game.wave = 0; game.waveTimer = 3; game.spawnQueue = 0; game.spawnTimer = 0;
      game.lives = 12; game.credits = ${design.progression.economy?.startingCurrency || 70};
      game.combo = 1; game.resource = 1;
      game.stats = { built: 0, killed: 0, leaked: 0 };
    };

    game.update = function (dt) {
      if (game.status !== 'playing') return;
      game.elapsed += dt;

      /* ---- placement ---- */
      var wp = camera.screenToWorld(input.pointer.x, input.pointer.y);
      game.hover = cellAt(wp.x, wp.y);
      if (input.pressed('action') && game.hover) build(game.hover.x, game.hover.y);
${design.controls.scheme === 'grid-step' ? `      /* keyboard placement cursor for keyboard-only players */
      game.cursor = game.cursor || { x: Math.floor(map.cols / 2), y: Math.floor(map.rows / 2) };
      if (input.pressed('left')) game.cursor.x = Math.max(0, game.cursor.x - 1);
      if (input.pressed('right')) game.cursor.x = Math.min(map.cols - 1, game.cursor.x + 1);
      if (input.pressed('up')) game.cursor.y = Math.max(0, game.cursor.y - 1);
      if (input.pressed('down')) game.cursor.y = Math.min(map.rows - 1, game.cursor.y + 1);
      if (input.pressed('action')) build(game.cursor.x, game.cursor.y);` : ''}

      /* ---- waves ---- */
      if (game.spawnQueue > 0) {
        game.spawnTimer -= dt;
        if (game.spawnTimer <= 0) {
          game.spawnTimer = Math.max(0.28, cfg.progression.stages[Math.min(game.wave, cfg.progression.stages.length - 1)].spawnInterval * 0.6);
          spawnCreep(game.wave);
          game.spawnQueue--;
        }
      } else if (world.count('creep') === 0) {
        game.waveTimer -= dt;
        if (game.waveTimer <= 0) {
          if (game.wave >= ${stages}) {
            game.status = 'won';
            game.reason = 'All ${stages} waves held off';
            audio.play('win');
            return;
          }
          game.credits += cfg.progression.stages[Math.min(game.wave, cfg.progression.stages.length - 1)].reward;
          startWave();
          game.wave++;
          game.waveTimer = 8;
        }
      }

      /* ---- creeps follow the path ---- */
      world.each('creep', function (c) {
        var target = map.waypoints[c.wp];
        if (!target) {
          world.kill(c);
          game.lives--;
          game.stats.leaked++;
          audio.play('hit');
          camera.kick(0.4);
          if (game.lives <= 0) { game.status = 'lost'; game.reason = 'The core fell'; audio.play('lose'); }
          return;
        }
        var d = LAB.ai.seek(c, target.x, target.y, dt, c.speed);
        if (d < map.tile * 0.4) c.wp++;
      });

      /* ---- towers acquire and fire ---- */
      world.each('tower', function (t) {
        t.cooldown -= dt;
        if (t.cooldown > 0) return;
        var best = null, bestProgress = -1;
        var creeps = world.get('creep');
        for (var i = 0; i < creeps.length; i++) {
          var c = creeps[i];
          if (!c.alive) continue;
          if (M.dist2(t.x, t.y, c.x, c.y) > t.range * t.range) continue;
          if (c.wp > bestProgress) { bestProgress = c.wp; best = c; } /* target the leader */
        }
        if (!best) return;
        t.cooldown = 1 / TOWER.fireRate;
        t.aim = Math.atan2(best.y - t.y, best.x - t.x);
        world.spawn('shot', {
          x: t.x, y: t.y, r: 3, target: best, damage: t.damage, life: 1.2,
          vx: Math.cos(t.aim) * 520, vy: Math.sin(t.aim) * 520,
        });
        audio.play('action', { volume: 0.1 });
      });

      world.each('shot', function (s) {
        s.life -= dt;
        if (s.life <= 0) { world.kill(s); return; }
        if (s.target && s.target.alive) {
          var a = Math.atan2(s.target.y - s.y, s.target.x - s.x);
          s.vx = Math.cos(a) * 520; s.vy = Math.sin(a) * 520;
        }
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.target && s.target.alive && M.dist2(s.x, s.y, s.target.x, s.target.y) < (s.r + s.target.r) * (s.r + s.target.r)) {
          s.target.hp -= s.damage;
          world.kill(s);
          particles.emit(s.x, s.y, { count: 5, speed: 100, life: 0.25, color: cfg.palette[2], size: 2 });
          if (s.target.hp <= 0) {
            world.kill(s.target);
            game.stats.killed++;
            game.credits += s.target.bounty;
            game.score += Math.round(cfg.scoring.kill * game.combo);
${twist === 'combo' ? `            game.combo = Math.min(cfg.twist.comboMax, game.combo + cfg.twist.comboStep); game.comboTimer = cfg.twist.comboWindow;` : ''}
            audio.play('hit', { pitch: 1.5 });
            particles.emit(s.target.x, s.target.y, { count: 14, speed: 160, life: 0.45, color: cfg.palette[4], size: 3 });
          }
        }
      });
${twist === 'combo' ? `      if (game.comboTimer > 0) { game.comboTimer -= dt; if (game.comboTimer <= 0) game.combo = 1; }` : ''}
${twist === 'resource-drain' ? `      game.resource = Math.max(0, game.resource - cfg.twist.drainPerSecond * dt);
      if (game.resource <= 0) { game.status = 'lost'; game.reason = 'Power grid collapsed'; audio.play('lose'); }` : ''}
${twist === 'terrain-mutation' ? `      game.mutateTimer = (game.mutateTimer || cfg.twist.mutateInterval) - dt;
      if (game.mutateTimer <= 0) {
        game.mutateTimer = cfg.twist.mutateInterval;
        for (var tries = 0; tries < 24; tries++) {
          var mx = ctx.rng.int(0, map.cols - 1), my = ctx.rng.int(0, map.rows - 1);
          var v = map.grid[my * map.cols + mx];
          if (v === 1 || towerAt(mx, my)) continue;
          map.grid[my * map.cols + mx] = v === 0 ? 2 : 0;
          break;
        }
      }` : ''}
      world.sweep();
    };

    game.render = function (r, alpha) {
      camera.follow(null, 1 / 60);
      camera.apply(r.ctx);
      var t = map.tile;

      for (var y = 0; y < map.rows; y++) {
        for (var x = 0; x < map.cols; x++) {
          var v = map.grid[y * map.cols + x];
          var color = v === 1 ? cfg.palette[3] : v === 2 ? cfg.palette[0] : cfg.palette[0];
          r.rect(x * t, y * t, t - 1, t - 1, color);
          if (v === 0) r.strokeRect(x * t + 2, y * t + 2, t - 5, t - 5, 'rgba(255,255,255,0.07)', 1);
          if (v === 2) r.shape('square', x * t + t / 2, y * t + t / 2, t * 0.22, cfg.palette[3]);
        }
      }
      r.shape('hex', map.goal.x, map.goal.y, t * 0.4, cfg.palette[2]);

      if (game.hover && game.hover.type === 0) {
        r.strokeRect(game.hover.x * t, game.hover.y * t, t, t, cfg.palette[2], 2);
        r.ring(game.hover.x * t + t / 2, game.hover.y * t + t / 2, TOWER.range, 'rgba(255,255,255,0.12)', 1);
      }
${design.controls.scheme === 'grid-step' ? `      if (game.cursor) r.strokeRect(game.cursor.x * t, game.cursor.y * t, t, t, cfg.palette[1], 2);` : ''}

      world.each('tower', function (tw) {
        r.shape('square', tw.x, tw.y, tw.r, cfg.palette[2], 0);
        r.line(tw.x, tw.y, tw.x + Math.cos(tw.aim || 0) * tw.r * 1.6, tw.y + Math.sin(tw.aim || 0) * tw.r * 1.6, cfg.palette[1], 3);
        if (tw.level > 1) r.text(String(tw.level), tw.x + tw.r, tw.y - tw.r, { size: 11, color: cfg.palette[1] });
      });
      world.each('creep', function (c) {
        r.shape('triangle', c.x, c.y, c.r, cfg.palette[4], c.facing || 0);
        r.bar(c.x, c.y - c.r - 8, c.r * 2.4, 3, c.hp / c.maxHp, cfg.palette[2]);
      });
      world.each('shot', function (s) { r.circle(s.x, s.y, s.r, cfg.palette[1]); });
      particles.render(r.ctx);
      camera.restore(r.ctx);
    };

    game.hud = function () {
      return {
        score: game.score,
        currency: game.credits,
        lives: game.lives,
        wave: Math.min(game.wave + (game.spawnQueue > 0 ? 0 : 1), ${stages}) + '/${stages}',
        timer: Math.floor(game.elapsed),
        health: game.lives / 12,
        resource: game.resource,
        combo: 'x' + game.combo.toFixed(1),
        moves: game.stats.built,
        fragile: game.lives <= 3 ? 'CRITICAL' : 'ok',
      };
    };

    game.onAction = function (name) { if (name === 'restart') game.reset(); };
    game.reset();
    return game;
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
}
