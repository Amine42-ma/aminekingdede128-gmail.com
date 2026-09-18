/* ============================================================================
   SPEED CITY — قلب اللعبة: العرض، الكاميرا، الحلقة الرئيسية، والحفظ
   ========================================================================== */
SC.game = (function () {
  const U = SC.util;
  const SAVE_KEY = 'speedcity.save.v2';

  const save = {
    money: 2500, xp: 0, level: 1, rep: 70,
    owned: ['cortina'], current: 'cortina',
    upgrades: { cortina: { engine: 0, tires: 0, brakes: 0, nitro: 0 } },
    colors: {}, done: {}, best: {}, radio: 'zero_latency',
    stats: { distance: 0, missions: 0, races: 0, topSpeed: 0 }
  };

  const settings = {
    quality: 'auto', shadows: true, steerMode: 'buttons', steerSense: 1.0,
    invertTilt: false, sound: true, volume: 0.85, music: 0.45, haptics: true, assist: true,
    lookSense: 1.0, peds: true, micOn: false, autoScale: true,
    mapRotate: true, timeOfDay: 'day', season: 'summer', traffic: true, camera: 'chase',
    engineSound: false
  };
  SC.settings = settings;

  const G = {
    renderer: null, scene: null, camera: null, car: null, clock: null,
    paused: true, mode: 'menu', waypoint: null, rivals: [], rivalAI: [],
    missions: [], missionMarkers: [], nearMission: null, nearPOI: null, playerPathIdx: 0,
    time: 0, frames: 0, fps: 60, ready: false, miniZoom: 0.95
  };

  /* --------------------------- إعدادات الجودة --------------------------- */
  /* ====================== مدير الجودة الديناميكي =========================
     ثلاثة مستويات واضحة، وكل مستوى يضبط كل ما يؤثّر في الأداء:

       منخفضة : بلا ظلال · بلا تنعيم حواف · دقّة منخفضة · بلا جزيئات
                (دخان الإطارات والشرر) · مدى رؤية قصير · مرور ومارّة أقلّ
       متوسطة : ظلال بسيطة ثابتة (PCFShadowMap) · دقّة الجهاز الطبيعية
       عالية  : ظلال ناعمة ديناميكية (PCFSoftShadowMap) · انعكاسات على
                هياكل السيارات · تنعيم حواف · دقّة الجهاز الكاملة

     يمكن تغييره أثناء اللعب من الإعدادات بلا إعادة تحميل. */
  const QUALITY_LEVELS = {
    low: {
      label: 'منخفضة', pixelRatio: 1, shadows: false, shadowType: null, shadowSize: 512,
      shadowRange: 55, aa: false, particles: 0, skidCount: 260, traffic: 6, peds: 6,
      far: 480, envIntensity: 0.35, reflections: false, lodBias: 0.62
    },
    medium: {
      label: 'متوسطة', pixelRatio: 'device', shadows: true, shadowType: 'basic', shadowSize: 1024,
      shadowRange: 70, aa: true, particles: 320, skidCount: 700, traffic: 10, peds: 10,
      far: 720, envIntensity: 0.75, reflections: false, lodBias: 0.85
    },
    high: {
      label: 'عالية', pixelRatio: 'full', shadows: true, shadowType: 'soft', shadowSize: 2048,
      shadowRange: 95, aa: true, particles: 460, skidCount: 1000, traffic: 16, peds: 14,
      far: 1000, envIntensity: 1.0, reflections: true, lodBias: 1
    }
  };

  function resolvePixelRatio(mode) {
    const dpr = window.devicePixelRatio || 1;
    if (mode === 'full') return Math.min(dpr, 2);
    if (mode === 'device') return Math.min(dpr, 1.75);
    return Math.min(dpr, 1);                 // منخفضة: بكسل واحد لكل بكسل شاشة
  }

  function pickQuality() {
    let q = settings.quality;
    if (q === 'auto') q = U.isMobile ? 'low' : 'high';
    const src = QUALITY_LEVELS[q] || QUALITY_LEVELS.medium;
    const p = Object.assign({}, src);
    p.pixelRatio = resolvePixelRatio(src.pixelRatio);
    if (!settings.shadows) { p.shadows = false; p.shadowType = null; }
    p.name = q;
    SC.quality = p;
    return p;
  }

  /* تطبيق المستوى على مشهد يعمل — بلا إعادة تحميل */
  function applyQuality(name) {
    if (name) settings.quality = name;
    const q = pickQuality();
    const R = G.renderer;
    if (!R) return q;

    R.setPixelRatio(q.pixelRatio);
    R.shadowMap.enabled = q.shadows;
    R.shadowMap.type = q.shadowType === 'soft' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    R.shadowMap.needsUpdate = true;

    const sun = SC.world.state.sun;
    if (sun) {
      sun.castShadow = q.shadows;
      if (q.shadows) {
        sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
        const S = q.shadowRange;
        sun.shadow.camera.left = -S; sun.shadow.camera.right = S;
        sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
        sun.shadow.camera.updateProjectionMatrix();
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      }
    }

    /* الانعكاسات على هياكل السيارات: خريطة البيئة */
    const scn = G.scene;
    if (scn) scn.environmentIntensity = q.reflections ? q.envIntensity
                                                     : Math.min(q.envIntensity, 0.4);

    /* الجزيئات: مُطفأة تماماً في المستوى المنخفض */
    if (SC.fx && SC.fx.setBudget) SC.fx.setBudget(q.particles, q.skidCount);

    /* كثافة الحياة في المدينة */
    if (SC.traffic && SC.traffic.setCount) SC.traffic.setCount(settings.traffic ? q.traffic : 0);
    if (SC.peds && SC.peds.setCount && G.car) SC.peds.setCount(settings.peds ? q.peds : 0, G.car.pos);

    /* مدى الرؤية */
    if (G.camera) {
      G.camera.far = Math.max(1500, q.far * 1.6);
      G.camera.updateProjectionMatrix();
    }
    G.qualityFar = q.far;
    SC.world.state.quality = q;
    persist();
    return q;
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
  /* الثقة/السمعة: تقلّ عند صدم المارّة وتزيد بإنجاز المهام والقيادة الهادئة */
  function addRep(n, reason) {
    const before = save.rep;
    save.rep = U.clamp((save.rep || 70) + n, 0, 100);
    if (Math.floor(before) !== Math.floor(save.rep)) persist();
    SC.ui && SC.ui.refreshWallet();
    if (n < 0 && save.rep < 25 && before >= 25) {
      SC.hud.toast('سمعتك سيّئة جداً — لن يثق بك أحد!', 'bad', 3200);
    }
    return save.rep;
  }
  const repMult = () => 0.8 + (save.rep || 70) / 250;

  function addXp(n) {
    save.xp += n;
    const need = () => save.level * 500;
    while (save.xp >= need()) { save.xp -= need(); save.level++; SC.hud.banner('المستوى ' + save.level, 'ارتقيت!', 2200); SC.audio.good(); }
    persist();
    SC.ui && SC.ui.refreshWallet();
  }

  /* ------------------------------ التهيئة ------------------------------- */
  async function init(dom, sources) {
    G.dom = dom;
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
    const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.42, q.far * 3.6);
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
    if (settings.season === 'winter') SC.world.setSeason('winter');
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

    /* المرور والمارّة */
    SC.traffic.init(scene, 0);
    if (settings.traffic) SC.traffic.setCount(q.traffic, G.car.pos);
    SC.peds.init(scene, 0);
    if (settings.peds !== false) SC.peds.setCount(q.peds, G.car.pos);
    G.onPedHit = onPedHit;

    /* المهام */
    G.missions = SC.missions.generate(4242);
    SC.missions.init({
      scene, get car() { return G.car; },
      addRival, clearRivals, setRivalsActive, racePosition, setPassenger, addMoney,
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
    car.onStunt = (secs, kind) => onStunt(secs, kind);
    document.body.classList.toggle('on-bike', !!car.isBike);
    G.scene.add(car.root);
    G.car = car;
    save.current = id;
    const sp = keepPos && pos ? { x: pos.x, z: pos.z, yaw } : SC.world.nearestSpawn(pos ? pos.x : 30, pos ? pos.z : 30);
    car.place(sp.x, sp.z, sp.yaw);
    car.lightsOn = SC.world.state.isNight;
    car.setFirstPerson(settings.camera === 'hood');
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

  /* ==================== سباق الاستعراض خلف شاشة البداية ==================
     خلف القائمة يدور سباق قصير: سيارتك تنطلق من آخر الشبكة، تحتكّ
     بالمنافسين وتتقدّم، وتفوز قرب نهاية المقطع الموسيقي ثم يُعاد من جديد.
     لا يمسّ حفظك ولا موقع سيارتك: كل شيء يعود كما كان عند «ابدأ اللعب». */
  const ATTRACT = { intro: 4.0, race: 52.0, win: 9.0 };     // ≈ ٦٥ ثانية

  /* خطّ سير موازٍ للحلقة بإزاحة جانبية: بدونه يطلب الجميع نفس الخطّ
     تماماً فيتكدّسون في المنعطف الأوّل ويقفون */
  function lanePath(base, off) {
    const n = base.length;
    return base.map((p, i) => {
      const q = base[(i + 1) % n];
      const dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz) || 1;
      return { x: p.x + (-dz / L) * off, z: p.z + (dx / L) * off };
    });
  }

  function startAttract() {
    if (G.attract || !G.ready || !G.car) return;
    const car = G.car;
    const base = SC.missions.circuitPath(5, 5, 4, 4);   // حلقة واسعة بمستقيمات طويلة
    const A = { t: 0, path: base, shot: 0, shotT: 0, won: false, acc: 0, lastHit: -9,
                saved: { x: car.pos.x, z: car.pos.z, yaw: car.yaw },
                savedLights: car.lightsOn, camPos: new THREE.Vector3(), camAt: new THREE.Vector3() };

    const p0 = base[0], p1 = base[1];
    const yaw = Math.atan2(p1.x - p0.x, p1.z - p0.z);
    const fx = Math.sin(yaw), fz = Math.cos(yaw);          // إلى الأمام
    const rx = fz, rz = -fx;                               // إلى اليمين
    const put = (lat, along) => ({ x: p0.x + rx * lat + fx * along,
                                   z: p0.z + rz * lat + fz * along });

    clearRivals();
    /* لكلٍّ مساره: أربعة خطوط متجاورة على عرض الطريق */
    const LANES = [2.4, -2.4, 0.8, -0.8];                  // [أنت, ثلاثة منافسين]
    const grid = [[LANES[1], -2], [LANES[2], -11], [LANES[3], -20]];
    grid.forEach((g, i) => {
      const q = put(g[0], g[1]);
      const lp = lanePath(base, LANES[i + 1]);
      const ai = addRival(lp, 0.56 + i * 0.03, q.x, q.z, yaw, i);
      ai.wp = 1;
    });
    setRivalsActive(false);

    const myPath = lanePath(base, LANES[0]);
    const me = put(LANES[0], -29);
    car.place(me.x, me.z, yaw);
    car.lightsOn = SC.world.state.isNight;
    A.ai = new SC.AIDriver(car, { skill: 0.68, path: myPath, targetSpeed: car.def.topSpeed * 0.45 });
    A.ai.active = false;
    A.ai.wp = 0;

    G.attract = A;
    G.mode = 'attract';
    G.freezeCam = true;
    document.body.classList.add('attract');
    snapAttractCamera();
    SC.audio.menuPlay();
  }

  function stopAttract() {
    const A = G.attract;
    if (!A) return;
    clearRivals();
    G.attract = null;
    G.mode = 'menu';
    G.freezeCam = false;
    document.body.classList.remove('attract');
    SC.audio.menuStop(0.7);
    const car = G.car;
    const sp = SC.world.nearestSpawn(A.saved.x, A.saved.z);
    car.place(sp.x, sp.z, sp.yaw);
    car.input = { throttle: 0, brake: 0, steer: 0, handbrake: 0, boost: 0, wheelie: 0 };
    car.lightsOn = A.savedLights;
    snapCamera();
  }

  function resetAttract() {
    const A = G.attract;
    if (!A) return;
    const keep = A.saved, lights = A.savedLights;
    G.attract = null;
    clearRivals();
    startAttract();
    if (G.attract) { G.attract.saved = keep; G.attract.savedLights = lights; }
  }

  function updateAttract(dt) {
    const A = G.attract;
    if (!A) return;
    A.t += dt;
    const T = ATTRACT, car = G.car;
    const total = T.intro + T.race + T.win;

    /* انطلاق بعد العدّ التنازلي */
    const live = A.t > T.intro;
    if (live && !A.live) { A.live = true; setRivalsActive(true); A.ai.active = true; SC.audio.blip(880, 0.12); }

    /* شدّ الحبل: يلحق بهم أوّلاً ثم يتقدّم قرب النهاية فيفوز في وقته.
       سرعات مدينة معتدلة: المنعطفات هنا قائمة الزاوية، والاندفاع يقذف
       السيارة خارج الطريق فيضيع الاستعراض. */
    const k = U.clamp((A.t - T.intro) / T.race, 0, 1);
    const late = k > 0.82;                       // اللحظات الأخيرة: يتراجعون
    A.ai.targetSpeed = car.def.topSpeed * (0.42 + 0.22 * k);
    G.rivalAI.forEach((ai, i) => {
      ai.targetSpeed = ai.v.def.topSpeed *
        ((late ? 0.30 : 0.47 - 0.12 * k) + i * 0.012);
    });

    /* إن قذف منعطفٌ سيارةً بعيداً عن مسارها أعِد ربطها بأقرب نقطة —
       بدونها تتوه بقيّة الجولة لأن الملاحة لا تتقدّم إلا عن قرب.
       وإن وقفت تماماً (تكدّس في زاوية) أعِدها إلى الخطّ: هذا استعراض
       في الخلفية، ووقوف سيارة فيه أسوأ من إعادة صامتة. */
    const fix = (ai) => {
      const path = ai.path || A.path;
      const t = path[ai.wp % path.length];
      const far = Math.hypot(t.x - ai.v.pos.x, t.z - ai.v.pos.z) > 55;
      ai.dead = (Math.abs(ai.v.kmh) < 4) ? (ai.dead || 0) + dt : 0;
      if (!far && ai.dead < 1.6) return;
      let best = 0, bd = 1e9;
      for (let i = 0; i < path.length; i++) {
        const q = path[i];
        const d = Math.hypot(q.x - ai.v.pos.x, q.z - ai.v.pos.z);
        if (d < bd) { bd = d; best = i; }
      }
      ai.wp = (best + 1) % path.length;
      if (ai.dead >= 1.6) {
        const a = path[best], b = path[(best + 1) % path.length];
        ai.v.place(a.x, a.z, Math.atan2(b.x - a.x, b.z - a.z));
        ai.dead = 0; ai.stuck = 0; ai.reverse = 0;
      }
    };
    fix(A.ai);
    G.rivalAI.forEach(fix);

    /* فيزياء بخطوة ثابتة لكل السيارات */
    const all = G.rivals.concat([car]);
    A.acc = Math.min(A.acc + dt, 0.25);
    let n = 0;
    while (A.acc >= FIXED && n < 4) {
      A.ai.update(FIXED, all);
      G.rivalAI.forEach((ai) => ai.update(FIXED, all));
      A.acc -= FIXED; n++;
    }

    /* الاحتكاك بين السيارات: تلامس ودفع وشرر — لا تحطيم */
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const minD = (a.halfLen + b.halfLen) * 0.52;
        if (d > minD || d < 1e-4) continue;
        const ux = dx / d, uz = dz / d, push = (minD - d) * 0.40;
        a.pos.x -= ux * push; a.pos.z -= uz * push;
        b.pos.x += ux * push; b.pos.z += uz * push;
        a.yawRate -= 0.35 * dt * 60 * 0.016; b.yawRate += 0.35 * dt * 60 * 0.016;
        if (A.t - A.lastHit > 0.45) {
          A.lastHit = A.t;
          SC.audio.crash(0.30);
          const mx = (a.pos.x + b.pos.x) / 2, mz = (a.pos.z + b.pos.z) / 2;
          const my = SC.world.groundHeight(mx, mz) + 0.65;
          for (let sp = 0; sp < 6; sp++) SC.fx.spark(mx, my, mz, ux, uz);
        }
      }
    }

    /* لحظة الفوز ثم إعادة الجولة */
    if (!A.won && A.t >= T.intro + T.race) {
      A.won = true;
      if (G.dom && G.dom.attractWin) G.dom.attractWin.classList.add('show');
      SC.audio.good && SC.audio.good();
    }
    if (A.t >= total) {
      if (G.dom && G.dom.attractWin) G.dom.attractWin.classList.remove('show');
      resetAttract();
      return;
    }

    attractCamera(dt);
    SC.fx.updateParticles(dt);
  }

  /* ------------------------ كاميرا سينمائية للاستعراض ------------------- */
  const _av = new THREE.Vector3(), _aw = new THREE.Vector3();

  /* لوحة القائمة تحتلّ وسط الشاشة، فنُميل هدف الكاميرا جانباً حتى تظهر
     السيارات في ثلث الشاشة لا خلف اللوحة */
  function biasAim(s) {
    const dx = s.tx - s.px, dz = s.tz - s.pz;
    const L = Math.hypot(dx, dz) || 1;
    const b = 0.36 * L;
    s.tx += (-dz / L) * b;
    s.tz += (dx / L) * b;
    return s;
  }

  function attractShot(i, car, t) {
    const yaw = car.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw);
    const rx = fz, rz = -fx;
    const p = car.pos;
    return biasAim(rawShot(i, p, fx, fz, rx, rz));
  }

  function rawShot(i, p, fx, fz, rx, rz) {
    switch (i % 5) {
      case 0:   // منخفضة أمام السيارة تنظر إليها
        return { px: p.x + fx * 9.5, py: 1.0, pz: p.z + fz * 9.5,
                 tx: p.x, ty: 0.9, tz: p.z, fov: 42 };
      case 1:   // جانبية قريبة تمرّ معها
        return { px: p.x + rx * 6.5 - fx * 1.5, py: 1.35, pz: p.z + rz * 6.5 - fz * 1.5,
                 tx: p.x, ty: 0.85, tz: p.z, fov: 50 };
      case 2:   // مطاردة منخفضة خلفها
        return { px: p.x - fx * 7.5, py: 1.9, pz: p.z - fz * 7.5,
                 tx: p.x + fx * 6, ty: 1.1, tz: p.z + fz * 6, fov: 58 };
      case 3:   // من الأعلى مائلة
        return { px: p.x - fx * 10 + rx * 7, py: 9.5, pz: p.z - fz * 10 + rz * 7,
                 tx: p.x + fx * 4, ty: 0.8, tz: p.z + fz * 4, fov: 46 };
      default:  // عجلة قريبة: الإحساس بالسرعة
        return { px: p.x - rx * 3.0 - fx * 2.2, py: 0.55, pz: p.z - rz * 3.0 - fz * 2.2,
                 tx: p.x + fx * 2, ty: 0.7, tz: p.z + fz * 2, fov: 62 };
    }
  }

  function snapAttractCamera() {
    const A = G.attract; if (!A) return;
    const s = attractShot(0, G.car, 0);
    G.camera.position.set(s.px, s.py, s.pz);
    G.camera.lookAt(s.tx, s.ty, s.tz);
    A.camPos.set(s.px, s.py, s.pz);
    A.camAt.set(s.tx, s.ty, s.tz);
  }

  function attractCamera(dt) {
    const A = G.attract, car = G.car;
    A.shotT += dt;
    /* اللقطة الأخيرة تُترك للفوز */
    const dur = A.won ? 99 : 7.0;
    if (A.shotT > dur) { A.shotT = 0; A.shot++; }
    const s = attractShot(A.won ? 0 : A.shot, car, A.shotT);
    const lerp = Math.min(1, dt * (A.shotT < 0.12 ? 60 : 6));
    _av.set(s.px, s.py, s.pz);
    _aw.set(s.tx, s.ty, s.tz);
    A.camPos.lerp(_av, lerp);
    A.camAt.lerp(_aw, lerp);
    /* لا تدخل الأرض */
    const gy = SC.world.groundHeight(A.camPos.x, A.camPos.z);
    if (A.camPos.y < gy + 0.35) A.camPos.y = gy + 0.35;
    G.camera.position.copy(A.camPos);
    G.camera.lookAt(A.camAt);
    if (Math.abs(G.camera.fov - s.fov) > 0.3) {
      G.camera.fov = U.lerp(G.camera.fov, s.fov, Math.min(1, dt * 4));
      G.camera.updateProjectionMatrix();
    }
  }

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
    if (res.def.online && res.success && SC.net && SC.net.connected) {
      SC.net.send({ t: 'race', to: res.def.opponent, kind: 'finish', time: res.time });
      SC.hud.banner('فزت بالسباق!', '', 2600);
    }
    setMissionMarkersVisible(true);
    refreshFreeMarkers();
    if (res.success) {
      addMoney(Math.round(res.money * repMult())); addXp(res.xp);
      addRep(res.def.type === 'taxi' ? 3 : 1.5);
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
    const need = def.minRep || 0;
    if ((save.rep || 70) < need) {
      SC.hud.toast('ثقتهم بك منخفضة (' + Math.round(save.rep) + '٪) — لن يقبلوا العمل معك', 'bad', 3200);
      SC.audio.bad();
      return false;
    }
    if (def.type === 'taxi' && G.car.def.driver && G.car.def.driver.pose === 'bike') {
      SC.hud.toast('لا يمكن نقل الركّاب بالدرّاجة — بدّل إلى سيارة', 'bad', 3000);
      return false;
    }
    setMissionMarkersVisible(false);
    G.mode = 'mission';
    SC.missions.start(def);
    SC.ui.hideAll();
    G.paused = false;
    return true;
  }

  /* راكب يجلس بجوار السائق أثناء مهمّات الأجرة */
  function setPassenger(on) {
    const car = G.car;
    if (!on) {
      if (G.passenger) { car.cabin.remove(G.passenger.root); G.passenger = null; }
      return;
    }
    if (G.passenger || !car.def.driver) return;
    const d = car.def.driver;
    const p = SC.character.create({ pose: 'car' });
    p.root.position.set(-d.seat[0], d.seat[1], d.seat[2] - 0.05);
    p.root.scale.setScalar((d.scale || 1) * 0.97);
    p.root.rotation.y = 0.12;
    car.cabin.add(p.root);
    G.passenger = p;
  }

  /* ------------------------------ الكاميرا ------------------------------ */
  /* أربعة أوضاع: خلفية · بعيدة · داخل المقصورة (منظور أول) · دوران حرّ.
     في كل الأوضاع يمكن سحب الإصبع لتدوير الكاميرا والنظر خلفك،
     وبإصبعين للتقريب والإبعاد.                                            */
  const camState = { pos: new THREE.Vector3(), look: new THREE.Vector3(), shake: 0, fov: 62 };
  const _cv = new THREE.Vector3(), _cv2 = new THREE.Vector3();
  function shake(a) { camState.shake = Math.min(1.2, camState.shake + a); }

  /* ----------------------------- حيل الدرّاجة ---------------------------
     تُحتسب المكافأة عند إنزال العجلة: كلّما طالت المدّة زاد المال والسمعة. */
  function onStunt(secs, kind) {
    if (secs < 1.2) return;                       // أقلّ من ثانية: لا تُحتسب
    const label = kind === 'stoppie' ? 'وقوف على المقدّمة' : 'وقوف على عجلة';
    const cash = Math.round(Math.min(secs, 12) * 26 * repMult());
    addMoney(cash);
    addRep(Math.min(1.2, secs * 0.18), 'stunt');
    save.stuntBest = Math.max(save.stuntBest || 0, secs);
    persist();
    SC.hud.toast(label + ' ' + secs.toFixed(1) + 'ث  +$' + cash, 'good', 2000);
    SC.audio.ui && SC.audio.ui(1);
    U.vibrate(18);
  }

  /* شارة المدّة الحيّة أعلى الشاشة */
  function updateStuntBadge(car) {
    const d = G.dom; if (!d || !d.stunt) return;
    const live = car.isBike && (car.wheelie > 0.45 || car.stoppie > 0.45);
    if (live) {
      d.stuntTime.textContent = car.wheelieTime.toFixed(1) + 'ث';
      d.stuntName.textContent = car.wheelie >= car.stoppie ? 'وقوف على عجلة' : 'وقوف على المقدّمة';
    }
    if (live !== G._stuntShown) { G._stuntShown = live; d.stunt.classList.toggle('show', live); }
    if (d.wheelie) d.wheelie.classList.toggle('active', !!(car.wheelie > 0.2));
  }

  const CAM_MODES = ['chase', 'far', 'hood', 'orbit'];
  const CAM_NAMES = { chase: 'خلفية', far: 'بعيدة', hood: 'من داخل المقصورة', orbit: 'دوران حول السيارة' };

  function updateCamera(dt, car) {
    const mode = settings.camera;
    const look = SC.input.look;
    const spd = U.clamp(car.kmh / 180, 0, 1);
    const fwd = car.forward;

    if (mode === 'hood') {
      /* منظور الشخص الأول: العين مثبّتة في مقعد السائق — لا تتأخّر ولا
         تتراجع مع التسارع، تدور فقط مع السيارة أو مع إصبعك. */
      const d = car.def.driver;
      const eye = d ? d.eye : [0, car.def.seatH + 0.35, 0];
      /* نحسب العين من جذع السيارة (موضع + دوران فقط) لا من المقصورة:
         المقصورة تميل مع التسارع وترتدّ مع التعليق، وهذا ما كان يجعل
         المنظور يتراجع إلى الوراء عند الانطلاق. */
      car.root.updateMatrixWorld(true);
      _cv.set(eye[0], eye[1] + (car.bodyY || 0) * 0.3, eye[2]);
      car.root.localToWorld(_cv);
      pushOutOfWalls(_cv, 0.25);
      camState.pos.copy(_cv);                       // تثبيت تامّ بلا تنعيم

      const yaw = car.yaw + look.yaw;
      const pitch = look.pitch * 0.9;
      _cv2.set(
        camState.pos.x + Math.sin(yaw) * Math.cos(pitch) * 12,
        camState.pos.y - Math.sin(pitch) * 12 + 0.2,
        camState.pos.z + Math.cos(yaw) * Math.cos(pitch) * 12
      );
      camState.look.lerp(_cv2, 1 - Math.exp(-26 * dt));
    } else {
      const orbit = mode === 'orbit';
      const baseDist = (mode === 'far' ? 11.5 : orbit ? 8.5 : 6.6);
      const back = orbit ? 1 : 1 + spd * 0.35;
      const dist = (baseDist * back + car.halfLen * 0.75) * look.zoom;
      const height = (mode === 'far' ? 5.2 : orbit ? 2.6 : 2.85) + (orbit ? 0 : spd * 0.45);

      const yaw = car.yaw + look.yaw;
      const pitch = U.clamp((orbit ? 0.16 : 0.10) + look.pitch, -0.35, 1.15);
      const cp = Math.cos(pitch);
      _cv.set(
        car.pos.x - Math.sin(yaw) * dist * cp,
        car.pos.y + height + Math.sin(pitch) * dist,
        car.pos.z - Math.cos(yaw) * dist * cp
      );
      if (!orbit) {
        // انزلاق جانبي بسيط أثناء الدريفت
        const side = new THREE.Vector3(Math.cos(car.yaw), 0, -Math.sin(car.yaw));
        _cv.addScaledVector(side, U.clamp(car.vLat * 0.16, -2.4, 2.4));
      }
      clampCamera(car.pos, _cv);            // لا تخترق الكاميرا المباني
      const lag = orbit ? 12 : (mode === 'far' ? 7 : (9 + spd * 9));
      camState.pos.lerp(_cv, 1 - Math.exp(-lag * dt));
      clampCamera(car.pos, camState.pos);   // بعد التنعيم كذلك، حتى لا تعبر الجدار

      // ننظر إلى الأمام عند القيادة، وإلى السيارة نفسها عند تدوير الكاميرا
      const ahead = (9 + spd * 7) * Math.max(0, Math.cos(look.yaw)) * (orbit ? 0 : 1);
      _cv2.copy(car.pos).addScaledVector(fwd, ahead);
      _cv2.y += orbit ? car.size.y * 0.55 : 1.4;
      camState.look.lerp(_cv2, 1 - Math.exp(-(11 + spd * 6) * dt));
    }

    /* اهتزاز — مخفَّف جداً داخل المقصورة حتى تبقى العين ثابتة */
    if (camState.shake > 0.001) {
      const sh = camState.shake * (mode === 'hood' ? 0.12 : 1);
      camState.pos.x += (Math.random() - 0.5) * sh * 0.7;
      camState.pos.y += (Math.random() - 0.5) * sh * 0.5;
      camState.pos.z += (Math.random() - 0.5) * sh * 0.7;
      camState.shake = U.damp(camState.shake, 0, 6, dt);
    }
    G.camera.position.copy(camState.pos);
    G.camera.lookAt(camState.look);

    /* داخل المقصورة نقرّب مستوى القصّ حتى لا تُقطع أجزاء السيارة */
    const wantNear = mode === 'hood' ? 0.10 : 0.42;
    if (Math.abs(G.camera.near - wantNear) > 0.001) {
      G.camera.near = wantNear;
      G.camera.updateProjectionMatrix();
    }
    /* زاوية الرؤية ثابتة في المنظور الأول: توسيعها مع السرعة كان يجعل
       المشهد يبدو وكأنّه يتراجع إلى الوراء. */
    const targetFov = mode === 'hood' ? 72 : (62 + spd * 12 + (car.nitroActive ? 6 : 0));
    camState.fov = U.damp(camState.fov, targetFov, 5, dt);
    if (Math.abs(G.camera.fov - camState.fov) > 0.05) {
      G.camera.fov = camState.fov;
      G.camera.updateProjectionMatrix();
    }
  }

  /* يمنع الكاميرا من الدخول داخل المباني: نقصّر المسافة عند أول اصطدام */
  /* يمنع الكاميرا من الدخول داخل المباني أو الرؤية من خلفها.
     نفحص الشعاع من المركبة إلى الكاميرا، ونقصّر المسافة عند أول جدار،
     ثم نُخرج الكاميرا من أي صندوق تكون بداخله (يحدث عند الاصطدام بالجدار). */
  const CAM_PAD = 0.95;              // هامش أكبر من مستوى القصّ الأمامي
  /* الكاميرا تبقى دائماً على الخطّ الواصل بينها وبين المركبة.
     الدفع الجانبي القديم كان يزحلقها حول المبنى فتصير أمام السيارة
     وكأنّ المنظور انقلب إلى الوراء. */
  function clampCamera(from, want) {
    const dx = want.x - from.x, dz = want.z - from.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.2) return want;
    const ux = dx / len, uz = dz / len;
    let hit = len, hitTop = 0;
    const list = SC.world.queryColliders(from.x + ux * len * 0.5, from.z + uz * len * 0.5, len * 0.5 + 6);
    for (const c of list) {
      if (c.h && c.h < 1.2) continue;
      if (want.y > (c.h || 8) + 1.2) continue;         // الكاميرا أعلى من المبنى
      let t0 = 0, t1 = len;
      const slabs = [[from.x, ux, c.minX - CAM_PAD, c.maxX + CAM_PAD],
                     [from.z, uz, c.minZ - CAM_PAD, c.maxZ + CAM_PAD]];
      let ok = true;
      for (const [pp, d, lo, hi] of slabs) {
        if (Math.abs(d) < 1e-6) { if (pp < lo || pp > hi) { ok = false; break; } continue; }
        let ta = (lo - pp) / d, tb = (hi - pp) / d;
        if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) { ok = false; break; }
      }
      if (!ok) continue;
      if (t1 <= 0.02) continue;                        // الصندوق خلف المركبة
      const t = Math.max(0, t0);
      if (t < hit) { hit = t; hitTop = c.h || 8; }
    }
    let d = len;
    if (hit < len) {
      d = Math.max(1.5, hit - 0.45);
      want.y = Math.max(want.y, from.y + 1.2 + (len - d) * 0.4);
    }
    /* إن بقيت داخل جدار، تراجَع على نفس الخطّ — ولا تنزلق إلى الجانب أبداً */
    for (let k = 0; k < 8; k++) {
      want.x = from.x + ux * d;
      want.z = from.z + uz * d;
      if (!insideWall(want)) break;
      if (d <= 1.5) { want.y = Math.max(want.y, (hitTop || 8) + 1.6); break; }
      d = Math.max(1.5, d - Math.max(0.9, d * 0.22));
    }
    want.x = from.x + ux * d;
    want.z = from.z + uz * d;
    /* أثناء الغرق نسمح للكاميرا بالنزول تحت سطح البحر */
    const sinking = G.car && G.car.sink > 0.4;
    const floor = sinking ? SC.world.CFG.bedY + 1.5 : SC.world.groundHeight(want.x, want.z) + 0.6;
    want.y = Math.max(want.y, floor);
    return want;
  }

  /* هل النقطة داخل مبنى؟ */
  function insideWall(p) {
    const list = SC.world.queryColliders(p.x, p.z, 2.0);
    for (const c of list) {
      if (c.h && c.h < 1.2) continue;
      if (p.y > (c.h || 8) + 0.8) continue;
      if (p.x > c.minX - CAM_PAD && p.x < c.maxX + CAM_PAD &&
          p.z > c.minZ - CAM_PAD && p.z < c.maxZ + CAM_PAD) return true;
    }
    return false;
  }

  /* إخراج نقطة من داخل أي مبنى إلى أقرب حافة */
  function pushOutOfWalls(p, padOverride) {
    const list = SC.world.queryColliders(p.x, p.z, 2.5);
    for (const c of list) {
      if (c.h && c.h < 1.2) continue;
      if (p.y > (c.h || 8) + 0.8) continue;
      const pad = padOverride == null ? CAM_PAD : padOverride;
      if (p.x > c.minX - pad && p.x < c.maxX + pad && p.z > c.minZ - pad && p.z < c.maxZ + pad) {
        const dl = p.x - (c.minX - pad), dr = (c.maxX + pad) - p.x;
        const db = p.z - (c.minZ - pad), dt = (c.maxZ + pad) - p.z;
        const m = Math.min(dl, dr, db, dt);
        if (m === dl) p.x = c.minX - pad;
        else if (m === dr) p.x = c.maxX + pad;
        else if (m === db) p.z = c.minZ - pad;
        else p.z = c.maxZ + pad;
      }
    }
    return p;
  }

  function setCamera(mode) {
    settings.camera = mode;
    SC.input.resetLook();
    SC.input.look.zoom = 1;
    if (G.car) {
      G.car.setFirstPerson(mode === 'hood');
      snapCamera();
    }
    persist();
    return CAM_NAMES[mode] || mode;
  }
  function cycleCamera() {
    const i = CAM_MODES.indexOf(settings.camera);
    return setCamera(CAM_MODES[(i + 1) % CAM_MODES.length]);
  }

  function snapCamera() {
    const car = G.car;
    if (settings.camera === 'hood') {
      const d = car.def.driver;
      const eye = d ? d.eye : [0, car.def.seatH + 0.35, 0];
      car.root.updateMatrixWorld(true);
      camState.pos.copy(car.root.localToWorld(new THREE.Vector3(eye[0], eye[1], eye[2])));
      camState.look.copy(camState.pos).addScaledVector(car.forward, 12);
    } else {
      camState.pos.copy(car.pos).addScaledVector(car.forward, -9).add(new THREE.Vector3(0, 3.4, 0));
      camState.look.copy(car.pos);
    }
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

  /* --------------------------- صدم أحد المارّة --------------------------- */
  function onPedHit(power, ped) {
    const penalty = Math.round(4 + power * 11);
    const fine = Math.round(60 + power * 240);
    G.lastPedHit = G.time;
    addRep(-penalty);
    addMoney(-Math.min(save.money, fine));
    SC.audio.crash(power * 0.85);
    SC.audio.bad();
    shake(power * 0.7);
    U.vibrate(160);
    SC.hud.toast('صدمت أحد المارّة! −' + penalty + ' ثقة · −' + U.money(fine), 'bad', 2600);
    const ms = SC.missions.state;
    if (ms.active && ms.active.type === 'taxi' && ms.phase === 'drive') {
      ms.comfort = Math.max(0, (ms.comfort || 1) - 0.35);
    }
  }

  /* ------------------------------- البحر -------------------------------- */
  /* الوصول إلى الماء يعني الغرق: تغرق المركبة ثم تعود إلى أقرب طريق */
  function updateWater(dt, car) {
    if (G.drowning != null) {
      G.drowning += dt;
      car.sink = Math.min((car.sink || 0) + dt * 7.6, Math.abs(SC.world.CFG.bedY) - 1.2);
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
      if (G.drowning > 5.5) {
        G.drowning = null; G.drownSplash = false; car.sink = 0;
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

  /* أقرب مكان في المدينة: يظهر شريط «دخول» عند الاقتراب */
  function checkNearPOI(car) {
    const slow = car.kmh < 42;                    // لا يفتح وأنت مندفع
    const hit = slow ? SC.world.nearestPOI(car.pos.x, car.pos.z) : null;
    const poi = hit ? hit.poi : null;
    if (poi !== G.nearPOI) {
      G.nearPOI = poi;
      SC.ui.showPOI(poi);
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

  /* خطوة منطقية واحدة (منفصلة عن الرسم لتسهيل الاختبار).
     الفيزياء تعمل بخطوة ثابتة 60 مرّة في الثانية مهما كان عدد الإطارات،
     وهذا يمنع اهتزاز السيارات وتغيّر الإحساس بالقيادة على الأجهزة البطيئة. */
  const FIXED = 1 / 60;

  function step(dt) {
    G.time += dt;
    G.frames++;
    const car = G.car;

    if (!G.paused) {
      const inp = SC.input.update(dt, settings);
      const frozen = SC.missions.state.countdown > 0;
      car.input = frozen
        ? { throttle: 0, brake: 1, steer: 0, handbrake: 1, boost: 0, wheelie: 0 }
        : { throttle: inp.throttle, brake: inp.brake, steer: inp.steer, handbrake: inp.handbrake,
            boost: inp.boost, wheelie: inp.wheelie || 0 };

      /* خطوات فيزياء ثابتة */
      G.acc = Math.min((G.acc || 0) + dt, 0.30);
      let n = 0;
      while (G.acc >= FIXED && n < 6) { physicsStep(FIXED, car); G.acc -= FIXED; n++; }
      if (n === 0 && dt > 0.0005 && (G.sinceStep = (G.sinceStep || 0) + dt) > FIXED) {
        G.sinceStep = 0; physicsStep(FIXED, car);
      }

      /* تحديثات لا تحتاج خطوة ثابتة */
      SC.fx.updateParticles(dt);
      if (SC.net && SC.net.connected) SC.net.update(dt, car);
      SC.missions.update(dt, car);
      checkNearMission(car);
      checkNearPOI(car);
      updateStuntBadge(car);
      updateArrow(car);
    }

    if (G.paused && G.attract) updateAttract(dt);

    autoQuality(dt);
    if (!G.freezeCam) updateCamera(dt, car);
    const under = G.camera.position.y < SC.world.CFG.seaY - 0.1;
    if (under !== G.wasUnder) {
      G.wasUnder = under;
      SC.world.setUnderwater(under, car.pos.x, car.pos.z);
      SC.audio.setUnderwater(under);
      document.body.classList.toggle('underwater', under);
    }
    SC.world.update(dt, car.pos);
    SC.audio.update(dt, car, G.paused);
    SC.hud.update(dt, {
      car, traffic: SC.traffic.vehicles(), rivals: G.rivals, waypoint: G.waypoint,
      mapRotate: settings.mapRotate, miniZoom: G.miniZoom
    });
    SC.ui.tick(dt, G);
  }

  /* ضبط تلقائي لمدى الرؤية ودقّة الرسم حسب سلاسة اللعب على الجهاز */
  function autoQuality(dt) {
    if (settings.autoScale === false || !G.renderer) return;
    G.qTimer = (G.qTimer || 0) + dt;
    if (G.qTimer < 1.2) return;
    G.qTimer = 0;
    const fps = G.fps;
    const q = SC.quality;
    G.qScale = G.qScale == null ? 1 : G.qScale;
    const before = G.qScale;
    if (fps < 28) G.qScale = Math.max(0.55, G.qScale - 0.08);
    else if (fps > 48) G.qScale = Math.min(1, G.qScale + 0.04);
    if (Math.abs(G.qScale - before) > 0.001) {
      const far = q.far * G.qScale;
      G.scene.fog.far = far;
      G.scene.fog.near = far * 0.12;
      G.camera.far = Math.max(1500, far * 3.6);
      G.camera.updateProjectionMatrix();
      // القبّة دائماً داخل مدى الكاميرا وإلا ظهرت فجوة سوداء في السماء
      if (SC.world.state.sky) SC.world.state.sky.scale.setScalar(G.camera.far * 0.9);
    }
    /* خفض دقّة الرسم عند البطء الشديد (خطوات ثابتة تفادياً لإعادة البناء المتكرّر) */
    const want = fps < 24 ? 1 : (fps > 42 ? q.pixelRatio : (G.pxRatio || q.pixelRatio));
    if (want !== G.pxRatio) {
      G.pxRatio = want;
      G.renderer.setPixelRatio(want);
      G.renderer.setSize(innerWidth, innerHeight, false);
    }
  }

  /* كل ما يتعلّق بالحركة والاصطدام — بخطوة زمنية ثابتة */
  function physicsStep(h, car) {
    car.update(h, car.input);
    save.stats.distance += car.distance - (car._lastDist || 0);
    car._lastDist = car.distance;
    save.stats.topSpeed = Math.max(save.stats.topSpeed, Math.round(car.kmh));

    const all = [car].concat(G.rivals);
    G.rivalAI.forEach((a) => {
      if (a.active) a.update(h, all);
      else { a.v.input = { throttle: 0, brake: 1, steer: 0, handbrake: 1, boost: 0 }; a.v.update(h, a.v.input); }
    });

    if (settings.traffic) SC.traffic.update(h, car, all.concat(SC.traffic.vehicles()));
    collideVehicles(car, G.rivals.concat(SC.traffic.vehicles()));

    if (settings.peds !== false) SC.peds.update(h, car, G);
    G.repTimer = (G.repTimer || 0) + h;
    if (G.repTimer > 5) {
      G.repTimer = 0;
      if (car.impact < 0.05 && G.time - (G.lastPedHit || -99) > 25) addRep(0.35);
    }

    updateSkids(h, car);
    updateWater(h, car);

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

  /* ------------------------- شراء واختيار السيارات ---------------------- */
  function buyCar(id) {
    const def = SC.cars.defs[id];
    if (!def) return false;
    if (save.owned.indexOf(id) >= 0) return true;
    if (save.money < def.price) return false;
    addMoney(-def.price);
    save.owned.push(id);
    persist();
    SC.hud.toast('🎉 اشتريت ' + def.name, 'ok', 2600);
    return true;
  }

  function selectCar(id) {
    if (save.owned.indexOf(id) < 0) return false;
    if (save.current === id) return true;
    spawnPlayer(id, true);
    persist();
    SC.ui.refreshWallet();
    SC.hud.toast('🚗 ' + SC.cars.defs[id].name, '', 2000);
    return true;
  }

  /* ---------------------------- أوامر عامة ------------------------------ */
  function setSeason(v) {
    settings.season = v;
    SC.world.setSeason(v);
    SC.audio && SC.audio.setSeason && SC.audio.setSeason(v);
    persist();
    SC.hud.toast(v === 'winter' ? '❄️ حلّ الشتاء' : '☀️ عاد الصيف', '', 1600);
  }
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
  /* تغيير الجودة فوراً بلا إعادة تحميل */
  function setQuality(name) {
    const q = applyQuality(name);
    SC.hud.toast('🎚 الجودة: ' + q.label, '', 1800);
    return q;
  }
  function setWaypoint(p) {
    G.waypoint = p;
    if (p) SC.hud.toast('تم تعيين نقطة المسار', '', 1600);
  }
  function togglePause(v) {
    G.paused = v == null ? !G.paused : v;
    if (G.paused) { SC.input.reset(); SC.audio.radioPause(); }
    else SC.audio.radioResume();
    return G.paused;
  }

  function start() {
    G.paused = false;
    G.mode = 'free';
    SC.ui.layoutTopbar && SC.ui.layoutTopbar();
    snapCamera();
    SC.audio.resume();
    SC.audio.setSfxVolume(settings.sound ? 1 : 0);
    SC.audio.setEngineSound(settings.engineSound);
    SC.audio.setMusicVolume(settings.music == null ? 0.45 : settings.music);
    /* الراديو: يبدأ على آخر محطّة اخترتها ويعمل في أي مركبة تقودها */
    if ((settings.music == null ? 0.45 : settings.music) > 0) {
      if (!G.radioStarted) {
        G.radioStarted = true;
        SC.audio.radioSet(save.radio || 'ia_zero_latency');
      } else SC.audio.radioResume();
    } else SC.audio.stopMusic();
  }

  /* تشغيل/إيقاف المارّة */
  function setPeds(on) {
    settings.peds = on;
    SC.peds.setCount(on ? SC.quality.peds : 0, G.car.pos);
    persist();
  }

  /* سباق مباشر ضدّ لاعب آخر عبر الإنترنت */
  function startOnlineRace(defId, opponentId) {
    const base = G.missions.find((m) => m.id === defId) ||
                 G.missions.find((m) => m.type === 'race');
    if (!base) return false;
    const rival = SC.net.state.players.get(opponentId);
    const def = Object.assign({}, base, {
      rivals: 0, online: true, opponent: opponentId,
      title: 'سباق ضدّ ' + (rival ? rival.name : 'لاعب'),
      desc: 'سباق مباشر — أول من يُنهي اللفّات يفوز'
    });
    return startMission(def);
  }

  return {
    G, save, settings, init, frame, step, start, spawnPlayer, respawn, startMission, setSeason,
    applyQuality, QUALITY_LEVELS,
    buyCar, selectCar,
    setCamera, cycleCamera, CAM_MODES, CAM_NAMES,
    setTimeOfDay, setTraffic, setQuality, setWaypoint, togglePause, persist, setPeds, startOnlineRace,
    addMoney, addXp, addRep, repMult, setPassenger, shake, snapCamera,
    refreshFreeMarkers, buildMissionMarkers,
    startAttract, stopAttract,
    get car() { return G.car; }
  };
})();
