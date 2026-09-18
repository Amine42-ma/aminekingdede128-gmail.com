/* ============================================================================
   SPEED CITY — اللعب الجماعي عبر الإنترنت
   يتّصل بخادم WebSocket (المرفق في مجلّد server/) لمزامنة اللاعبين،
   ويستخدم WebRTC للتحدّث بالميكروفون بين اللاعبين.
   بلا خادم تعمل اللعبة كاملةً في وضع «أوف لاين».
   ========================================================================== */
SC.net = (function () {
  const U = SC.util;

  const KEY_STORE = 'speedcity-player-key';

  /* مفتاح ثابت لهذا الجهاز: به يعرف الخادم أنّ هذه غرفي أنا حتى بعد
     إعادة الاتّصال أو إغلاق اللعبة، فيُطبَّق حدّ الغرف على الشخص لا الجلسة. */
  function myKey() {
    let k = null;
    try { k = localStorage.getItem(KEY_STORE); } catch (e) {}
    if (!k) {
      k = (crypto.randomUUID ? crypto.randomUUID()
                             : String(Date.now()) + Math.random().toString(36).slice(2));
      try { localStorage.setItem(KEY_STORE, k); } catch (e) {}
    }
    return k;
  }

  const state = {
    ws: null, id: 0, name: '', url: '', connected: false, connecting: false,
    players: new Map(),          // id -> { id, name, car, x, z, y, yaw, v, veh, tx, tz, tyaw, last }
    mic: false, micWanted: false, voices: new Map(), stream: null,
    rooms: [], room: null, roomLimit: 3, roomsOwned: 0, serverTotal: 0, pendingRoom: null,
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
        send({ t: 'hello', name: state.name, car: SC.game.save.current, key: myKey() });
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
    state.micWanted = false;
    state.rooms = []; state.room = null;
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

      /* ------------------------------ الغرف ------------------------------ */
      case 'rooms':
        state.rooms = m.list || [];
        state.roomLimit = m.limit == null ? state.roomLimit : m.limit;
        state.roomsOwned = m.mine || 0;
        state.serverTotal = m.total || 0;
        /* قدِمنا من رابط فيه رمز غرفة: ادخلها بمجرّد معرفة القائمة */
        if (state.pendingRoom) {
          const code = state.pendingRoom; state.pendingRoom = null;
          joinRoom(code);
        }
        emit('rooms', m);
        break;
      case 'room.joined':
        state.room = m.room;
        if (SC.mylib) SC.mylib.clearHeard();  // ما يسمعه أهل الغرفة السابقة
        clearPlayers();                       // لاعبو الغرفة السابقة ليسوا هنا
        (m.players || []).forEach(addPlayer);
        emit('players');
        emit('room', m.room);
        emit('toast', { text: 'دخلت «' + m.room.name + '»', kind: 'ok' });
        /* الصوت مع أهل الغرفة الجديدة */
        if (state.mic) state.players.forEach((p) => callPeer(p.id));
        else if (state.micWanted) startMic();
        break;
      case 'room.left':
        state.room = null;
        clearPlayers();
        emit('room', null);
        break;
      case 'room.closed':
        emit('toast', { text: 'أُغلقت الغرفة «' + (m.name || m.code) + '»', kind: 'bad' });
        break;
      case 'room.deleted':
        emit('toast', { text: 'حُذفت الغرفة ' + m.code, kind: 'ok' });
        emit('rooms', null);
        break;
      case 'room.error':
        emit('roomError', m);
        break;

      /* ------------------- الموسيقى الشخصية (أسماء فقط) ------------------ */
      case 'music.policy': case 'music.now': case 'music.blocked': case 'music.reported':
        if (SC.mylib) SC.mylib.onNet(m);
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
          p.veh = new SC.Vehicle(SC.cars.defs[p.car] ? p.car : 'cortina', { simpleDriver: true, variant: (Math.random() * 6) | 0 });
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

  /* --------------------------- الميكروفون (صوت) ------------------------
     المتصفّح لا يعطي الميكروفون إلا بعد لمسة من اللاعب وإذن صريح، ولا
     يمكن لأي صفحة أن تمنح نفسها الإذن. لذلك نطلبه بوضوح ونشرح سبب الرفض. */
  const MIC_HELP = 'افتح إعدادات الموقع في المتصفّح ← الأذونات ← الميكروفون ← اسمح، ثم أعد المحاولة.';

  /* حالة الإذن إن كان المتصفّح يكشفها: granted / denied / prompt / unknown */
  async function micReady() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return 'unsupported';
    if (!window.isSecureContext) return 'insecure';     // يحتاج https أو localhost
    try {
      const st = await navigator.permissions.query({ name: 'microphone' });
      return st.state;
    } catch (e) { return 'unknown'; }
  }

  async function startMic() {
    state.micWanted = true;
    if (state.mic) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      emit('mic-error', { code: 'unsupported', text: 'هذا المتصفّح لا يدعم الميكروفون' });
      return false;
    }
    if (!window.isSecureContext) {
      emit('mic-error', { code: 'insecure',
        text: 'الميكروفون يحتاج اتّصالاً آمناً — افتح اللعبة عبر https أو من localhost' });
      return false;
    }
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      });
      state.mic = true;
      /* شغّل الصوت الخارج من بقيّة اللاعبين — يحتاج لمسة، وهذه هي اللمسة */
      SC.audio && SC.audio.resume && SC.audio.resume();
      state.players.forEach((p) => callPeer(p.id));
      emit('mic', true);
      emit('toast', { text: '🎙 الميكروفون مفتوح — يسمعك من في الغرفة', kind: 'ok' });
      return true;
    } catch (e) {
      const n = e && e.name;
      let info = { code: 'denied', text: 'رُفض إذن الميكروفون. ' + MIC_HELP };
      if (n === 'NotFoundError' || n === 'DevicesNotFoundError') {
        info = { code: 'nodevice', text: 'لا يوجد ميكروفون في هذا الجهاز' };
      } else if (n === 'NotReadableError' || n === 'TrackStartError') {
        info = { code: 'busy', text: 'الميكروفون مشغول في تطبيق آخر — أغلقه ثم أعد المحاولة' };
      }
      state.micWanted = false;
      emit('mic-error', info);
      return false;
    }
  }
  function stopMic() {
    state.mic = false; state.micWanted = false;
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
  /* ------------------------------ الغرف ------------------------------ *
     الغرفة يُدخل إليها برابط متصفّح عادي: الخادم هو من يخدم اللعبة، فرابط
     الغرفة هو عنوان الصفحة نفسه + رمزها. من يفتحه يتّصل ويدخل مباشرةً. */
  function roomLink(code) {
    try {
      const u = new URL(location.href);
      u.hash = '';
      u.search = '?room=' + encodeURIComponent(code);
      return u.toString();
    } catch (e) { return String(code); }
  }

  /* عنوان الخادم المستنتج من الصفحة نفسها */
  function serverURL() {
    try {
      return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
    } catch (e) { return ''; }
  }

  /* رمز الغرفة إن جاء اللاعب من رابط دعوة */
  function linkRoom() {
    try {
      const q = new URLSearchParams(location.search);
      const c = (q.get('room') || '').trim().toUpperCase();
      return /^[A-Z0-9]{3,8}$/.test(c) ? c : null;
    } catch (e) { return null; }
  }

  /* اتّصل بخادم الصفحة وادخل الغرفة المطلوبة (يُستدعى عند الإقلاع) */
  function joinFromLink(name) {
    const code = linkRoom();
    if (!code) return Promise.resolve(false);
    state.pendingRoom = code;
    return connect(serverURL(), name).then(() => true).catch(() => {
      state.pendingRoom = null;
      return false;
    });
  }

  const refreshRooms = () => send({ t: 'rooms' });
  const createRoom = (name) => send({ t: 'room.create', name: name || '' });
  const deleteRoom = (code) => send({ t: 'room.delete', code });
  const joinRoom = (code) => send({ t: 'room.join', code });
  const leaveRoom = () => send({ t: 'room.leave' });

  const invite = (to) => send({ t: 'invite', to });
  const acceptInvite = (to, race) => send({ t: 'accept', to, race });
  const decline = (to) => send({ t: 'decline', to });
  const chat = (msg) => send({ t: 'chat', msg });
  const playerList = () => Array.from(state.players.values());

  return { state, connect, disconnect, update, send, invite, acceptInvite, decline, chat,
           startMic, stopMic, micReady, playerList, myKey,
           refreshRooms, createRoom, deleteRoom, joinRoom, leaveRoom,
           roomLink, serverURL, linkRoom, joinFromLink,
           get connected() { return state.connected; }, get room() { return state.room; },
           get id() { return state.id; }, set onEvent(f) { state.onEvent = f; } };
})();
