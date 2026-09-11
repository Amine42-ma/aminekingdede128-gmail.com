/* ============================================================================
   SPEED CITY — الإقلاع: يجمع عناصر الواجهة ويبدأ اللعبة
   ========================================================================== */
(function () {
  const U = SC.util;
  const $ = (id) => document.getElementById(id);

  /* النماذج: تُقرأ من ملفات .glb أثناء التطوير، أو من داخل الصفحة في
     النسخة النهائية ذات الملف الواحد (window.SC_MODEL_DATA) */
  const MODELS = {
    building_stanley:      { file: 'building_stanley.glb',      label: 'المبنى الكبير' },
    building_residential5: { file: 'building_residential5.glb', label: 'المبنى السكني' },
    building_office2:      { file: 'building_office2.glb',      label: 'مبنى المكاتب' },
    building_shop:         { file: 'building_shop.glb',         label: 'المحل' },
    building_house:        { file: 'building_house.glb',        label: 'البيت' },
    building_school:       { file: 'building_school.glb',       label: 'المدرسة' },
    car_cortina:           { file: 'car_cortina.glb',           label: 'السيارة', length: 4.3 },
    bike_cyberpunk:        { file: 'bike_cyberpunk.glb',        label: 'الدراجة', length: 2.2 },
    van_motorhome:         { file: 'van_motorhome.glb',         label: 'البيت المتنقّل', length: 9.3 }
  };

  function buildSources() {
    const data = window.SC_MODEL_DATA;
    const out = {};
    for (const k in MODELS) {
      const cfg = Object.assign({}, MODELS[k]);
      if (data && data[k]) cfg.data = data[k];
      else cfg.url = 'assets/models/' + cfg.file;
      out[k] = cfg;
    }
    return out;
  }

  const dom = {
    canvas: $('c'), hud: $('hud'),
    loadBar: $('loadBar'), loadText: $('loadText'),
    money: $('money'), level: $('level'), xpBar: $('xpBar'), wpChip: $('wpChip'), fps: $('fps'),
    repChip: $('repChip'), repVal: $('repVal'),
    objective: $('objective'), objTitle: $('objTitle'), objText: $('objText'), objMeta: $('objMeta'),
    mini: $('mini'), compass: $('compass'), speed: $('speed'),
    toasts: $('toasts'), banner: $('banner'),
    prompt: $('prompt'), promptTitle: $('promptTitle'), promptDesc: $('promptDesc'),
    promptReward: $('promptReward'), promptStart: $('promptStart'), promptClose: $('promptClose'),
    btnMissions: $('btnMissions'), btnShop: $('btnShop'), btnMap: $('btnMap'),
    btnSettings: $('btnSettings'), btnPause: $('btnPause'), btnOnline: $('btnOnline'),
    screenOnline: $('screenOnline'), netStatus: $('netStatus'), netName: $('netName'),
    netUrl: $('netUrl'), netConnect: $('netConnect'), netDisconnect: $('netDisconnect'),
    netMic: $('netMic'), netPlayers: $('netPlayers'), netCount: $('netCount'),
    netChat: $('netChat'), netMsg: $('netMsg'), netSend: $('netSend'),
    screenMenu: $('screenMenu'), screenShop: $('screenShop'), screenMap: $('screenMap'),
    screenMissions: $('screenMissions'), screenSettings: $('screenSettings'),
    screenResult: $('screenResult'), screenPause: $('screenPause'),
    shopList: $('shopList'), missionList: $('missionList'), settingsList: $('settingsList'),
    radioBar: $('radioBar'), radioPrev: $('radioPrev'), radioNext: $('radioNext'),
    radioName: $('radioName'), radioTitle: $('radioTitle'), radioList: $('radioList'),
    mapCanvas: $('mapCanvas'), mapInfo: $('mapInfo'), mapCenter: $('mapCenter'), mapWorld: $('mapWorld'),
    mapClear: $('mapClear'), mapIn: $('mapIn'), mapOut: $('mapOut'),
    resultTitle: $('resultTitle'), resultSub: $('resultSub'), resultRows: $('resultRows'),
    loading: $('loading')
  };

  const controls = {
    canvas: $('c'),
    left: $('btnLeft'), right: $('btnRight'), gas: $('btnGas'), brake: $('btnBrake'),
    hand: $('btnHand'), boost: $('btnBoost'), wheel: $('wheel'),
    cam: $('btnCam'), horn: $('btnHorn'), flip: $('btnFlip'), light: $('btnLight'), back: $('btnBack')
  };

  function fail(e) {
    console.error(e);
    dom.loadText.innerHTML = 'تعذّر بدء اللعبة:<br><small style="opacity:.7">' + (e && e.message ? e.message : e) + '</small>';
  }

  async function boot() {
    if (!window.THREE) return fail(new Error('لم تُحمّل مكتبة العرض'));
    try {
      SC.input.init(controls);
      SC.hud.init(dom);
      await SC.game.init(dom, buildSources());
      SC.ui.init(dom);
      document.body.dataset.steer = SC.settings.steerMode;

      /* أزرار القائمة الرئيسية */
      const play = () => {
        SC.ui.hideAll();
        dom.hud.classList.remove('hidden');
        SC.game.start();
        SC.audio.resume();
        SC.hud.toast('استكشف المدينة أو ابدأ مهمّة من العلامات الذهبية', '', 3800);
      };
      SC.input.bindTap($('btnPlay'), play);
      SC.input.bindTap($('btnPlayOnline'), () => { play(); SC.ui.open('online'); });
      SC.input.bindTap($('btnMenuMissions'), () => SC.ui.open('missions'));
      SC.input.bindTap($('btnMenuShop'), () => SC.ui.open('shop'));
      SC.input.bindTap($('btnMenuSettings'), () => SC.ui.open('settings'));
      SC.input.bindTap($('btnPauseMissions'), () => SC.ui.open('missions'));
      SC.input.bindTap($('btnPauseShop'), () => SC.ui.open('shop'));
      SC.input.bindTap($('btnPauseSettings'), () => SC.ui.open('settings'));
      SC.input.bindTap($('btnAbort'), () => {
        if (SC.missions.state.active) {
          SC.missions.cancel();
          SC.game.G.missionMarkers.forEach((m) => { m.mesh.visible = true; });
          SC.game.refreshFreeMarkers();
          SC.hud.toast('أُلغيت المهمّة', 'bad');
        }
        SC.ui.hideAll();
      });

      /* أول لمسة تُفعّل الصوت (سياسة المتصفحات) */
      const unlock = () => { SC.audio.resume(); window.removeEventListener('pointerdown', unlock); };
      window.addEventListener('pointerdown', unlock);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && !SC.ui.current) SC.ui.open('pause');
      });

      dom.loading.classList.remove('show');
      dom.screenMenu.classList.add('show');
      SC.game.snapCamera();
      SC.game.frame();
      window.SC_READY = true;
      document.title = 'READY · مدينة السرعة';
    } catch (e) { fail(e); }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') boot();
  else window.addEventListener('DOMContentLoaded', boot);
})();
