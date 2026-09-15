/**
 * Ruleset: PLATFORMER (side view, gravity, jump arcs).
 * Covers precision platformer and obstacle course.
 *
 * The level generator guarantees reachability: every gap is produced inside the
 * jump envelope implied by the tuned gravity/jump values, then validated, and
 * regenerated if validation fails.
 */

export function emitWorld(design) {
  return `/* game/world.js - procedural platform course with a reachability guarantee */
(function (global) {
  'use strict';
  var LAB = global.LAB;

  LAB.buildWorld = function (cfg, rng) {
    var w = cfg.world.width, h = cfg.world.height;
    var attempt = 0;
    var built = null;
    while (attempt++ < 12) {
      var gen = LAB.procgen.platforms(rng, {
        width: w, baseY: h - 120, minY: 140, minGap: 70,
        gapBias: cfg.world.gapBias || 0.45,
        gravity: cfg.physics.gravity, jumpVelocity: cfg.physics.jumpVelocity, moveSpeed: cfg.physics.moveSpeed,
      });
      var check = LAB.procgen.validatePlatforms(gen.platforms, gen.jumpWidth, gen.jumpHeight);
      if (check.ok) { built = gen; break; }
      /* Unreachable layout: reseed and try again rather than shipping a level
         the player cannot finish. */
    }
    if (!built) {
      /* Deterministic fallback: evenly spaced platforms that are always reachable. */
      var flat = [];
      for (var x = 0; x < w; x += 260) flat.push({ x: x, y: h - 120, w: 180, h: 22 });
      built = { platforms: flat, jumpWidth: 200, jumpHeight: 120 };
    }

    var platforms = built.platforms;
    var hazards = [];
    for (var i = 1; i < platforms.length - 1; i++) {
      if (!rng.chance(cfg.world.hazardChance || 0.28)) continue;
      var p = platforms[i];
      hazards.push({ x: p.x + p.w * 0.3, y: p.y - 14, w: Math.min(48, p.w * 0.4), h: 14 });
    }
    var collectibles = [];
    for (var c = 0; c < (cfg.world.collectibles || 8); c++) {
      var pl = platforms[1 + Math.floor(rng.next() * (platforms.length - 1))];
      collectibles.push({ x: pl.x + pl.w * rng.range(0.2, 0.8), y: pl.y - rng.range(28, 74), r: 9 });
    }
    var last = platforms[platforms.length - 1];
    return {
      platforms: platforms,
      hazards: hazards,
      collectibles: collectibles,
      goal: { x: last.x + last.w * 0.5, y: last.y - 34, w: 26, h: 44 },
      bounds: { x: -200, y: -400, w: w + 400, h: h + 600 },
      start: { x: platforms[0].x + 60, y: platforms[0].y - 40 },
      killY: h + 240,
      jumpWidth: built.jumpWidth,
      jumpHeight: built.jumpHeight,
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

export function emitRules(design) {
  const twist = design.twist.mechanic;
  const win = design.winCondition;
  const enemies = design.traits.enemies !== 'hazards-only';
  // A one-button scheme has no horizontal binding, so the character runs by
  // itself and the single button is the whole verb - a real design, and the
  // only way this control scheme produces a playable platformer.
  const autoRun = !design.controls.bindings?.left;
  return `/* game/rules.js - platformer ruleset for "${design.name}"
 * win: ${win.type} | twist: ${design.traits.twist}
 */
(function (global) {
  'use strict';
  var LAB = global.LAB;
  var M = LAB.math;

  LAB.createGame = function (ctx) {
    var cfg = ctx.cfg, world = ctx.world, input = ctx.input, camera = ctx.camera;
    var particles = ctx.particles, audio = ctx.audio, collision = ctx.collision;
    var map = LAB.buildWorld(cfg, ctx.rng);

    var game = {
      status: 'playing', score: 0, elapsed: 0, collected: 0, deaths: 0,
      combo: 1, comboTimer: 0, resource: 1, gravitySign: 1, map: map, player: null,
      stats: { jumps: 0, falls: 0, hits: 0 },
    };

    camera.bounds = { x: 0, y: -200, w: cfg.world.width, h: cfg.world.height + 200 };
${twist === 'ghost-replay' ? `    var ghost = { samples: [], playback: [], t: 0, recordT: 0 };
    try {
      var saved = ctx.save.data.ghost;
      if (saved && saved.length) ghost.playback = saved;
    } catch (err) { /* no previous run */ }` : ''}

    function spawnPlayer() {
      game.player = world.spawn('player', {
        x: map.start.x, y: map.start.y, hw: 12, hh: 18, r: 14,
        hp: cfg.player.hp, maxHp: cfg.player.hp, onGround: false, coyote: 0, invuln: 0,
      });
    }
${enemies ? `
    function spawnEnemies() {
      for (var i = 2; i < map.platforms.length; i += 3) {
        var p = map.platforms[i];
        if (p.w < 90) continue;
        world.spawn('enemy', {
          x: p.x + p.w * 0.5, y: p.y - 16, r: cfg.enemy.radius, hw: 11, hh: 14,
          hp: cfg.enemy.hp, dir: ctx.rng.chance(0.5) ? 1 : -1,
          minX: p.x + 12, maxX: p.x + p.w - 12, speed: cfg.enemy.speed * 0.4,
        });
      }
    }` : ''}

    function die(reason) {
      if (game.status !== 'playing') return;
      game.deaths++;
      audio.play('lose');
      particles.emit(game.player.x, game.player.y, { count: 20, speed: 220, life: 0.6, color: cfg.palette[4], size: 3, gravity: 600 });
${twist === 'one-hit' ? `      game.status = 'lost'; game.reason = reason || 'One hit was all it took';`
    : `      game.player.hp--;
      if (game.player.hp <= 0) { game.status = 'lost'; game.reason = reason || 'Out of health'; return; }
      game.player.x = map.start.x; game.player.y = map.start.y;
      game.player.vx = 0; game.player.vy = 0; game.player.invuln = 1;
${twist === 'combo' ? `      game.combo = 1;` : ''}`}
    }

    function winRun(reason) {
      if (game.status !== 'playing') return;
      game.status = 'won';
      game.reason = reason;
      audio.play('win');
${twist === 'ghost-replay' ? `      try { ctx.save.data.ghost = ghost.samples.slice(0, 4000); ctx.save.save(); } catch (err) { /* storage full */ }` : ''}
    }

    game.reset = function () {
      world.clear(); particles.clear();
      game.status = 'playing'; game.score = 0; game.elapsed = 0; game.collected = 0;
      game.combo = 1; game.comboTimer = 0; game.resource = 1; game.gravitySign = 1;
      game.stats = { jumps: 0, falls: 0, hits: 0 };
      map.collectibles.forEach(function (c) { c.taken = false; });
      spawnPlayer();
${enemies ? `      spawnEnemies();` : ''}
${twist === 'ghost-replay' ? `      ghost.samples = []; ghost.t = 0; ghost.recordT = 0;` : ''}
      camera.x = game.player.x; camera.y = game.player.y;
    };

    game.update = function (dt) {
      if (game.status !== 'playing') return;
      game.elapsed += dt;
      var p = game.player;
      p.invuln = Math.max(0, p.invuln - dt);

${autoRun ? `      /* auto-run: the single button is reserved for jumping */
      var ax = 1;`
    : `      var ax = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);`}
${!autoRun && design.controls.mobile?.virtualStick ? `      var stick = input.axis();
      if (Math.abs(stick.x) > 0.2) ax = stick.x;` : ''}
      var wantJump = input.down('action') || input.buffered('action', false);

${twist === 'flip-gravity' ? `      if (input.pressed('secondary') || input.pressed('down')) {
        game.gravitySign *= -1;
        p.vy = 0;
        audio.play('action');
        particles.emit(p.x, p.y, { count: 12, speed: 140, life: 0.4, color: cfg.palette[3], size: 3 });
      }
      var flipCfg = { gravity: cfg.physics.gravity * game.gravitySign, jumpVelocity: cfg.physics.jumpVelocity * game.gravitySign,
                      moveSpeed: cfg.physics.moveSpeed, accel: cfg.physics.accel, friction: cfg.physics.friction,
                      maxFall: cfg.physics.maxFall, coyoteMs: cfg.physics.coyoteMs };
      var phys = flipCfg;` : `      var phys = cfg.physics;`}
${twist === 'time-scale' ? `      ctx.loop.timeScale = (input.down('secondary') && game.resource > 0) ? cfg.twist.slowFactor : 1;
      if (input.down('secondary')) game.resource = Math.max(0, game.resource - cfg.twist.drainPerSecond * dt);
      else game.resource = Math.min(1, game.resource + cfg.twist.rechargePerSecond * dt);` : ''}

      var prevY = p.y;
      var wasGround = p.onGround;
      LAB.physics.integrate(p, ax, wantJump, dt, phys);
      if (!wasGround && p.vy < 0) game.stats.jumps++;

      p.onGround = collision.resolveRects(p, map.platforms, p.x, prevY);
${twist === 'flip-gravity' ? `      if (game.gravitySign < 0 && p.vy < 0) p.onGround = collision.resolveRects(p, map.platforms, p.x, prevY) || p.onGround;` : ''}
      if (p.onGround && !wasGround) {
        particles.emit(p.x, p.y + p.hh, { count: 6, speed: 90, life: 0.25, color: cfg.palette[3], size: 2, angle: -Math.PI / 2, spread: 2 });
      }

      if (p.y > map.killY || p.y < -map.killY) { game.stats.falls++; die('Fell out of the world'); return; }
      p.x = M.clamp(p.x, 4, cfg.world.width - 4);

      /* hazards */
      for (var i = 0; i < map.hazards.length; i++) {
        var hz = map.hazards[i];
        if (p.invuln <= 0 && M.rectOverlap({ x: p.x - p.hw, y: p.y - p.hh, w: p.hw * 2, h: p.hh * 2 }, hz)) { die('Touched a hazard'); return; }
      }

      /* collectibles */
      for (var c = 0; c < map.collectibles.length; c++) {
        var col = map.collectibles[c];
        if (col.taken) continue;
        if (M.dist2(p.x, p.y, col.x, col.y) < (col.r + p.hw) * (col.r + p.hw)) {
          col.taken = true;
          game.collected++;
          game.score += Math.round(cfg.scoring.pickup * game.combo);
${twist === 'combo' ? `          game.combo = Math.min(cfg.twist.comboMax, game.combo + cfg.twist.comboStep); game.comboTimer = cfg.twist.comboWindow;` : ''}
          audio.play('pickup');
          particles.emit(col.x, col.y, { count: 10, speed: 120, life: 0.4, color: cfg.palette[2], size: 2 });
        }
      }
${twist === 'combo' ? `      if (game.comboTimer > 0) { game.comboTimer -= dt; if (game.comboTimer <= 0) game.combo = 1; }` : ''}
${twist === 'light-radius' ? `      game.resource = Math.max(0, game.resource - cfg.twist.drainPerSecond * dt);
      if (game.resource <= 0) die('The light went out');` : ''}
${enemies ? `
      world.each('enemy', function (e) {
        e.x += e.dir * e.speed * dt;
        if (e.x < e.minX) { e.x = e.minX; e.dir = 1; }
        if (e.x > e.maxX) { e.x = e.maxX; e.dir = -1; }
        if (p.invuln <= 0 && M.rectOverlap({ x: p.x - p.hw, y: p.y - p.hh, w: p.hw * 2, h: p.hh * 2 }, { x: e.x - e.hw, y: e.y - e.hh, w: e.hw * 2, h: e.hh * 2 })) {
          /* stomping from above kills the enemy, otherwise it hurts */
          if (p.vy > 60 && p.y < e.y - 4) { world.kill(e); p.vy = -cfg.physics.jumpVelocity * 0.6; game.score += cfg.scoring.kill; audio.play('hit', { pitch: 1.4 }); }
          else { game.stats.hits++; die('Hit by a patrol'); }
        }
      });` : ''}
${twist === 'ghost-replay' ? `      ghost.recordT += dt;
      if (ghost.recordT >= 1 / cfg.twist.sampleHz) {
        ghost.recordT = 0;
        ghost.samples.push([Math.round(p.x), Math.round(p.y)]);
      }
      ghost.t += dt;
      var gi = Math.floor(ghost.t * cfg.twist.sampleHz);
      game.ghostPos = ghost.playback[gi] || null;` : ''}

      /* goal */
${win.type === 'reach' ? `      if (M.rectOverlap({ x: p.x - p.hw, y: p.y - p.hh, w: p.hw * 2, h: p.hh * 2 }, map.goal)) {
        game.score += Math.max(0, Math.round(cfg.scoring.level - game.elapsed * 4));
        winRun('Reached the exit in ' + game.elapsed.toFixed(1) + 's');
      }`
    : win.type === 'collect' ? `      if (game.collected >= map.collectibles.length) winRun('Collected everything');`
    : `      if (game.score >= ${win.target || 800}) winRun('Target score reached');`}

      camera.follow(p, dt);
      world.sweep();
    };

    game.render = function (r, alpha) {
      var p = game.player;
      camera.apply(r.ctx);

      /* parallax background bands */
      for (var b = 0; b < 3; b++) {
        var depth = 0.25 + b * 0.25;
        var y = cfg.world.height - 60 - b * 90;
        r.ctx.globalAlpha = 0.12 + b * 0.05;
        r.rect(camera.x * (1 - depth) - 1200, y, 4000, 300, cfg.palette[3]);
      }
      r.ctx.globalAlpha = 1;

      for (var i = 0; i < map.platforms.length; i++) {
        var pl = map.platforms[i];
        r.rect(pl.x, pl.y, pl.w, pl.h, cfg.palette[3]);
        r.rect(pl.x, pl.y, pl.w, 3, cfg.palette[2]);
      }
      for (var hz = 0; hz < map.hazards.length; hz++) {
        var hazard = map.hazards[hz];
        r.rect(hazard.x, hazard.y, hazard.w, hazard.h, cfg.palette[4]);
      }
      for (var c = 0; c < map.collectibles.length; c++) {
        var col = map.collectibles[c];
        if (col.taken) continue;
        r.shape('diamond', col.x, col.y + Math.sin(game.elapsed * 3 + c) * 3, col.r, cfg.palette[2]);
      }
      r.rect(map.goal.x - map.goal.w / 2, map.goal.y, map.goal.w, map.goal.h, cfg.palette[2]);
      r.strokeRect(map.goal.x - map.goal.w / 2, map.goal.y, map.goal.w, map.goal.h, cfg.palette[1], 2);
${enemies ? `      world.each('enemy', function (e) { r.shape('square', e.x, e.y, e.r, cfg.palette[4]); });` : ''}
${twist === 'ghost-replay' ? `      if (game.ghostPos) { r.ctx.globalAlpha = 0.4; r.shape('capsule', game.ghostPos[0], game.ghostPos[1], 14, cfg.palette[1]); r.ctx.globalAlpha = 1; }` : ''}
      particles.render(r.ctx);

      if (p && p.alive) {
        var flash = p.invuln > 0 && Math.floor(p.invuln * 18) % 2 === 0;
        r.rect(p.x - p.hw, p.y - p.hh, p.hw * 2, p.hh * 2, flash ? cfg.palette[1] : cfg.palette[2]);
        var eyeX = p.x + (p.vx >= 0 ? 4 : -4);
        r.rect(eyeX - 2, p.y - 8, 4, 4, cfg.palette[0]);
      }

      camera.restore(r.ctx);
${twist === 'light-radius' ? `      if (p) { var s = camera.worldToScreen(p.x, p.y); r.lightMask(s.x, s.y, cfg.twist.lightBase + game.resource * cfg.twist.lightRange, 0.93); }` : ''}
      r.vignette(0.3);
    };

    game.hud = function () {
      return {
        score: game.score,
        health: game.player ? Math.max(0, game.player.hp) / game.player.maxHp : 0,
        timer: game.elapsed.toFixed(1),
        resource: game.resource,
        combo: 'x' + game.combo.toFixed(1),
        moves: game.collected + '/' + map.collectibles.length,
        fragile: 'ONE HIT',
        wave: game.deaths,
      };
    };

    game.onAction = function (name) { if (name === 'restart') game.reset(); };
    game.reset();
    return game;
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
}
