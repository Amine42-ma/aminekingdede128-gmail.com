/* ============================================================================
   SPEED CITY — الشاشات والقوائم: المتجر، الخريطة، المهام، الإعدادات، النتائج
   ========================================================================== */
SC.ui = (function () {
  const U = SC.util;
  const $ = U.$;
  let dom = {}, current = null, mapView = { px: 0, py: 0, zoom: 0.55 }, mapCanvas = null;

  const UPGRADES = [
    { key: 'engine', name: 'المحرّك', icon: '⚙️', desc: 'قوة أعلى وسرعة قصوى أكبر' },
    { key: 'tires', name: 'الإطارات', icon: '🛞', desc: 'تماسك أفضل في المنعطفات' },
    { key: 'brakes', name: 'الفرامل', icon: '🛑', desc: 'توقّف أسرع وتحكّم أدق' },
    { key: 'nitro', name: 'النيترو', icon: '🔥', desc: 'دفعة تسارع أقوى' }
  ];
  const MAX_LEVEL = 4;
  const COLORS = [0xf2f2f2, 0x111418, 0xd93a3a, 0x2f6fd0, 0x2fa84f, 0xe0b13a, 0xff6b2c, 0x7c3aed, 0x22d3ee, 0xff8fb1];

  const upgradeCost = (car, key, level) => Math.round((900 + level * 850) * (1 + SC.cars.defs[car].stats.speed / 130));

  /* ------------------------------- عام ---------------------------------- */
  function init(refs) {
    dom = refs;
    mapCanvas = dom.mapCanvas;

    /* أزرار الشريط العلوي */
    SC.input.bindTap(dom.btnMissions, () => open('missions'));
    SC.input.bindTap(dom.btnShop, () => open('shop'));
    SC.input.bindTap(dom.btnMap, () => open('map'));
    SC.input.bindTap(dom.btnSettings, () => open('settings'));
    SC.input.bindTap(dom.btnPause, () => open('pause'));

    U.$$('[data-close]').forEach((b) => SC.input.bindTap(b, () => hideAll()));

    /* أحداث التحكّم */
    SC.input.on('cam', cycleCamera);
    SC.input.on('horn', () => { SC.audio.hornBeep(); U.vibrate(20); });
    SC.input.on('flip', () => SC.game.respawn());
    SC.input.on('light', toggleLights);
    SC.input.on('map', () => (current === 'map' ? hideAll() : open('map')));
    SC.input.on('pause', () => (current ? hideAll() : open('pause')));

    SC.input.bindTap(dom.promptStart, () => {
      if (SC.game.G.nearMission) SC.game.startMission(SC.game.G.nearMission);
    });
    SC.input.bindTap(dom.promptClose, () => showPrompt(null, true));

    buildSettings();
    initMap();
    refreshWallet();
  }

  function open(name) {
    hideAll(true);
    current = name;
    const el = dom['screen' + name.charAt(0).toUpperCase() + name.slice(1)];
    if (!el) return;
    if (name === 'shop') buildShop();
    if (name === 'missions') buildMissions();
    if (name === 'map') { centerMap(); drawMap(); }
    if (name === 'settings') syncSettings();
    el.classList.add('show');
    dom.hud.classList.add('dim');
    SC.game.togglePause(true);
    SC.audio.ui();
  }
  function hideAll(silent) {
    ['screenMenu', 'screenShop', 'screenMap', 'screenMissions', 'screenSettings', 'screenResult', 'screenPause']
      .forEach((k) => dom[k] && dom[k].classList.remove('show'));
    current = null;
    dom.hud.classList.remove('dim');
    if (!silent) {
      SC.game.togglePause(false);
      SC.audio.resume();
    }
  }

  function refreshWallet() {
    const s = SC.game.save;
    if (dom.money) dom.money.textContent = U.money(s.money);
    if (dom.level) dom.level.textContent = 'المستوى ' + s.level;
    if (dom.xpBar) dom.xpBar.style.width = U.clamp(s.xp / (s.level * 500) * 100, 0, 100) + '%';
    U.$$('.wallet-val').forEach((e) => { e.textContent = U.money(s.money); });
  }

  function cycleCamera() {
    const name = SC.game.cycleCamera();
    SC.hud.toast('الكاميرا: ' + name + ' — اسحب بإصبعك للنظر حولك', '', 1800);
  }
  function toggleLights() {
    const car = SC.game.car;
    car.lightsOn = !car.lightsOn;
    SC.hud.toast(car.lightsOn ? 'الأضواء مُشغّلة' : 'الأضواء مُطفأة', '', 1200);
  }

  /* ------------------------------ المتجر -------------------------------- */
  function buildShop() {
    const s = SC.game.save;
    const wrap = dom.shopList;
    wrap.innerHTML = '';
    SC.cars.order.forEach((id) => {
      const def = SC.cars.defs[id];
      const owned = s.owned.includes(id);
      const active = s.current === id;
      const card = U.el('div', 'car-card' + (active ? ' active' : ''));
      const thumb = (SC.assets.get(def.key) || {}).thumb;
      card.innerHTML =
        (thumb ? '<div class="car-shot"><img src="' + thumb + '" alt=""></div>' : '') +
        '<div class="car-head">' +
          '<div><div class="car-name">' + def.name + '</div>' +
          '<div class="car-tag">' + def.tag + '</div></div>' +
          '<div class="car-cls cls-' + def.cls + '">' + def.cls + '</div>' +
        '</div>' +
        statBar('السرعة', def.stats.speed) +
        statBar('التسارع', def.stats.accel) +
        statBar('التماسك', def.stats.grip) +
        '<div class="car-actions"></div>';
      const act = card.querySelector('.car-actions');

      if (!owned) {
        const b = U.el('button', 'btn buy', 'شراء · ' + U.money(def.price));
        if (s.money < def.price) b.classList.add('disabled');
        SC.input.bindTap(b, () => {
          if (SC.game.save.money < def.price) { SC.hud.toast('المبلغ غير كافٍ', 'bad'); SC.audio.bad(); return; }
          SC.game.addMoney(-def.price);
          SC.game.save.owned.push(id);
          SC.game.persist();
          SC.audio.cash();
          SC.hud.toast('تم شراء ' + def.name, 'ok');
          selectCar(id);
          buildShop();
        });
        act.appendChild(b);
      } else if (!active) {
        const b = U.el('button', 'btn', 'اختيار');
        SC.input.bindTap(b, () => { selectCar(id); buildShop(); });
        act.appendChild(b);
      } else {
        act.appendChild(U.el('div', 'owned-tag', 'المركبة الحالية'));
      }

      if (owned) {
        const up = U.el('div', 'upgrades');
        UPGRADES.forEach((u) => {
          const lvl = s.upgrades[id][u.key] || 0;
          const cost = upgradeCost(id, u.key, lvl);
          const row = U.el('div', 'up-row');
          row.innerHTML = '<span class="up-ic">' + u.icon + '</span>' +
            '<span class="up-name">' + u.name + '</span>' +
            '<span class="up-dots">' + Array.from({ length: MAX_LEVEL }, (_, i) =>
              '<i class="' + (i < lvl ? 'on' : '') + '"></i>').join('') + '</span>';
          const b = U.el('button', 'btn tiny', lvl >= MAX_LEVEL ? 'مكتمل' : U.money(cost));
          if (lvl >= MAX_LEVEL) b.classList.add('disabled');
          SC.input.bindTap(b, () => {
            const cur = SC.game.save.upgrades[id][u.key] || 0;
            if (cur >= MAX_LEVEL) return;
            const c = upgradeCost(id, u.key, cur);
            if (SC.game.save.money < c) { SC.hud.toast('المبلغ غير كافٍ', 'bad'); SC.audio.bad(); return; }
            SC.game.addMoney(-c);
            SC.game.save.upgrades[id][u.key] = cur + 1;
            SC.game.persist();
            SC.audio.good();
            if (SC.game.save.current === id) SC.game.car.upgrades = SC.game.save.upgrades[id];
            buildShop();
          });
          row.appendChild(b);
          up.appendChild(row);
        });
        card.appendChild(up);

        const colors = U.el('div', 'colors');
        COLORS.forEach((c) => {
          const sw = U.el('button', 'swatch');
          sw.style.background = '#' + c.toString(16).padStart(6, '0');
          SC.input.bindTap(sw, () => {
            SC.game.save.colors[id] = c;
            SC.game.persist();
            if (SC.game.save.current === id) SC.game.car.setColor(c);
            SC.hud.toast('تم تغيير اللون', '', 1000);
          });
          colors.appendChild(sw);
        });
        card.appendChild(colors);
      }
      wrap.appendChild(card);
    });
    refreshWallet();
  }
  function statBar(label, v) {
    return '<div class="stat"><span>' + label + '</span><i><b style="width:' + v + '%"></b></i></div>';
  }
  function selectCar(id) {
    SC.game.spawnPlayer(id, true);
    SC.game.persist();
    SC.game.snapCamera();
    SC.hud.toast('تم اختيار ' + SC.cars.defs[id].name, 'ok');
  }

  /* ------------------------------ المهام -------------------------------- */
  function buildMissions() {
    const wrap = dom.missionList;
    wrap.innerHTML = '';
    const s = SC.game.save;
    SC.game.G.missions.forEach((def) => {
      const card = U.el('div', 'mission-card');
      const best = s.best[def.id];
      const d = Math.hypot(def.from.x - SC.game.car.pos.x, def.from.z - SC.game.car.pos.z);
      card.innerHTML =
        '<div class="m-icon" style="background:' + def.color + '22;color:' + def.color + '">' + def.icon + '</div>' +
        '<div class="m-body">' +
          '<div class="m-title">' + def.title + (s.done[def.id] ? ' <i class="done">✓</i>' : '') + '</div>' +
          '<div class="m-desc">' + def.desc + '</div>' +
          '<div class="m-meta">💰 ' + U.money(def.reward) + ' · ⭐ ' + def.xp +
            ' · 📍 ' + U.distText(d) + (best ? ' · ⏱ ' + U.time(best) : '') + '</div>' +
        '</div>' +
        '<div class="m-actions"></div>';
      const act = card.querySelector('.m-actions');
      const go = U.el('button', 'btn primary', 'ابدأ');
      SC.input.bindTap(go, () => { hideAll(true); SC.game.startMission(def); });
      const mark = U.el('button', 'btn ghost tiny', 'على الخريطة');
      SC.input.bindTap(mark, () => { SC.game.setWaypoint({ x: def.from.x, z: def.from.z }); hideAll(); });
      act.appendChild(go); act.appendChild(mark);
      wrap.appendChild(card);
    });
  }

  /* ------------------------------ الخريطة ------------------------------- */
  function initMap() {
    if (!mapCanvas) return;
    let dragging = false, lastX = 0, lastY = 0, moved = 0, pinch = null;

    const resize = () => {
      const r = mapCanvas.getBoundingClientRect();
      mapCanvas.width = Math.max(320, r.width);
      mapCanvas.height = Math.max(240, r.height);
      if (current === 'map') drawMap();
    };
    window.addEventListener('resize', resize);
    setTimeout(resize, 60);
    mapCanvas._resize = resize;

    mapCanvas.addEventListener('pointerdown', (e) => {
      dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
      mapCanvas.setPointerCapture(e.pointerId);
    });
    mapCanvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      mapView.px += dx; mapView.py += dy;
      drawMap();
    });
    mapCanvas.addEventListener('pointerup', (e) => {
      dragging = false;
      if (moved < 6) {
        const r = mapCanvas.getBoundingClientRect();
        const p = SC.hud.screenToWorld(mapCanvas,
          mapView, (e.clientX - r.left) * mapCanvas.width / r.width,
          (e.clientY - r.top) * mapCanvas.height / r.height);
        if (SC.world.inBounds(p.x, p.z)) {
          SC.game.setWaypoint(p);
          SC.audio.ui();
          drawMap();
        }
      }
    });
    mapCanvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      mapView.zoom = U.clamp(mapView.zoom * f, 0.22, 2.6);
      drawMap();
    }, { passive: false });

    SC.input.bindTap(dom.mapCenter, () => { centerMap(); drawMap(); });
    SC.input.bindTap(dom.mapClear, () => { SC.game.setWaypoint(null); drawMap(); });
    SC.input.bindTap(dom.mapIn, () => { mapView.zoom = U.clamp(mapView.zoom * 1.25, 0.22, 2.6); drawMap(); });
    SC.input.bindTap(dom.mapOut, () => { mapView.zoom = U.clamp(mapView.zoom / 1.25, 0.22, 2.6); drawMap(); });
  }
  function centerMap() {
    const car = SC.game.car;
    mapView.px = -(SC.hud.mapX(car.pos.x) - 550) * mapView.zoom;
    mapView.py = -(SC.hud.mapZ(car.pos.z) - 550) * mapView.zoom;
  }
  function drawMap() {
    if (!mapCanvas) return;
    if (mapCanvas.width < 40 && mapCanvas._resize) mapCanvas._resize();
    SC.hud.drawBigMap(mapCanvas, mapView, SC.game.G);
    if (dom.mapInfo) {
      const w = SC.game.G.waypoint;
      dom.mapInfo.textContent = w
        ? 'نقطة المسار على بُعد ' + U.distText(Math.hypot(w.x - SC.game.car.pos.x, w.z - SC.game.car.pos.z))
        : 'اضغط على الخريطة لتعيين نقطة مسار';
    }
  }

  /* ----------------------------- الإعدادات ------------------------------ */
  function buildSettings() {
    const seg = (name, options, get, set) => {
      const wrap = U.el('div', 'seg');
      options.forEach(([val, label]) => {
        const b = U.el('button', 'seg-btn', label);
        b.dataset.val = val;
        b.dataset.group = name;
        SC.input.bindTap(b, () => {
          set(val);
          U.$$('[data-group="' + name + '"]').forEach((x) => x.classList.toggle('on', x.dataset.val === String(val)));
        });
        wrap.appendChild(b);
      });
      return wrap;
    };
    const row = (label, node, hint) => {
      const r = U.el('div', 'set-row');
      r.innerHTML = '<div class="set-label">' + label + (hint ? '<span>' + hint + '</span>' : '') + '</div>';
      r.appendChild(node);
      dom.settingsList.appendChild(r);
      return r;
    };

    row('طريقة التوجيه', seg('steerMode', [['buttons', 'أزرار'], ['wheel', 'مقود'], ['tilt', 'ميلان الجهاز']],
      null, (v) => {
        SC.settings.steerMode = v;
        if (v === 'tilt') SC.input.requestTilt();
        document.body.dataset.steer = v;
        SC.game.persist();
      }), 'اختر ما يناسب هاتفك');

    const sens = U.el('input');
    sens.type = 'range'; sens.min = '0.5'; sens.max = '1.6'; sens.step = '0.05';
    sens.addEventListener('input', () => { SC.settings.steerSense = +sens.value; SC.game.persist(); });
    dom.sens = sens;
    row('حساسية التوجيه', sens);

    row('مساعدة الثبات', seg('assist', [['1', 'مفعّلة'], ['0', 'مطفأة']], null,
      (v) => { SC.settings.assist = v === '1'; SC.game.persist(); }), 'تصحيح تلقائي خفيف عند الانزلاق');

    const lookS = U.el('input');
    lookS.type = 'range'; lookS.min = '0.4'; lookS.max = '2'; lookS.step = '0.05';
    lookS.addEventListener('input', () => { SC.settings.lookSense = +lookS.value; SC.game.persist(); });
    dom.lookS = lookS;
    row('حساسية تدوير الكاميرا', lookS);

    row('الكاميرا', seg('cam', [['chase', 'خلفية'], ['far', 'بعيدة'], ['hood', 'داخل المقصورة'], ['orbit', 'دوران حر']],
      null, (v) => SC.hud.toast('الكاميرا: ' + SC.game.setCamera(v), '', 1400)),
      'اسحب بإصبعك على الشاشة للنظر حولك، وبإصبعين للتقريب');

    row('وقت اليوم', seg('tod', [['day', 'نهار'], ['sunset', 'غروب'], ['night', 'ليل']],
      null, (v) => SC.game.setTimeOfDay(v)));

    row('جودة الرسوم', seg('quality', [['low', 'خفيفة'], ['medium', 'متوسطة'], ['high', 'عالية']],
      null, (v) => {
        SC.hud.toast('سيُعاد تحميل اللعبة لتطبيق الجودة…', '', 1800);
        setTimeout(() => SC.game.setQuality(v), 700);
      }), 'خفيفة = أنسب للهواتف');

    row('مرور المدينة', seg('traffic', [['1', 'مُفعّل'], ['0', 'مُطفأ']], null,
      (v) => SC.game.setTraffic(v === '1')));

    row('دوران الخريطة', seg('rotate', [['1', 'مع السيارة'], ['0', 'ثابتة']], null,
      (v) => { SC.settings.mapRotate = v === '1'; SC.game.persist(); }));

    const vol = U.el('input');
    vol.type = 'range'; vol.min = '0'; vol.max = '1'; vol.step = '0.05';
    vol.addEventListener('input', () => {
      SC.settings.volume = +vol.value;
      SC.settings.sound = +vol.value > 0;
      SC.audio.setEnabled(SC.settings.sound);
      SC.audio.setVolume(+vol.value);
      SC.game.persist();
    });
    dom.vol = vol;
    row('مستوى الصوت', vol);

    row('الاهتزاز', seg('haptics', [['1', 'مُفعّل'], ['0', 'مُطفأ']], null,
      (v) => { SC.settings.haptics = v === '1'; SC.game.persist(); }));

    const reset = U.el('button', 'btn danger', 'مسح البيانات والبدء من جديد');
    SC.input.bindTap(reset, () => {
      if (!confirm('سيتم حذف المال والمركبات والتقدّم. متابعة؟')) return;
      U.store.del('speedcity.save.v2');
      location.reload();
    });
    row('البيانات', reset);
  }
  function syncSettings() {
    const s = SC.settings;
    const setGroup = (g, v) => U.$$('[data-group="' + g + '"]').forEach((x) => x.classList.toggle('on', x.dataset.val === String(v)));
    setGroup('steerMode', s.steerMode);
    setGroup('cam', s.camera);
    setGroup('tod', s.timeOfDay);
    setGroup('quality', s.quality === 'auto' ? (SC.quality.name) : s.quality);
    setGroup('traffic', s.traffic ? '1' : '0');
    setGroup('rotate', s.mapRotate ? '1' : '0');
    setGroup('haptics', s.haptics ? '1' : '0');
    setGroup('assist', s.assist ? '1' : '0');
    if (dom.sens) dom.sens.value = s.steerSense;
    if (dom.lookS) dom.lookS.value = s.lookSense || 1;
    if (dom.vol) dom.vol.value = s.sound ? s.volume : 0;
  }

  /* ------------------------------ النتائج ------------------------------- */
  function showResult(res) {
    const el = dom.screenResult;
    dom.resultTitle.textContent = res.success ? 'أحسنت!' : 'فشلت المهمّة';
    dom.resultTitle.className = 'res-title ' + (res.success ? 'ok' : 'bad');
    dom.resultSub.textContent = res.def.title + (res.reason ? ' — ' + res.reason : '');
    const rows = [];
    if (res.def.type === 'race') rows.push(['المركز', res.pos + ' / ' + (res.def.rivals + 1)]);
    rows.push(['الزمن', U.time(res.time)]);
    rows.push(['أعلى سرعة', res.top + ' كم/س']);
    rows.push(['المكافأة', res.success ? U.money(res.money) : U.money(0)]);
    rows.push(['الخبرة', res.success ? '+' + res.xp : '0']);
    dom.resultRows.innerHTML = rows.map(([k, v]) =>
      '<div class="res-row"><span>' + k + '</span><b>' + v + '</b></div>').join('');
    el.classList.add('show');
    dom.hud.classList.add('dim');
    current = 'result';
    SC.game.togglePause(true);
  }

  /* --------------------------- دعوة بدء المهمّة ------------------------- */
  let promptDef = null, promptHidden = null;
  function showPrompt(def, dismiss) {
    if (dismiss) { promptHidden = promptDef; }
    promptDef = def;
    const el = dom.prompt;
    if (!def || promptHidden === def) { el.classList.remove('show'); return; }
    dom.promptTitle.textContent = def.title;
    dom.promptDesc.textContent = def.desc;
    dom.promptReward.textContent = '💰 ' + U.money(def.reward) + '  ⭐ ' + def.xp;
    el.classList.add('show');
  }

  function tick(dt, G) {
    if (dom.fps && (G.frames % 30 === 0)) dom.fps.textContent = Math.round(G.fps) + ' FPS';
    if (dom.wpChip) {
      if (G.waypoint) {
        dom.wpChip.classList.add('show');
        dom.wpChip.textContent = '⚑ ' + U.distText(Math.hypot(G.waypoint.x - G.car.pos.x, G.waypoint.z - G.car.pos.z));
      } else dom.wpChip.classList.remove('show');
    }
  }

  return { init, open, hideAll, refreshWallet, showResult, showPrompt, tick, buildShop, drawMap,
           get current() { return current; } };
})();
