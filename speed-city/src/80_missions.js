/* ============================================================================
   SPEED CITY — المهام والسباقات
   أنواع: توصيل، سباق زمني بنقاط تفتيش، سباق ضد منافسين، وجمع الطرود
   ========================================================================== */
SC.missions = (function () {
  const U = SC.util;
  let ctx = null;
  const state = {
    active: null, checkpoints: [], cpIndex: 0, lap: 0, laps: 1,
    timeLeft: 0, elapsed: 0, collected: 0, rivals: [], started: false, countdown: 0
  };

  /* ------------------------- توليد مسار حلقي للسباق --------------------- */
  function circuitPath(bx, bz, w, h) {
    const W = SC.world, P = W.CFG.pitch, H = W.CFG.half;
    const x0 = -H + bx * P, x1 = -H + (bx + w) * P;
    const z0 = -H + bz * P, z1 = -H + (bz + h) * P;
    const corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    const pts = [];
    const STEP = 26, LANE = 5.2;
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i];
      const [bx2, bz2] = corners[(i + 1) % 4];
      const dx = bx2 - ax, dz = bz2 - az;
      const len = Math.hypot(dx, dz);
      const ux = dx / len, uz = dz / len;
      const nx = -uz * LANE, nz = ux * LANE;       // إزاحة إلى المسار الأيمن
      const n = Math.max(2, Math.round(len / STEP));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        pts.push({ x: ax + dx * t + nx, z: az + dz * t + nz });
      }
    }
    return pts;
  }

  /* مسار من نقاط طرق حرّة (للسباق الزمني) */
  function routeThrough(points) {
    const pts = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      const n = Math.max(2, Math.round(len / 26));
      for (let k = 0; k < n; k++) pts.push({ x: a.x + dx * k / n, z: a.z + dz * k / n });
    }
    return pts;
  }

  /* نقطة على الشارع قرب موقع معيّن */
  function roadNear(x, z, rnd) {
    const s = SC.world.snapToRoad(x, z);
    return { x: s.x, z: s.z };
  }

  /* ------------------------- قائمة المهام المتاحة ----------------------- */
  function generate(seed) {
    const rnd = U.rng(seed || 7788);
    const W = SC.world, N = W.CFG.blocks, P = W.CFG.pitch, H = W.CFG.half;
    const CFG_PITCH = P;
    const list = [];

    const spot = () => {
      const p = W.randomRoadPoint(rnd);
      return roadNear(p.x, p.z);
    };

    /* مهمّات التوصيل */
    const deliveryNames = [
      ['توصيل طرد', 'استلم الطرد ثم أوصله قبل انتهاء الوقت'],
      ['توصيل عاجل', 'شحنة مستعجلة — لا تتأخّر!'],
      ['نقل قطع غيار', 'الورشة تنتظر القطع']
    ];
    for (let i = 0; i < 3; i++) {
      const a = spot(), b = spot();
      const dist = Math.hypot(a.x - b.x, a.z - b.z);
      const nm = deliveryNames[i % deliveryNames.length];
      list.push({
        id: 'deliver' + i, type: 'delivery', title: nm[0], desc: nm[1],
        from: a, to: b, time: Math.max(60, dist / 15 + 28),
        reward: Math.round(320 + dist * 1.5), xp: 30, icon: '📦', color: '#f4b942'
      });
    }

    /* سباقات زمنية بنقاط تفتيش */
    for (let i = 0; i < 2; i++) {
      const bx = 1 + Math.floor(rnd() * (N - 3)), bz = 1 + Math.floor(rnd() * (N - 3));
      const path = circuitPath(bx - 1, bz - 1, 2, 2);
      const lapLen = 4 * 2 * CFG_PITCH;
      list.push({
        id: 'trial' + i, type: 'timeTrial', title: 'تحدّي الزمن ' + (i + 1),
        desc: 'اجتَز كل نقاط التفتيش قبل نفاد الوقت',
        path, cpEvery: 4, time: Math.round(lapLen / 17 + 22), laps: 1,
        from: path[0], reward: 900 + i * 350, xp: 55, icon: '⏱', color: '#38bdf8'
      });
    }

    /* سباقات ضد منافسين */
    const q = Math.max(2, Math.floor(N / 4));
    const raceDefs = [
      { bx: 1, bz: 1, w: 3, h: 3, name: 'سباق الحي الشمالي', laps: 2, reward: 1500, rivals: 3, skill: 0.62 },
      { bx: N - 5, bz: N - 5, w: 4, h: 3, name: 'جولة وسط المدينة', laps: 2, reward: 2400, rivals: 3, skill: 0.74 },
      { bx: q, bz: q, w: N - q * 2, h: N - q * 2, name: 'الحلبة الكبرى', laps: 1, reward: 4200, rivals: 4, skill: 0.85 }
    ];
    raceDefs.forEach((r, i) => {
      const path = circuitPath(r.bx, r.bz, r.w, r.h);
      list.push({
        id: 'race' + i, type: 'race', title: r.name, desc: 'تغلّب على المنافسين — ' + r.laps + ' لفّات',
        path, laps: r.laps, rivals: r.rivals, skill: r.skill, cpEvery: 6,
        from: path[0], reward: r.reward, xp: 90 + i * 30, icon: '🏁', color: '#ff5c5c'
      });
    });

    /* جمع الطرود */
    for (let i = 0; i < 1; i++) {
      const pts = [];
      for (let k = 0; k < 8; k++) pts.push(spot());
      list.push({
        id: 'collect' + i, type: 'collect', title: 'جمع الصناديق', desc: 'اجمع 8 صناديق منتشرة في المدينة',
        points: pts, time: 150, from: pts[0], reward: 1400, xp: 70, icon: '🎯', color: '#a78bfa'
      });
    }
    return list;
  }

  /* ------------------------------ التشغيل ------------------------------- */
  function init(context) { ctx = context; }

  function markerAt(x, z, color, radius) {
    const m = SC.fx.makeMarker(new THREE.Color(color), radius || 6.5);
    m.position.set(x, SC.world.groundHeight(x, z) + 0.02, z);
    ctx.scene.add(m);
    return m;
  }

  function clearVisuals() {
    state.checkpoints.forEach((c) => { if (c.mesh) ctx.scene.remove(c.mesh); });
    state.checkpoints = [];
    SC.hud.clearMarkers();
  }

  function start(def) {
    cancel(true);
    state.active = def;
    state.cpIndex = 0; state.lap = 0; state.elapsed = 0;
    state.collected = 0; state.started = false;
    state.laps = def.laps || 1;
    state.timeLeft = def.time || 0;
    state.result = null;

    if (def.type === 'delivery') {
      state.phase = 'pickup';
      addCheckpoint(def.from.x, def.from.z, '#f4b942', 7);
    } else if (def.type === 'collect') {
      def.points.forEach((p) => addCheckpoint(p.x, p.z, '#a78bfa', 5.5));
      state.collected = 0;
    } else {
      /* سباق: نقاط تفتيش على المسار */
      const every = def.cpEvery || 5;
      for (let i = 0; i < def.path.length; i += every) {
        const p = def.path[i];
        addCheckpoint(p.x, p.z, i === 0 ? '#7fe8c0' : '#38bdf8', 9);
      }
      state.countdown = 3.99;
      const p0 = def.path[0], p1 = def.path[1];
      const yaw = Math.atan2(p1.x - p0.x, p1.z - p0.z);
      ctx.car.place(p0.x, p0.z, yaw);
      ctx.car.nitro = 1;
      if (def.rivals) {
        for (let i = 0; i < def.rivals; i++) {
          const off = (i % 2 === 0 ? 1 : -1) * 3.4;
          const back = Math.floor(i / 2) * 8 + 8;
          const rx = p0.x - Math.sin(yaw) * back + Math.cos(yaw) * off;
          const rz = p0.z - Math.cos(yaw) * back - Math.sin(yaw) * off;
          ctx.addRival(def.path, def.skill + (Math.random() - 0.5) * 0.12, rx, rz, yaw, i);
        }
      }
    }
    updateHudMarkers();
    ctx.onStart && ctx.onStart(def);
    return state;
  }

  function addCheckpoint(x, z, color, radius) {
    const mesh = markerAt(x, z, color, radius);
    state.checkpoints.push({ x, z, r: radius || 7, mesh, done: false, color });
    return state.checkpoints[state.checkpoints.length - 1];
  }

  function updateHudMarkers() {
    const list = [];
    state.checkpoints.forEach((c, i) => {
      if (c.done) return;
      const def = state.active;
      const isNext = def && (def.type === 'delivery' || def.type === 'collect' ? true : i === state.cpIndex % state.checkpoints.length);
      list.push({ x: c.x, z: c.z, color: isNext ? '#ffd23f' : c.color, size: isNext ? 5.5 : 3.4, icon: '' });
    });
    SC.hud.setMarkers(list);
  }

  function cancel(silent) {
    clearVisuals();
    ctx && ctx.clearRivals && ctx.clearRivals();
    state.active = null;
    state.countdown = 0;
    if (!silent) SC.hud.setObjective(null);
  }

  /* ------------------------------ التحديث ------------------------------- */
  function update(dt, car) {
    const def = state.active;
    if (!def) return;

    /* العدّ التنازلي قبل السباق */
    if (state.countdown > 0) {
      const prev = Math.ceil(state.countdown);
      state.countdown -= dt;
      const now = Math.ceil(state.countdown);
      if (now !== prev) {
        if (now > 0) { SC.hud.banner(String(now), '', 700); SC.audio.count(false); }
        else { SC.hud.banner('انطلق!', '', 900); SC.audio.count(true); }
      }
      if (state.countdown <= 0) { state.started = true; ctx.setRivalsActive(true); }
      SC.hud.setObjective({
        title: def.title,
        text: 'استعد للانطلاق…',
        meta: '<b>' + Math.max(1, Math.ceil(state.countdown)) + '</b>'
      });
      return 'countdown';
    }
    state.started = true;
    state.elapsed += dt;
    if (def.time) {
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) return finish(false, 'انتهى الوقت');
    }

    const px = car.pos.x, pz = car.pos.z;

    /* دوران علامات نقاط التفتيش وتخفيتها عند الاقتراب */
    state.checkpoints.forEach((c) => {
      if (!c.mesh) return;
      if (c.mesh.userData.spin) c.mesh.userData.spin.rotation.z += dt * 1.2;
      if (c.mesh.userData.setFade) {
        const d = Math.hypot(c.x - px, c.z - pz);
        c.mesh.userData.setFade(U.clamp((d - 8) / 16, 0, 1));
      }
    });
    const near = (c) => Math.hypot(c.x - px, c.z - pz) < c.r + 2.2;

    if (def.type === 'delivery') {
      const cp = state.checkpoints[0];
      if (cp && near(cp)) {
        if (state.phase === 'pickup') {
          state.phase = 'dropoff';
          ctx.scene.remove(cp.mesh);
          state.checkpoints.length = 0;
          addCheckpoint(def.to.x, def.to.z, '#7fe8c0', 7);
          SC.audio.good();
          SC.hud.toast('تم استلام الشحنة — أوصلها الآن', 'ok');
          updateHudMarkers();
        } else {
          return finish(true);
        }
      }
      const target = state.checkpoints[0];
      const d = target ? Math.hypot(target.x - px, target.z - pz) : 0;
      SC.hud.setObjective({
        title: def.title,
        text: state.phase === 'pickup' ? 'اذهب إلى نقطة الاستلام' : 'أوصل الشحنة إلى الوجهة',
        meta: '<span>' + U.distText(d) + '</span> · <b class="' + (state.timeLeft < 15 ? 'red' : '') + '">' + U.clock(state.timeLeft) + '</b>',
        warn: state.timeLeft < 15
      });
    } else if (def.type === 'collect') {
      let remaining = 0, nearest = null, nd = 1e9;
      state.checkpoints.forEach((c) => {
        if (c.done) return;
        remaining++;
        if (near(c)) {
          c.done = true;
          ctx.scene.remove(c.mesh);
          state.collected++;
          SC.audio.check();
          SC.hud.toast('صندوق ' + state.collected + '/' + state.checkpoints.length, 'ok', 1200);
          updateHudMarkers();
        } else {
          const d = Math.hypot(c.x - px, c.z - pz);
          if (d < nd) { nd = d; nearest = c; }
        }
      });
      if (state.collected >= state.checkpoints.length) return finish(true);
      SC.hud.setObjective({
        title: def.title, text: 'اجمع الصناديق المتبقّية',
        meta: '<span>' + state.collected + '/' + state.checkpoints.length + '</span> · <b class="' +
          (state.timeLeft < 20 ? 'red' : '') + '">' + U.clock(state.timeLeft) + '</b>',
        warn: state.timeLeft < 20
      });
    } else {
      /* سباق / تحدّي زمني */
      const cps = state.checkpoints;
      const cur = cps[state.cpIndex % cps.length];
      if (cur && near(cur)) {
        state.cpIndex++;
        SC.audio.check();
        if (state.cpIndex % cps.length === 0) {
          state.lap++;
          if (state.lap >= state.laps) return finish(true);
          SC.hud.banner('اللفّة ' + (state.lap + 1) + '/' + state.laps, '', 1400);
        }
        updateHudMarkers();
      }
      const target = cps[state.cpIndex % cps.length];
      const d = target ? Math.hypot(target.x - px, target.z - pz) : 0;
      const pos = def.type === 'race' ? ctx.racePosition(state) : 0;
      SC.hud.setObjective({
        title: def.title,
        text: def.type === 'race' ? 'المركز <b>' + pos + '/' + (def.rivals + 1) + '</b>' : 'اتبع نقاط التفتيش',
        meta: '<span>نقطة ' + (state.cpIndex % cps.length + 1) + '/' + cps.length + '</span> · ' +
          '<span>لفّة ' + (state.lap + 1) + '/' + state.laps + '</span> · <b class="' +
          (def.time && state.timeLeft < 15 ? 'red' : '') + '">' +
          (def.time ? U.clock(state.timeLeft) : U.time(state.elapsed)) + '</b>',
        warn: !!(def.time && state.timeLeft < 15)
      });
    }
  }

  function finish(success, reason) {
    const def = state.active;
    if (!def) return;
    let money = 0, xp = 0, pos = 1;
    if (success) {
      money = def.reward;
      xp = def.xp;
      if (def.type === 'race') {
        pos = ctx.racePosition(state);
        const mult = [1, 0.6, 0.35, 0.2, 0.12][Math.min(4, pos - 1)];
        money = Math.round(def.reward * mult);
        xp = Math.round(def.xp * mult);
      }
      if (def.time && state.timeLeft > 0) money += Math.round(state.timeLeft * 6);
    }
    const result = {
      def, success, reason, money, xp, pos,
      time: state.elapsed, top: Math.round(ctx.car.topSpeedSeen)
    };
    cancel(true);
    SC.hud.setObjective(null);
    ctx.onFinish && ctx.onFinish(result);
    return 'done';
  }

  return { init, generate, start, update, cancel, finish, state, circuitPath, routeThrough };
})();
