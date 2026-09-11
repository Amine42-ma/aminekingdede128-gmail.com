/* ============================================================================
   SPEED CITY — الصوت: محرّك مركّب رقمياً (بدون ملفات صوت)
   ========================================================================== */
SC.audio = (function () {
  const U = SC.util;
  let ctx = null, master = null, ready = false, enabled = true;
  let eng = null, squeal = null, wind = null, sfxBus = null, musicBus = null;
  let engineOn = false;          // صوت المحرّك مطفأ افتراضياً
  let lastThrottle = 0;

  function noiseBuffer(sec) {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);

    /* --- المحرّك: موجة مركّبة غنيّة بالتوافقيات + شهيق + صفير التربو --- */
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1;
    sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.55;
    musicBus.connect(master);

    const g = ctx.createGain(); g.gain.value = 0;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 1500; filt.Q.value = 4;

    // موجة دورية تحاكي أشواط المحرّك (توافقيات فردية أقوى)
    const N = 16, re = new Float32Array(N), im = new Float32Array(N);
    for (let i = 1; i < N; i++) im[i] = (i % 2 ? 1 : 0.45) / (i * 0.85);
    const wave = ctx.createPeriodicWave(re, im, { disableNormalization: false });

    const o1 = ctx.createOscillator(); o1.setPeriodicWave(wave); o1.frequency.value = 60;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 30; o2.detune.value = -7;
    const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = 480;   // صفير التربو
    const g2 = ctx.createGain(); g2.gain.value = 0.42;
    const g3 = ctx.createGain(); g3.gain.value = 0;
    const nz = ctx.createBufferSource(); nz.buffer = noiseBuffer(2); nz.loop = true;
    const nzg = ctx.createGain(); nzg.gain.value = 0.05;
    const nzf = ctx.createBiquadFilter(); nzf.type = 'bandpass'; nzf.frequency.value = 420; nzf.Q.value = 0.7;
    o1.connect(filt); o2.connect(g2); g2.connect(filt);
    nz.connect(nzf); nzf.connect(nzg); nzg.connect(filt);
    filt.connect(g); g.connect(sfxBus);
    o3.connect(g3); g3.connect(sfxBus);
    o1.start(); o2.start(); o3.start(); nz.start();
    eng = { g, filt, o1, o2, o3, g3, nzg };

    /* --- صرير الإطارات --- */
    const sq = ctx.createBufferSource(); sq.buffer = noiseBuffer(2); sq.loop = true;
    const sqf = ctx.createBiquadFilter(); sqf.type = 'bandpass'; sqf.frequency.value = 1750; sqf.Q.value = 7;
    const sqg = ctx.createGain(); sqg.gain.value = 0;
    sq.connect(sqf); sqf.connect(sqg); sqg.connect(sfxBus); sq.start();
    squeal = { g: sqg, f: sqf };

    /* --- صوت الهواء مع السرعة --- */
    const w = ctx.createBufferSource(); w.buffer = noiseBuffer(2); w.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'highpass'; wf.frequency.value = 900;
    const wg = ctx.createGain(); wg.gain.value = 0;
    w.connect(wf); wf.connect(wg); wg.connect(sfxBus); w.start();
    wind = { g: wg, f: wf };
    ready = true;
  }

  function resume() {
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }
  /* كتم مرشّح تحت الماء */
  let uwFilter = null;
  function setUnderwater(on) {
    if (!ready) return;
    if (!uwFilter) {
      uwFilter = ctx.createBiquadFilter();
      uwFilter.type = 'lowpass';
      uwFilter.frequency.value = 22000;
      master.disconnect();
      master.connect(uwFilter);
      uwFilter.connect(ctx.destination);
    }
    uwFilter.frequency.setTargetAtTime(on ? 380 : 22000, ctx.currentTime, 0.15);
  }

  function setEnabled(v) {
    enabled = v;
    if (master) master.gain.value = v ? 0.85 : 0;
  }
  function setVolume(v) { if (master) master.gain.value = enabled ? v : 0; }

  /* تحديث دوري من حلقة اللعبة */
  function update(dt, car, paused) {
    if (!ready || !enabled) return;
    const idle = 58;
    const rpm = paused ? 0.12 : car.rpm;
    const load = paused ? 0 : (car.input.throttle * 0.6 + 0.25);
    const f = idle + rpm * 118 * (car.def.mass < 500 ? 1.55 : 1);
    /* صوت المحرّك مُطفأ افتراضياً — كان مزعجاً. يُفعَّل من الإعدادات. */
    if (engineOn) {
      eng.o1.frequency.setTargetAtTime(f, ctx.currentTime, 0.045);
      eng.o2.frequency.setTargetAtTime(f * 0.5, ctx.currentTime, 0.045);
      eng.filt.frequency.setTargetAtTime(500 + rpm * 2600, ctx.currentTime, 0.06);
      eng.g.gain.setTargetAtTime(paused ? 0.0 : 0.055 + load * 0.075 + (car.nitroActive ? 0.05 : 0),
        ctx.currentTime, 0.07);
    } else if (eng.g.gain.value > 0.0001) {
      eng.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    }

    const slip = paused ? 0 : U.clamp(car.slip * (car.kmh > 12 ? 1 : 0), 0, 1);
    squeal.g.gain.setTargetAtTime(slip * 0.11, ctx.currentTime, 0.05);
    squeal.f.frequency.setTargetAtTime(1500 + slip * 900, ctx.currentTime, 0.08);

    const spd = paused ? 0 : U.clamp(car.kmh / 210, 0, 1);
    wind.g.gain.setTargetAtTime(spd * spd * 0.07, ctx.currentTime, 0.12);
    wind.f.frequency.setTargetAtTime(700 + spd * 1500, ctx.currentTime, 0.15);

    /* صفير التربو وطقطقة العادم تتبعان صوت المحرّك */
    if (engineOn) {
      eng.o3.frequency.setTargetAtTime(900 + rpm * 3200, ctx.currentTime, 0.10);
      eng.g3.gain.setTargetAtTime(paused ? 0 : U.clamp((rpm - 0.55) * 0.055, 0, 0.03) * (car.input.throttle > 0.3 ? 1 : 0.25),
        ctx.currentTime, 0.12);
      const thr = paused ? 0 : car.input.throttle;
      if (lastThrottle > 0.55 && thr < 0.15 && rpm > 0.55) pop();
      lastThrottle = thr;
    } else if (eng.g3.gain.value > 0.0001) {
      eng.g3.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
    }
  }

  /* طقطقة عادم قصيرة */
  function pop() {
    if (!ready || !enabled) return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.12);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 240; f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.value = 0.16;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(); src.stop(ctx.currentTime + 0.14);
  }

  /* ------------------------------ أصوات لحظية -------------------------- */
  function blip(freq, dur, type, vol, slideTo) {
    if (!ready || !enabled) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(vol == null ? 0.16 : vol, ctx.currentTime + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + dur);
    o.connect(g); g.connect(sfxBus);
    o.start(); o.stop(ctx.currentTime + dur + 0.02);
  }

  function crash(power) {
    if (!ready || !enabled) return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.4);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.value = 900 + power * 1400;
    f.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.3);
    const g = ctx.createGain();
    g.gain.value = U.clamp(power, 0.05, 1) * 0.5;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(); src.stop(ctx.currentTime + 0.4);
  }

  let hornNodes = null;
  function horn(on) {
    if (!ready || !enabled) return;
    if (on && !hornNodes) {
      const g = ctx.createGain(); g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.10, ctx.currentTime + 0.03);
      const a = ctx.createOscillator(); a.type = 'square'; a.frequency.value = 415;
      const b = ctx.createOscillator(); b.type = 'square'; b.frequency.value = 494;
      a.connect(g); b.connect(g); g.connect(sfxBus);
      a.start(); b.start();
      hornNodes = { a, b, g };
    } else if (!on && hornNodes) {
      const { a, b, g } = hornNodes;
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.06);
      a.stop(ctx.currentTime + 0.1); b.stop(ctx.currentTime + 0.1);
      hornNodes = null;
    }
  }
  function hornBeep() { horn(true); setTimeout(() => horn(false), 320); }

  const ui = () => blip(660, 0.07, 'triangle', 0.09);
  const good = () => { blip(660, 0.1, 'triangle', 0.12); setTimeout(() => blip(990, 0.16, 'triangle', 0.12), 90); };
  const bad = () => blip(220, 0.35, 'sawtooth', 0.1, 90);
  const cash = () => { blip(1320, 0.08, 'sine', 0.1); setTimeout(() => blip(1760, 0.14, 'sine', 0.1), 70); };
  const check = () => blip(1180, 0.12, 'triangle', 0.13);
  const count = (last) => blip(last ? 1320 : 720, last ? 0.5 : 0.18, 'triangle', 0.15);

  /* ======================= الموسيقى الخلفية ==========================
     حلقة إلكترونية مولّدة بالكامل داخل المتصفّح: باس + وتريات + إيقاع.
     ================================================================== */
  const music = {
    on: false, vol: 0.5, timer: null, step: 0, next: 0, bpm: 104,
    prog: [0, 5, 3, 7],                       // Am · F · C · G (بالنسبة إلى A)
    scale: [0, 3, 5, 7, 10]
  };
  const NOTE = (semi) => 55 * Math.pow(2, semi / 12);   // A1 أساساً

  function voice(type, freq, t, dur, vol, dest, detune) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (detune) o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || musicBus);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function drum(kind, t) {
    if (kind === 'kick') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.connect(g); g.connect(musicBus);
      o.start(t); o.stop(t + 0.25);
    } else {
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.25);
      const f = ctx.createBiquadFilter();
      f.type = kind === 'snare' ? 'bandpass' : 'highpass';
      f.frequency.value = kind === 'snare' ? 1800 : 7200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(kind === 'snare' ? 0.28 : 0.10, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'snare' ? 0.16 : 0.05));
      src.connect(f); f.connect(g); g.connect(musicBus);
      src.start(t); src.stop(t + 0.3);
    }
  }

  function scheduleMusic() {
    if (!music.on || !ready) return;
    const spb = 60 / music.bpm / 2;              // خطوة = نصف نبضة (٨ لكل مازورة)
    while (music.next < ctx.currentTime + 0.35) {
      const t = Math.max(music.next, ctx.currentTime + 0.02);
      const st = music.step % 16;
      const bar = Math.floor(music.step / 16) % 4;
      const root = music.prog[bar];

      if (st % 4 === 0) drum('kick', t);
      if (st % 8 === 4) drum('snare', t);
      if (st % 2 === 0) drum('hat', t);

      const section = Math.floor(music.step / 64) % 2;       // مقطعان يتبادلان
      // الباس
      if (st % 2 === 0) {
        const oct = (st % 8 === 0 || st % 4 === 0) ? 0 : 12;
        voice('sawtooth', NOTE(root + oct), t, 0.26, 0.15);
        if (section === 1 && st % 8 === 6) voice('sawtooth', NOTE(root + 7), t, 0.18, 0.10);
      }
      // وتر ممتدّ في بداية كل مازورة
      if (st === 0) {
        [0, 3, 7, 10].forEach((iv, k) =>
          voice('triangle', NOTE(root + 24 + iv), t, 1.7, 0.042, null, (k - 1) * 7));
      }
      // لحن
      if (section === 1 ? (st % 2 === 1) : (st % 4 === 2 && bar % 2 === 1)) {
        const n = music.scale[(Math.floor(music.step / 2) + bar) % music.scale.length];
        voice('square', NOTE(root + 36 + n), t, 0.18, section === 1 ? 0.030 : 0.024);
      }
      // تصفيق خفيف في نهاية كل أربع مازورات
      if (bar === 3 && st >= 12 && st % 2 === 0) drum('hat', t);
      music.step++;
      music.next = (music.next || ctx.currentTime) + spb;
    }
  }


  /* =========================== راديو السيارة ============================
     المقاطع تُبَثّ مباشرةً من روابط المالك، فلا تُضمَّن في الملف ولا تُحمَّل
     في الذاكرة. نُشغّلها بعنصر <audio> عادي ونتحكّم بمستواه مباشرةً —
     لا نمرّرها على WebAudio لأن الربط عبر createMediaElementSource يحتاج
     ترويسات CORS، وبدونها يخرج صمتٌ تام بلا أي خطأ ظاهر. */
  const RADIO_TRACKS = [
    { id: 'zero_latency', title: 'Zero Latency',
      url: 'https://qcucttfkpnpkpfdbnsoq.supabase.co/storage/v1/object/public/Game/Zero+Latency.mp3' },
    { id: 'lost_velocity', title: 'Lost in the Velocity',
      url: 'https://qcucttfkpnpkpfdbnsoq.supabase.co/storage/v1/object/public/Game/Lost+in+the+Velocity.mp3' },
    { id: 'lost_night', title: 'Lost in the Night',
      url: 'https://qcucttfkpnpkpfdbnsoq.supabase.co/storage/v1/object/public/Game/Lost+in+the+Night.mp3' },
    { id: 'full_speed', title: 'Full Speed Ahead',
      url: 'https://qcucttfkpnpkpfdbnsoq.supabase.co/storage/v1/object/public/Game/Full+Speed+Ahead.mp3' }
  ];

  const radio = {
    stations: [], index: 0, el: null, on: true, onChange: null,
    loading: false, failed: {}
  };

  function buildStations() {
    if (radio.stations.length) return radio.stations;
    radio.stations.push({ id: 'off',  title: 'الراديو مطفأ',  kind: 'off',  icon: '🔇' });
    radio.stations.push({ id: 'city', title: 'إذاعة المدينة', kind: 'proc', icon: '🎛' });
    const list = (typeof window !== 'undefined' && window.SC_RADIO_TRACKS) || RADIO_TRACKS;
    list.forEach((t) => radio.stations.push({
      id: t.id, title: t.title, url: t.url, kind: 'url', icon: '🎵'
    }));
    return radio.stations;
  }

  function ensureRadioEl() {
    if (radio.el) return radio.el;
    const el = new Audio();
    el.preload = 'none';
    el.loop = false;
    /* بلا crossOrigin: التشغيل المباشر لا يحتاجها، ووضعها يفرض CORS بلا داعٍ */
    el.addEventListener('ended', () => { if (radio.on) radioNext(true); });
    el.addEventListener('playing', () => {
      radio.loading = false;
      const st = currentStation();
      if (st) delete radio.failed[st.id];
      if (radio.onChange) radio.onChange(st, radio.index, false);
    });
    el.addEventListener('error', onRadioError);
    el.addEventListener('stalled', () => { radio.loading = true; });
    radio.el = el;
    return el;
  }

  /* تعذّر تحميل مقطع (بلا إنترنت مثلاً): علّمه وانتقل لغيره مرّة واحدة */
  function onRadioError() {
    const st = currentStation();
    if (!st || st.kind !== 'url') return;
    radio.failed[st.id] = true;
    radio.loading = false;
    if (radio.onChange) radio.onChange(st, radio.index, false);
    const all = buildStations().filter((x) => x.kind === 'url');
    if (all.every((x) => radio.failed[x.id])) { radioSet('city'); return; }
    radioNext(true);
  }

  function currentStation() {
    buildStations();
    return radio.stations[U.clamp(radio.index, 0, radio.stations.length - 1)];
  }

  function radioVolume() {
    return U.clamp((music.vol == null ? 0.45 : music.vol) * 1.15, 0, 1);
  }

  function playStation(i, announce) {
    init();
    buildStations();
    radio.index = ((i % radio.stations.length) + radio.stations.length) % radio.stations.length;
    const st = radio.stations[radio.index];
    const el = ensureRadioEl();

    if (st.kind !== 'url') {
      el.pause();
      el.removeAttribute('src');
      el.load();
      radio.loading = false;
    }
    if (st.kind === 'proc') startMusic(); else stopMusic();
    if (st.kind === 'off' && musicBus) musicBus.gain.value = 0;

    if (st.kind === 'url') {
      el.src = st.url;
      el.volume = radioVolume();
      radio.loading = true;
      if (radioVolume() > 0) {
        const pr = el.play();
        if (pr && pr.catch) pr.catch(() => { radio.loading = false; });
      } else radio.loading = false;
    }
    radio.on = st.kind !== 'off';
    if (radio.onChange) radio.onChange(st, radio.index, announce !== false);
    return st;
  }

  function radioNext(auto) {
    buildStations();
    let i = radio.index + 1;
    if (auto) {
      /* التقدّم التلقائي يتخطّى «مطفأ» و«إذاعة المدينة» والمقاطع المتعذّرة */
      for (let n = 0; n < radio.stations.length; n++, i++) {
        const st = radio.stations[((i % radio.stations.length) + radio.stations.length) % radio.stations.length];
        if (st.kind === 'url' && !radio.failed[st.id]) break;
      }
    }
    return playStation(i, !auto);
  }
  function radioPrev() { return playStation(radio.index - 1); }
  function radioSet(id) {
    buildStations();
    const i = radio.stations.findIndex((s) => s.id === id);
    return playStation(i < 0 ? 1 : i);
  }
  function radioStations() { return buildStations(); }
  function radioCurrent() {
    return { station: currentStation(), index: radio.index,
             loading: radio.loading, failed: !!radio.failed[currentStation().id] };
  }
  function radioOnChange(fn) { radio.onChange = fn; }
  function radioPause() { if (radio.el) radio.el.pause(); }
  function radioResume() {
    if (radio.el && currentStation().kind === 'url' && radio.on && radioVolume() > 0) {
      const pr = radio.el.play(); if (pr && pr.catch) pr.catch(() => {});
    }
  }

  function startMusic() {
    init();
    if (!ready || music.on) return;
    music.on = true;
    music.step = 0;
    music.next = ctx.currentTime + 0.1;
    musicBus.gain.value = music.vol * 0.6;
    music.timer = setInterval(scheduleMusic, 60);
    scheduleMusic();
  }
  function stopMusic() {
    music.on = false;
    if (music.timer) { clearInterval(music.timer); music.timer = null; }
    if (musicBus) musicBus.gain.value = 0;
  }
  function setMusicVolume(v) {
    music.vol = v;
    const st = radio.stations.length ? currentStation() : null;
    const onUrl = st && st.kind === 'url';
    if (musicBus) musicBus.gain.value = (music.on && !onUrl) ? v * 0.6 : (onUrl ? 0 : (music.on ? v * 0.6 : 0));
    if (radio.el) {
      radio.el.volume = radioVolume();
      if (onUrl) {
        if (v <= 0) radio.el.pause();
        else if (radio.el.paused && radio.on) {
          const pr = radio.el.play(); if (pr && pr.catch) pr.catch(() => {});
        }
      }
    }
    if (v <= 0 && !onUrl) stopMusic();
  }
  function setSfxVolume(v) { if (sfxBus) sfxBus.gain.value = v; }
  function setEngineSound(on) {
    engineOn = !!on;
    if (eng && !engineOn) {
      eng.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      eng.g3.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    }
  }

  /* تمرير الصوت تحت الماء إلى الراديو أيضاً يجري عبر musicBus نفسه */
  function radioPause() { if (radio.el) radio.el.pause(); }
  function radioResume() {
    if (radio.el && currentStation().kind === 'file' && radio.on) {
      const pr = radio.el.play(); if (pr && pr.catch) pr.catch(() => {});
    }
  }

  return { init, resume, update, setEnabled, setVolume, setUnderwater, blip, crash, horn, hornBeep, pop,
           startMusic, stopMusic, setMusicVolume, setSfxVolume, setEngineSound, music,
           radioNext, radioPrev, radioSet, radioStations, radioCurrent, radioOnChange,
           radioPause, radioResume, playStation, get radioEl() { return radio.el; },
           get engineGain() { return eng ? eng.g.gain.value : null; },
           ui, good, bad, cash, check, count, get ctx() { return ctx; } };
})();
