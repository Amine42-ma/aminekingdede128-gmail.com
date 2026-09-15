/**
 * Ruleset: EXPLORER3D (three.js exploration).
 *
 * This is the one ruleset the lab's headless sandbox cannot verify - there is
 * no WebGL in the sandbox - so the emitted code is written defensively:
 *   - three.js is loaded asynchronously and failure is reported to the player
 *     on the 2D canvas instead of a blank screen (offline case)
 *   - user GLB models are loaded if supplied, with generated placeholder
 *     geometry when a model is missing or its licence is unverified
 * The lab reports this honestly: 3D builds are statically checked and must be
 * opened in a browser to confirm rendering.
 */

export function emitWorld(design) {
  return `/* game/world.js - 3D field layout (positions only; meshes are built in rules.js) */
(function (global) {
  'use strict';
  var LAB = global.LAB;

  LAB.buildWorld = function (cfg, rng) {
    var size = cfg.world.size || 120;
    var noise = LAB.procgen.noise2(rng, 0.05);

    var props = [];
    for (var i = 0; i < (cfg.world.scatter || 60); i++) {
      var x = rng.range(-size / 2, size / 2);
      var z = rng.range(-size / 2, size / 2);
      if (Math.hypot(x, z) < 6) continue; /* keep the spawn clear */
      var h = 1.2 + noise(x + size, z + size) * 4.5;
      props.push({ x: x, z: z, r: 0.6 + rng.next() * 1.1, h: h, kind: rng.chance(0.25) ? 'tall' : 'rock' });
    }

    var landmarks = [];
    for (var l = 0; l < (cfg.world.landmarks || 5); l++) {
      var a = (l / (cfg.world.landmarks || 5)) * Math.PI * 2;
      var d = size * 0.32;
      landmarks.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, h: 8 + rng.next() * 6 });
    }

    var collectibles = [];
    for (var c = 0; c < (cfg.world.collectibles || 8); c++) {
      collectibles.push({
        x: rng.range(-size / 2 + 6, size / 2 - 6),
        z: rng.range(-size / 2 + 6, size / 2 - 6),
        y: 1.2, taken: false,
      });
    }

    return {
      size: size, props: props, landmarks: landmarks, collectibles: collectibles,
      start: { x: 0, y: 0, z: 0 },
      exit: { x: landmarks[0].x, z: landmarks[0].z, r: 3 },
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

export function emitRules(design) {
  const twist = design.twist.mechanic;
  const win = design.winCondition;
  const firstPerson = design.traits.camera === 'first-person';
  return `/* game/rules.js - 3D exploration for "${design.name}" | camera: ${design.traits.camera} */
(function (global) {
  'use strict';
  var LAB = global.LAB;
  var M = LAB.math;

  LAB.createGame = function (ctx) {
    var cfg = ctx.cfg, world = ctx.world, input = ctx.input;
    var audio = ctx.audio;
    var map = LAB.buildWorld(cfg, ctx.rng);

    var game = {
      status: 'playing', score: 0, elapsed: 0, collected: 0, resource: 1, combo: 1,
      ready: false, error: null, map: map,
      player: { x: 0, y: 1.7, z: 0, vx: 0, vy: 0, vz: 0, groundY: 1.7, onGround: true, yaw: 0, pitch: 0 },
      stats: { distance: 0, interactions: 0 },
      three: null,
    };

    /* The 3D view gets its own canvas: the 2D canvas stays underneath for the
       loading and error states, and is hidden once WebGL is live. */
    var doc = global.document;
    var view = doc.createElement('canvas');
    view.id = 'stage3d';
    view.style.position = 'absolute';
    view.style.inset = '0';
    view.style.width = '100%';
    view.style.height = '100%';
    view.style.display = 'none';
    var app = doc.getElementById('app') || doc.body;
    app.insertBefore(view, app.firstChild);

    LAB.three.load().then(function (m) {
      buildScene(m.THREE);
    }).catch(function (err) {
      game.error = err.message || String(err);
    });

    function buildScene(THREE) {
      var renderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas: view, antialias: true });
      } catch (err) {
        game.error = 'WebGL is not available in this browser: ' + err.message;
        return;
      }
      renderer.setPixelRatio(Math.min(2, global.devicePixelRatio || 1));
      renderer.setSize(view.clientWidth || 960, view.clientHeight || 540, false);

      var scene = new THREE.Scene();
      scene.background = new THREE.Color(cfg.palette[0]);
      scene.fog = new THREE.Fog(cfg.palette[0], ${twist === 'light-radius' ? '8' : '30'}, ${twist === 'light-radius' ? '34' : 'map.size * 0.9'});

      var camera = new THREE.PerspectiveCamera(70, (view.clientWidth || 960) / (view.clientHeight || 540), 0.1, 600);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.85));
      var sun = new THREE.DirectionalLight(0xffffff, 1.1);
      sun.position.set(30, 50, 20);
      scene.add(sun);
${twist === 'light-radius' ? `      var lamp = new THREE.PointLight(cfg.palette[2], 2.2, 30);
      scene.add(lamp);` : ''}

      var ground = new THREE.Mesh(
        new THREE.PlaneGeometry(map.size * 1.6, map.size * 1.6),
        new THREE.MeshStandardMaterial({ color: cfg.palette[3], roughness: 0.95 })
      );
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);

      /* props: instanced-friendly simple geometry, no assets required */
      var rockGeo = new THREE.IcosahedronGeometry(1, 0);
      var tallGeo = new THREE.CylinderGeometry(0.5, 0.8, 1, 6);
      var rockMat = new THREE.MeshStandardMaterial({ color: cfg.palette[3], roughness: 0.9 });
      var tallMat = new THREE.MeshStandardMaterial({ color: cfg.palette[4], roughness: 0.7 });
      for (var i = 0; i < map.props.length; i++) {
        var p = map.props[i];
        var mesh = new THREE.Mesh(p.kind === 'tall' ? tallGeo : rockGeo, p.kind === 'tall' ? tallMat : rockMat);
        mesh.position.set(p.x, p.h / 2, p.z);
        mesh.scale.set(p.r, p.h, p.r);
        scene.add(mesh);
      }
      for (var l = 0; l < map.landmarks.length; l++) {
        var lm = map.landmarks[l];
        var tower = new THREE.Mesh(
          new THREE.CylinderGeometry(1.2, 2.2, lm.h, 7),
          new THREE.MeshStandardMaterial({ color: cfg.palette[2], roughness: 0.4, metalness: 0.2 })
        );
        tower.position.set(lm.x, lm.h / 2, lm.z);
        scene.add(tower);
      }

      var pickupGeo = new THREE.OctahedronGeometry(0.55, 0);
      var pickupMat = new THREE.MeshStandardMaterial({ color: cfg.palette[2], emissive: cfg.palette[2], emissiveIntensity: 0.6 });
      var pickupMeshes = [];
      for (var c = 0; c < map.collectibles.length; c++) {
        var col = map.collectibles[c];
        var pm = new THREE.Mesh(pickupGeo, pickupMat);
        pm.position.set(col.x, col.y, col.z);
        scene.add(pm);
        pickupMeshes.push(pm);
      }

      var avatar = null;
${design.assets?.some((a) => a.kind === 'model') ? `      /* A user-supplied GLB was attached to this design: load it, fall back to
         generated geometry if it fails or is missing. */
      LAB.three.loadModel(LAB.three.models[0]).then(function (res) {
        avatar = res.scene;
        avatar.scale.setScalar(1);
        scene.add(avatar);
      }).catch(function () {
        avatar = LAB.three.placeholder(THREE, parseInt(String(cfg.palette[2]).slice(1), 16));
        scene.add(avatar);
      });`
    : `      avatar = LAB.three.placeholder(THREE, parseInt(String(cfg.palette[2]).slice(1), 16));
      scene.add(avatar);`}

      game.three = {
        THREE: THREE, renderer: renderer, scene: scene, camera: camera,
        pickupMeshes: pickupMeshes, get avatar() { return avatar; },
${twist === 'light-radius' ? `        lamp: lamp,` : ''}
      };
      game.ready = true;
      view.style.display = 'block';
      var stage2d = doc.getElementById('stage');
      if (stage2d) stage2d.style.display = 'none';

      global.addEventListener('resize', function () {
        var w = view.clientWidth || 960, h = view.clientHeight || 540;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      });

      /* pointer lock for mouse look, only on user gesture */
      view.addEventListener('click', function () {
        if (view.requestPointerLock) view.requestPointerLock();
      });
      doc.addEventListener('mousemove', function (e) {
        if (doc.pointerLockElement !== view) return;
        game.player.yaw -= (e.movementX || 0) * cfg.physics.lookSensitivity;
        game.player.pitch = M.clamp(game.player.pitch - (e.movementY || 0) * cfg.physics.lookSensitivity, -1.2, 1.2);
      });
    }

    function blocked(x, z) {
      for (var i = 0; i < map.props.length; i++) {
        var p = map.props[i];
        var dx = x - p.x, dz = z - p.z;
        if (dx * dx + dz * dz < (p.r + 0.6) * (p.r + 0.6)) return true;
      }
      return false;
    }

    game.reset = function () {
      game.status = 'playing'; game.score = 0; game.elapsed = 0; game.collected = 0;
      game.resource = 1; game.combo = 1;
      game.stats = { distance: 0, interactions: 0 };
      game.player.x = 0; game.player.z = 0; game.player.y = 1.7;
      game.player.vx = game.player.vy = game.player.vz = 0;
      game.player.yaw = 0; game.player.pitch = 0;
      for (var i = 0; i < map.collectibles.length; i++) map.collectibles[i].taken = false;
      if (game.three) {
        for (var m = 0; m < game.three.pickupMeshes.length; m++) game.three.pickupMeshes[m].visible = true;
      }
    };

    game.update = function (dt) {
      if (game.status !== 'playing') return;
      game.elapsed += dt;
      var p = game.player;

      var axis = input.axis();
      /* movement is relative to where the camera is looking */
      var sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
      var ax = axis.x * cos - axis.y * sin;
      var az = axis.x * sin + axis.y * cos;

      if (input.down('left')) p.yaw += 1.8 * dt * (axis.x === 0 ? 1 : 0);
      if (input.down('right')) p.yaw -= 1.8 * dt * (axis.x === 0 ? 1 : 0);

      var prevX = p.x, prevZ = p.z;
      LAB.physics.integrate(p, ax, az, dt, cfg.physics);
      if (input.pressed('action') && p.onGround) { p.vy = cfg.physics.jumpVelocity; p.onGround = false; audio.play('action'); }

      if (blocked(p.x, prevZ)) p.x = prevX;
      if (blocked(p.x, p.z)) p.z = prevZ;
      var half = map.size / 2;
      p.x = M.clamp(p.x, -half, half);
      p.z = M.clamp(p.z, -half, half);
      game.stats.distance += Math.hypot(p.x - prevX, p.z - prevZ);

      for (var i = 0; i < map.collectibles.length; i++) {
        var c = map.collectibles[i];
        if (c.taken) continue;
        if (Math.hypot(p.x - c.x, p.z - c.z) < 1.6) {
          c.taken = true;
          game.collected++;
          game.stats.interactions++;
          game.score += Math.round(cfg.scoring.pickup * game.combo);
          audio.play('pickup');
          if (game.three) game.three.pickupMeshes[i].visible = false;
${twist === 'resource-drain' || twist === 'light-radius' ? `          game.resource = Math.min(1, game.resource + cfg.twist.pickupRestore);` : ''}
${twist === 'combo' ? `          game.combo = Math.min(cfg.twist.comboMax, game.combo + cfg.twist.comboStep); game.comboTimer = cfg.twist.comboWindow;` : ''}
        }
      }
${twist === 'combo' ? `      if (game.comboTimer > 0) { game.comboTimer -= dt; if (game.comboTimer <= 0) game.combo = 1; }` : ''}
${twist === 'resource-drain' || twist === 'light-radius' ? `      game.resource = Math.max(0, game.resource - cfg.twist.drainPerSecond * dt);
      if (game.resource <= 0) { game.status = 'lost'; game.reason = 'Power ran out'; audio.play('lose'); }` : ''}

${win.type === 'collect' ? `      if (game.collected >= map.collectibles.length) { game.status = 'won'; game.reason = 'Everything found'; audio.play('win'); }`
    : win.type === 'reach' ? `      if (Math.hypot(p.x - map.exit.x, p.z - map.exit.z) < map.exit.r) { game.status = 'won'; game.reason = 'Reached the landmark'; audio.play('win'); }`
    : `      if (game.elapsed >= ${win.seconds || 120}) { game.status = 'won'; game.reason = 'Survey complete'; audio.play('win'); }`}

      if (game.three) updateCamera(dt);
    };

    function updateCamera(dt) {
      var t = game.three, p = game.player;
      var cam = t.camera;
${firstPerson ? `      cam.position.set(p.x, p.y, p.z);
      cam.rotation.order = 'YXZ';
      cam.rotation.y = p.yaw;
      cam.rotation.x = p.pitch;
      if (t.avatar) t.avatar.visible = false;`
    : `      var dist = 7, height = 3.4;
      cam.position.set(
        p.x - Math.sin(p.yaw) * dist,
        p.y + height,
        p.z - Math.cos(p.yaw) * dist
      );
      cam.lookAt(p.x, p.y + 0.6, p.z);
      if (t.avatar) {
        t.avatar.visible = true;
        t.avatar.position.set(p.x, p.y - 1.1, p.z);
        t.avatar.rotation.y = p.yaw + Math.PI;
      }`}
${twist === 'light-radius' ? `      if (t.lamp) { t.lamp.position.set(p.x, p.y + 1, p.z); t.lamp.distance = 8 + game.resource * 26; }` : ''}
      for (var i = 0; i < t.pickupMeshes.length; i++) t.pickupMeshes[i].rotation.y += dt * 1.6;
    }

    /* The 2D renderer is only used before WebGL is live (or if it failed). */
    game.render = function (r, alpha) {
      if (game.ready && game.three) {
        game.three.renderer.render(game.three.scene, game.three.camera);
        return;
      }
      var cx = r.width / 2, cy = r.height / 2;
      if (game.error) {
        r.text('3D runtime unavailable', cx, cy - 18, { size: 20, align: 'center', color: cfg.palette[4] });
        r.text(game.error.slice(0, 90), cx, cy + 10, { size: 12, align: 'center', color: cfg.palette[1] });
        r.text('This build needs three.js: connect once, or drop a copy in vendor/.', cx, cy + 34, { size: 11, align: 'center', color: cfg.palette[1] });
      } else {
        r.text('Loading 3D runtime...', cx, cy, { size: 18, align: 'center', color: cfg.palette[2] });
        var w = 200;
        r.rect(cx - w / 2, cy + 18, w, 4, 'rgba(255,255,255,0.15)');
        r.rect(cx - w / 2, cy + 18, w * ((game.elapsed * 0.4) % 1), 4, cfg.palette[2]);
      }
    };

    game.hud = function () {
      return {
        score: game.score,
        health: 1,
        resource: game.resource,
        timer: Math.floor(game.elapsed),
        moves: game.collected + '/' + map.collectibles.length,
        combo: 'x' + game.combo.toFixed(1),
        wave: Math.round(game.stats.distance) + 'm',
        fragile: game.ready ? 'ok' : 'loading',
      };
    };

    game.onAction = function (name) { if (name === 'restart') game.reset(); };
    game.reset();
    return game;
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
}
