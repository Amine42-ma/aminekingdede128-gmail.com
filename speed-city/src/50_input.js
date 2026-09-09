/* ============================================================================
   SPEED CITY — التحكّم: لمس الهاتف + لوحة المفاتيح + ذراع التحكّم + الميلان
   ========================================================================== */
SC.input = (function () {
  const U = SC.util;

  const state = {
    throttle: 0, brake: 0, steer: 0, handbrake: 0, boost: 0,
    steerRaw: 0, source: 'touch'
  };
  const keys = {};
  const held = { left: false, right: false, gas: false, brake: false, hand: false, boost: false };
  let wheelValue = 0, wheelActive = false, tilt = 0, tiltZero = null;
  const actions = {};       // اسم الحدث -> دالة

  const SETTINGS_DEFAULT = { steerMode: 'buttons', steerSense: 1.0, invertTilt: false };

  function on(name, fn) { (actions[name] = actions[name] || []).push(fn); }
  function fire(name, arg) { (actions[name] || []).forEach((f) => f(arg)); }

  /* زر يعمل باللمس والفأرة مع دعم تعدّد اللمس */
  function bindHold(el, onDown, onUp) {
    if (!el) return;
    const down = (e) => {
      e.preventDefault();
      el.classList.add('pressed');
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      onDown && onDown(e);
    };
    const up = (e) => {
      el.classList.remove('pressed');
      try { el.releasePointerCapture(e.pointerId); } catch (err) {}
      onUp && onUp(e);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', (e) => { if (e.buttons) up(e); });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  function bindTap(el, fn) {
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.classList.add('pressed');
      U.vibrate(12);
      fn(e);
      setTimeout(() => el.classList.remove('pressed'), 120);
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /* عجلة قيادة تُسحب يميناً ويساراً */
  function bindWheel(el) {
    if (!el) return;
    let id = null, startX = 0, startVal = 0;
    const R = () => el.getBoundingClientRect().width * 0.55;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); id = e.pointerId; startX = e.clientX; startVal = wheelValue;
      wheelActive = true;
      try { el.setPointerCapture(id); } catch (err) {}
      el.classList.add('pressed');
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      wheelValue = U.clamp(startVal + (e.clientX - startX) / R(), -1, 1);
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null; wheelActive = false; el.classList.remove('pressed');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  function initTilt() {
    window.addEventListener('deviceorientation', (e) => {
      if (e.gamma == null) return;
      const raw = (window.orientation === 90 || screen.orientation && screen.orientation.angle === 90) ? e.beta : -e.beta;
      let val = (screen.orientation && Math.abs(screen.orientation.angle) === 90) ? e.beta : e.gamma;
      if (screen.orientation && screen.orientation.angle === -90) val = -val;
      if (tiltZero == null) tiltZero = val;
      tilt = U.clamp((val - tiltZero) / 26, -1, 1);
    }, true);
  }
  function requestTilt() {
    tiltZero = null;
    if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
      DeviceOrientationEvent.requestPermission().catch(() => {});
    }
  }

  function init(dom) {
    /* --- أزرار اللمس --- */
    bindHold(dom.left, () => { held.left = true; }, () => { held.left = false; });
    bindHold(dom.right, () => { held.right = true; }, () => { held.right = false; });
    bindHold(dom.gas, () => { held.gas = true; U.vibrate(8); }, () => { held.gas = false; });
    bindHold(dom.brake, () => { held.brake = true; }, () => { held.brake = false; });
    bindHold(dom.hand, () => { held.hand = true; U.vibrate(16); }, () => { held.hand = false; });
    bindHold(dom.boost, () => { held.boost = true; }, () => { held.boost = false; });
    bindWheel(dom.wheel);
    ['cam', 'horn', 'flip', 'light'].forEach((k) => bindTap(dom[k], () => fire(k)));

    /* --- لوحة المفاتيح --- */
    window.addEventListener('keydown', (e) => {
      if (e.repeat) { keys[e.code] = true; return; }
      keys[e.code] = true;
      const map = { KeyC: 'cam', KeyH: 'horn', KeyR: 'flip', KeyL: 'light', KeyM: 'map', Escape: 'pause', KeyP: 'pause', Enter: 'action' };
      if (map[e.code]) { fire(map[e.code]); e.preventDefault(); }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    window.addEventListener('blur', () => {
      for (const k in keys) keys[k] = false;
      for (const k in held) held[k] = false;
    });
    initTilt();
  }

  function update(dt, settings) {
    const st = settings || SETTINGS_DEFAULT;
    const kb = keys;
    let steerTarget = 0, gas = 0, brake = 0, hand = 0, boost = 0;

    /* لوحة المفاتيح */
    if (kb.ArrowLeft || kb.KeyA) steerTarget -= 1;
    if (kb.ArrowRight || kb.KeyD) steerTarget += 1;
    if (kb.ArrowUp || kb.KeyW) gas = 1;
    if (kb.ArrowDown || kb.KeyS) brake = 1;
    if (kb.Space) hand = 1;
    if (kb.ShiftLeft || kb.ShiftRight) boost = 1;

    /* أزرار اللمس */
    if (held.left) steerTarget -= 1;
    if (held.right) steerTarget += 1;
    if (held.gas) gas = 1;
    if (held.brake) brake = 1;
    if (held.hand) hand = 1;
    if (held.boost) boost = 1;

    /* ذراع التحكّم */
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      if (Math.abs(p.axes[0]) > 0.12) steerTarget += p.axes[0];
      if (p.buttons[7]) gas = Math.max(gas, p.buttons[7].value);
      if (p.buttons[6]) brake = Math.max(brake, p.buttons[6].value);
      if (p.buttons[0] && p.buttons[0].pressed) hand = 1;
      if (p.buttons[1] && p.buttons[1].pressed) boost = 1;
      state.source = 'pad';
      break;
    }

    /* أنماط التوجيه البديلة */
    let analog = null;
    if (st.steerMode === 'wheel' && (wheelActive || Math.abs(wheelValue) > 0.01)) {
      if (!wheelActive) wheelValue = U.damp(wheelValue, 0, 7, dt);
      analog = wheelValue;
    } else if (st.steerMode === 'tilt') {
      analog = tilt * (st.invertTilt ? -1 : 1);
    }
    if (analog != null && Math.abs(steerTarget) < 0.05) steerTarget = analog;

    steerTarget = U.clamp(steerTarget, -1, 1) * (st.steerSense || 1);

    /* تنعيم المقود: سريع للداخل وأسرع للعودة إلى المنتصف */
    const toCenter = Math.abs(steerTarget) < 0.02;
    const rate = toCenter ? 6.5 : 4.2;
    state.steer = U.damp(state.steer, U.clamp(steerTarget, -1, 1), rate, dt);
    if (Math.abs(state.steer) < 0.004) state.steer = 0;

    state.throttle = U.damp(state.throttle, gas, 12, dt);
    state.brake = U.damp(state.brake, brake, 14, dt);
    state.handbrake = hand;
    state.boost = boost;
    state.steerRaw = steerTarget;
    return state;
  }

  const reset = () => {
    state.throttle = state.brake = state.steer = 0;
    state.handbrake = state.boost = 0;
    for (const k in held) held[k] = false;
    wheelValue = 0;
  };

  return { state, init, update, on, fire, reset, bindTap, bindHold, requestTilt,
           get tilt() { return tilt; }, keys };
})();
