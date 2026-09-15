/**
 * Ruleset: RACER (top-down lap racing).
 *
 * A closed track is generated as a smoothed loop; checkpoints are placed along
 * it and must be taken in order, which is what makes lap counting honest
 * (you cannot reverse across the line to farm laps). Rival AI follows the
 * racing line with a per-car skill offset.
 */

export function emitWorld(design) {
  return `/* game/world.js - procedural closed circuit with ordered checkpoints */
(function (global) {
  'use strict';
  var LAB = global.LAB;

  LAB.buildWorld = function (cfg, rng) {
    var pts = LAB.procgen.track(rng, cfg.world.trackPoints || 9, cfg.world.trackRadius || 700, 0.55);

    /* checkpoints spaced evenly along the smoothed loop */
    var checkpoints = [];
    var count = cfg.world.checkpoints || 8;
    for (var i = 0; i < count; i++) {
      var idx = Math.floor((i / count) * pts.length);
      var p = pts[idx];
      var nxt = pts[(idx + 1) % pts.length];
      var a = Math.atan2(nxt.y - p.y, nxt.x - p.x);
      checkpoints.push({ x: p.x, y: p.y, angle: a, index: i });
    }

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var k = 0; k < pts.length; k++) {
      minX = Math.min(minX, pts[k].x); maxX = Math.max(maxX, pts[k].x);
      minY = Math.min(minY, pts[k].y); maxY = Math.max(maxY, pts[k].y);
    }

    return {
      points: pts,
      checkpoints: checkpoints,
      width: cfg.world.trackWidth || 140,
      laps: cfg.world.laps || 3,
      start: { x: pts[0].x, y: pts[0].y, angle: Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) },
      bounds: { x: minX - 300, y: minY - 300, w: (maxX - minX) + 600, h: (maxY - minY) + 600 },
    };
  };

  /** Distance from a point to the track centre line, plus the nearest index. */
  LAB.trackDistance = function (map, x, y) {
    var best = Infinity, bestIdx = 0;
    for (var i = 0; i < map.points.length; i++) {
      var p = map.points[i];
      var d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (d < best) { best = d; bestIdx = i; }
    }
    return { distance: Math.sqrt(best), index: bestIdx };
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

export function emitRules(design) {
  const twist = design.twist.mechanic;
  const rivals = design.traits.enemies === 'rival-racers';
  const win = design.winCondition;
  return `/* game/rules.js - racing for "${design.name}" | rivals: ${rivals} | twist: ${design.traits.twist} */
(function (global) {
  'use strict';
  var LAB = global.LAB;
  var M = LAB.math;

  LAB.createGame = function (ctx) {
    var cfg = ctx.cfg, world = ctx.world, input = ctx.input, camera = ctx.camera;
    var particles = ctx.particles, audio = ctx.audio;
    var map = LAB.buildWorld(cfg, ctx.rng);

    var game = {
      status: 'playing', score: 0, elapsed: 0, lap: 0, nextCp: 0,
      lapTimes: [], bestLap: null, offTrack: 0, resource: 1, combo: 1,
      map: map, player: null,
      stats: { checkpoints: 0, offTrackTime: 0, topSpeed: 0 },
    };

    camera.bounds = map.bounds;

    function spawnPlayer() {
      game.player = world.spawn('player', {
        x: map.start.x, y: map.start.y, angle: map.start.angle,
        r: 13, vx: 0, vy: 0, lap: 0, nextCp: 0,
      });
    }
${rivals ? `
    function spawnRivals() {
      var n = Math.min(4, cfg.enemy.maxAlive);
      for (var i = 0; i < n; i++) {
        world.spawn('rival', {
          x: map.start.x - Math.cos(map.start.angle) * (60 + i * 46),
          y: map.start.y - Math.sin(map.start.angle) * (60 + i * 46),
          angle: map.start.angle, r: 13, vx: 0, vy: 0,
          target: 2 + i, lap: 0, nextCp: 0,
          skill: 0.72 + ctx.rng.next() * 0.26,   /* per-rival pace */
          lineOffset: ctx.rng.range(-0.45, 0.45), /* how far off the centre line they run */
        });
      }
    }` : ''}

    game.reset = function () {
      world.clear(); particles.clear();
      game.status = 'playing'; game.score = 0; game.elapsed = 0;
      game.lap = 0; game.nextCp = 0; game.lapTimes = []; game.lapStart = 0;
      game.offTrack = 0; game.resource = 1; game.combo = 1;
      game.stats = { checkpoints: 0, offTrackTime: 0, topSpeed: 0 };
      spawnPlayer();
${rivals ? `      spawnRivals();` : ''}
      camera.x = game.player.x; camera.y = game.player.y;
    };

    function checkpointPass(car, isPlayer) {
      var cp = map.checkpoints[car.nextCp];
      if (!cp) return;
      if (M.dist2(car.x, car.y, cp.x, cp.y) > (map.width * 0.85) * (map.width * 0.85)) return;
      car.nextCp++;
      if (isPlayer) {
        game.stats.checkpoints++;
        game.score += 20;
        audio.play('checkpoint', { volume: 0.12 });
      }
      if (car.nextCp >= map.checkpoints.length) {
        car.nextCp = 0;
        car.lap++;
        if (isPlayer) {
          var lapTime = game.elapsed - game.lapStart;
          game.lapStart = game.elapsed;
          game.lapTimes.push(lapTime);
          if (game.bestLap === null || lapTime < game.bestLap) game.bestLap = lapTime;
          game.lap = car.lap;
          game.score += Math.max(40, Math.round(cfg.scoring.lap - lapTime * 5));
          ctx.ui && ctx.ui.toast('Lap ' + car.lap + ' - ' + lapTime.toFixed(2) + 's');
          audio.play('win', { volume: 0.14 });
        }
      }
    }

    game.update = function (dt) {
      if (game.status !== 'playing') return;
      game.elapsed += dt;
      var p = game.player;

      var steer = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
      var throttle = (input.down('up') ? 1 : 0) - (input.down('down') ? 1 : 0);
${design.controls.mobile?.virtualStick ? `      var stick = input.axis();
      if (Math.abs(stick.x) > 0.15) steer = stick.x;
      if (Math.abs(stick.y) > 0.15) throttle = -stick.y;` : ''}
${twist === 'time-scale' ? `      ctx.loop.timeScale = (input.down('action') && game.resource > 0) ? cfg.twist.slowFactor : 1;
      if (input.down('action')) game.resource = Math.max(0, game.resource - cfg.twist.drainPerSecond * dt);
      else game.resource = Math.min(1, game.resource + cfg.twist.rechargePerSecond * dt);` : ''}

      LAB.physics.integrate(p, steer, throttle, dt, cfg.physics);
      game.stats.topSpeed = Math.max(game.stats.topSpeed, p.speed || 0);

      /* off-track penalty: grip and top speed drop outside the tarmac */
      var td = LAB.trackDistance(map, p.x, p.y);
      var half = map.width / 2;
      if (td.distance > half) {
        game.offTrack = Math.min(1, game.offTrack + dt * 2);
        game.stats.offTrackTime += dt;
        p.vx *= Math.pow(0.55, dt * 60 / 60);
        p.vy *= Math.pow(0.55, dt * 60 / 60);
        if (Math.random() < 0.3) particles.emit(p.x, p.y, { count: 2, speed: 60, life: 0.35, color: cfg.palette[3], size: 2 });
${twist === 'combo' ? `        game.combo = 1;` : ''}
      } else {
        game.offTrack = Math.max(0, game.offTrack - dt * 3);
${twist === 'combo' ? `        if ((p.drift || 0) > 40) {
          game.combo = Math.min(cfg.twist.comboMax, game.combo + cfg.twist.comboStep * dt * 2);
          game.score += 12 * dt * game.combo;
        }` : ''}
      }
      if ((p.drift || 0) > 55) {
        particles.emit(p.x - Math.cos(p.angle) * 12, p.y - Math.sin(p.angle) * 12,
          { count: 2, speed: 40, life: 0.5, color: cfg.palette[3], size: 3 });
      }

      checkpointPass(p, true);
${rivals ? `
      world.each('rival', function (r) {
        /* follow the racing line a few points ahead, offset by the rival's line preference */
        var idx = (LAB.trackDistance(map, r.x, r.y).index + 6) % map.points.length;
        var t = map.points[idx];
        var nxt = map.points[(idx + 1) % map.points.length];
        var nx = -(nxt.y - t.y), ny = (nxt.x - t.x);
        var nl = Math.hypot(nx, ny) || 1;
        var tx = t.x + (nx / nl) * half * r.lineOffset;
        var ty = t.y + (ny / nl) * half * r.lineOffset;

        var want = Math.atan2(ty - r.y, tx - r.x);
        var diff = ((want - r.angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        var steerAI = M.clamp(diff * 2.2, -1, 1);
        LAB.physics.integrate(r, steerAI, r.skill, dt, cfg.physics);
        checkpointPass(r, false);
      });` : ''}
${twist === 'terrain-mutation' ? `      game.mutateTimer = (game.mutateTimer || cfg.twist.mutateInterval) - dt;
      if (game.mutateTimer <= 0) {
        game.mutateTimer = cfg.twist.mutateInterval;
        game.hazardIndex = ctx.rng.int(0, map.points.length - 1);
        ctx.ui && ctx.ui.toast('Surface change ahead');
      }
      if (game.hazardIndex !== undefined && Math.abs(td.index - game.hazardIndex) < 4 && td.distance < half) {
        p.vx *= Math.pow(0.9, dt * 60 / 60); p.vy *= Math.pow(0.9, dt * 60 / 60);
      }` : ''}
${twist === 'ghost-replay' ? `      game.ghostT = (game.ghostT || 0) + dt;
      game.ghostRecordT = (game.ghostRecordT || 0) + dt;
      if (game.ghostRecordT >= 1 / cfg.twist.sampleHz) {
        game.ghostRecordT = 0;
        (game.ghostSamples = game.ghostSamples || []).push([Math.round(p.x), Math.round(p.y)]);
      }
      var gi = Math.floor(game.ghostT * cfg.twist.sampleHz);
      game.ghostPos = (ctx.save.data.ghost || [])[gi] || null;` : ''}

${win.type === 'lap-time' ? `      if (game.lap >= map.laps) {
        game.status = 'won';
        game.reason = 'Race finished in ' + game.elapsed.toFixed(2) + 's (best lap ' + (game.bestLap || 0).toFixed(2) + 's)';
        audio.play('win');
${twist === 'ghost-replay' ? `        try { ctx.save.data.ghost = (game.ghostSamples || []).slice(0, 6000); ctx.save.save(); } catch (err) { /* storage full */ }` : ''}
      }`
    : win.type === 'survive' ? `      if (game.elapsed >= ${win.seconds || 90}) { game.status = 'won'; game.reason = 'Held the pace'; audio.play('win'); }`
    : `      if (game.lap >= map.laps) { game.status = 'won'; game.reason = 'Race complete'; audio.play('win'); }`}

      camera.follow(p, dt);
      camera.targetZoom = M.clamp(1.05 - (p.speed || 0) / 2600, 0.72, 1.05);
      world.sweep();
    };

    game.render = function (r, alpha) {
      var p = game.player;
      camera.apply(r.ctx);

      /* track: wide stroke for tarmac, thin dashed centre line */
      var ctx2 = r.ctx;
      ctx2.strokeStyle = cfg.palette[3];
      ctx2.lineWidth = map.width;
      ctx2.lineJoin = 'round';
      ctx2.lineCap = 'round';
      ctx2.beginPath();
      ctx2.moveTo(map.points[0].x, map.points[0].y);
      for (var i = 1; i < map.points.length; i++) ctx2.lineTo(map.points[i].x, map.points[i].y);
      ctx2.closePath();
      ctx2.stroke();

      ctx2.strokeStyle = cfg.palette[1];
      ctx2.globalAlpha = 0.22;
      ctx2.lineWidth = 3;
      ctx2.stroke();
      ctx2.globalAlpha = 1;

      for (var c = 0; c < map.checkpoints.length; c++) {
        var cp = map.checkpoints[c];
        var isNext = c === game.player.nextCp;
        var nx = Math.cos(cp.angle + Math.PI / 2) * (map.width / 2);
        var ny = Math.sin(cp.angle + Math.PI / 2) * (map.width / 2);
        r.line(cp.x - nx, cp.y - ny, cp.x + nx, cp.y + ny, isNext ? cfg.palette[2] : 'rgba(255,255,255,0.14)', isNext ? 5 : 2);
      }
      particles.render(ctx2);
${rivals ? `      world.each('rival', function (rv) { r.shape('triangle', rv.x, rv.y, rv.r, cfg.palette[4], rv.angle); });` : ''}
${twist === 'ghost-replay' ? `      if (game.ghostPos) { ctx2.globalAlpha = 0.35; r.shape('triangle', game.ghostPos[0], game.ghostPos[1], 13, cfg.palette[1], 0); ctx2.globalAlpha = 1; }` : ''}
      if (p) {
        r.shape('triangle', p.x, p.y, p.r, cfg.palette[2], p.angle);
        if (game.offTrack > 0.3) r.ring(p.x, p.y, p.r + 8, cfg.palette[4], 2);
      }
      camera.restore(ctx2);
      r.vignette(0.32);
    };

    game.hud = function () {
      return {
        score: Math.floor(game.score),
        lap: (game.lap + 1) + '/' + map.laps,
        timer: game.elapsed.toFixed(1),
        health: 1 - game.offTrack,
        resource: game.resource,
        combo: 'x' + game.combo.toFixed(1),
        wave: game.bestLap ? game.bestLap.toFixed(2) : '-',
        moves: game.stats.checkpoints,
        fragile: 'ok',
      };
    };

    game.onAction = function (name) { if (name === 'restart') game.reset(); };
    game.reset();
    return game;
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
}
