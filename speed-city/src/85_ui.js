/* ============================================================================
   SPEED CITY — الشاشات والقوائم: المتجر، الخريطة، المهام، الإعدادات، النتائج
   ========================================================================== */
SC.ui = (function () {
  const U = SC.util;
  const $ = U.$;
  let dom = {}, current = null, mapView = { px: 0, py: 0, zoom: 0.42 }, mapCanvas = null;

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
    SC.input.bindTap(dom.btnMap, () => { mapView.mode = 'world'; open('map'); });
    initRadio();
    initMusic();
    if (dom.poiEnter) SC.input.bindTap(dom.poiEnter, () => enterPOI());
    if (dom.dealerPrev) SC.input.bindTap(dom.dealerPrev, () => { dealerIdx--; buildDealer(); });
    if (dom.dealerNext) SC.input.bindTap(dom.dealerNext, () => { dealerIdx++; buildDealer(); });
    if (dom.garagePrev) SC.input.bindTap(dom.garagePrev, () => { garageIdx--; buildGarage(); });
    if (dom.garageNext) SC.input.bindTap(dom.garageNext, () => { garageIdx++; buildGarage(); });
    /* E على لوحة المفاتيح = دخول المكان القريب */
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' && !current && SC.game.G.nearPOI) enterPOI();
    });
    /* الضغط على الخريطة المصغّرة يفتح نفسها بحجم كبير على موقع اللاعب */
    const mini = document.querySelector('.minimap');
    if (mini) SC.input.bindTap(mini, () => { mapView.mode = 'near'; open('map'); });
    SC.input.bindTap(dom.btnSettings, () => open('settings'));
    SC.input.bindTap(dom.btnPause, () => open('pause'));
    if (dom.btnOnline) SC.input.bindTap(dom.btnOnline, () => open('online'));
    initOnline();

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
    closeRadioList();
    hideAll(true);
    current = name;
    const el = dom['screen' + name.charAt(0).toUpperCase() + name.slice(1)];
    if (!el) return;
    if (name === 'music') buildMusic();
    if (name === 'online') { buildOnline(); buildRooms(); setMicState();
                             setNetStatus(SC.net.connected ? 'متّصل ✓' : 'غير متّصل', SC.net.connected ? 'on' : '');
                             if (SC.net.connected) SC.net.refreshRooms(); }
    if (name === 'shop') buildShop();
    if (name === 'missions') buildMissions();
    if (name === 'dealer') buildDealer();
    if (name === 'garage') buildGarage();
    if (name === 'map') {
      if (mapView.mode === 'near') { mapView.zoom = 1.35; centerMap(); mapView.mode = null; mapView.touched = true; }
      else if (mapView.mode === 'world' || !mapView.touched) { fitMap(); mapView.mode = null; }
      drawMap();
    }
    if (name === 'settings') syncSettings();
    el.classList.add('show');
    dom.hud.classList.add('dim');
    SC.game.togglePause(true);
    SC.audio.ui();
  }
  function hideAll(silent) {
    Object.keys(preview).forEach((k) => previewStop(preview[k]));
    /* أغلق كل شاشة موجودة فعلاً — القائمة الثابتة كانت تنسى الشاشات الجديدة
       (المعرض والكراج) فتبقى مفتوحة بلا مخرج */
    U.$$('.screen:not(.boot)').forEach((el) => el.classList.remove('show'));
    current = null;
    dom.hud.classList.remove('dim');
    if (silent) return;
    /* لم تبدأ اللعبة بعد (ما زلنا في شاشة البداية): أعِد القائمة بدل ترك
       الشاشة فارغة بلا زرّ «ابدأ» بينما سباق الاستعراض يدور خلفها */
    if (dom.hud && dom.hud.classList.contains('hidden')) {
      dom.screenMenu.classList.add('show');
      current = 'menu';
      SC.audio.resume();
      return;                       // ولا نرفع الإيقاف: الاستعراض يعمل موقوفاً
    }
    SC.game.togglePause(false);
    SC.audio.resume();
  }

  function refreshWallet() {
    const s = SC.game.save;
    if (dom.repVal) {
      const r = Math.round(s.rep == null ? 70 : s.rep);
      dom.repVal.textContent = r + '%';
      if (dom.repChip) {
        dom.repChip.classList.toggle('low', r < 35);
        dom.repChip.classList.toggle('high', r >= 75);
        dom.repChip.title = 'ثقة الناس بك';
      }
    }
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

  /* ----------------------------- أون لاين ------------------------------- */
  function setNetStatus(text, cls) {
    if (!dom.netStatus) return;
    dom.netStatus.textContent = text;
    dom.netStatus.className = 'net-status ' + (cls || '');
    /* بعد الاتّصال تُطوى إعدادات الخادم: على شاشة الهاتف كانت تدفع
       قائمة الغرف تحت حافّة الشاشة */
    if (dom.onlineBody) {
      dom.onlineBody.classList.toggle('linked', !!SC.net.connected);
      if (!SC.net.connected) dom.onlineBody.classList.remove('show-conn');
    }
  }

  function initOnline() {
    if (!dom.netConnect) return;
    const saved = U.store.get('speedcity.net', {});
    dom.netName.value = saved.name || ('سائق ' + Math.floor(Math.random() * 900 + 100));
    dom.netUrl.value = saved.url || (location.protocol === 'https:' ? 'wss://' : 'ws://') +
      (location.host || 'localhost:8080');

    SC.input.bindTap(dom.netConnect, async () => {
      const url = dom.netUrl.value.trim(), name = dom.netName.value.trim() || 'سائق';
      U.store.set('speedcity.net', { url, name });
      setNetStatus('جارٍ الاتّصال…');
      try {
        await SC.net.connect(url, name);
      } catch (e) {
        setNetStatus('فشل الاتّصال', 'err');
        SC.hud.toast('تعذّر الاتّصال بالخادم — تأكّد من تشغيله ومن العنوان', 'bad', 4200);
      }
    });
    SC.input.bindTap(dom.netDisconnect, () => { SC.net.disconnect(); setNetStatus('غير متّصل'); buildRooms(); });
    if (dom.netEdit) SC.input.bindTap(dom.netEdit, () => {
      dom.onlineBody && dom.onlineBody.classList.toggle('show-conn');
    });
    SC.input.bindTap(dom.netMic, async () => {
      if (SC.net.state.mic) { SC.net.stopMic(); setMicState(); }
      else { setMicState('جارٍ طلب الإذن…'); await SC.net.startMic(); setMicState(); }
    });

    /* ------------------------------ الغرف ------------------------------ */
    if (dom.roomRefresh) SC.input.bindTap(dom.roomRefresh, () => {
      if (needNet()) return;
      SC.net.refreshRooms();
    });
    if (dom.roomCreate) SC.input.bindTap(dom.roomCreate, () => {
      if (needNet()) return;
      const st = SC.net.state;
      if (st.roomsOwned >= st.roomLimit) {     // نفس قاعدة الخادم، لكن فوراً
        const mine = st.rooms.filter((r) => r.mine).map((r) => '«' + r.name + '»').join('، ');
        SC.hud.toast('بلغت الحدّ: ' + st.roomLimit + ' غرف لك. احذف واحدة أوّلاً — ' + mine,
                     'bad', 6000);
        return;
      }
      SC.net.createRoom(dom.roomName.value.trim() || randomRoomName());
      dom.roomName.value = '';
    });
    if (dom.roomJoin) SC.input.bindTap(dom.roomJoin, () => {
      if (needNet()) return;
      const code = (dom.roomCode.value || '').trim().toUpperCase();
      if (!code) { SC.hud.toast('اكتب رمز الغرفة أوّلاً', 'bad'); return; }
      SC.net.joinRoom(code);
      dom.roomCode.value = '';
    });
    SC.input.bindTap(dom.netSend, sendChat);
    dom.netMsg && dom.netMsg.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });

    SC.net.onEvent = (type, data) => {
      if (type === 'open') {
        setNetStatus('متّصل ✓', 'on');
        SC.hud.toast('اتّصلت باللعب الجماعي', 'ok');
        buildOnline();
      } else if (type === 'close') {
        setNetStatus('انقطع الاتّصال', 'err');
        SC.hud.toast('انقطع الاتّصال بالخادم', 'bad');
        buildOnline();
      } else if (type === 'players') {
        buildOnline();
      } else if (type === 'rooms' || type === 'room') {
        buildRooms();
        buildOnline();
      } else if (type === 'roomError') {
        onRoomError(data);
      } else if (type === 'mic-error') {
        setMicState(data.text, 'err');
        SC.hud.toast(data.text, 'bad', 5200);
      } else if (type === 'toast') {
        SC.hud.toast(data.text, data.kind);
      } else if (type === 'chat') {
        addChat(data.name, data.msg);
        if (current !== 'online') SC.hud.toast('💬 ' + data.name + ': ' + data.msg, '', 3000);
      } else if (type === 'mic') {
        if (dom.netMic) {
          dom.netMic.classList.toggle('primary', !!data);
          dom.netMic.textContent = data ? '🎙 إغلاق الميكروفون' : '🎙 تفعيل الميكروفون';
        }
        setMicState();
      } else if (type === 'invite') {
        onInvite(data);
      } else if (type === 'accept') {
        SC.hud.toast((data.name || 'اللاعب') + ' قبل التحدّي — انطلق!', 'ok', 3000);
        SC.game.startOnlineRace(data.race, data.from);
      } else if (type === 'race') {
        if (data.kind === 'finish') {
          SC.hud.banner('خسرت السباق', (data.name || 'الخصم') + ' وصل أولاً', 3000);
        }
      }
    };
  }

  function sendChat() {
    const v = dom.netMsg.value.trim();
    if (!v || !SC.net.connected) return;
    SC.net.chat(v);
    addChat('أنت', v);
    dom.netMsg.value = '';
  }
  function addChat(name, msg) {
    if (!dom.netChat) return;
    const line = U.el('div', 'line', '<b>' + name + ':</b> ' + msg.replace(/[<>]/g, ''));
    dom.netChat.appendChild(line);
    while (dom.netChat.children.length > 40) dom.netChat.removeChild(dom.netChat.firstChild);
    dom.netChat.scrollTop = dom.netChat.scrollHeight;
  }

  /* ==================== مكتبة الموسيقى الشخصية ==========================
     الملفّات من جهاز اللاعب فقط. لا تنزيل من الإنترنت ولا حقل رابط — بعد
     إقرار الحقوق يُفتح منتقي ملفّات النظام، ويبقى الملفّ محلّياً. */
  let rightsPick = 'own', reportPick = 'copyright', reportTarget = null;

  function initMusic() {
    if (!dom.musicAdd) return;

    SC.input.bindTap(dom.musicAdd, () => openRights());
    SC.input.bindTap(dom.musicStop, () => { SC.mylib.stop(); buildMusic(); });

    /* المنتقي يفتحه <label for> بنفسه، فلا يعتمد على نافذة JS قد يمنعها
       المتصفّح؛ ولا يُفعَّل إلا بعد تعليم الإقرار (pointer-events) */
    dom.rightsAgree.addEventListener('change', () => {
      dom.rightsOk.classList.toggle('off', !dom.rightsAgree.checked);
    });
    dom.musicFile.addEventListener('change', () => {
      const f = dom.musicFile.files && dom.musicFile.files[0];
      dom.musicFile.value = '';
      hideAll(true);
      dom.screenMusic.classList.add('show');
      current = 'music';
      buildMusic();
      if (!f) return;
      SC.mylib.add(f, { confirmed: true, rights: rightsPick })
        .then((rec) => {
          SC.hud.toast('أُضيف «' + rec.title + '» إلى مكتبتك — محفوظ على جهازك وحده', 'ok', 3600);
          buildMusic();
        })
        .catch((e) => {
          const msg = { type: 'هذا ليس ملفّاً صوتياً مدعوماً',
                        size: 'الملفّ أكبر من ' + Math.round(SC.mylib.MAX_SIZE / 1048576) + ' ميغابايت',
                        full: 'بلغت الحدّ: ' + SC.mylib.MAX_TRACKS + ' مقطعاً — احذف واحداً أوّلاً',
                        store: 'تعذّر الحفظ على الجهاز — قد تكون ذاكرة المتصفّح ممتلئة'
                      }[e.message] || 'تعذّرت الإضافة';
          SC.hud.toast(msg, 'bad', 4200);
        });
    });

    SC.input.bindTap(dom.musicShareAll, () => {
      const st = SC.mylib.state;
      if (!st.policy.sharing) {
        SC.hud.toast('مشاركة الموسيقى معطّلة على هذا الخادم', 'bad', 3200);
        return;
      }
      SC.mylib.setShareAll(!st.shareOn);
      buildMusic();
    });

    /* نافذة إقرار الحقوق */
    SC.input.bindTap(dom.rightsCancel, () => { hideAll(); open('music'); });

    /* نافذة الإبلاغ */
    SC.input.bindTap(dom.reportCancel, () => { hideAll(); open('music'); });
    SC.input.bindTap(dom.reportSend, () => {
      if (!reportTarget) { hideAll(); return; }
      SC.mylib.report(reportTarget, reportPick);
      hideAll(); open('music');
      SC.hud.toast('أُرسل البلاغ وأُوقفت مشاركة المقطع', 'ok', 4000);
    });

    SC.mylib.onChange = () => { if (current === 'music') buildMusic(); };
    SC.mylib.load().then(buildMusic);
  }

  function openRights() {
    rightsPick = 'own';
    dom.rightsAgree.checked = false;
    dom.rightsOk.classList.add('off');          // لا اختيار قبل الإقرار
    dom.rightsOpts.innerHTML = '';
    SC.mylib.RIGHTS.forEach((r) => {
      const b = U.el('button', r.id === rightsPick ? 'on' : '', esc(r.label) +
        (r.share ? '' : ' <span style="opacity:.6">— بلا مشاركة</span>'));
      SC.input.bindTap(b, () => {
        rightsPick = r.id;
        [...dom.rightsOpts.children].forEach((c, i) => c.classList.toggle('on', SC.mylib.RIGHTS[i].id === r.id));
      });
      dom.rightsOpts.appendChild(b);
    });
    hideAll(true);
    dom.screenRights.classList.add('show');
    current = 'rights';
  }

  function openReport(target, what) {
    reportTarget = target; reportPick = 'copyright';
    dom.reportWhat.textContent = what;
    dom.reportOpts.innerHTML = '';
    SC.mylib.REASONS.forEach((r) => {
      const b = U.el('button', r.id === reportPick ? 'on' : '', esc(r.label));
      SC.input.bindTap(b, () => {
        reportPick = r.id;
        [...dom.reportOpts.children].forEach((c, i) => c.classList.toggle('on', SC.mylib.REASONS[i].id === r.id));
      });
      dom.reportOpts.appendChild(b);
    });
    hideAll(true);
    dom.screenReport.classList.add('show');
    current = 'report';
  }

  const fileSize = (n) => n >= 1048576
    ? (Math.round(n / 104858) / 10) + ' م.ب'
    : Math.max(1, Math.round(n / 1024)) + ' ك.ب';

  function buildMusic() {
    if (!dom.musicList) return;
    const st = SC.mylib.state, list = st.list;
    dom.musicCount.textContent = list.length + ' مقاطع';
    if (dom.musicQuota) dom.musicQuota.textContent = list.length + ' / ' + SC.mylib.MAX_TRACKS;

    dom.musicList.innerHTML = '';
    if (!list.length) {
      dom.musicList.appendChild(U.el('div', 'net-empty',
        'لا مقاطع بعد — اضغط «+ إضافة موسيقى من الجهاز»'));
    }
    list.forEach((rec) => {
      const playing = st.playingId === rec.id;
      const row = U.el('div', 'music-row' + (playing ? ' on' : ''));
      const R = SC.mylib.rightsOf(rec.rights);
      row.innerHTML = '<span class="mt">' + esc(rec.title) + '</span>' +
        (rec.reported ? '<span class="flag">مُبلَّغ عنه</span>' : '') +
        '<span class="mm">' + esc(R.label) + ' · ' + fileSize(rec.size) + '</span>';

      const pb = U.el('button', 'btn tiny primary', playing ? '❚❚' : '▶');
      SC.input.bindTap(pb, () => {
        if (playing) { SC.mylib.stop(); } else SC.mylib.play(rec.id);
        buildMusic();
      });
      row.appendChild(pb);

      if (st.policy.sharing && R.share && !rec.reported) {
        const sb = U.el('button', 'btn tiny' + (rec.share ? ' shared' : ''), rec.share ? 'تُشارَك' : 'مشاركة');
        SC.input.bindTap(sb, () => { SC.mylib.setShare(rec.id, !rec.share); buildMusic(); });
        row.appendChild(sb);
      }

      const rb = U.el('button', 'btn tiny ghost', '🚩');
      rb.title = 'إبلاغ عن هذا المقطع';
      SC.input.bindTap(rb, () => openReport(rec.id, 'المقطع: «' + rec.title + '» من مكتبتك'));
      row.appendChild(rb);

      const db = U.el('button', 'btn tiny danger', 'حذف');
      SC.input.bindTap(db, () => confirmDeleteTrack(rec));
      row.appendChild(db);

      dom.musicList.appendChild(row);
    });

    /* بطاقة المشاركة: تختفي كلّياً إن عطّلها الخادم */
    if (dom.musicShareCard) {
      dom.musicShareCard.style.display = st.policy.sharing ? '' : 'none';
    }
    if (dom.musicShareAll) {
      dom.musicShareAll.textContent = st.shareOn ? 'مفعّلة' : 'مطفأة';
      dom.musicShareAll.classList.toggle('on', st.shareOn);
    }
    if (dom.musicShareState) {
      dom.musicShareState.textContent = !st.policy.sharing
        ? 'معطّلة على هذا الخادم'
        : (st.shareOn ? 'يُعرض اسم ما تسمعه لمن في غرفتك' : 'لا يُرسل شيء');
    }
    if (dom.musicHeard) {
      dom.musicHeard.innerHTML = '';
      st.heard.forEach((h) => {
        const row = U.el('div', 'heard-row',
          '🎧 <b>' + esc(h.name || 'لاعب') + '</b> يسمع: ' + esc(h.title));
        const rb = U.el('button', 'btn tiny ghost', '🚩');
        SC.input.bindTap(rb, () => openReport({ id: h.id, title: h.title },
          'ما يشاركه ' + (h.name || 'لاعب') + ': «' + h.title + '»'));
        row.appendChild(rb);
        dom.musicHeard.appendChild(row);
      });
    }
  }

  function confirmDeleteTrack(rec) {
    dom.resultTitle.textContent = 'حذف الموسيقى؟';
    dom.resultTitle.className = 'res-title';
    dom.resultSub.textContent = '«' + rec.title + '» — سيُمسح من جهازك نهائياً.';
    dom.resultRows.innerHTML = '';
    const wrap = U.el('div', 'pause-btns');
    const yes = U.el('button', 'btn xl', 'نعم، احذفه');
    SC.input.bindTap(yes, () => {
      SC.mylib.remove(rec.id).then(() => {
        SC.hud.toast('حُذف المقطع من مكتبتك', 'ok', 2600);
        hideAll(); open('music');
      });
    });
    const no = U.el('button', 'btn primary xl', 'تراجع');
    SC.input.bindTap(no, () => { hideAll(); open('music'); });
    wrap.appendChild(yes); wrap.appendChild(no);
    dom.resultRows.appendChild(wrap);
    dom.screenResult.classList.add('show');
    current = 'result';
  }

  /* ------------------------------- الغرف -------------------------------- */
  const ROOM_WORDS = ['الصقور', 'الليل', 'الجسر', 'الميناء', 'النيترو', 'الرمال', 'العاصفة',
                      'الشارع', 'الشمال', 'البرق', 'الواحة', 'الخليج', 'الإطارات', 'السرعة'];
  function randomRoomName() {
    return 'غرفة ' + ROOM_WORDS[(Math.random() * ROOM_WORDS.length) | 0];
  }
  function needNet() {
    if (SC.net.connected) return false;
    SC.hud.toast('اتّصل بالخادم أوّلاً', 'bad', 2600);
    return true;
  }

  async function setMicState(text, cls) {
    const el = dom.micState;
    if (!el) return;
    if (text) { el.textContent = text; el.className = 'mic-state ' + (cls || ''); return; }
    if (SC.net.state.mic) { el.textContent = 'مفتوح — يسمعك من في الغرفة'; el.className = 'mic-state on'; return; }
    const st = await SC.net.micReady();
    const map = {
      granted: ['الإذن ممنوح — اضغط للتشغيل', ''],
      denied: ['الإذن مرفوض — غيّره من إعدادات المتصفّح', 'err'],
      prompt: ['اضغط الزرّ ثم اختر «سماح»', ''],
      unsupported: ['هذا المتصفّح لا يدعم الميكروفون', 'err'],
      insecure: ['يحتاج https أو localhost', 'err'],
      unknown: ['اضغط الزرّ لطلب الإذن', '']
    };
    const v = map[st] || map.unknown;
    el.textContent = v[0]; el.className = 'mic-state ' + v[1];
  }

  function onRoomError(m) {
    if (m.code === 'limit') {
      const names = (m.rooms || []).map((r) => '«' + r.name + '»').join('، ');
      SC.hud.toast('بلغت الحدّ: ' + m.limit + ' غرف. احذف واحدة من غرفك أوّلاً — ' + names,
                   'bad', 6000);
    } else if (m.code === 'full') SC.hud.toast('الغرفة ممتلئة', 'bad', 3000);
    else if (m.code === 'missing') SC.hud.toast('لا توجد غرفة بهذا الرمز', 'bad', 3000);
    else if (m.code === 'notowner') SC.hud.toast('لا تُحذف إلا غرفك أنت', 'bad', 3000);
    else if (m.code === 'nokey') SC.hud.toast('تعذّر تمييز جهازك — أعد الاتّصال', 'bad', 3000);
    buildRooms();
  }

  /* إن رفض المتصفّح النسخ التلقائي نعرض الرابط ليُنسخ يدوياً */
  function showLink(link) {
    dom.resultTitle.textContent = 'رابط الغرفة';
    dom.resultTitle.className = 'res-title';
    dom.resultSub.textContent = 'انسخ الرابط وأرسله لأصدقائك — من يفتحه يدخل غرفتك مباشرةً.';
    dom.resultRows.innerHTML = '';
    const box = U.el('div', 'link-box');
    const inp = U.el('input');
    inp.type = 'text'; inp.value = link; inp.readOnly = true;
    box.appendChild(inp);
    dom.resultRows.appendChild(box);
    const wrap = U.el('div', 'pause-btns');
    const ok = U.el('button', 'btn primary xl', 'تمّ');
    SC.input.bindTap(ok, () => { hideAll(); open('online'); });
    wrap.appendChild(ok);
    dom.resultRows.appendChild(wrap);
    dom.screenResult.classList.add('show');
    current = 'result';
    setTimeout(() => { try { inp.select(); } catch (e) {} }, 60);
  }

  function buildRooms() {
    if (!dom.roomList) return;
    const st = SC.net.state;
    const here = st.room;

    /* الحصّة: كم غرفة لك من الحدّ */
    if (dom.roomQuota) {
      const full = st.roomsOwned >= st.roomLimit;
      dom.roomQuota.textContent = 'غرفك ' + st.roomsOwned + ' / ' + st.roomLimit +
        (SC.net.connected ? ' · على الخادم ' + (st.serverTotal || 1) : '');
      dom.roomQuota.className = 'quota' + (full ? ' full' : '');
      dom.roomQuota.title = full ? 'احذف غرفة قديمة لتُنشئ جديدة' : '';
    }
    if (dom.roomCreate) dom.roomCreate.classList.toggle('off', st.roomsOwned >= st.roomLimit);

    /* شارة الغرفة الحالية */
    if (dom.roomHere) {
      dom.roomHere.innerHTML = '';
      if (!SC.net.connected) {
        dom.roomHere.style.display = 'none';
      } else {
        dom.roomHere.style.display = '';
        const n = U.el('span', '', 'أنت في <b>' + esc(here ? here.name : '—') + '</b>');
        dom.roomHere.appendChild(n);
        if (here && !here.fixed) {
          const c = U.el('span', 'code', here.code);
          dom.roomHere.appendChild(c);
          /* رابط الغرفة: يفتحه صديقك في متصفّحه فيدخل إليها مباشرةً */
          const copy = U.el('button', 'btn tiny', '🔗 نسخ رابط الدعوة');
          SC.input.bindTap(copy, () => {
            const link = SC.net.roomLink(here.code);
            const done = () => SC.hud.toast('نُسخ الرابط — أرسله لأصدقائك', 'ok', 3000);
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(link).then(done, () => showLink(link));
            } else showLink(link);
          });
          dom.roomHere.appendChild(copy);
          const leave = U.el('button', 'btn tiny ghost', 'خروج');
          SC.input.bindTap(leave, () => SC.net.leaveRoom());
          dom.roomHere.appendChild(leave);
        }
      }
    }

    dom.roomList.innerHTML = '';
    if (!SC.net.connected) {
      dom.roomList.appendChild(U.el('div', 'net-empty', 'اتّصل بالخادم لرؤية الغرف'));
      return;
    }
    if (!st.rooms.length) {
      dom.roomList.appendChild(U.el('div', 'net-empty', 'لا توجد غرف بعد — أنشئ أوّل غرفة'));
      return;
    }
    st.rooms.forEach((r) => {
      const inIt = here && here.code === r.code;
      const row = U.el('div', 'room-row' + (inIt ? ' on' : ''));
      row.innerHTML = '<span class="rname">' + esc(r.name) + '</span>' +
        (r.fixed ? '' : '<span class="rcode">' + esc(r.code) + '</span>') +
        (r.mine ? '<span class="mine">غرفتك</span>' : '') +
        '<span class="rmeta">' + r.players + '/' + r.max + ' لاعب' +
        (r.fixed ? '' : ' · ' + esc(r.ownerName)) + '</span>';
      if (!inIt) {
        const join = U.el('button', 'btn tiny primary', 'دخول');
        SC.input.bindTap(join, () => SC.net.joinRoom(r.code));
        row.appendChild(join);
      }
      if (r.mine && !r.fixed) {
        const del = U.el('button', 'btn tiny danger', 'حذف');
        SC.input.bindTap(del, () => confirmDeleteRoom(r));
        row.appendChild(del);
      }
      dom.roomList.appendChild(row);
    });
  }

  /* الحذف نهائي ويُخرج من فيها، فنسأل مرّة */
  function confirmDeleteRoom(r) {
    const el = dom.screenResult;
    dom.resultTitle.textContent = 'حذف الغرفة؟';
    dom.resultTitle.className = 'res-title';
    dom.resultSub.textContent = '«' + r.name + '» — سيخرج من فيها إلى المدينة الحرّة، ولا رجعة.';
    dom.resultRows.innerHTML = '';
    const wrap = U.el('div', 'pause-btns');
    const yes = U.el('button', 'btn xl', 'نعم، احذفها');
    SC.input.bindTap(yes, () => { SC.net.deleteRoom(r.code); hideAll(); open('online'); });
    const no = U.el('button', 'btn primary xl', 'تراجع');
    SC.input.bindTap(no, () => { hideAll(); open('online'); });
    wrap.appendChild(yes); wrap.appendChild(no);
    dom.resultRows.appendChild(wrap);
    el.classList.add('show');
    current = 'result';
  }

  const esc = (t) => String(t == null ? '' : t).replace(/[<>&]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

  function buildOnline() {
    if (!dom.netPlayers) return;
    const list = SC.net.playerList();
    dom.netCount.textContent = '(' + list.length + ')';
    dom.netPlayers.innerHTML = '';
    if (!SC.net.connected) {
      dom.netPlayers.appendChild(U.el('div', 'net-empty', 'اتّصل بالخادم لرؤية اللاعبين'));
      return;
    }
    if (!list.length) {
      dom.netPlayers.appendChild(U.el('div', 'net-empty', 'لا أحد معك في هذه الغرفة الآن'));
      return;
    }
    list.forEach((p) => {
      const row = U.el('div', 'net-player');
      row.innerHTML = '<span>🚗</span><b>' + p.name + '</b>' +
        '<span class="car">' + ((SC.cars.defs[p.car] || {}).name || '') + '</span>';
      const race = U.el('button', 'btn tiny primary', 'تحدّه في سباق');
      SC.input.bindTap(race, () => {
        SC.net.invite(p.id);
        SC.hud.toast('أُرسلت الدعوة إلى ' + p.name, 'ok');
      });
      const go = U.el('button', 'btn tiny ghost', 'اذهب إليه');
      SC.input.bindTap(go, () => { SC.game.setWaypoint({ x: p.x, z: p.z }); hideAll(); });
      row.appendChild(race); row.appendChild(go);
      dom.netPlayers.appendChild(row);
    });
  }

  function onInvite(data) {
    const name = data.name || 'لاعب';
    const el = dom.screenResult;
    dom.resultTitle.textContent = 'تحدّي سباق!';
    dom.resultTitle.className = 'res-title';
    dom.resultSub.textContent = name + ' يدعوك إلى سباق';
    dom.resultRows.innerHTML = '';
    const wrap = U.el('div', 'pause-btns');
    const ok = U.el('button', 'btn primary xl', 'قبول والانطلاق');
    SC.input.bindTap(ok, () => {
      const raceDef = (SC.game.G.missions.find((m) => m.type === 'race') || {}).id;
      SC.net.acceptInvite(data.from, raceDef);
      hideAll();
      SC.game.startOnlineRace(raceDef, data.from);
    });
    const no = U.el('button', 'btn xl', 'رفض');
    SC.input.bindTap(no, () => { SC.net.decline(data.from); hideAll(); });
    wrap.appendChild(ok); wrap.appendChild(no);
    dom.resultRows.appendChild(wrap);
    el.classList.add('show');
    dom.hud.classList.add('dim');
    current = 'result';
    SC.game.togglePause(true);
    SC.audio.good();
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
  /* شاشة المهام: مقسّمة حسب المركبة — لكل مركبة عملها الخاص */
  const VEH_TABS = [
    { id: 'cortina', label: '🚗 السيارة',  hint: 'سباقات وتحدّيات وتوصيل وتاكسي' },
    { id: 'bike', label: '🏍 الدرّاجة', hint: 'توصيل بيتزا سريع وسباقات خفيفة' },
    { id: 'van',  label: '🚚 الكاميون', hint: 'حمولات ثقيلة بين الجزر — أرباح كبيرة، بلا سباقات' }
  ];
  let missionTab = null;

  /* ====================== معرض السيارات والكراج ==========================
     عرض ثلاثي الأبعاد حيّ للسيارة نفسها من نموذجها الأصلي، مع بطاقة
     مواصفات وأزرار شراء/اختيار. يُستخدم مُصيّر صغير مستقل يعمل فقط
     أثناء فتح الشاشة، فلا يكلّف شيئاً أثناء اللعب. */
  const preview = {};        // key -> { renderer, scene, camera, holder, raf, canvas }

  function makePreview(canvas) {
    if (preview[canvas.id]) return preview[canvas.id];
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true,
                                           powerPreference: 'low-power' });
    } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1.6, 0.1, 100);
    scene.add(new THREE.HemisphereLight(0xdce8f5, 0x2a3240, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(4, 6, 5); scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fd8ff, 1.5);
    rim.position.set(-5, 3, -4); scene.add(rim);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.05, 0.12, 36),
      new THREE.MeshStandardMaterial({ color: 0x1a2330, roughness: 0.55, metalness: 0.25 }));
    disc.position.y = -0.06; scene.add(disc);
    const holder = new THREE.Group(); scene.add(holder);
    const P = { renderer, scene, camera, holder, canvas, disc, raf: 0, spin: 0, live: false };
    preview[canvas.id] = P;
    return P;
  }

  function previewShow(P, carId) {
    if (!P) return;
    while (P.holder.children.length) P.holder.remove(P.holder.children[0]);
    const def = SC.cars.defs[carId];
    if (!def) return;
    let obj = null;
    if (SC.assets.get(def.key)) {
      obj = SC.assets.clone(def.key);
      /* لون خاص بالعرض دون المساس بسيارة اللاعب */
      obj.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        /* نسخة خاصة بالعرض مع الحفاظ على شكل الحقل: مصفوفة تبقى مصفوفة
           وخامة مفردة تبقى مفردة — تحويل المفرد إلى مصفوفة لا يرسم شيئاً. */
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => m.clone())
          : o.material.clone();
      });
    } else {
      obj = SC.Vehicle.placeholder(def.color || 0x9aa4b2, new THREE.Vector3(1.8, 1.4, 4.3));
    }
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const ctr = box.getCenter(new THREE.Vector3());
    obj.position.sub(new THREE.Vector3(ctr.x, box.min.y, ctr.z));
    P.holder.add(obj);
    /* القاعدة تتبع حجم المركبة، والكاميرا تؤطّرها بإحكام */
    const reach = Math.max(size.x, size.z, size.y * 1.7);
    if (P.disc) P.disc.scale.set(Math.max(size.x, size.z) * 0.72, 1, Math.max(size.x, size.z) * 0.72);
    P.camera.position.set(reach * 0.30, reach * 0.42, reach * 1.32);
    P.camera.lookAt(0, size.y * 0.46, 0);
    P.fit = reach;
  }

  function previewStart(P) {
    if (!P || P.live) return;
    P.live = true;
    const loop = () => {
      if (!P.live) return;
      P.raf = requestAnimationFrame(loop);
      const r = P.canvas.getBoundingClientRect();
      if (r.width > 4 && (P.canvas.width !== Math.round(r.width) || P.canvas.height !== Math.round(r.height))) {
        P.renderer.setSize(r.width, r.height, false);
        P.camera.aspect = r.width / Math.max(1, r.height);
        P.camera.updateProjectionMatrix();
      }
      P.spin += 0.006;
      P.holder.rotation.y = P.spin;
      P.renderer.render(P.scene, P.camera);
    };
    loop();
  }
  function previewStop(P) {
    if (!P) return;
    P.live = false;
    if (P.raf) cancelAnimationFrame(P.raf);
    P.raf = 0;
  }

  /* ------------------------------ المعرض -------------------------------- */
  let dealerIdx = 0, dealerPOI = null;

  function dealerList() {
    return SC.cars.order.filter((id) => SC.cars.defs[id]);
  }

  function statRow(label, val, cls) {
    return '<div class="d-stat ' + (cls || '') + '"><span>' + label + '</span>' +
           '<div class="d-bar"><i style="width:' + Math.max(4, Math.min(100, val)) + '%"></i></div>' +
           '<b>' + Math.round(val) + '</b></div>';
  }

  function buildDealer() {
    const list = dealerList();
    if (!list.length) return;
    dealerIdx = ((dealerIdx % list.length) + list.length) % list.length;
    const id = list[dealerIdx], def = SC.cars.defs[id], sv = SC.game.save;
    const owned = sv.owned.indexOf(id) >= 0;
    const current = sv.current === id;
    const canAfford = sv.money >= def.price;

    if (dom.dealerTitle) dom.dealerTitle.textContent = dealerPOI ? dealerPOI.name : 'معرض السيارات';
    if (dom.dealerMoney) dom.dealerMoney.textContent = U.money(sv.money);
    dom.dealerName.textContent = def.name;
    dom.dealerTag.textContent = def.tag + ' · الفئة ' + def.cls;
    dom.dealerBadge.textContent = 'CAR DEALERSHIP';
    dom.dealerPrice.textContent = owned ? 'مملوكة' : U.money(def.price);
    dom.dealerPrice.className = 'd-price' + (owned ? ' owned' : '');
    dom.dealerStats.innerHTML =
      statRow('السرعة', def.stats.speed, 'speed') +
      statRow('التسارع', def.stats.accel, 'accel') +
      statRow('التحكّم', def.stats.grip, 'grip') +
      statRow('أقصى سرعة', Math.min(100, def.topSpeed * 3.6 / 2.6), 'speed');

    /* الأزرار */
    const act = dom.dealerActions;
    act.innerHTML = '';
    const note = dom.dealerNote;
    note.className = 'd-note';
    note.textContent = 'أقصى سرعة ' + Math.round(def.topSpeed * 3.6) + ' كم/س · الوزن ' + def.mass + ' كغ';

    if (!owned) {
      const buy = U.el('button', 'btn primary' + (canAfford ? '' : ' off'),
                       canAfford ? '🛒 شراء' : '💸 المال غير كافٍ');
      if (canAfford) {
        SC.input.bindTap(buy, () => {
          if (SC.game.buyCar(id)) {
            SC.audio.cash();
            note.className = 'd-note ok';
            note.textContent = 'تمّ الشراء! اضغط «اختيار» للقيادة بها الآن.';
            buildDealer();
          }
        });
      } else {
        SC.input.bindTap(buy, () => {
          note.className = 'd-note bad';
          note.textContent = 'ينقصك ' + U.money(def.price - sv.money) + ' — أنجز مهمّة لكسب المال.';
          SC.audio.bad();
        });
      }
      act.appendChild(buy);
    } else if (!current) {
      const use = U.el('button', 'btn primary', '✓ اختيار');
      SC.input.bindTap(use, () => {
        SC.game.selectCar(id);
        note.className = 'd-note ok';
        note.textContent = 'صارت سيارتك الحالية.';
        buildDealer();
      });
      act.appendChild(use);
    } else {
      const cur = U.el('button', 'btn off', '★ سيارتك الحالية');
      act.appendChild(cur);
    }
    const back = U.el('button', 'btn ghost', 'خروج');
    SC.input.bindTap(back, () => hideAll());
    act.appendChild(back);

    /* شريط الاختيار السريع */
    dom.dealerStrip.innerHTML = '';
    list.forEach((cid, i) => {
      const d = SC.cars.defs[cid];
      const own = sv.owned.indexOf(cid) >= 0;
      const card = U.el('button', 'd-card' + (i === dealerIdx ? ' on' : '') + (own ? ' owned' : ''));
      card.innerHTML = '<b>' + d.name + '</b><span>' + (own ? 'مملوكة' : U.money(d.price)) + '</span>';
      SC.input.bindTap(card, () => { dealerIdx = i; buildDealer(); });
      dom.dealerStrip.appendChild(card);
    });

    const P = makePreview(dom.dealerCanvas);
    previewShow(P, id);
    previewStart(P);
  }

  function openDealer(poi) {
    dealerPOI = poi || null;
    const list = dealerList();
    const cur = list.indexOf(SC.game.save.current);
    dealerIdx = cur >= 0 ? cur : 0;
    open('dealer');
  }

  /* ------------------------------ الكراج -------------------------------- */
  let garageIdx = 0;
  function garageList() {
    return SC.game.save.owned.filter((id) => SC.cars.defs[id]);
  }
  function buildGarage() {
    const list = garageList();
    if (!list.length) return;
    garageIdx = ((garageIdx % list.length) + list.length) % list.length;
    const id = list[garageIdx], def = SC.cars.defs[id], sv = SC.game.save;
    const current = sv.current === id;
    if (dom.garageCount) dom.garageCount.textContent = list.length + ' سيارات';
    dom.garageName.textContent = def.name;
    dom.garageTag.textContent = def.tag + ' · الفئة ' + def.cls;
    dom.garageBadge.textContent = 'GARAGE';
    dom.garageStats.innerHTML =
      statRow('السرعة', def.stats.speed, 'speed') +
      statRow('التسارع', def.stats.accel, 'accel') +
      statRow('التحكّم', def.stats.grip, 'grip');
    const act = dom.garageActions;
    act.innerHTML = '';
    if (!current) {
      const use = U.el('button', 'btn primary', '✓ اختر هذه السيارة');
      SC.input.bindTap(use, () => {
        SC.game.selectCar(id);
        dom.garageNote.className = 'd-note ok';
        dom.garageNote.textContent = 'تمّ — اخرج وقُد.';
        buildGarage();
      });
      act.appendChild(use);
    } else {
      act.appendChild(U.el('button', 'btn off', '★ سيارتك الحالية'));
    }
    const back = U.el('button', 'btn ghost', 'خروج');
    SC.input.bindTap(back, () => hideAll());
    act.appendChild(back);

    dom.garageStrip.innerHTML = '';
    list.forEach((cid, i) => {
      const d = SC.cars.defs[cid];
      const card = U.el('button', 'd-card owned' + (i === garageIdx ? ' on' : ''));
      card.innerHTML = '<b>' + d.name + '</b><span>' + (sv.current === cid ? 'الحالية' : 'مملوكة') + '</span>';
      SC.input.bindTap(card, () => { garageIdx = i; buildGarage(); });
      dom.garageStrip.appendChild(card);
    });
    const P = makePreview(dom.garageCanvas);
    previewShow(P, id);
    previewStart(P);
  }
  function openGarage() {
    const list = garageList();
    const cur = list.indexOf(SC.game.save.current);
    garageIdx = cur >= 0 ? cur : 0;
    open('garage');
  }

  /* ------------------ شارة الدخول إلى مكان في المدينة ------------------- */
  function showPOI(poi) {
    const el = dom.poiPrompt;
    if (!el) return;
    if (!poi) { el.classList.remove('show'); return; }
    dom.poiIcon.textContent = poi.icon;
    dom.poiName.textContent = poi.name;
    dom.poiSub.textContent = poi.en;
    const enter = dom.poiEnter;
    const usable = poi.kind === 'dealer' || poi.kind === 'garage';
    enter.textContent = usable ? 'دخول' : 'زيارة';
    enter.classList.toggle('off', !usable);
    el.classList.add('show');
    SC.audio.ui();
  }

  function enterPOI() {
    const poi = SC.game.G.nearPOI;
    if (!poi) return;
    if (poi.kind === 'dealer') openDealer(poi);
    else if (poi.kind === 'garage') openGarage();
    else SC.hud.toast(poi.icon + ' ' + poi.name + ' — ' + poi.en, '', 2200);
  }

  /* ------------------------------ الراديو ------------------------------- */
  /* شريط الأزرار العلوي يلتفّ على الشاشات الضيّقة، فنقيس ارتفاعه الحقيقي
     ونُنزل الراديو ولوحة المهمّة تحته بدل أرقام ثابتة. */
  function layoutTopbar() {
    const tb = document.querySelector('.topbar');
    if (!tb) return;
    const h = Math.round(tb.getBoundingClientRect().height);
    if (h > 0) document.documentElement.style.setProperty('--topbar-h', h + 'px');
  }

  function initRadio() {
    if (!dom.radioBar) return;
    layoutTopbar();
    window.addEventListener('resize', layoutTopbar);
    [80, 400, 1200].forEach((ms) => setTimeout(layoutTopbar, ms));
    SC.input.bindTap(dom.radioNext, () => { SC.audio.radioNext(); closeRadioList(); });
    SC.input.bindTap(dom.radioPrev, () => { SC.audio.radioPrev(); closeRadioList(); });
    SC.input.bindTap(dom.radioName, () => toggleRadioList());
    /* أي لمسة على الشاشة تغلق قائمة المحطّات */
    const canvas = document.getElementById('c');
    if (canvas) canvas.addEventListener('pointerdown', closeRadioList);
    SC.audio.radioOnChange((st, i, announce) => {
      const cur = SC.audio.radioCurrent();
      if (dom.radioTitle) {
        dom.radioTitle.textContent = cur.failed ? st.title + ' — لا يوجد اتصال'
                                   : cur.loading ? st.title + ' …' : st.title;
      }
      dom.radioBar.classList.toggle('off', st.kind === 'off');
      dom.radioBar.classList.toggle('wait', !!cur.loading);
      dom.radioBar.classList.toggle('fail', !!cur.failed);
      if (announce) {
        dom.radioBar.classList.remove('flash');
        void dom.radioBar.offsetWidth;               // إعادة تشغيل الوميض
        dom.radioBar.classList.add('flash');
      }
      buildRadioList();
      if (announce && st.kind !== 'off') SC.hud.toast('📻 ' + st.title, '', 1600);
      /* لا نحفظ المحطّة إلا عن اختيار صريح أو عند تشغيل مقطع فعلي،
         وإلا كتب فحصُ الملفات المحفوظة عند الإقلاع «مطفأ» فوق اختيارك. */
      if (announce === true || st.kind === 'url') {
        if (SC.game.save.radio !== st.id) {
          SC.game.save.radio = st.id;
          SC.game.persist();
        }
      }
    });
    buildRadioList();
    /* امسح أي مقطع محفوظ لم يعد ضمن القائمة، ثم افحص الباقي */
    SC.audio.pruneCache().then(() => SC.audio.refreshCached());
  }

  function buildRadioList() {
    const wrap = dom.radioList;
    if (!wrap) return;
    const cur = SC.audio.radioCurrent();
    const cached = SC.audio.radioCachedMap();
    const saving = SC.audio.radioSavingMap();
    wrap.innerHTML = '';
    let urlCount = 0, savedCount = 0;
    SC.audio.radioStations().forEach((st, i) => {
      const b = U.el('button', i === cur.index ? 'on' : '');
      let tag = '';
      if (st.kind === 'url') {
        urlCount++;
        if (cached[st.id]) { tag = '<b class="rok">✓</b>'; savedCount++; }
        else if (saving[st.id]) tag = '<b class="rdl">⌛</b>';
      }
      b.innerHTML = '<i>' + st.icon + '</i><span>' + st.title + '</span>' + tag;
      SC.input.bindTap(b, () => { SC.audio.playStation(i); closeRadioList(); });
      wrap.appendChild(b);
    });
    /* زرّ الحفظ للتشغيل دون إنترنت */
    const save = U.el('button', 'rsave');
    const done = savedCount >= urlCount && urlCount > 0;
    save.innerHTML = done
      ? '<i>✅</i><span>الموسيقى محفوظة — تعمل بلا إنترنت</span>'
      : '<i>⬇️</i><span>حفظ الموسيقى للتشغيل بلا إنترنت (' + savedCount + '/' + urlCount + ')</span>';
    if (!done) {
      SC.input.bindTap(save, () => {
        save.innerHTML = '<i>⌛</i><span>جارٍ الحفظ…</span>';
        SC.audio.cacheAll((d, n, ok) => {
          save.innerHTML = '<i>⌛</i><span>جارٍ الحفظ… ' + d + '/' + n + '</span>';
          if (d >= n) {
            save.innerHTML = ok >= n
              ? '<i>✅</i><span>تمّ الحفظ — تعمل بلا إنترنت</span>'
              : '<i>⚠️</i><span>حُفظ ' + ok + ' من ' + n + ' — تحقّق من الإنترنت</span>';
            SC.hud.toast(ok >= n ? '✅ الموسيقى صارت تعمل بلا إنترنت'
                                 : '⚠️ حُفظ ' + ok + ' من ' + n + ' مقاطع', '', 2600);
            setTimeout(buildRadioList, 1400);
          }
        });
      });
    }
    wrap.appendChild(save);
    /* مدخل مكتبة الموسيقى الشخصية */
    const mine = U.el('button', 'rsave');
    const n = SC.mylib ? SC.mylib.state.list.length : 0;
    mine.innerHTML = '<i>🎵</i><span>موسيقاي من الجهاز' + (n ? ' (' + n + ')' : '') + '</span>';
    SC.input.bindTap(mine, () => { closeRadioList(); open('music'); });
    wrap.appendChild(mine);
  }
  function toggleRadioList() {
    if (!dom.radioList) return;
    const showing = dom.radioList.classList.contains('show');
    if (showing) closeRadioList();
    else { buildRadioList(); dom.radioList.classList.add('show'); SC.audio.ui(); }
  }
  function closeRadioList() { if (dom.radioList) dom.radioList.classList.remove('show'); }

  function buildMissions() {
    const wrap = dom.missionList;
    wrap.innerHTML = '';
    const s = SC.game.save;
    const cur = SC.cars.family(s.current);      // عائلة المركبة الحالية
    if (!missionTab) missionTab = cur;

    /* أزرار التبديل بين مركبات المهام */
    const tabs = U.el('div', 'mtabs');
    VEH_TABS.forEach((t) => {
      const owned = s.owned.some((id) => SC.cars.family(id) === t.id);
      const b = U.el('button', 'mtab' + (missionTab === t.id ? ' on' : '') + (owned ? '' : ' locked'),
                     t.label + (owned ? '' : ' 🔒'));
      SC.input.bindTap(b, () => { missionTab = t.id; buildMissions(); });
      tabs.appendChild(b);
    });
    wrap.appendChild(tabs);

    const tabDef = VEH_TABS.filter((t) => t.id === missionTab)[0] || VEH_TABS[0];
    const owned = s.owned.some((id) => SC.cars.family(id) === missionTab);
    const note = U.el('div', 'mnote',
      tabDef.hint + (owned
        ? (cur === missionTab ? '' : ' — بدّل إلى هذه المركبة من المتجر لتبدأ')
        : ' — اشترِ هذه المركبة من المتجر أولاً'));
    wrap.appendChild(note);

    const list = SC.game.G.missions.filter((m) => (m.veh || 'cortina') === missionTab);
    if (!list.length) { wrap.appendChild(U.el('div', 'mnote', 'لا توجد مهام لهذه المركبة بعد')); return; }

    list.forEach((def) => {
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
      if (cur === missionTab) {
        const go = U.el('button', 'btn primary', 'ابدأ');
        SC.input.bindTap(go, () => { hideAll(true); SC.game.startMission(def); });
        act.appendChild(go);
      } else if (owned) {
        const sw = U.el('button', 'btn primary', 'بدّل وابدأ');
        SC.input.bindTap(sw, () => {
          /* بدّل إلى أفضل مركبة مملوكة من هذه العائلة */
          const pick = s.owned.filter((id) => SC.cars.family(id) === missionTab)
                              .sort((a, b) => SC.cars.defs[b].price - SC.cars.defs[a].price)[0];
          if (pick) SC.game.spawnPlayer(pick, true);
          hideAll(true);
          SC.game.startMission(def);
        });
        act.appendChild(sw);
      } else {
        const buy = U.el('button', 'btn ghost', 'إلى المتجر');
        SC.input.bindTap(buy, () => open('shop'));
        act.appendChild(buy);
      }
      const mark = U.el('button', 'btn ghost tiny', 'على الخريطة');
      SC.input.bindTap(mark, () => { SC.game.setWaypoint({ x: def.from.x, z: def.from.z }); hideAll(); });
      act.appendChild(mark);
      wrap.appendChild(card);
    });
  }

  /* ------------------------------ الخريطة ------------------------------- */
  function initMap() {
    if (!mapCanvas) return;
    let dragging = false, lastX = 0, lastY = 0, moved = 0, pinch = null;

    const resize = () => {
      const r = mapCanvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      mapCanvas.width = Math.max(320, Math.round(r.width * dpr));
      mapCanvas.height = Math.max(240, Math.round(r.height * dpr));
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
      mapView.px += dx; mapView.py += dy; mapView.touched = true;
      drawMap();
    });
    mapCanvas.addEventListener('pointerup', (e) => {
      dragging = false;
      if (moved < 6) {
        const r = mapCanvas.getBoundingClientRect();
        const p = SC.hud.screenToWorld(mapCanvas,
          mapView, (e.clientX - r.left) * mapCanvas.width / r.width,
          (e.clientY - r.top) * mapCanvas.height / r.height);
        /* أي مكان على الخريطة صالح: لو ضغطتَ على البحر نأخذك إلى أقرب طريق */
        let dest = p, snapped = false;
        if (!SC.world.inBounds(p.x, p.z) && !SC.world.bridgeAt(p.x, p.z)) {
          const sn = SC.world.snapToRoad(p.x, p.z);
          dest = { x: sn.x, z: sn.z };
          snapped = true;
        }
        SC.game.setWaypoint(dest);
        SC.audio.ui();
        if (snapped) SC.hud.toast('البحر ليس طريقاً — اخترنا أقرب نقطة على اليابسة', '', 2200);
        drawMap();
      }
    });
    mapCanvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      mapView.zoom = U.clamp(mapView.zoom * f, 0.22, 2.6);
      drawMap();
    }, { passive: false });

    SC.input.bindTap(dom.mapCenter, () => { mapView.touched = true; mapView.zoom = 1.35; centerMap(); drawMap(); });
    if (dom.mapWorld) SC.input.bindTap(dom.mapWorld, () => { mapView.touched = false; fitMap(); drawMap(); });
    SC.input.bindTap(dom.mapClear, () => { SC.game.setWaypoint(null); drawMap(); });
    SC.input.bindTap(dom.mapIn, () => { mapView.zoom = U.clamp(mapView.zoom * 1.25, 0.22, 2.6); drawMap(); });
    SC.input.bindTap(dom.mapOut, () => { mapView.zoom = U.clamp(mapView.zoom / 1.25, 0.22, 2.6); drawMap(); });
  }
  function centerMap() {
    const car = SC.game.car;
    if (mapCanvas) SC.hud.focusBigMap(mapCanvas, mapView, car.pos.x, car.pos.z);
  }
  function fitMap() { mapView.px = 0; mapView.py = 0; mapView.zoom = 0.42; }
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

    row('وقت اليوم', seg('tod', [['auto', 'تلقائي 🕒'], ['day', 'نهار'], ['sunset', 'غروب'], ['night', 'ليل']],
      null, (v) => SC.game.setTimeOfDay(v)),
      'تلقائي: الوقت يمضي وحده من النهار إلى الغروب فالليل ثمّ الفجر');

    row('الفصل', seg('season', [['summer', 'صيف ☀️'], ['winter', 'شتاء ❄️']],
      null, (v) => SC.game.setSeason(v)), 'الشتاء يكسو المدينة بالثلج');

    /* اللعب الجماعي يحتاج خادماً محلياً، فلا يظهر في شاشة البداية ولا في الـHUD */
    {
      const b = U.el('button', 'btn ghost', '🌐 اللعب الجماعي — الغرف والميكروفون');
      SC.input.bindTap(b, () => open('online'));
      row('اللعب مع أصدقائك', b,
          'أنشئ غرفة أو ادخل غرفة غيرك وتكلّم بالميكروفون. يحتاج خادماً: ' +
          'node server/server.mjs — واللعبة تعمل كاملةً بدونه');
    }

    {
      const b = U.el('button', 'btn ghost', '🎵 موسيقاي — أضف من جهازك');
      SC.input.bindTap(b, () => open('music'));
      row('الموسيقى الشخصية', b,
          'أضف مقاطع تملك حقّ استخدامها من جهازك. تُحفظ على جهازك وحده ولا تُرفع لأي خادم');
    }

    row('صوت المحرّك', seg('engine', [['0', 'مطفأ'], ['1', 'مُفعّل']], null, (v) => {
      SC.settings.engineSound = v === '1';
      SC.audio.setEngineSound(SC.settings.engineSound);
      SC.game.persist();
    }), 'مطفأ افتراضياً — تبقى أصوات الإطارات والرياح والاصطدام');

    row('جودة الرسوم', seg('quality', [['low', 'منخفضة'], ['medium', 'متوسطة'], ['high', 'عالية']],
      null, (v) => SC.game.setQuality(v)),
      'منخفضة: بلا ظلال ولا جزيئات · متوسطة: ظلال بسيطة · عالية: ظلال ناعمة وانعكاسات');

    row('ضبط تلقائي للأداء', seg('auto', [['1', 'مفعّل'], ['0', 'مطفأ']], null,
      (v) => { SC.settings.autoScale = v === '1'; SC.game.persist(); }),
      'يقلّل مدى الرؤية تلقائياً إن تباطأت اللعبة');

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
    row('مؤثّرات الصوت', vol);

    const mvol = U.el('input');
    mvol.type = 'range'; mvol.min = '0'; mvol.max = '1'; mvol.step = '0.05';
    mvol.addEventListener('input', () => {
      SC.settings.music = +mvol.value;
      SC.audio.setMusicVolume(+mvol.value);
      if (+mvol.value > 0) SC.audio.startMusic();
      SC.game.persist();
    });
    dom.mvol = mvol;
    row('الموسيقى الخلفية', mvol);

    row('الميكروفون (أون لاين)', seg('mic', [['1', 'مفتوح'], ['0', 'مغلق']], null,
      async (v) => {
        if (v === '1') await SC.net.startMic(); else SC.net.stopMic();
        SC.settings.micOn = v === '1';
        SC.game.persist();
      }), 'للتحدّث مع اللاعبين أثناء اللعب الجماعي');

    row('المارّة في الشوارع', seg('peds', [['1', 'مفعّل'], ['0', 'مطفأ']], null,
      (v) => { SC.settings.peds = v === '1'; SC.game.setPeds(v === '1'); }));

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
    setGroup('season', s.season || 'summer');
    setGroup('engine', s.engineSound ? '1' : '0');
    setGroup('quality', s.quality === 'auto' ? (SC.quality.name) : s.quality);
    setGroup('traffic', s.traffic ? '1' : '0');
    setGroup('rotate', s.mapRotate ? '1' : '0');
    setGroup('haptics', s.haptics ? '1' : '0');
    setGroup('assist', s.assist ? '1' : '0');
    if (dom.sens) dom.sens.value = s.steerSense;
    if (dom.lookS) dom.lookS.value = s.lookSense || 1;
    if (dom.vol) dom.vol.value = s.sound ? s.volume : 0;
    if (dom.mvol) dom.mvol.value = s.music == null ? 0.5 : s.music;
    setGroup('mic', SC.net && SC.net.state.mic ? '1' : '0');
    setGroup('peds', s.peds === false ? '0' : '1');
    setGroup('auto', s.autoScale === false ? '0' : '1');
  }

  /* ------------------------------ النتائج ------------------------------- */
  function showResult(res) {
    const el = dom.screenResult;
    dom.resultTitle.textContent = res.success ? 'أحسنت!' : 'فشلت المهمّة';
    dom.resultTitle.className = 'res-title ' + (res.success ? 'ok' : 'bad');
    dom.resultSub.textContent = res.def.title + (res.reason ? ' — ' + res.reason : '');
    const rows = [];
    if (res.def.type === 'race') rows.push(['المركز', res.pos + ' / ' + (res.def.rivals + 1)]);
    if (res.comfort != null) rows.push(['راحة الراكب', res.comfort + '٪']);
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

  return { init, open, hideAll, refreshWallet, buildRadioList, closeRadioList, layoutTopbar,
           showPOI, openDealer, openGarage, enterPOI, showResult, showPrompt, tick, buildShop, drawMap,
           buildMusic, openReport,
           get current() { return current; } };
})();
