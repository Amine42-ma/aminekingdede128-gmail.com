/* ============================================================================
   SPEED CITY — اللعب الجماعي عبر الإنترنت
   يتّصل بخادم WebSocket (المرفق في مجلّد server/) لمزامنة اللاعبين،
   ويستخدم WebRTC للتحدّث بالميكروفون بين اللاعبين.
   بلا خادم تعمل اللعبة كاملةً في وضع «أوف لاين».
   ========================================================================== */
SC.net = (function () {
  const U = SC.util;

  const state = {
    ws: null, id: 0, name: '', url: '', connected: false, connecting: false,
    players: new Map(),          // id -> { id, name, car, x, z, y, yaw, v, veh, tx, tz, tyaw, last }
    mic: false, voices: new Map(), stream: null,
    lastSend: 0, ping: 0, onEvent: null, race: null
  };

  const RTC_CFG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  function emit(type, data) { if (state.onEvent) state.onEvent(type, data); }

  /* ------------------------------ الاتّصال ------------------------------ */
  function connect(url, name) {
    return new Promise((resolve, reject) => {
      if (state.ws) disconnect();
      state.url = url; state.name = name || 'لاعب';
      state.connecting = true;
      let ws;
      try { ws = new WebSocket(url); } catch (e) { state.connecting = false; reject(e); return; }
      state.ws = ws;
      const timeout = setTimeout(() => {
        if (!state.connected) { try { ws.close(); } catch (e) {} reject(new Error('انتهت مهلة الاتّصال')); }
      }, 8000);

      ws.onopen = () => {
        clearTimeout(timeout);
        state.connected = true; state.connecting = false;
        send({ t: 'hello', name: state.name, car: SC.game.save.current });
        emit('open');
        resolve(true);
      };
      ws.onclose = () => {
        const was = state.connected;
        state.connected = false; state.connecting = false;
        clearPlayers();
        if (was) emit('close');
      };
      ws.onerror = () => {
        clearTimeout(timeout);
        state.connecting = false;
        if (!state.connected) reject(new Error('تعذّر الاتّصال بالخادم'));
      };
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        onMessage(m);
      };
    });
  }

  function disconnect() {
    stopMic();
    if (state.ws) { try { state.ws.close(); } catch (e) {} }
    state.ws = null; state.connected = false;
    clearPlayers();
  }

  function send(obj) {
    if (state.ws && state.ws.readyState === 1) {
      try { state.ws.send(JSON.stringify(obj)); } catch (e) {}
    }
  }

  /* ------------------------- اللاعبون الآخرون -------------------------- */
  function addPlayer(p) {
    if (state.players.has(p.id)) return state.players.get(p.id);
    const rec = { id: p.id, name: p.name, car: p.car || 'cortina',
                  x: 0, y: 0, z: 0, yaw: 0, v: 0, tx: 0, tz: 0, ty: 0, tyaw: 0, veh: null, last: 0 };
    state.players.set(p.id, rec);
    emit('players');
    return rec;
  }
  function removePlayer(id) {
    const p = state.players.get(id);
    if (p && p.veh) SC.game.G.scene.remove(p.veh.root);
    state.players.delete(id);
    closeVoice(id);
    emit('players');
  }
  function clearPlayers() {
    state.players.forEach((p) => { if (p.veh) SC.game.G.scene.remove(p.veh.root); });
    state.players.clear();
    state.voices.forEach((v, id) => closeVoice(id));
    emit('players');
  }

  function onMessage(m) {
    switch (m.t) {
      case 'welcome':
        state.id = m.id;
        (m.players || []).forEach(addPlayer);
        emit('players');
        break;
      case 'join':
        addPlayer(m);
        emit('toast', { text: m.name + ' انضمّ إلى المدينة', kind: 'ok' });
        break;
      case 'leave': {
        const p = state.players.get(m.id);
        if (p) emit('toast', { text: p.name + ' غادر', kind: '' });
        removePlayer(m.id);
        break;
      }
      case 'name': {
        const p = state.players.get(m.id) || addPlayer(m);
        p.name = m.name; p.car = m.car || p.car;
        emit('players');
        break;
      }
      case 'pos': {
        const p = state.players.get(m.id) || addPlayer({ id: m.id, name: 'لاعب', car: m.car });
        p.tx = m.x; p.tz = m.z; p.ty = m.y || 0; p.tyaw = m.yaw; p.v = m.v || 0;
        p.last = performance.now();
        if (m.car && m.car !== p.car) { p.car = m.car; if (p.veh) { SC.game.G.scene.remove(p.veh.root); p.veh = null; } }
        break;
      }
      case 'chat':
        emit('chat', m);
        break;
      case 'invite':
        emit('invite', m);
        break;
      case 'accept':
        emit('accept', m);
        break;
      case 'decline':
        emit('toast', { text: (m.name || 'اللاعب') + ' رفض التحدّي', kind: 'bad' });
        break;
      case 'race':
        emit('race', m);
        break;
      case 'rtc':
        handleRtc(m);
        break;
      case 'pong':
        state.ping = Math.round(performance.now() - m.ts);
        break;
    }
  }

  /* ------------------------ التحديث في حلقة اللعبة --------------------- */
  function update(dt, car) {
    if (!state.connected) return;
    const now = performance.now();
    if (now - state.lastSend > 90) {                 // ~11 مرّة في الثانية
      state.lastSend = now;
      send({ t: 'pos', x: +car.pos.x.toFixed(2), z: +car.pos.z.toFixed(2), y: +car.pos.y.toFixed(2),
             yaw: +car.yaw.toFixed(3), v: Math.round(car.kmh), car: car.id });
      if (now - (state.lastPing || 0) > 3000) { state.lastPing = now; send({ t: 'ping', ts: now }); }
    }

    /* تنعيم حركة اللاعبين الآخرين */
    state.players.forEach((p) => {
      if (!p.veh) {
        try {
          p.veh = new SC.Vehicle(SC.cars.defs[p.car] ? p.car : 'cortina', { simpleDriver: true });
          p.veh.setColor(0x3a6ea5);
          p.veh.place(p.tx, p.tz, p.tyaw);
          p.veh.lightsOn = SC.world.state.isNight;
          SC.game.G.scene.add(p.veh.root);
        } catch (e) { return; }
      }
      p.x = U.damp(p.x, p.tx, 12, dt);
      p.z = U.damp(p.z, p.tz, 12, dt);
      p.yaw += U.angleDelta(p.yaw, p.tyaw) * Math.min(1, dt * 12);
      const gy = SC.world.groundHeight(p.x, p.z);
      p.veh.root.position.set(p.x, gy, p.z);
      p.veh.root.rotation.y = p.yaw;
      if (p.veh.wheels) {
        const spin = (p.v / 3.6) / 0.32 * dt;
        p.veh.wheels.forEach((w) => { w.spin -= spin; w.pivot.rotation.x = w.spin; });
      }
    });
  }

  /* --------------------------- الميكروفون (صوت) ------------------------ */
  async function startMic() {
    if (state.mic) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      emit('toast', { text: 'المتصفّح لا يدعم الميكروفون', kind: 'bad' });
      return false;
    }
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }, video: false
      });
      state.mic = true;
      state.players.forEach((p) => callPeer(p.id));
      emit('mic', true);
      return true;
    } catch (e) {
      emit('toast', { text: 'رُفض إذن الميكروفون', kind: 'bad' });
      return false;
    }
  }
  function stopMic() {
    state.mic = false;
    if (state.stream) { state.stream.getTracks().forEach((t) => t.stop()); state.stream = null; }
    state.voices.forEach((v, id) => closeVoice(id));
    emit('mic', false);
  }
  function closeVoice(id) {
    const v = state.voices.get(id);
    if (!v) return;
    try { v.pc.close(); } catch (e) {}
    if (v.audio) { v.audio.pause(); v.audio.srcObject = null; v.audio.remove(); }
    state.voices.delete(id);
  }
  function peer(id) {
    let v = state.voices.get(id);
    if (v) return v;
    const pc = new RTCPeerConnection(RTC_CFG);
    const audio = document.createElement('audio');
    audio.autoplay = true;
    document.body.appendChild(audio);
    v = { pc, audio };
    state.voices.set(id, v);
    if (state.stream) state.stream.getTracks().forEach((t) => pc.addTrack(t, state.stream));
    pc.onicecandidate = (e) => { if (e.candidate) send({ t: 'rtc', to: id, kind: 'ice', data: e.candidate }); };
    pc.ontrack = (e) => { audio.srcObject = e.streams[0]; };
    return v;
  }
  async function callPeer(id) {
    if (!state.mic || id === state.id) return;
    const v = peer(id);
    const offer = await v.pc.createOffer();
    await v.pc.setLocalDescription(offer);
    send({ t: 'rtc', to: id, kind: 'offer', data: offer });
  }
  async function handleRtc(m) {
    const id = m.from;
    const v = peer(id);
    try {
      if (m.kind === 'offer') {
        await v.pc.setRemoteDescription(m.data);
        const ans = await v.pc.createAnswer();
        await v.pc.setLocalDescription(ans);
        send({ t: 'rtc', to: id, kind: 'answer', data: ans });
      } else if (m.kind === 'answer') {
        await v.pc.setRemoteDescription(m.data);
      } else if (m.kind === 'ice') {
        await v.pc.addIceCandidate(m.data);
      }
    } catch (e) { /* تجاهل أخطاء التفاوض العابرة */ }
  }

  /* ------------------------------ الدعوات ------------------------------ */
  const invite = (to) => send({ t: 'invite', to });
  const acceptInvite = (to, race) => send({ t: 'accept', to, race });
  const decline = (to) => send({ t: 'decline', to });
  const chat = (msg) => send({ t: 'chat', msg });
  const playerList = () => Array.from(state.players.values());

  return { state, connect, disconnect, update, send, invite, acceptInvite, decline, chat,
           startMic, stopMic, playerList, get connected() { return state.connected; },
           get id() { return state.id; }, set onEvent(f) { state.onEvent = f; } };
})();
