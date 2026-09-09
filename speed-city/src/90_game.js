/* ============================================================================
   SPEED CITY — قلب اللعبة: العرض، الكاميرا، الحلقة الرئيسية، والحفظ
   ========================================================================== */
SC.game = (function () {
  const U = SC.util;
  const SAVE_KEY = 'speedcity.save.v2';

  const save = {
    money: 2500, xp: 0, level: 1,
    owned: ['cortina'], current: 'cortina',
    upgrades: { cortina: { engine: 0, tires: 0, brakes: 0, nitro: 0 } },
    colors: {}, done: {}, best: {},
    stats: { distance: 0, missions: 0, races: 0, topSpeed: 0 }
  };

  const settings = {
    quality: 'auto', shadows: true, steerMode: 'buttons', steerSense: 1.0,
    invertTilt: false, sound: true, volume: 0.85, haptics: true,
    mapRotate: true, timeOfDay: 'day', traffic: true, camera: 'chase'
  };
  SC.settings = settings;

  const G = {
    renderer: null, scene: null, camera: null, car: null, clock: null,
    paused: true, mode: 'menu', waypoint: null, rivals: [], rivalAI: [],
    missions: [], missionMarkers: [], nearMission: null, playerPathIdx: 0,
    time: 0, frames: 0, fps: 60, ready: false, miniZoom: 3.0
  };

  /* --------------------------- إعدادات الجودة --------------------------- */
  function pickQuality() {
    const mob = U.isMobile;
    const dpr = window.devicePixelRatio || 1;
    let q = settings.quality;
    if (q === 'auto') q = mob ? 'low' : 'high';
    const presets = {
      low:   { pixelRatio: Math.min(dpr, 1.5), shadows: false, shadowSize: 1024, shadowRange: 60,
               skidCount: 400, particles: 200, traffic: 6, far: 480, aa: false },
      medium:{ pixelRatio: Math.min(dpr, 1.75), shadows: true, shadowSize: 1024, shadowRange: 70,
               skidCount: 700, particles: 320, traffic: 10, far: 720, aa: true },
      high:  { pixelRatio: Math.min(dpr, 2), shadows: true, shadowSize: 2048, shadowRange: 95,
               skidCount: 1000, particles: 460, traffic: 16, far: 1000, aa: true }
    };
    const p = presets[q] || presets.medium;
    if (!settings.shadows) p.shadows = false;
    p.name = q;
    SC.quality = p;
    return p;
  }

  /* ------------------------------ الحفظ --------------------------------- */
  function load() {
    const s = U.store.get(SAVE_KEY, null);
    if (s) {
      Object.assign(save, s);
      Object.assign(settings, s.settings || {});
    }
    SC.cars.order.forEach((id) => { if (!save.upgrades[id]) save.upgrades[id] = { engine: 0, tires: 0, brakes: 0, nitro: 0 }; });
  }
  function persist() {
    U.store.set(SAVE_KEY, Object.assign({}, save, { settings }));
  }
  function addMoney(n) {
    save.money = Math.max(0, save.money + n);
    persist();
    SC.ui && SC.ui.refreshWallet();
  }
  function addXp(n) {
    save.xp += n;
    const need = () => save.level * 500;
    while (save.xp >= need()) { save.xp -= need(); save.level++; SC.hud.banner('المستوى ' + save.level, 'ارتقيت!', 2200); SC.audio.good(); }
    persist();
    SC.ui && SC.ui.refreshWallet();
  }

  /* ------------------------------ التهيئة ------------------------------- */
  async function init(dom, sources) {
    load();
    const q = pickQuality();

    const canvas = dom.canvas;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: q.aa, powerPreference: 'high-performance' });
    renderer.setPixelRatio(q.pixelRatio);
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = q.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    G.renderer = renderer;

    const scene = new THREE.Scene();
    G.scene = scene;
    const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.35, q.far * 4);
    camera.position.set(0, 12, -20);
    G.camera = camera;

    /* تحميل النماذج */
    await SC.assets.loadAll(sources, (p, label) => {
      if (dom.loadBar) dom.loadBar.style.width = Math.round(p * 100) + '%';
      if (dom.loadText) dom.loadText.textContent = 'تحميل ' + label + '…';
    });

    /* فصل العجلات للمركبات (مرّة واحدة لكل نموذج) */
    ['car_cortina', 'van_motorhome', 'bike_cyberpunk'].forEach((key) => {
      const m = SC.assets.get(key);
      if (!m) return;
      const ws = SC.wheels.extract(m.root);
      m.wheelDebug = SC.wheels.extract.debug;
      ws.forEach((w, i) => {
        w.pivot.name = 'wheel_' + i;
        w.pivot.userData.wheel = { front: w.front, side: w.side, radius: w.radius };
      });
      m.wheelCount = ws.length;
    });

    if (dom.loadText) dom.loadText.textContent = 'بناء المدينة…';
    await new Promise((r) => setTimeout(r, 30));
    SC.world.build(scene, renderer, q);
    SC.world.setTimeOfDay(settings.timeOfDay);
    renderer.toneMappingExposure = SC.world.state.exposure;
    scene.fog.far = Math.min(scene.fog.far, q.far);

    SC.fx.init(scene);
    SC.hud.buildCityMap();

    /* صور المركبات للمتجر */
    try {
      SC.cars.order.forEach((id) => SC.assets.renderThumb(renderer, SC.cars.defs[id].key));
    } catch (e) { console.warn('تعذّر توليد صور المركبات', e); }

    /* اللاعب */
    spawnPlayer(save.current);

    /* المرور */
    SC.traffic.init(scene, 0);
    if (settings.traffic) SC.traffic.setCount(q.traffic, G.car.pos);

    /* المهام */
    G.missions = SC.missions.generate(4242);
    SC.missions.init({
      scene, get car() { return G.car; },
      addRival, clearRivals, setRivalsActive, racePosition,
      onFinish: onMissionFinish, onStart: () => {}
    });
    buildMissionMarkers();

    /* سهم التوجيه فوق السيارة */
    const arrowGeo = new THREE.ConeGeometry(0.42, 1.15, 4);
    arrowGeo.rotateX(Math.PI / 2);
    G.arrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9 }));
    G.arrow.visible = false;
    scene.add(G.arrow);

    window.addEventListener('resize', onResize);
    onResize();
    G.clock = new THREE.Clock();
    G.ready = true;
    return G;
  }

  function onResize() {
    if (!G.renderer) return;
    const w = innerWidth, h = innerHeight;
    G.renderer.setSize(w, h, false);
    G.camera.aspect = w / h;
    G.camera.updateProjectionMatrix();
  }

  /* ---------------------------- مركبة اللاعب ---------------------------- */
  function spawnPlayer(id, keepPos) {
    const prev = G.car;
    const pos = prev ? prev.pos.clone() : null;
    const yaw = prev ? prev.yaw : 0;
    if (prev) G.scene.remove(prev.root);
    const car = new SC.Vehicle(id, { player: true, upgrades: save.upgrades[id] });
    if (save.colors[id]) car.setColor(save.colors[id]);
    car.onImpact = (p) => {
      SC.audio.crash(p);
      U.vibrate(Math.round(30 + p * 90));
      shake(p * 0.9);
      const f = car.localToWorld(0, 0.5, car.halfLen);
      for (let i = 0; i < Math.round(p * 8); i++) SC.fx.spark(f.x, f.y, f.z, Math.sin(car.yaw), Math.cos(car.yaw));
    };
    car.onCurb = (p) => { U.vibrate(10); shake(p * 0.25); };
    G.scene.add(car.root);
    G.car = car;
    save.current = id;
    const sp = keepPos && pos ? { x: pos.x, z: pos.z, yaw } : SC.world.nearestSpawn(pos ? pos.x : 30, pos ? pos.z : 30);
    car.place(sp.x, sp.z, sp.yaw);
    car.lightsOn = SC.world.state.isNight;
    return car;
  }

  function respawn() {
    const car = G.car;
    const sp = SC.world.nearestSpawn(car.pos.x, car.pos.z);
    car.place(sp.x, sp.z, sp.yaw);
    SC.hud.toast('أُعيدت السيارة إلى الطريق', '', 1500);
  }

  /* ------------------------------ المنافسون ----------------------------- */
  function addRival(path, skill, x, z, yaw, index) {
    const ids = ['cortina', 'cortina', 'bike', 'van'];
    const v = new SC.Vehicle(ids[index % ids.length]);
    v.setColor([0xd93a3a, 0x2f6fd0, 0x2fa84f, 0xe0b13a][index % 4]);
    v.place(x, z, yaw);
    v.lightsOn = SC.world.state.isNight;
    G.scene.add(v.root);
    const ai = new SC.AIDriver(v, { skill, path, targetSpeed: v.def.topSpeed * (0.72 + skill * 0.3) });
    ai.active = false;
    G.rivals.push(v);
    G.rivalAI.push(ai);
    return ai;
  }
  function clearRivals() {
    G.rivals.forEach((v) => G.scene.remove(v.root));
    G.rivals.length = 0; G.rivalAI.length = 0;
  }
  function setRivalsActive(on) { G.rivalAI.forEach((a) => { a.active = on; }); }

  /* ترتيب اللاعب في السباق بحسب التقدّم على المسار */
  function racePosition(mstate) {
    const def = mstate.active;
    if (!def || !def.path) return 1;
    const len = def.path.length;
    const mine = mstate.lap * len + G.playerPathIdx;
    let pos = 1;
    G.rivalAI.forEach((a) => {
      const theirs = a.lap * len + a.wp;
      if (theirs > mine) pos++;
    });
    return pos;
  }

  /* --------------------------- علامات المهام ---------------------------- */
  function buildMissionMarkers() {
    G.missionMarkers.forEach((m) => G.scene.remove(m.mesh));
    G.missionMarkers = [];
    G.missions.forEach((def) => {
      const mesh = SC.fx.makeMarker(new THREE.Color(def.color), 6);
      mesh.position.set(def.from.x, SC.world.groundHeight(def.from.x, def.from.z) + 0.02, def.from.z);
      G.scene.add(mesh);
      G.missionMarkers.push({ def, mesh });
    });
    refreshFreeMarkers();
  }
  function refreshFreeMarkers() {
    if (SC.missions.state.active) return;
    SC.hud.setMarkers(G.missions.map((d) => ({ x: d.from.x, z: d.from.z, color: d.color, icon: d.icon, size: 5 })));
  }
  function setMissionMarkersVisible(v) {
    G.missionMarkers.forEach((m) => { m.mesh.visible = v; });
  }

  function onMissionFinish(res) {
    setMissionMarkersVisible(true);
    refreshFreeMarkers();
    if (res.success) {
      addMoney(res.money); addXp(res.xp);
      save.stats.missions++;
      if (res.def.type === 'race') save.stats.races++;
      const key = res.def.id;
      if (!save.best[key] || res.time < save.best[key]) save.best[key] = res.time;
      save.done[key] = (save.done[key] || 0) + 1;
      persist();
      SC.audio.cash();
    } else {
      SC.audio.bad();
    }
    G.mode = 'free';
    SC.ui.showResult(res);
  }

  function startMission(def) {
    setMissionMarkersVisible(false);
    G.mode = 'mission';
    SC.missions.start(def);
    SC.ui.hideAll();
    G.paused = false;
  }

  /* ------------------------------ الكاميرا ------------------------------ */
  const camState = { pos: new THREE.Vector3(), look: new THREE.Vector3(), shake: 0, fov: 62 };
  function shake(a) { camState.shake = Math.min(1.2, camState.shake + a); }

  function updateCamera(dt, car) {
    const mode = settings.camera;
    const spd = U.clamp(car.kmh / 180, 0, 1);
    let desired = new THREE.Vector3(), look = new THREE.Vector3();
    const fwd = car.forward;
    const back = 1 + spd * 0.35;

    if (mode === 'hood') {
      const h = car.def.seatH + 0.25;
      desired.copy(car.pos).addScaledVector(fwd, car.halfLen * 0.15).add(new THREE.Vector3(0, h, 0));
      look.copy(car.pos).addScaledVector(fwd, 26).add(new THREE.Vector3(0, h * 0.9, 0));
      camState.pos.lerp(desired, 1 - Math.exp(-26 * dt));
      camState.look.lerp(look, 1 - Math.exp(-16 * dt));
    } else {
      const dist = (mode === 'far' ? 11.5 : 6.6) * back + car.halfLen * 0.75;
      const height = (mode === 'far' ? 5.2 : 2.85) + spd * 0.45;
      desired.copy(car.pos)
        .addScaledVector(fwd, -dist)
        .add(new THREE.Vector3(0, height, 0));
      // انزلاق جانبي بسيط أثناء الدريفت
      const side = new THREE.Vector3(Math.cos(car.yaw), 0, -Math.sin(car.yaw));
      desired.addScaledVector(side, U.clamp(car.vLat * 0.16, -2.4, 2.4));
      look.copy(car.pos).addScaledVector(fwd, 9 + spd * 7).add(new THREE.Vector3(0, 1.4, 0));
      const lag = mode === 'far' ? 7 : (9 + spd * 9);
      camState.pos.lerp(desired, 1 - Math.exp(-lag * dt));
      camState.look.lerp(look, 1 - Math.exp(-(11 + spd * 6) * dt));
    }

    /* اهتزاز */
    if (camState.shake > 0.001) {
      const s = camState.shake;
      camState.pos.x += (Math.random() - 0.5) * s * 0.7;
      camState.pos.y += (Math.random() - 0.5) * s * 0.5;
      camState.pos.z += (Math.random() - 0.5) * s * 0.7;
      camState.shake = U.damp(camState.shake, 0, 6, dt);
    }
    G.camera.position.copy(camState.pos);
    G.camera.lookAt(camState.look);

    const targetFov = 62 + spd * 12 + (car.nitroActive ? 6 : 0);
    camState.fov = U.damp(camState.fov, targetFov, 5, dt);
    if (Math.abs(G.camera.fov - camState.fov) > 0.05) {
      G.camera.fov = camState.fov;
      G.camera.updateProjectionMatrix();
    }
  }
  function snapCamera() {
    const car = G.car;
    camState.pos.copy(car.pos).addScaledVector(car.forward, -9).add(new THREE.Vector3(0, 3.4, 0));
    camState.look.copy(car.pos);
    G.camera.position.copy(camState.pos);
    G.camera.lookAt(camState.look);
  }

  /* ------------------------- المؤثرات على الإطارات ---------------------- */
  let skidTimer = 0;
  function updateSkids(dt, car) {
    const slipping = (car.slip > 0.28 || (car.input.handbrake > 0.5 && car.kmh > 14)) && car.kmh > 8;
    const strength = U.clamp(car.slip * 1.4 + (car.input.handbrake > 0.5 ? 0.35 : 0), 0, 1);
    const s = Math.sin(car.yaw), c = Math.cos(car.yaw);
    const rearOff = -car.halfLen * 0.58;
    const w = car.halfWid * 0.78;
    [[-1, 'L'], [1, 'R']].forEach(([sd, id]) => {
      const x = car.pos.x + s * rearOff + c * (w * sd);
      const z = car.pos.z + c * rearOff - s * (w * sd);
      if (slipping) {
        SC.fx.addSkid('p' + id, x, z, s, c, 0.34, strength, G.time);
        if (Math.random() < strength * 0.55) SC.fx.smoke(x, SC.world.groundHeight(x, z) + 0.05, z, strength);
      } else SC.fx.endSkid('p' + id);
    });
    /* غبار على الرمل */
    if (car.kmh > 25 && SC.world.onSand(car.pos.x, car.pos.z) && Math.random() < 0.6) {
      const bx = car.pos.x - s * car.halfLen * 0.5, bz = car.pos.z - c * car.halfLen * 0.5;
      SC.fx.dust(bx, 0.12, bz);
    }
    skidTimer += dt;
    if (skidTimer > 0.5) { SC.fx.fadeSkid(G.time); skidTimer = 0; }
  }

  /* ------------------------------- البحر -------------------------------- */
  /* الوصول إلى الماء يعني الغرق: تغرق المركبة ثم تعود إلى أقرب طريق */
  function updateWater(dt, car) {
    if (G.drowning != null) {
      G.drowning += dt;
      car.root.position.y -= dt * 1.5;
      car.input.throttle = 0; car.input.brake = 0;
      car.vLong *= 0.90; car.vLat *= 0.90;
      if (G.drowning > 0.35 && !G.drownSplash) {
        G.drownSplash = true;
        for (let i = 0; i < 26; i++) {
          SC.fx.emit(car.pos.x + (Math.random() - 0.5) * 3, 0.2, car.pos.z + (Math.random() - 0.5) * 3,
            (Math.random() - 0.5) * 5, 2.5 + Math.random() * 4, (Math.random() - 0.5) * 5,
            { life: 1.2, size: 1.1, grow: 1.6, alpha: 0.55, color: [0.72, 0.86, 0.95] });
        }
      }
      if (G.drowning > 1.9) {
        G.drowning = null; G.drownSplash = false;
        const fine = Math.min(save.money, 250);
        if (fine > 0) addMoney(-fine);
        if (SC.missions.state.active) {
          SC.missions.finish(false, 'غرقت في البحر');
        }
        respawn();
        SC.hud.banner('غرقت! 🌊', fine > 0 ? 'غرامة ' + U.money(fine) : '', 2200);
      }
      return;
    }
    if (SC.world.isWater(car.pos.x, car.pos.z)) {
      G.drowning = 0; G.drownSplash = false;
      SC.audio.crash(0.9);
      SC.audio.bad();
      U.vibrate(220);
      shake(1.0);
      return;
    }
    /* تحذير عند الاقتراب من الماء */
    const d = SC.world.distToWater(car.pos.x, car.pos.z);
    if (d < 90 && car.kmh > 40 && G.time - (G.lastSeaWarn || -99) > 6) {
      G.lastSeaWarn = G.time;
      SC.hud.toast('⚠️ البحر أمامك — انتبه!', 'bad', 2000);
    }
  }

  /* -------------------------- مهمّة قريبة للبدء ------------------------- */
  function checkNearMission(car) {
    if (SC.missions.state.active) { if (G.nearMission) { G.nearMission = null; SC.ui.showPrompt(null); } return; }
    let best = null, bd = 16;
    for (const m of G.missionMarkers) {
      const d = Math.hypot(m.def.from.x - car.pos.x, m.def.from.z - car.pos.z);
      if (m.mesh.userData.setFade) m.mesh.userData.setFade(U.clamp((d - 8) / 16, 0, 1));
      if (d < bd) { bd = d; best = m.def; }
    }
    if (best !== G.nearMission) {
      G.nearMission = best;
      SC.ui.showPrompt(best);
    }
  }

  /* ------------------------------ الحلقة -------------------------------- */
  function frame() {
    requestAnimationFrame(frame);
    if (!G.ready) return;
    const raw = G.clock.getDelta();
    const dt = Math.min(raw, 0.05);
    G.fps = U.lerp(G.fps, 1 / Math.max(raw, 0.0001), 0.05);
    step(dt);
    G.renderer.render(G.scene, G.camera);
  }

  /* خطوة منطقية واحدة (منفصلة عن الرسم لتسهيل الاختبار) */
  function step(dt) {
    G.time += dt;
    G.frames++;
    const car = G.car;
    const active = !G.paused;

    if (active) {
      const inp = SC.input.update(dt, settings);
      const frozen = SC.missions.state.countdown > 0;
      car.input = frozen
        ? { throttle: 0, brake: 1, steer: 0, handbrake: 1, boost: 0 }
        : { throttle: inp.throttle, brake: inp.brake, steer: inp.steer, handbrake: inp.handbrake, boost: inp.boost };
      car.update(dt, car.input);
      save.stats.distance += car.distance - (car._lastDist || 0);
      car._lastDist = car.distance;
      save.stats.topSpeed = Math.max(save.stats.topSpeed, Math.round(car.kmh));

      /* المنافسون */
      const all = [car].concat(G.rivals);
      G.rivalAI.forEach((a) => {
        if (a.active) a.update(dt, all);
        else { a.v.input = { throttle: 0, brake: 1, steer: 0, handbrake: 1, boost: 0 }; a.v.update(dt, a.v.input); }
      });

      /* المرور */
      if (settings.traffic) SC.traffic.update(dt, car, all.concat(SC.traffic.vehicles()));

      /* تصادم اللاعب مع المركبات الأخرى */
      collideVehicles(car, G.rivals.concat(SC.traffic.vehicles()));

      updateSkids(dt, car);
      updateWater(dt, car);
      SC.fx.updateParticles(dt);

      /* تتبّع موضع اللاعب على مسار السباق */
      const ms = SC.missions.state;
      if (ms.active && ms.active.path) {
        const p = ms.active.path;
        let best = G.playerPathIdx, bd = 1e9;
        for (let k = -4; k < 14; k++) {
          const i = (G.playerPathIdx + k + p.length) % p.length;
          const d = (p[i].x - car.pos.x) ** 2 + (p[i].z - car.pos.z) ** 2;
          if (d < bd) { bd = d; best = i; }
        }
        G.playerPathIdx = best;
      }

      SC.missions.update(dt, car);
      checkNearMission(car);
      updateArrow(car);
    }

    updateCamera(dt, car);
    SC.world.update(dt, car.pos);
    SC.audio.update(dt, car, G.paused);
    SC.hud.update(dt, {
      car, traffic: SC.traffic.vehicles(), rivals: G.rivals, waypoint: G.waypoint,
      mapRotate: settings.mapRotate, miniZoom: G.miniZoom
    });
    SC.ui.tick(dt, G);
  }

  /* اصطدام بسيط بين المركبات (دوائر) */
  function collideVehicles(car, others) {
    for (const o of others) {
      const dx = o.pos.x - car.pos.x, dz = o.pos.z - car.pos.z;
      const d = Math.hypot(dx, dz);
      const rr = (car.halfLen + o.halfLen) * 0.62;
      if (d > rr || d < 1e-4) continue;
      const nx = dx / d, nz = dz / d;
      const push = (rr - d) * 0.5;
      const massRatio = o.def.mass / (o.def.mass + car.def.mass);
      car.pos.x -= nx * push * (massRatio * 2 * 0.8);
      car.pos.z -= nz * push * (massRatio * 2 * 0.8);
      o.pos.x += nx * push * ((1 - massRatio) * 2 * 0.8);
      o.pos.z += nz * push * ((1 - massRatio) * 2 * 0.8);
      const s = Math.sin(car.yaw), c = Math.cos(car.yaw);
      const nLong = nx * s + nz * c, nLat = nx * c - nz * s;
      const vN = car.vLong * nLong + car.vLat * nLat;
      if (vN > 0) {
        car.vLong -= vN * nLong * 1.2; car.vLat -= vN * nLat * 1.2;
        o.vLong += vN * 0.5;
        const p = Math.min(1, Math.abs(vN) / 16);
        if (p > 0.06) { SC.audio.crash(p * 0.8); shake(p * 0.6); U.vibrate(Math.round(p * 60)); }
      }
    }
  }

  /* سهم يشير إلى الهدف الحالي */
  function updateArrow(car) {
    let target = null;
    const ms = SC.missions.state;
    if (ms.active) {
      const cps = ms.checkpoints;
      if (cps.length) {
        const cp = ms.active.type === 'delivery' || ms.active.type === 'collect'
          ? cps.find((c) => !c.done) : cps[ms.cpIndex % cps.length];
        if (cp) target = cp;
      }
    } else if (G.waypoint) target = G.waypoint;
    if (!target) { G.arrow.visible = false; return; }
    const d = Math.hypot(target.x - car.pos.x, target.z - car.pos.z);
    G.arrow.visible = d > 12;
    if (!G.arrow.visible) return;
    G.arrow.position.set(car.pos.x, car.pos.y + car.size.y + 2.1 + Math.sin(G.time * 3) * 0.12, car.pos.z);
    G.arrow.rotation.set(0, Math.atan2(target.x - car.pos.x, target.z - car.pos.z), 0);
  }

  /* ---------------------------- أوامر عامة ------------------------------ */
  function setTimeOfDay(name) {
    settings.timeOfDay = name;
    SC.world.setTimeOfDay(name);
    SC.world.refreshEnv(G.renderer, SC.world.state.pmrem);
    G.renderer.toneMappingExposure = SC.world.state.exposure;
    const night = SC.world.state.isNight;
    G.car.lightsOn = night;
    G.rivals.forEach((v) => { v.lightsOn = night; });
    SC.traffic.vehicles().forEach((v) => { v.lightsOn = night; });
    persist();
  }
  function setTraffic(on) {
    settings.traffic = on;
    SC.traffic.setCount(on ? SC.quality.traffic : 0, G.car.pos);
    persist();
  }
  function setQuality(name) {
    settings.quality = name;
    persist();
    location.reload();
  }
  function setWaypoint(p) {
    G.waypoint = p;
    if (p) SC.hud.toast('تم تعيين نقطة المسار', '', 1600);
  }
  function togglePause(v) {
    G.paused = v == null ? !G.paused : v;
    if (G.paused) SC.input.reset();
    return G.paused;
  }

  function start() {
    G.paused = false;
    G.mode = 'free';
    snapCamera();
    SC.audio.resume();
  }

  return {
    G, save, settings, init, frame, step, start, spawnPlayer, respawn, startMission,
    setTimeOfDay, setTraffic, setQuality, setWaypoint, togglePause, persist,
    addMoney, addXp, shake, snapCamera, refreshFreeMarkers, buildMissionMarkers,
    get car() { return G.car; }
  };
})();
