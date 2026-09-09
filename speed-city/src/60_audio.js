/* ============================================================================
   SPEED CITY — الصوت: محرّك مركّب رقمياً (بدون ملفات صوت)
   ========================================================================== */
SC.audio = (function () {
  const U = SC.util;
  let ctx = null, master = null, ready = false, enabled = true;
  let eng = null, squeal = null, wind = null;

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

    /* --- المحرّك: موجتان + ضجيج عبر مرشّح --- */
    const g = ctx.createGain(); g.gain.value = 0;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 1500; filt.Q.value = 3;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 60;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 30; o2.detune.value = 8;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    const nz = ctx.createBufferSource(); nz.buffer = noiseBuffer(2); nz.loop = true;
    const nzg = ctx.createGain(); nzg.gain.value = 0.05;
    const nzf = ctx.createBiquadFilter(); nzf.type = 'bandpass'; nzf.frequency.value = 420; nzf.Q.value = 0.7;
    o1.connect(filt); o2.connect(g2); g2.connect(filt);
    nz.connect(nzf); nzf.connect(nzg); nzg.connect(filt);
    filt.connect(g); g.connect(master);
    o1.start(); o2.start(); nz.start();
    eng = { g, filt, o1, o2, nzg };

    /* --- صرير الإطارات --- */
    const sq = ctx.createBufferSource(); sq.buffer = noiseBuffer(2); sq.loop = true;
    const sqf = ctx.createBiquadFilter(); sqf.type = 'bandpass'; sqf.frequency.value = 1750; sqf.Q.value = 7;
    const sqg = ctx.createGain(); sqg.gain.value = 0;
    sq.connect(sqf); sqf.connect(sqg); sqg.connect(master); sq.start();
    squeal = { g: sqg, f: sqf };

    /* --- صوت الهواء مع السرعة --- */
    const w = ctx.createBufferSource(); w.buffer = noiseBuffer(2); w.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'highpass'; wf.frequency.value = 900;
    const wg = ctx.createGain(); wg.gain.value = 0;
    w.connect(wf); wf.connect(wg); wg.connect(master); w.start();
    wind = { g: wg, f: wf };
    ready = true;
  }

  function resume() {
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
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
    eng.o1.frequency.setTargetAtTime(f, ctx.currentTime, 0.045);
    eng.o2.frequency.setTargetAtTime(f * 0.5, ctx.currentTime, 0.045);
    eng.filt.frequency.setTargetAtTime(500 + rpm * 2600, ctx.currentTime, 0.06);
    eng.g.gain.setTargetAtTime(paused ? 0.0 : 0.055 + load * 0.075 + (car.nitroActive ? 0.05 : 0), ctx.currentTime, 0.07);

    const slip = paused ? 0 : U.clamp(car.slip * (car.kmh > 12 ? 1 : 0), 0, 1);
    squeal.g.gain.setTargetAtTime(slip * 0.11, ctx.currentTime, 0.05);
    squeal.f.frequency.setTargetAtTime(1500 + slip * 900, ctx.currentTime, 0.08);

    const spd = paused ? 0 : U.clamp(car.kmh / 210, 0, 1);
    wind.g.gain.setTargetAtTime(spd * spd * 0.07, ctx.currentTime, 0.12);
    wind.f.frequency.setTargetAtTime(700 + spd * 1500, ctx.currentTime, 0.15);
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
    o.connect(g); g.connect(master);
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
    src.connect(f); f.connect(g); g.connect(master);
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
      a.connect(g); b.connect(g); g.connect(master);
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

  return { init, resume, update, setEnabled, setVolume, blip, crash, horn, hornBeep,
           ui, good, bad, cash, check, count, get ctx() { return ctx; } };
})();
