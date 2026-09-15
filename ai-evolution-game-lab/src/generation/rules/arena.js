/**
 * Ruleset: ARENA (top-down action).
 * Covers arena-survival, twin-stick, wave defense, survival gathering.
 *
 * Emits real gameplay: player movement + attack, enemy AI per behaviour,
 * wave progression, pickups, scoring, win/lose evaluation, and whichever twist
 * modifier the design selected.
 */

export function emitWorld(design) {
  const wrap = design.traits.world === 'wrapping-field';
  return `/* game/world.js - arena layout */
(function (global) {
  'use strict';
  var LAB = global.LAB;
  LAB.buildWorld = function (cfg, rng) {
    var w = cfg.world.width, h = cfg.world.height;
    var obstacles = [];
    for (var i = 0; i < (cfg.world.obstacles || 0); i++) {
      var ow = rng.range(40, 140), oh = rng.range(40, 140);
      obstacles.push({
        x: rng.range(80, w - ow - 80), y: rng.range(80, h - oh - 80),
        w: ow, h: oh, kind: rng.chance(0.3) ? 'hazard' : 'block',
      });
    }
    /* Keep the spawn area clear so the player never starts inside geometry. */
    var cx = w / 2, cy = h / 2;
    obstacles = obstacles.filter(function (o) {
      return !(cx > o.x - 90 && cx < o.x + o.w + 90 && cy > o.y - 90 && cy < o.y + o.h + 90);
    });
    return {
      bounds: { x: 0, y: 0, w: w, h: h },
      boundsMode: ${wrap ? "'wrap'" : "'clamp'"},
      obstacles: obstacles,
      spawnPoints: [
        { x: 60, y: 60 }, { x: w - 60, y: 60 }, { x: 60, y: h - 60 }, { x: w - 60, y: h - 60 },
        { x: w / 2, y: 40 }, { x: w / 2, y: h - 40 }, { x: 40, y: h / 2 }, { x: w - 40, y: h / 2 },
      ],
      start: { x: cx, y: cy },
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

export function emitRules(design) {
  const t = design.traits;
  const twist = design.twist.mechanic;
  const behaviour = (design.entities.find((e) => e.role === 'enemy') || {}).behaviour || 'seek';
  const hasEnemies = t.enemies !== 'hazards-only';
  const aimPointer = design.controls.pointerAim;
  const win = design.winCondition;
  const hasCore = win.type === 'defend' || t.objective === 'protect-core';

  return `/* game/rules.js - ${design.ruleset} ruleset for "${design.name}"
 * objective: ${win.type} | enemies: ${t.enemies} | twist: ${t.twist}
 */
(function (global) {
  'use strict';
  var LAB = global.LAB;
  var M = LAB.math;

  LAB.createGame = function (ctx) {
    var cfg = ctx.cfg;
    var world = ctx.world;         /* entity store */
    var map = LAB.buildWorld(cfg, ctx.rng);
    var input = ctx.input;
    var collision = ctx.collision;
    var particles = ctx.particles;
    var audio = ctx.audio;
    var camera = ctx.camera;

    var game = {
      status: 'playing',
      score: 0,
      combo: 1,
      comboTimer: 0,
      wave: 0,
      waveTimer: 0,
      spawnTimer: 0,
      elapsed: 0,
      resource: 1,
      collected: 0,
      collectTarget: 0,
      map: map,
      player: null,
      core: null,
      stats: { shots: 0, kills: 0, hits: 0, pickups: 0 },
    };

    camera.bounds = map.bounds;

    function spawnPlayer() {
      var p = world.spawn('player', {
        x: map.start.x, y: map.start.y, r: ${design.entities[0].radius || 12},
        hp: cfg.player.hp, maxHp: cfg.player.hp, cooldown: 0, facing: 0, charge: 0, invuln: 0,
      });
      game.player = p;
      return p;
    }
${hasCore ? `
    function spawnCore() {
      game.core = world.spawn('core', {
        x: map.bounds.w / 2, y: map.bounds.h / 2, r: 26,
        hp: cfg.core.hp, maxHp: cfg.core.hp,
      });
    }` : ''}

    function spawnEnemy(stage) {
      var pt = map.spawnPoints[ctx.rng.int(0, map.spawnPoints.length - 1)];
      var e = world.spawn('enemy', {
        x: pt.x, y: pt.y, r: cfg.enemy.radius,
        hp: Math.ceil(cfg.enemy.hp * (1 + stage * 0.18)),
        speed: cfg.enemy.speed * (stage ? cfg.progression.stages[Math.min(stage, cfg.progression.stages.length - 1)].enemySpeed : 1),
        fireTimer: ctx.rng.range(0.4, 1.8),
        wanderAngle: ctx.rng.range(0, Math.PI * 2),
${behaviour === 'spawn-nest' ? `        nest: ctx.rng.chance(0.28), spawnTimer: 2.2,` : ''}
      });
      return e;
    }

    function spawnPickup() {
      var b = map.bounds;
      world.spawn('pickup', {
        x: ctx.rng.range(b.x + 40, b.x + b.w - 40),
        y: ctx.rng.range(b.y + 40, b.y + b.h - 40),
        r: 9, kind: ${t.rewards === 'powerup-drops' ? "ctx.rng.chance(0.35) ? 'power' : 'score'" : "'score'"},
        bob: ctx.rng.range(0, 6.28),
      });
    }

    function fire(px, py, angle) {
      game.stats.shots++;
      var speed = cfg.player.projectileSpeed${twist === 'charge' ? ' * (0.7 + game.player.charge * 0.9)' : ''};
      world.spawn('bullet', {
        x: px, y: py, r: ${twist === 'charge' ? '4 + (game.player.charge || 0) * 6' : '4'},
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: cfg.player.projectileLife,
        damage: cfg.player.damage${twist === 'charge' ? ' * (1 + (game.player.charge || 0) * 1.8)' : ''},
      });
      audio.play('action');
      particles.emit(px, py, { count: 4, angle: angle + Math.PI, spread: 0.8, speed: 90, life: 0.22, color: cfg.palette[2], size: 2 });
    }

    function addScore(n) {
      game.score += Math.round(n * game.combo);
${twist === 'combo' ? `      game.combo = Math.min(cfg.twist.comboMax, game.combo + cfg.twist.comboStep);
      game.comboTimer = cfg.twist.comboWindow;` : ''}
    }

    function damagePlayer(amount) {
      var p = game.player;
      if (!p || p.invuln > 0 || game.status !== 'playing') return;
      p.hp -= amount;
      p.invuln = cfg.player.invulnSeconds;
      camera.kick(0.5);
      audio.play('hit');
      particles.emit(p.x, p.y, { count: 14, speed: 180, life: 0.5, color: cfg.palette[4], size: 3 });
${twist === 'combo' ? `      game.combo = 1;` : ''}
      if (p.hp <= 0) lose('You were overwhelmed');
    }

    function lose(reason) {
      if (game.status !== 'playing') return;
      game.status = 'lost';
      game.reason = reason;
      audio.play('lose');
    }
    function win(reason) {
      if (game.status !== 'playing') return;
      game.status = 'won';
      game.reason = reason;
      audio.play('win');
    }

    game.reset = function () {
      world.clear();
      particles.clear();
      game.status = 'playing';
      game.score = 0; game.combo = 1; game.comboTimer = 0;
      game.wave = 0; game.waveTimer = 0; game.spawnTimer = 0.6;
      game.elapsed = 0; game.resource = 1; game.collected = 0;
      game.stats = { shots: 0, kills: 0, hits: 0, pickups: 0 };
      spawnPlayer();
${hasCore ? `      spawnCore();` : ''}
      for (var i = 0; i < cfg.pickups.initial; i++) spawnPickup();
      game.collectTarget = ${win.type === 'collect' ? 'cfg.pickups.initial' : '0'};
      map.shrink = 0;
      camera.x = game.player.x; camera.y = game.player.y;
    };

    game.update = function (dt) {
      if (game.status !== 'playing') return;
      game.elapsed += dt;
      var p = game.player;
      if (!p) return;
      p.invuln = Math.max(0, p.invuln - dt);
      p.cooldown = Math.max(0, p.cooldown - dt);

      /* ---- player movement ---- */
      var axis = input.axis();
      LAB.physics.integrate(p, axis.x, axis.y, dt, cfg.physics);
      if (axis.x || axis.y) p.facing = Math.atan2(axis.y, axis.x);
${aimPointer ? `      var wp = camera.screenToWorld(input.pointer.x, input.pointer.y);
      p.aim = Math.atan2(wp.y - p.y, wp.x - p.x);` : `      p.aim = p.facing;`}

      /* ---- attack ---- */
${twist === 'charge' ? `      if (input.down('action')) {
        p.charge = Math.min(1, (p.charge || 0) + dt / cfg.twist.chargeSeconds);
      } else if (p.charge > 0.12 && p.cooldown <= 0) {
        fire(p.x, p.y, p.aim);
        p.cooldown = cfg.player.cooldown;
        p.charge = 0;
      } else if (!input.down('action')) { p.charge = 0; }`
    : twist === 'beat-window' ? `      game.beat = (game.elapsed % cfg.twist.beatSeconds) / cfg.twist.beatSeconds;
      var onBeat = game.beat < cfg.twist.beatWindow || game.beat > 1 - cfg.twist.beatWindow;
      if ((input.pressed('action') || input.buffered('action')) && p.cooldown <= 0) {
        fire(p.x, p.y, p.aim);
        p.cooldown = onBeat ? cfg.player.cooldown * 0.45 : cfg.player.cooldown;
        if (onBeat) { addScore(2); ctx.ui && ctx.ui.toast('On beat!', 500); }
      }`
    : `      if (input.down('action') && p.cooldown <= 0) {
        fire(p.x, p.y, p.aim);
        p.cooldown = cfg.player.cooldown;
      }`}

      /* ---- twist modifiers ---- */
${twist === 'shrink-bounds' ? `      map.shrink = Math.min(cfg.twist.maxShrink, map.shrink + cfg.twist.shrinkRate * dt);
      var inset = map.shrink;
      var safe = { x: inset, y: inset, w: map.bounds.w - inset * 2, h: map.bounds.h - inset * 2 };
      game.safeZone = safe;
      if (p.x < safe.x || p.x > safe.x + safe.w || p.y < safe.y || p.y > safe.y + safe.h) {
        damagePlayer(cfg.twist.outsideDamage * dt * 10);
      }` : ''}
${twist === 'resource-drain' || twist === 'light-radius' ? `      game.resource = Math.max(0, game.resource - cfg.twist.drainPerSecond * dt);
      if (game.resource <= 0) lose('Power ran out');` : ''}
${twist === 'time-scale' ? `      ctx.loop.timeScale = input.down('secondary') && game.resource > 0 ? cfg.twist.slowFactor : 1;
      if (input.down('secondary')) game.resource = Math.max(0, game.resource - cfg.twist.drainPerSecond * dt);
      else game.resource = Math.min(1, game.resource + cfg.twist.rechargePerSecond * dt);` : ''}
${twist === 'combo' ? `      if (game.comboTimer > 0) { game.comboTimer -= dt; if (game.comboTimer <= 0) game.combo = 1; }` : ''}
${twist === 'terrain-mutation' ? `      game.mutateTimer = (game.mutateTimer || 0) - dt;
      if (game.mutateTimer <= 0 && map.obstacles.length) {
        game.mutateTimer = cfg.twist.mutateInterval;
        var o = map.obstacles[ctx.rng.int(0, map.obstacles.length - 1)];
        o.kind = o.kind === 'hazard' ? 'block' : 'hazard';
        particles.emit(o.x + o.w / 2, o.y + o.h / 2, { count: 10, speed: 70, life: 0.6, color: cfg.palette[3], size: 3 });
      }` : ''}

      LAB.physics.applyBounds(p, map.bounds, map.boundsMode);
      resolveObstacles(p, dt);

      /* ---- waves ---- */
      updateWaves(dt);

      /* ---- entities ---- */
      world.each('bullet', function (b) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.life -= dt;
        if (b.life <= 0) world.kill(b);
        if (b.x < map.bounds.x - 40 || b.x > map.bounds.w + 40 || b.y < map.bounds.y - 40 || b.y > map.bounds.h + 40) world.kill(b);
      });
${hasEnemies ? `
      world.each('enemy', function (e) {
        e.age += dt;
        updateEnemy(e, dt);
        LAB.physics.applyBounds(e, map.bounds, 'clamp');
      });` : ''}

      world.each('pickup', function (pk) {
        pk.age += dt;
        pk.bob += dt * 3;
      });

      /* ---- collisions ---- */
      var bullets = world.get('bullet');
${hasEnemies ? `      collision.pairs(bullets, world.get('enemy'), dt, function (b, e) {
        if (!b.alive || !e.alive) return;
        world.kill(b);
        e.hp -= b.damage;
        game.stats.hits++;
        particles.emit(e.x, e.y, { count: 8, speed: 140, life: 0.35, color: cfg.palette[2], size: 2.5 });
        if (e.hp <= 0) {
          world.kill(e);
          game.stats.kills++;
          addScore(cfg.scoring.kill);
          audio.play('hit', { pitch: 1.6 });
          particles.emit(e.x, e.y, { count: 18, speed: 210, life: 0.55, color: cfg.palette[4], size: 3 });
          if (ctx.rng.chance(cfg.pickups.dropChance)) {
            world.spawn('pickup', { x: e.x, y: e.y, r: 9, kind: 'score', bob: 0 });
          }
        }
      });

      collision.pairs([p], world.get('enemy'), dt, function (pl, e) {
        damagePlayer(cfg.enemy.contactDamage);
        if (cfg.enemy.diesOnContact) { world.kill(e); }
      });

      collision.pairs(world.get('ebullet'), [p], dt, function (b) {
        world.kill(b);
        damagePlayer(cfg.enemy.shotDamage);
      });
      world.each('ebullet', function (b) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        if (b.life <= 0) world.kill(b);
      });` : ''}
${hasCore ? `      collision.pairs(world.get('enemy'), [game.core], dt, function (e) {
        world.kill(e);
        game.core.hp -= 1;
        camera.kick(0.7);
        audio.play('hit');
        if (game.core.hp <= 0) lose('The core was destroyed');
      });` : ''}

      collision.pairs([p], world.get('pickup'), dt, function (pl, pk) {
        world.kill(pk);
        game.stats.pickups++;
        game.collected++;
        audio.play('pickup');
        addScore(cfg.scoring.pickup);
        particles.emit(pk.x, pk.y, { count: 10, speed: 130, life: 0.4, color: cfg.palette[3], size: 2 });
        if (pk.kind === 'power') {
          p.hp = Math.min(p.maxHp, p.hp + 1);
${twist === 'resource-drain' || twist === 'light-radius' ? `          game.resource = Math.min(1, game.resource + cfg.twist.pickupRestore);` : ''}
          ctx.ui && ctx.ui.toast('Power up');
        }
${twist === 'resource-drain' || twist === 'light-radius' ? `        else game.resource = Math.min(1, game.resource + cfg.twist.pickupRestore * 0.4);` : ''}
        if (world.count('pickup') < cfg.pickups.minimum) spawnPickup();
      });

      checkObjective();
      world.sweep();
    };

    function resolveObstacles(e, dt) {
      for (var i = 0; i < map.obstacles.length; i++) {
        var o = map.obstacles[i];
        if (!M.circleRect(e, o)) continue;
        if (o.kind === 'hazard') { damagePlayer(1); continue; }
        /* push out along the shallowest axis */
        var cx = M.clamp(e.x, o.x, o.x + o.w);
        var cy = M.clamp(e.y, o.y, o.y + o.h);
        var dx = e.x - cx, dy = e.y - cy;
        var d = Math.hypot(dx, dy) || 0.001;
        var push = e.r - d;
        if (push > 0) { e.x += (dx / d) * push; e.y += (dy / d) * push; e.vx *= 0.6; e.vy *= 0.6; }
      }
    }
${hasEnemies ? `
    function updateEnemy(e, dt) {
      var p = game.player;
      if (!p) return;
${behaviour === 'keep-distance-and-fire' ? `      var d = LAB.ai.standOff(e, p.x, p.y, dt, e.speed, cfg.enemy.preferredRange);
      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && d < cfg.enemy.preferredRange * 1.6) {
        e.fireTimer = cfg.enemy.fireInterval;
        var a = Math.atan2(p.y - e.y, p.x - e.x);
        world.spawn('ebullet', { x: e.x, y: e.y, r: 4, vx: Math.cos(a) * cfg.enemy.shotSpeed, vy: Math.sin(a) * cfg.enemy.shotSpeed, life: 3 });
      }`
    : behaviour === 'patrol-vision' ? `      if (!e.route) {
        e.route = [];
        for (var i = 0; i < 3; i++) e.route.push({ x: ctx.rng.range(60, map.bounds.w - 60), y: ctx.rng.range(60, map.bounds.h - 60) });
        e.routeIndex = 0;
      }
      if (LAB.ai.canSee(e, p, cfg.enemy.visionRange, cfg.enemy.visionAngle)) {
        e.alerted = 1.5;
      }
      if (e.alerted > 0) { e.alerted -= dt; LAB.ai.seek(e, p.x, p.y, dt, e.speed * 1.25); }
      else LAB.ai.patrol(e, dt, e.speed * 0.7);`
    : behaviour === 'spawn-nest' ? `      if (e.nest) {
        e.spawnTimer -= dt;
        if (e.spawnTimer <= 0 && world.count('enemy') < cfg.enemy.maxAlive) {
          e.spawnTimer = cfg.enemy.nestInterval;
          var child = world.spawn('enemy', { x: e.x + ctx.rng.range(-20, 20), y: e.y + ctx.rng.range(-20, 20), r: cfg.enemy.radius * 0.8, hp: 1, speed: e.speed * 1.2, nest: false });
          if (child) particles.emit(e.x, e.y, { count: 6, speed: 80, life: 0.3, color: cfg.palette[4], size: 2 });
        }
        LAB.ai.wander(e, dt, e.speed * 0.3, ctx.rng);
      } else {
        LAB.ai.seek(e, p.x, p.y, dt, e.speed);
      }`
    : `      LAB.ai.seek(e, p.x, p.y, dt, e.speed);`}
    }` : ''}

    function updateWaves(dt) {
      var stages = cfg.progression.stages;
      var stage = stages[Math.min(game.wave, stages.length - 1)];
${hasEnemies ? `      game.spawnTimer -= dt;
      if (game.spawnTimer <= 0 && world.count('enemy') < cfg.enemy.maxAlive) {
        game.spawnTimer = Math.max(0.25, stage.spawnInterval);
        spawnEnemy(game.wave);
      }
      game.waveTimer += dt;
      if (game.waveTimer >= (stage.durationSec || cfg.waveSeconds)) {
        game.waveTimer = 0;
        game.wave++;
        if (game.wave < stages.length) {
          ctx.ui && ctx.ui.toast(stages[game.wave].label);
          addScore(stage.reward);
        }
      }` : `      game.waveTimer += dt;`}
      if (world.count('pickup') < cfg.pickups.minimum) spawnPickup();
    }

    function checkObjective() {
${win.type === 'survive' ? `      if (game.elapsed >= ${win.seconds}) win('You survived ${win.seconds} seconds');`
    : win.type === 'waves' ? `      if (game.wave >= cfg.progression.stages.length) win('All waves cleared');`
    : win.type === 'defend' ? `      if (game.wave >= cfg.progression.stages.length && game.core && game.core.hp > 0) win('The core held');`
    : win.type === 'collect' ? `      if (game.collected >= game.collectTarget && game.collectTarget > 0) win('Everything collected');`
    : `      if (game.score >= ${win.target || 1000}) win('Target score reached');`}
    }

    game.render = function (r, alpha) {
      var p = game.player;
      camera.follow(p, 1 / 60);
      camera.apply(r.ctx);

      /* arena floor + grid */
      r.rect(map.bounds.x, map.bounds.y, map.bounds.w, map.bounds.h, cfg.palette[0]);
      r.ctx.globalAlpha = 0.16;
      for (var gx = 0; gx <= map.bounds.w; gx += 80) r.line(gx, 0, gx, map.bounds.h, cfg.palette[3], 1);
      for (var gy = 0; gy <= map.bounds.h; gy += 80) r.line(0, gy, map.bounds.w, gy, cfg.palette[3], 1);
      r.ctx.globalAlpha = 1;
      r.strokeRect(map.bounds.x, map.bounds.y, map.bounds.w, map.bounds.h, cfg.palette[3], 3);
${twist === 'shrink-bounds' ? `      if (game.safeZone) r.strokeRect(game.safeZone.x, game.safeZone.y, game.safeZone.w, game.safeZone.h, cfg.palette[4], 2);` : ''}

      for (var i = 0; i < map.obstacles.length; i++) {
        var o = map.obstacles[i];
        r.rect(o.x, o.y, o.w, o.h, o.kind === 'hazard' ? cfg.palette[4] : cfg.palette[3]);
      }

      world.each('pickup', function (pk) {
        r.shape('diamond', pk.x, pk.y + Math.sin(pk.bob) * 3, pk.r, pk.kind === 'power' ? cfg.palette[3] : cfg.palette[2]);
      });
${hasCore ? `      if (game.core && game.core.alive) {
        r.shape('hex', game.core.x, game.core.y, game.core.r, cfg.palette[3]);
        r.bar(game.core.x, game.core.y - game.core.r - 12, 60, 5, game.core.hp / game.core.maxHp, cfg.palette[2]);
      }` : ''}
${hasEnemies ? `      world.each('enemy', function (e) {
        r.shape(${behaviour === 'patrol-vision' ? "'square'" : behaviour === 'keep-distance-and-fire' ? "'cross'" : "'triangle'"}, e.x, e.y, e.r, ${behaviour === 'patrol-vision' ? "(e.alerted > 0 ? cfg.palette[4] : cfg.palette[3])" : 'cfg.palette[4]'}, e.facing || 0);
      });
      world.each('ebullet', function (b) { r.circle(b.x, b.y, b.r, cfg.palette[4]); });` : ''}
      world.each('bullet', function (b) { r.circle(b.x, b.y, b.r, cfg.palette[2]); });

      particles.render(r.ctx);

      if (p && p.alive) {
        var flash = p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0;
        r.shape('capsule', p.x, p.y, p.r, flash ? cfg.palette[1] : cfg.palette[2], p.aim || 0);
        r.line(p.x, p.y, p.x + Math.cos(p.aim || 0) * (p.r + 14), p.y + Math.sin(p.aim || 0) * (p.r + 14), cfg.palette[1], 2);
${twist === 'charge' ? `        if (p.charge > 0.05) r.ring(p.x, p.y, p.r + 6 + p.charge * 10, cfg.palette[3], 2);` : ''}
      }

      camera.restore(r.ctx);
${twist === 'light-radius' ? `      if (p) {
        var s = camera.worldToScreen(p.x, p.y);
        r.lightMask(s.x, s.y, cfg.twist.lightBase + game.resource * cfg.twist.lightRange, 0.94);
      }` : ''}
      r.vignette(0.35);
    };

    game.hud = function () {
      var out = {
        score: game.score,
        wave: Math.min(game.wave + 1, cfg.progression.stages.length),
        health: game.player ? Math.max(0, game.player.hp) / game.player.maxHp : 0,
        timer: Math.floor(game.elapsed),
        resource: game.resource,
        combo: 'x' + game.combo.toFixed(1),
        fragile: game.player && game.player.hp <= 1 ? 'CAREFUL' : 'ok',
      };
      return out;
    };

    game.onAction = function (name) {
      if (name === 'restart') game.reset();
    };

    game.reset();
    return game;
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
}
