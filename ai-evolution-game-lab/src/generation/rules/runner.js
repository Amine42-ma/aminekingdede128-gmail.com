/**
 * Ruleset: RUNNER (endless auto-scroller).
 *
 * The world is generated in chunks ahead of the player and culled behind, so
 * the run is genuinely endless with bounded memory. Difficulty comes from the
 * speed ramp and from obstacle density scaling with distance.
 */

export function emitWorld(design) {
  return `/* game/world.js - chunked endless course */
(function (global) {
  'use strict';
  var LAB = global.LAB;

  LAB.buildWorld = function (cfg, rng) {
    var chunkW = cfg.world.chunkWidth || 420;
    var groundY = 420;

    function makeChunk(index) {
      var x0 = index * chunkW;
      var obstacles = [];
      var coins = [];
      if (index > 0) {
        var density = Math.min(0.92, (cfg.world.obstacleDensity || 0.5) + index * 0.01);
        var slots = 3;
        for (var s = 0; s < slots; s++) {
          if (!rng.chance(density / slots * 1.6)) continue;
          var x = x0 + 80 + s * (chunkW / slots) + rng.range(-20, 20);
          var kind = rng.next();
          if (kind < 0.45) obstacles.push({ x: x, y: groundY - 34, w: 26, h: 34, kind: 'block' });
          else if (kind < 0.75) obstacles.push({ x: x, y: groundY - 96, w: 30, h: 46, kind: 'high' });
          else obstacles.push({ x: x, y: groundY, w: rng.range(60, 110), h: 200, kind: 'gap' });
        }
        for (var c = 0; c < 3; c++) {
          if (!rng.chance(0.45)) continue;
          coins.push({ x: x0 + 60 + c * 120 + rng.range(-20, 20), y: groundY - rng.range(40, 130), r: 9, taken: false });
        }
      }
      return { index: index, x0: x0, x1: x0 + chunkW, obstacles: obstacles, coins: coins };
    }

    return {
      chunkWidth: chunkW,
      groundY: groundY,
      makeChunk: makeChunk,
      start: { x: 80, y: groundY - 40 },
      bounds: { x: 0, y: 0, w: 1e9, h: 720 },
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

export function emitRules(design) {
  const twist = design.twist.mechanic;
  const win = design.winCondition;
  return `/* game/rules.js - endless runner for "${design.name}" | twist: ${design.traits.twist} */
(function (global) {
  'use strict';
  var LAB = global.LAB;
  var M = LAB.math;

  LAB.createGame = function (ctx) {
    var cfg = ctx.cfg, world = ctx.world, input = ctx.input, camera = ctx.camera;
    var particles = ctx.particles, audio = ctx.audio;
    var map = LAB.buildWorld(cfg, ctx.rng);

    var game = {
      status: 'playing', score: 0, distance: 0, elapsed: 0, speed: 0,
      combo: 1, comboTimer: 0, resource: 1, gravitySign: 1, chunks: [], map: map,
      nearMisses: 0, player: null,
      stats: { jumps: 0, coins: 0 },
    };

    function ensureChunks() {
      var needUntil = game.player.x + 1600;
      var nextIndex = game.chunks.length ? game.chunks[game.chunks.length - 1].index + 1 : 0;
      while (!game.chunks.length || game.chunks[game.chunks.length - 1].x1 < needUntil) {
        game.chunks.push(map.makeChunk(nextIndex++));
      }
      while (game.chunks.length && game.chunks[0].x1 < game.player.x - 600) game.chunks.shift();
    }

    function spawnPlayer() {
      game.player = world.spawn('player', {
        x: map.start.x, y: map.start.y, hw: 13, hh: 19, r: 15,
        hp: ${twist === 'one-hit' ? 1 : 'cfg.player.hp'}, maxHp: ${twist === 'one-hit' ? 1 : 'cfg.player.hp'},
        onGround: false, ducking: false, invuln: 0,
      });
    }

    function hit(reason) {
      var p = game.player;
      if (p.invuln > 0 || game.status !== 'playing') return;
      p.hp--;
      p.invuln = 1.1;
      audio.play('hit');
      camera.kick(0.6);
      particles.emit(p.x, p.y, { count: 16, speed: 200, life: 0.5, color: cfg.palette[4], size: 3 });
${twist === 'combo' ? `      game.combo = 1;` : ''}
      if (p.hp <= 0) { game.status = 'lost'; game.reason = reason; audio.play('lose'); }
    }

    game.reset = function () {
      world.clear(); particles.clear();
      game.status = 'playing'; game.score = 0; game.distance = 0; game.elapsed = 0;
      game.combo = 1; game.comboTimer = 0; game.resource = 1; game.gravitySign = 1;
      game.chunks = []; game.nearMisses = 0;
      game.speed = cfg.world.scrollSpeed || 300;
      game.stats = { jumps: 0, coins: 0 };
      spawnPlayer();
      ensureChunks();
      camera.x = game.player.x + 180; camera.y = map.groundY - 120;
    };

    game.update = function (dt) {
      if (game.status !== 'playing') return;
      var p = game.player;
      game.elapsed += dt;
      p.invuln = Math.max(0, p.invuln - dt);

      /* speed ramp: the core difficulty driver for this genre */
      game.speed = Math.min(cfg.world.scrollSpeed * 2.6, (cfg.world.scrollSpeed || 300) + game.elapsed * 7.5);
${twist === 'beat-window' ? `      game.beat = (game.elapsed % cfg.twist.beatSeconds) / cfg.twist.beatSeconds;` : ''}

      var wantJump = input.down('action') || input.buffered('action', false);
${twist === 'flip-gravity' ? `      if (input.pressed('secondary') || input.pressed('down')) {
        game.gravitySign *= -1; p.vy = 0; audio.play('action');
      }
      var phys = { gravity: cfg.physics.gravity * game.gravitySign, jumpVelocity: cfg.physics.jumpVelocity * game.gravitySign,
                   moveSpeed: 0, accel: cfg.physics.accel, friction: 0, maxFall: cfg.physics.maxFall, coyoteMs: cfg.physics.coyoteMs };`
    : `      var phys = { gravity: cfg.physics.gravity, jumpVelocity: cfg.physics.jumpVelocity, moveSpeed: 0,
                   accel: cfg.physics.accel, friction: 0, maxFall: cfg.physics.maxFall, coyoteMs: cfg.physics.coyoteMs };`}

      p.ducking = input.down('down');
      p.hh = p.ducking && p.onGround ? 10 : 19;

      var wasGround = p.onGround;
      LAB.physics.integrate(p, 0, wantJump, dt, phys);
      if (wasGround && !p.onGround) game.stats.jumps++;

      /* forward motion is automatic - that is the genre */
      p.x += game.speed * dt;
      game.distance = p.x - map.start.x;

      var ground = map.groundY;
      var overGap = false;
      ensureChunks();
      for (var ci = 0; ci < game.chunks.length; ci++) {
        var chunk = game.chunks[ci];
        for (var oi = 0; oi < chunk.obstacles.length; oi++) {
          var o = chunk.obstacles[oi];
          if (o.kind === 'gap' && p.x > o.x && p.x < o.x + o.w) overGap = true;
        }
      }
${twist === 'flip-gravity' ? `      var floorY = game.gravitySign > 0 ? ground : 120;
      if (game.gravitySign > 0 ? (p.y + p.hh >= floorY && !overGap) : (p.y - p.hh <= floorY)) {
        p.y = game.gravitySign > 0 ? floorY - p.hh : floorY + p.hh; p.vy = 0; p.onGround = true; p.jumping = false;
      } else p.onGround = false;`
    : `      if (p.y + p.hh >= ground && !overGap) { p.y = ground - p.hh; p.vy = 0; p.onGround = true; p.jumping = false; }
      else p.onGround = false;`}

      if (p.y > map.groundY + 320 || p.y < -320) { hit('Fell into a gap'); if (game.status === 'playing') { p.y = map.start.y; p.vy = 0; } }

      /* obstacle collisions + near-miss detection (feeds the combo) */
      var box = { x: p.x - p.hw, y: p.y - p.hh, w: p.hw * 2, h: p.hh * 2 };
      for (var c2 = 0; c2 < game.chunks.length; c2++) {
        var ch = game.chunks[c2];
        for (var k = 0; k < ch.obstacles.length; k++) {
          var ob = ch.obstacles[k];
          if (ob.kind === 'gap' || ob.cleared) continue;
          if (M.rectOverlap(box, ob)) { hit('Hit an obstacle'); ob.cleared = true; continue; }
          if (!ob.passed && ob.x + ob.w < p.x - p.hw) {
            ob.passed = true;
            var gapY = Math.abs((ob.y + ob.h / 2) - p.y);
            if (gapY < 60) {
              game.nearMisses++;
${twist === 'combo' ? `              game.combo = Math.min(cfg.twist.comboMax, game.combo + cfg.twist.comboStep);
              game.comboTimer = cfg.twist.comboWindow;
              ctx.ui && ctx.ui.toast('Close!', 500);` : ''}
              game.score += 5;
            }
          }
        }
        for (var ki = 0; ki < ch.coins.length; ki++) {
          var coin = ch.coins[ki];
          if (coin.taken) continue;
          if (M.dist2(p.x, p.y, coin.x, coin.y) < (coin.r + p.hw) * (coin.r + p.hw)) {
            coin.taken = true;
            game.stats.coins++;
            game.score += Math.round(cfg.scoring.pickup * game.combo);
            audio.play('pickup');
            particles.emit(coin.x, coin.y, { count: 8, speed: 120, life: 0.35, color: cfg.palette[2], size: 2 });
${twist === 'resource-drain' || twist === 'light-radius' ? `            game.resource = Math.min(1, game.resource + cfg.twist.pickupRestore);` : ''}
          }
        }
      }

      game.score += game.speed * dt * 0.05 * game.combo;
${twist === 'combo' ? `      if (game.comboTimer > 0) { game.comboTimer -= dt; if (game.comboTimer <= 0) game.combo = 1; }` : ''}
${twist === 'resource-drain' || twist === 'light-radius' ? `      game.resource = Math.max(0, game.resource - cfg.twist.drainPerSecond * dt);
      if (game.resource <= 0) { game.status = 'lost'; game.reason = 'Power ran out'; }` : ''}
${twist === 'shrink-bounds' ? `      game.ceiling = 60 + Math.min(200, game.elapsed * 3);
      if (p.y - p.hh < game.ceiling) hit('Crushed by the closing ceiling');` : ''}

${win.type === 'distance' ? `      /* endless: no win state, the score is the result */`
    : win.type === 'survive' ? `      if (game.elapsed >= ${win.seconds || 90}) { game.status = 'won'; game.reason = 'Survived the run'; audio.play('win'); }`
    : `      if (game.score >= ${win.target || 1500}) { game.status = 'won'; game.reason = 'Target reached'; audio.play('win'); }`}

      camera.targetY = map.groundY - 120;
      camera.follow({ x: p.x + 180, y: map.groundY - 120, vx: game.speed, vy: 0 }, dt);
      world.sweep();
    };

    game.render = function (r, alpha) {
      var p = game.player;
      camera.apply(r.ctx);

      /* ground + parallax stripes */
      r.rect(camera.x - 900, map.groundY, 2400, 300, cfg.palette[3]);
      r.ctx.globalAlpha = 0.2;
      for (var s = -900; s < 1500; s += 120) {
        var sx = Math.floor((camera.x * 0.4 + s) / 120) * 120;
        r.rect(sx, map.groundY - 240, 60, 240, cfg.palette[3]);
      }
      r.ctx.globalAlpha = 1;
${twist === 'shrink-bounds' ? `      if (game.ceiling) r.rect(camera.x - 900, game.ceiling - 200, 2400, 200, cfg.palette[4]);` : ''}

      for (var ci = 0; ci < game.chunks.length; ci++) {
        var ch = game.chunks[ci];
        for (var oi = 0; oi < ch.obstacles.length; oi++) {
          var o = ch.obstacles[oi];
          if (o.kind === 'gap') r.rect(o.x, o.y, o.w, o.h, cfg.palette[0]);
          else r.rect(o.x, o.y, o.w, o.h, o.kind === 'high' ? cfg.palette[4] : cfg.palette[2]);
        }
        for (var ki = 0; ki < ch.coins.length; ki++) {
          var coin = ch.coins[ki];
          if (coin.taken) continue;
          r.shape('diamond', coin.x, coin.y + Math.sin(game.elapsed * 4 + ki) * 3, coin.r, cfg.palette[2]);
        }
      }
      particles.render(r.ctx);
      if (p && p.alive) {
        var flash = p.invuln > 0 && Math.floor(p.invuln * 18) % 2 === 0;
        r.rect(p.x - p.hw, p.y - p.hh, p.hw * 2, p.hh * 2, flash ? cfg.palette[1] : cfg.palette[2]);
      }
      camera.restore(r.ctx);
${twist === 'light-radius' ? `      if (p) { var sp = camera.worldToScreen(p.x, p.y); r.lightMask(sp.x, sp.y, cfg.twist.lightBase + game.resource * cfg.twist.lightRange, 0.9); }` : ''}
      r.vignette(0.28);
    };

    game.hud = function () {
      return {
        score: Math.floor(game.score),
        health: game.player ? Math.max(0, game.player.hp) / game.player.maxHp : 0,
        timer: Math.floor(game.distance / 10) + 'm',
        combo: 'x' + game.combo.toFixed(1),
        resource: game.resource,
        fragile: 'ONE HIT',
        wave: game.nearMisses,
      };
    };

    game.onAction = function (name) { if (name === 'restart') game.reset(); };
    game.reset();
    return game;
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
}
