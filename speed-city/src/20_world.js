/* ============================================================================
   SPEED CITY — بناء المدينة: الشوارع، الأرصفة، الإنارة، والمباني
   المباني كلها من النماذج المرفقة فقط (لا مبانٍ مولّدة برمجياً)
   ========================================================================== */
SC.world = (function () {
  const U = SC.util;

  /* ------------------------- إعدادات المدينة ---------------------------- */
  const CFG = {
    blocks: 16,       // مربّعات الجزيرة الأولى (للتوافق)
    pitch: 176,       // المسافة بين محاور الشوارع (م)
    road: 22,         // عرض الشارع (م)
    walk: 6,          // عرض الرصيف (م)
    curb: 0.16,       // ارتفاع الرصيف (م)
    beach: 150,       // عرض الشاطئ الرملي حول كل جزيرة (م)
    seaY: -1.0,       // مستوى سطح البحر
    bedY: -32,        // قاع البحر
    seed: 20250909,
    /* ستّ جزر متفاوتة الحجم تربطها شبكة جسور بحريّة طويلة */
    islands: [
      { id: 0, name: 'المدينة الأم',   cx: 0,     cz: 0,     blocks: 16 },
      { id: 1, name: 'جزيرة الميناء',  cx: 6600,  cz: 0,     blocks: 20 },
      { id: 2, name: 'العاصمة الكبرى', cx: 0,     cz: 7800,  blocks: 24 },
      { id: 3, name: 'جزيرة الشمال',   cx: 0,     cz: -5400, blocks: 12 },
      { id: 4, name: 'واحة الغرب',     cx: -6400, cz: 0,     blocks: 14 },
      { id: 5, name: 'مدينة الخليج',   cx: 6600,  cz: 7800,  blocks: 16 }
    ]
  };
  CFG.islands.forEach((i) => {
    i.span = i.blocks * CFG.pitch;
    i.half = i.span / 2;
    i.shore = i.half + CFG.road / 2 + CFG.beach;
  });
  CFG.span = CFG.islands[0].span;
  CFG.half = CFG.islands[0].half;
  CFG.shore = CFG.islands[0].shore;

  /* الجسور: مستطيلات تصل بين شواطئ الجزر */
  const BRIDGES = [
    { a: 0, b: 1, axis: 'x', deckY: 12, width: 26, ramp: 210 },
    { a: 0, b: 2, axis: 'z', deckY: 12, width: 26, ramp: 210 },
    { a: 0, b: 3, axis: 'z', deckY: 10, width: 22, ramp: 190 },
    { a: 0, b: 4, axis: 'x', deckY: 10, width: 22, ramp: 190 },
    { a: 1, b: 5, axis: 'z', deckY: 13, width: 24, ramp: 210 },
    { a: 2, b: 5, axis: 'x', deckY: 11, width: 24, ramp: 190 }
  ];

  const state = {
    group: null, colliders: [], grid: null, cellSize: 60, chunks: [],
    blockRects: [], roadNodes: [], lamps: [], sky: null, sun: null, hemi: null,
    spawns: [], parkings: [], props: null, envRT: null
  };

  /* -------------------------- نسج مرسومة برمجياً ------------------------- */
  function canvasTex(w, h, draw, rx, ry, srgb) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx || 1, ry || 1);
    t.anisotropy = 8;
    if (srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function noise(ctx, w, h, amount, base) {
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = base + (Math.random() - 0.5) * amount;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  const TEX = {};
  function buildTextures() {
    TEX.asphalt = canvasTex(256, 256, (c, w, h) => {
      noise(c, w, h, 9, 62);                       // حبيبات ناعمة منخفضة التباين
      c.globalAlpha = 0.06;
      for (let i = 0; i < 26; i++) {               // تفاوت خفيف في اللون
        const x = Math.random() * w, y = Math.random() * h, r = 18 + Math.random() * 60;
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, Math.random() < 0.5 ? '#000' : '#fff');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
      }
      c.globalAlpha = 0.10;                        // شقوق رفيعة
      c.strokeStyle = '#20232a'; c.lineWidth = 1;
      for (let i = 0; i < 10; i++) {
        c.beginPath();
        let x = Math.random() * w, y = Math.random() * h;
        c.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 46; y += (Math.random() - 0.5) * 46; c.lineTo(x, y); }
        c.stroke();
      }
      c.globalAlpha = 1;
    }, 300, 300);



    TEX.walk = canvasTex(256, 256, (c, w, h) => {
      noise(c, w, h, 10, 146);
      c.strokeStyle = 'rgba(112,112,112,0.42)'; c.lineWidth = 2;
      for (let i = 0; i <= 4; i++) {               // فواصل بلاط الرصيف
        c.beginPath(); c.moveTo(i * w / 4, 0); c.lineTo(i * w / 4, h); c.stroke();
        c.beginPath(); c.moveTo(0, i * h / 4); c.lineTo(w, i * h / 4); c.stroke();
      }
    }, 1, 1);

    TEX.grass = canvasTex(256, 256, (c, w, h) => {
      const img = c.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = Math.random();
        img.data[i] = 58 + n * 34; img.data[i + 1] = 92 + n * 46; img.data[i + 2] = 44 + n * 24;
        img.data[i + 3] = 255;
      }
      c.putImageData(img, 0, 0);
    }, 12, 12);

    TEX.lot = canvasTex(256, 256, (c, w, h) => {
      noise(c, w, h, 18, 72);
      c.strokeStyle = 'rgba(235,235,225,0.55)'; c.lineWidth = 3;
      for (let i = 0; i < 4; i++) {                 // خطوط مواقف السيارات
        c.beginPath(); c.moveTo(i * w / 4 + 8, 12); c.lineTo(i * w / 4 + 8, h * 0.42); c.stroke();
        c.beginPath(); c.moveTo(i * w / 4 + 8, h * 0.58); c.lineTo(i * w / 4 + 8, h - 12); c.stroke();
      }
    }, 6, 6);

    TEX.dash = canvasTex(64, 256, (c, w, h) => {     // خط منقّط في منتصف الشارع
      c.clearRect(0, 0, w, h);
      c.fillStyle = '#f2ecd8';
      c.fillRect(w * 0.36, h * 0.12, w * 0.28, h * 0.46);
    }, 1, 1);

    TEX.solid = canvasTex(32, 32, (c, w, h) => { c.fillStyle = '#efe9d6'; c.fillRect(0, 0, w, h); }, 1, 1);

    TEX.zebra = canvasTex(256, 128, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.fillStyle = 'rgba(238,236,226,0.9)';
      for (let i = 0; i < 14; i++) c.fillRect(i * w / 14 + w / 56, 0, w / 28, h);
    }, 1, 1);

    TEX.sand = canvasTex(256, 256, (c, w, h) => {
      const img = c.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = Math.random();
        img.data[i] = 196 + n * 34; img.data[i + 1] = 178 + n * 30; img.data[i + 2] = 140 + n * 26;
        img.data[i + 3] = 255;
      }
      c.putImageData(img, 0, 0);
    }, 260, 260);

    TEX.waterN = canvasTex(256, 256, (c, w, h) => {     // خريطة نتوءات الأمواج
      const img = c.createImageData(w, h);
      const wave = (x, y) => Math.sin(x * 0.09 + Math.sin(y * 0.05) * 2.2) * 0.5 +
                             Math.sin(y * 0.07 + Math.cos(x * 0.045) * 1.8) * 0.5;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const dx = wave(x + 1, y) - wave(x - 1, y);
        const dy = wave(x, y + 1) - wave(x, y - 1);
        img.data[i] = 128 + dx * 90; img.data[i + 1] = 128 + dy * 90;
        img.data[i + 2] = 235; img.data[i + 3] = 255;
      }
      c.putImageData(img, 0, 0);
    }, 90, 90, false);

    TEX.smoke = canvasTex(128, 128, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.85)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.28)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }, 1, 1);

    TEX.glow = canvasTex(128, 128, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,220,140,0.55)');
      g.addColorStop(1, 'rgba(255,180,60,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }, 1, 1);
    return TEX;
  }

  /* ------------------------------ السماء -------------------------------- */
  const SKY_VS = `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
  const SKY_FS = `
    varying vec3 vDir;
    uniform vec3 top, mid, bottom, sunDir, sunCol, cloudCol;
    uniform float cloudAmt, uTime;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float vnoise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p){
      float v = 0.0, a = 0.55;
      for (int i = 0; i < 4; i++){ v += a * vnoise(p); p = p * 2.07 + 3.1; a *= 0.5; }
      return v;
    }
    void main(){
      vec3 d = normalize(vDir);
      float h = clamp(d.y*0.5+0.5, 0.0, 1.0);
      vec3 col = mix(bottom, mid, smoothstep(0.42, 0.52, h));
      col = mix(col, top, smoothstep(0.5, 0.98, h));
      if (cloudAmt > 0.001 && d.y > 0.005) {
        vec2 uv = d.xz / (d.y + 0.18) * 0.55 + vec2(uTime * 0.0035, uTime * 0.0016);
        float c = fbm(uv);
        c = smoothstep(0.46, 0.86, c) * smoothstep(0.0, 0.22, d.y);
        col = mix(col, cloudCol, clamp(c * cloudAmt, 0.0, 1.0));
      }
      float s = max(dot(d, normalize(sunDir)), 0.0);
      col += sunCol * (pow(s, 220.0)*1.6 + pow(s, 8.0)*0.28);
      gl_FragColor = vec4(col, 1.0);
    }`;

  const PRESETS = {
    day:    { cloud: 0xffffff, cloudAmt: 0.9, top: 0x2f6fd0, mid: 0x7fb6ef, bottom: 0xd8e6f2, sun: 0xfff3d6, sunI: 2.9, hemi: 1.35, fog: 0xbdd3e8, fogFar: 900, amb: 0xbcd0e8, sunPos: [0.45, 0.72, 0.28], exposure: 1.05 },
    sunset: { cloud: 0xffc9a0, cloudAmt: 1.0, top: 0x21386e, mid: 0xe0774a, bottom: 0xf6c58a, sun: 0xffb066, sunI: 2.4, hemi: 0.95, fog: 0xe0a077, fogFar: 780, amb: 0xd08a6a, sunPos: [-0.85, 0.20, -0.35], exposure: 1.0 },
    night:  { cloud: 0x2a3855, cloudAmt: 0.55, top: 0x050c1c, mid: 0x0d1e3a, bottom: 0x1b2c4a, sun: 0xa8c0ee, sunI: 0.5, hemi: 0.42, fog: 0x0c1628, fogFar: 560, amb: 0x35486e, sunPos: [0.3, 0.62, -0.5], exposure: 1.2 }
  };

  /* ألوان السماء في الشتاء: شاحبة وباردة والضباب أقرب */
  const WINTER_SKY = {
    day:    { cloud: 0xf2f7fb, cloudAmt: 1.0, top: 0x5b7fa8, mid: 0xa8c4dc, bottom: 0xe8f0f6, sun: 0xf2f6ff, sunI: 1.85, hemi: 1.5, fog: 0xdae6ef, fogFar: 620, amb: 0xd4e2ee, exposure: 1.02 },
    sunset: { cloud: 0xe9cdbd, cloudAmt: 1.0, top: 0x2d3f60, mid: 0xc08f78, bottom: 0xe6c8ba, sun: 0xffd0a8, sunI: 1.6, hemi: 1.05, fog: 0xd2b6a8, fogFar: 560, amb: 0xc2a394, exposure: 1.0 },
    night:  { cloud: 0x3a4a66, cloudAmt: 0.7, top: 0x0a1428, mid: 0x18304f, bottom: 0x2c4364, sun: 0xc4d6f4, sunI: 0.45, hemi: 0.55, fog: 0x162740, fogFar: 430, amb: 0x4a6086, exposure: 1.18 }
  };

  /* ألوان الأرض في الفصلين */
  const SEASON_TINT = {
    summer: { ground: 0xffffff, sand: 0xffffff, slab: 0xffffff, grass: 0xffffff, lot: 0xffffff, water: 0x1d6485 },
    winter: { ground: 0xa9b6c0, sand: 0xe6eef5, slab: 0xeef4fa, grass: 0xe4eef6, lot: 0xcdd8e2, water: 0x16506d }
  };

  function buildSky(scene) {
    const geo = new THREE.SphereGeometry(1, 32, 20);
    const mat = new THREE.ShaderMaterial({
      vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color() }, mid: { value: new THREE.Color() },
        bottom: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0.4, 0.7, 0.3) },
        sunCol: { value: new THREE.Color(0xfff0d0) }, cloudCol: { value: new THREE.Color(0xffffff) },
        cloudAmt: { value: 0.85 }, uTime: { value: 0 }
      }
    });
    const sky = new THREE.Mesh(geo, mat);
    // نصف قطر القبّة يتبع مدى الكاميرا، وإلا قُصّت السماء وظهرت سوداء
    sky.scale.setScalar(Math.max(1500, (SC.quality ? SC.quality.far : 1000) * 3.6) * 0.9);
    sky.frustumCulled = false;
    sky.renderOrder = -1000;
    scene.add(sky);
    return sky;
  }

  /* ضبط وقت اليوم: يعيد ضبط السماء، الشمس، الضباب والإضاءة */
  function setTimeOfDay(name) {
    const base = PRESETS[name] || PRESETS.day;
    const w = state.season === 'winter' ? WINTER_SKY[name] : null;
    const p = w ? Object.assign({}, base, w) : base;
    state.timeOfDay = name;
    const u = state.sky.material.uniforms;
    u.top.value.setHex(p.top); u.mid.value.setHex(p.mid); u.bottom.value.setHex(p.bottom);
    u.sunDir.value.set(p.sunPos[0], p.sunPos[1], p.sunPos[2]).normalize();
    u.sunCol.value.setHex(p.sun);
    u.cloudCol.value.setHex(p.cloud);
    u.cloudAmt.value = (state.quality && state.quality.name === 'low') ? p.cloudAmt * 0.75 : p.cloudAmt;

    state.sun.color.setHex(p.sun);
    state.sun.intensity = p.sunI;
    state.sunDir = new THREE.Vector3(p.sunPos[0], p.sunPos[1], p.sunPos[2]).normalize();
    state.hemi.intensity = p.hemi;
    state.hemi.color.setHex(p.amb);
    state.scene.fog.color.setHex(p.fog);
    state.scene.fog.far = p.fogFar;
    state.scene.fog.near = p.fogFar * 0.12;
    state.exposure = p.exposure;
    state.isNight = (name === 'night');

    if (state.lampMat) {
      state.lampMat.emissiveIntensity = state.isNight ? 3.4 : 0.0;
      state.lampMat.color.setHex(state.isNight ? 0xfff0c0 : 0x9aa3ad);
    }
    (state.lampGlows || []).forEach((g) => { g.visible = state.isNight; });
    if (state.onTimeChange) state.onTimeChange(name, p);
    return p;
  }

  /* ------------------------- شبكة التصادم السريعة ------------------------ */
  function buildGrid() {
    const cs = state.cellSize;
    const map = new Map();
    state.colliders.forEach((c, idx) => {
      const i0 = Math.floor(c.minX / cs), i1 = Math.floor(c.maxX / cs);
      const j0 = Math.floor(c.minZ / cs), j1 = Math.floor(c.maxZ / cs);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const k = i + ',' + j;
        let a = map.get(k); if (!a) { a = []; map.set(k, a); }
        a.push(idx);
      }
    });
    state.grid = map;
  }
  function queryColliders(x, z, r) {
    const cs = state.cellSize, out = [];
    const i0 = Math.floor((x - r) / cs), i1 = Math.floor((x + r) / cs);
    const j0 = Math.floor((z - r) / cs), j1 = Math.floor((z + r) / cs);
    const seen = new Set();
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const a = state.grid.get(i + ',' + j); if (!a) continue;
      for (const idx of a) if (!seen.has(idx)) { seen.add(idx); out.push(state.colliders[idx]); }
    }
    return out;
  }

  /* الجزيرة التي تقع فيها النقطة (أو null إن كانت في البحر) */
  function islandAt(x, z) {
    for (const i of CFG.islands) {
      if (Math.abs(x - i.cx) <= i.shore && Math.abs(z - i.cz) <= i.shore) return i;
    }
    return null;
  }
  const islandById = (id) => CFG.islands[id];

  /* معلومات الجسر عند نقطة: {onDeck, y} */
  function bridgeAt(x, z) {
    for (const br of state.bridges) {
      if (br.axis === 'x') {
        if (z < br.z - br.width / 2 || z > br.z + br.width / 2) continue;
        if (x < br.x0 || x > br.x1) continue;
        return { br, y: deckHeight(br, x) };
      } else {
        if (x < br.x - br.width / 2 || x > br.x + br.width / 2) continue;
        if (z < br.z0 || z > br.z1) continue;
        return { br, y: deckHeight(br, z) };
      }
    }
    return null;
  }
  function deckHeight(br, t) {
    const a = br.axis === 'x' ? br.x0 : br.z0;
    const b = br.axis === 'x' ? br.x1 : br.z1;
    const r = br.ramp;
    if (t < a + r) return br.deckY * U.smoothstep(U.clamp((t - a) / r, 0, 1));
    if (t > b - r) return br.deckY * U.smoothstep(U.clamp((b - t) / r, 0, 1));
    return br.deckY;
  }

  /* ارتفاع الأرض عند نقطة (الرصيف أعلى من الشارع، والجسر أعلى من الجميع) */
  function groundHeight(x, z) {
    const br = bridgeAt(x, z);
    if (br) return br.y;
    const isl = islandAt(x, z);
    if (!isl) return CFG.seaY;
    const P = CFG.pitch, R = CFG.road;
    const lx = x - isl.cx + isl.half, lz = z - isl.cz + isl.half;
    if (lx < 0 || lz < 0 || lx > isl.span || lz > isl.span) return 0;
    const ox = lx % P, oz = lz % P;
    const inset = R / 2;
    return (ox > inset && ox < P - inset && oz > inset && oz < P - inset) ? CFG.curb : 0;
  }
  const onRoad = (x, z) => {
    if (bridgeAt(x, z)) return true;
    return groundHeight(x, z) === 0 && !!islandAt(x, z);
  };

  /* هل النقطة داخل شوارع إحدى الجزر (بدون الشاطئ) */
  function inBounds(x, z) {
    for (const i of CFG.islands) {
      const lim = i.half + CFG.road * 0.5 + 8;
      if (Math.abs(x - i.cx) < lim && Math.abs(z - i.cz) < lim) return true;
    }
    return false;
  }
  /* الماء: خارج كل الجزر وخارج الجسور */
  const isWater = (x, z) => !islandAt(x, z) && !bridgeAt(x, z);
  /* المسافة إلى خطّ الماء (سالبة في البحر) */
  function distToWater(x, z) {
    if (bridgeAt(x, z)) return 999;
    let best = -1e9;
    for (const i of CFG.islands) {
      const d = i.shore - Math.max(Math.abs(x - i.cx), Math.abs(z - i.cz));
      if (d > best) best = d;
    }
    return best;
  }
  function onSand(x, z) {
    const i = islandAt(x, z);
    if (!i) return false;
    const d = Math.max(Math.abs(x - i.cx), Math.abs(z - i.cz));
    return d > i.half + CFG.road * 0.5;
  }
  /* أقرب مركز شارع في الجزيرة الحالية */
  function snapToRoad(x, z) {
    const isl = islandAt(x, z) || nearestIsland(x, z);
    const P = CFG.pitch, H = isl.half;
    const gx = Math.round((x - isl.cx + H) / P) * P - H + isl.cx;
    const gz = Math.round((z - isl.cz + H) / P) * P - H + isl.cz;
    return Math.abs(x - gx) < Math.abs(z - gz)
      ? { x: gx, z: U.clamp(z, isl.cz - H, isl.cz + H), axis: 'z', island: isl }
      : { x: U.clamp(x, isl.cx - H, isl.cx + H), z: gz, axis: 'x', island: isl };
  }
  function nearestIsland(x, z) {
    let best = CFG.islands[0], bd = 1e18;
    for (const i of CFG.islands) {
      const d = (i.cx - x) ** 2 + (i.cz - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  /* ================================ البناء ============================== */
  function build(scene, renderer, quality) {
    state.scene = scene;
    state.quality = quality;
    buildTextures();
    const rnd = U.rng(CFG.seed);
    const G = new THREE.Group(); G.name = 'city';
    state.group = G;
    scene.add(G);
    state.colliders.length = 0; state.blockRects.length = 0; state.spawns.length = 0;
    state.chunks.length = 0; state.lamps.length = 0; state.lampBase = 0;
    state.bridges = []; state.lampGlows = [];

    scene.fog = new THREE.Fog(0xbdd3e8, 100, 900);

    /* --- إضاءة --- */
    state.hemi = new THREE.HemisphereLight(0xbcd0e8, 0x4a4238, 1.0);
    scene.add(state.hemi);
    const sun = new THREE.DirectionalLight(0xfff3d6, 3.0);
    sun.castShadow = quality.shadows;
    if (quality.shadows) {
      sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
      const S = quality.shadowRange;
      sun.shadow.camera.left = -S; sun.shadow.camera.right = S;
      sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
      sun.shadow.camera.near = 1; sun.shadow.camera.far = 420;
      sun.shadow.bias = -0.0012;
      sun.shadow.normalBias = 0.6;
    }
    scene.add(sun); scene.add(sun.target);
    state.sun = sun;
    state.sky = buildSky(scene);
    state.sky.scale.setScalar(Math.max(1500, quality.far * 3.6) * 0.9);

    /* --- البحر وقاعه: عالم واحد يضمّ كل الجزر --- */
    buildSea(G);
    buildReef(G);
    buildSnow(G);

    /* --- الجزر الثلاث --- */
    state.islandGroups = [];
    CFG.islands.forEach((isl) => {
      const ig = new THREE.Group();
      ig.name = 'island' + isl.id;
      G.add(ig);
      buildIsland(ig, isl, U.rng(CFG.seed + isl.id * 9377), quality);
      state.islandGroups.push({ group: ig, isl });
    });

    /* --- الجسور البحرية الطويلة بين الجزر --- */
    buildBridges(G, quality);

    buildGrid();

    /* --- خريطة البيئة للانعكاسات على السيارات --- */
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    setTimeOfDay('day');
    refreshEnv(renderer, pmrem);
    state.pmrem = pmrem;
    state.renderer = renderer;

    return state;
  }

  function refreshEnv(renderer, pmrem) {
    const tmp = new THREE.Scene();
    const sky = state.sky.clone();
    sky.material = state.sky.material.clone();
    sky.material.uniforms = state.sky.material.uniforms;   // نفس الألوان الحالية
    tmp.add(sky);
    if (state.envRT) state.envRT.dispose();
    state.envRT = pmrem.fromScene(tmp, 0.04);
    state.scene.environment = state.envRT.texture;
    state.scene.environmentIntensity = state.isNight ? 0.35 : 1.0;
  }

  /* ------------------------------ البحر ---------------------------------- */
  function buildSea(G) {
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1d6485, roughness: 0.07, metalness: 0.6,
      normalMap: TEX.waterN, normalScale: new THREE.Vector2(0.9, 0.9),
      side: THREE.DoubleSide
    });
    const SEA = 46000;
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(SEA, SEA), waterMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = CFG.seaY;
    sea.name = 'water';
    sea.renderOrder = 1;
    G.add(sea);

    /* قاع البحر — يظهر عند الغوص */
    const bedMat = new THREE.MeshStandardMaterial({ map: TEX.sand, color: 0x93a7a4, roughness: 1 });
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(SEA, SEA), bedMat);
    bed.rotation.x = -Math.PI / 2;
    bed.position.y = CFG.bedY;
    bed.name = 'seabed';
    bed.visible = false;          // لا يُرسم إلا عند الغوص
    G.add(bed);

    state.water = { material: waterMat, mesh: sea, bed };
  }

  /* --------------------- عالم ما تحت البحر (الشُّعب) --------------------- */
  /* كل ما يظهر عند الغوص: صخور، أعشاب بحرية، مرجان، حطام سفينة، أسماك،
     وذرّات عالقة في الماء. كله مخفي تماماً أثناء القيادة العادية فلا يكلّف شيئاً. */
  function buildReef(G) {
    const reef = new THREE.Group();
    reef.name = 'reef';
    reef.visible = false;
    reef.matrixAutoUpdate = false;

    const N_ROCK = 110, N_KELP = 190, N_CORAL = 90, N_FISH = 84;

    const rockMat  = new THREE.MeshStandardMaterial({ map: TEX.sand, color: 0x7c9298, roughness: 1, metalness: 0 });
    const kelpMat  = new THREE.MeshStandardMaterial({ color: 0x63d492, roughness: 0.75, side: THREE.DoubleSide,
                                                      emissive: 0x1c6b3f, emissiveIntensity: 1.0 });
    const coralMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.05 });
    const fishMat  = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.25,
                                                      emissive: 0x6fd3f0, emissiveIntensity: 0.35 });

    const rockGeo  = new THREE.IcosahedronGeometry(1, 0);
    const kelpGeo = (function () {
      /* شريطان متقاطعان يتضيّقان نحو الأعلى — يبدوان كورقة طحلب من أي زاوية */
      const seg = 4, verts = [], uvs = [], idx = [];
      const wAt = (t) => 0.55 * (1 - 0.55 * t) * (1 + 0.35 * Math.sin(t * 3.1));
      for (let plane = 0; plane < 2; plane++) {
        const base = verts.length / 3;
        for (let j = 0; j <= seg; j++) {
          const t = j / seg, w = wAt(t), y = t;
          const bend = Math.sin(t * 1.9) * 0.28;          // انحناء طبيعي
          if (plane === 0) { verts.push(-w, y, bend, w, y, bend); }
          else             { verts.push(bend, y, -w, bend, y, w); }
          uvs.push(0, t, 1, t);
        }
        for (let j = 0; j < seg; j++) {
          const a = base + j * 2;
          idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    })();
    const coralGeo = new THREE.ConeGeometry(0.55, 1, 6);
    coralGeo.translate(0, 0.5, 0);
    const fishGeo  = new THREE.ConeGeometry(0.20, 0.85, 4);
    fishGeo.rotateX(-Math.PI / 2);                       // الأنف نحو +Z
    fishGeo.scale(1, 0.45, 1);

    const N_DUNE = 16;
    const duneGeo = new THREE.SphereGeometry(1, 12, 7);
    const dunes = new THREE.InstancedMesh(duneGeo, rockMat.clone(), N_DUNE);
    dunes.material.color.setHex(0x9db0ad);
    dunes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    dunes.frustumCulled = false;
    reef.add(dunes);

    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, N_ROCK);
    const kelp  = new THREE.InstancedMesh(kelpGeo, kelpMat, N_KELP);
    const coral = new THREE.InstancedMesh(coralGeo, coralMat, N_CORAL);
    const fish  = new THREE.InstancedMesh(fishGeo, fishMat, N_FISH);
    [rocks, kelp, coral, fish].forEach((m) => {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      reef.add(m);
    });
    coral.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N_CORAL * 3), 3);
    fish.instanceColor  = new THREE.InstancedBufferAttribute(new Float32Array(N_FISH * 3), 3);

    /* حطام سفينة غارقة */
    const wreck = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x8d7c62, roughness: 0.9, metalness: 0.2,
                                                    emissive: 0x24303a, emissiveIntensity: 0.6 });
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.4, 22, 10, 1, false, 0, Math.PI), hullMat);
    hull.rotation.z = Math.PI / 2;
    hull.rotation.x = Math.PI;
    hull.position.y = 2.4;
    wreck.add(hull);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(22, 0.5, 6.6), hullMat);
    deck.position.y = 4.6; wreck.add(deck);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(5.5, 3, 4.6), hullMat);
    cab.position.set(-3, 6.3, 0); wreck.add(cab);
    for (const mx of [4, -7]) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 11, 6), hullMat);
      mast.position.set(mx, 9.5, 0); mast.rotation.z = 0.22; wreck.add(mast);
    }
    wreck.rotation.z = 0.16;
    reef.add(wreck);

    /* ذرّات عالقة في الماء تعطي إحساس العمق */
    const MOTES = 520;
    const mp = new Float32Array(MOTES * 3);
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
      color: 0xbfe6f5, size: 0.16, sizeAttenuation: true, transparent: true,
      opacity: 0.55, depthWrite: false, map: TEX.glow, blending: THREE.AdditiveBlending
    }));
    motes.frustumCulled = false;
    reef.add(motes);

    /* أشعة ضوء نافذة من السطح إلى الأعماق */
    if (!TEX.rayGrad) {
      TEX.rayGrad = canvasTex(8, 128, (c, w, h) => {
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#8fd8ff');
        g.addColorStop(1, '#000000');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
      }, 1, 1);
    }
    const rayMat = new THREE.MeshBasicMaterial({
      color: 0x9fe8ff, map: TEX.rayGrad, transparent: true, opacity: 0.075, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });
    const rayGeo = new THREE.CylinderGeometry(1.1, 7, 1, 9, 1, true);
    rayGeo.translate(0, -0.5, 0);                     // القمة عند السطح
    const N_RAY = 26;
    const rays = new THREE.InstancedMesh(rayGeo, rayMat, N_RAY);
    rays.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    rays.frustumCulled = false;
    rays.renderOrder = 3;
    reef.add(rays);

    G.add(reef);
    state.reef = {
      rays, dunes,
      group: reef, rocks, kelp, coral, fish, wreck, motes,
      fishData: [], kelpData: [], cx: NaN, cz: NaN, t: 0, mp
    };
  }

  /* توزيع الشُّعب حول نقطة الغوص — نفس المكان يعطي دائماً نفس المشهد */
  function placeReef(cx, cz) {
    const R = state.reef;
    if (!R) return;
    const gx = Math.round(cx / 90) * 90, gz = Math.round(cz / 90) * 90;
    if (gx === R.cx && gz === R.cz) return;
    R.cx = gx; R.cz = gz;

    const rnd = U.rng(((gx * 73856093) ^ (gz * 19349663) ^ CFG.seed) >>> 0);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(),
          E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();
    const bed = CFG.bedY;
    const spread = (i, n, r0, r1) => {
      const a = rnd() * Math.PI * 2, d = r0 + Math.sqrt(rnd()) * (r1 - r0);
      return [gx + Math.cos(a) * d, gz + Math.sin(a) * d];
    };
    const setI = (mesh, i, x, y, z, sx, sy, sz, rx, ry, rz) => {
      P.set(x, y, z); E.set(rx, ry, rz); Q.setFromEuler(E); S.set(sx, sy, sz);
      M.compose(P, Q, S); mesh.setMatrixAt(i, M);
    };

    if (R.dunes) {
      for (let i = 0; i < R.dunes.count; i++) {
        const [x, z] = spread(0, 1, 40, 130);
        setI(R.dunes, i, x, bed - rnd.range(1, 4), z,
             rnd.range(16, 46), rnd.range(3.5, 9.5), rnd.range(16, 46),
             0, rnd() * 6.28, 0);
      }
      R.dunes.instanceMatrix.needsUpdate = true;
    }
    for (let i = 0; i < R.rocks.count; i++) {
      const [x, z] = spread(i, R.rocks.count, 3, 115);
      const s = rnd.range(0.7, 4.2);
      setI(R.rocks, i, x, bed + s * rnd.range(0.15, 0.55), z,
           s * rnd.range(0.8, 1.5), s * rnd.range(0.5, 1.1), s * rnd.range(0.8, 1.5),
           rnd.range(-0.3, 0.3), rnd() * 6.28, rnd.range(-0.3, 0.3));
    }
    const groves = [];
    for (let g = 0; g < 13; g++) { const [gx2, gz2] = spread(0, 1, g < 3 ? 7 : 26, g < 3 ? 26 : 100); groves.push([gx2, gz2]); }
    R.kelpData.length = 0;
    for (let i = 0; i < R.kelp.count; i++) {
      const gv = groves[(i / R.kelp.count * groves.length) | 0] || groves[0];
      const x = gv[0] + rnd.range(-13, 13), z = gv[1] + rnd.range(-13, 13);
      const h = rnd.range(3.5, 12);
      const d = { x, z, w: rnd.range(0.45, 1.05), h, w2: rnd.range(0.45, 1.05),
                  ry: rnd() * 6.28, tx: rnd.range(-0.16, 0.16), tz: rnd.range(-0.16, 0.16),
                  ph: rnd() * 6.28, amp: rnd.range(0.05, 0.16) };
      R.kelpData.push(d);
      setI(R.kelp, i, x, bed, z, d.w, h, d.w2, d.tx, d.ry, d.tz);
    }
    const cc = new THREE.Color();
    const palette = [0xff7a6b, 0xffb057, 0xf06fae, 0x7fd6ff, 0xc79bff, 0x8ce8b6];
    for (let i = 0; i < R.coral.count; i++) {
      const [x, z] = spread(i, R.coral.count, 4, 95);
      const h = rnd.range(0.8, 3.4);
      setI(R.coral, i, x, bed, z, rnd.range(0.6, 1.5), h, rnd.range(0.6, 1.5),
           rnd.range(-0.25, 0.25), rnd() * 6.28, rnd.range(-0.25, 0.25));
      cc.setHex(palette[(rnd() * palette.length) | 0]);
      R.coral.setColorAt(i, cc);
    }

    /* أسماك في أسراب */
    R.fishData.length = 0;
    const schools = 6, per = Math.floor(R.fish.count / schools);
    for (let s0 = 0; s0 < schools; s0++) {
      const [sx, sz] = spread(0, 1, 12, 105);
      const sy = bed + rnd.range(3, 22);
      const hue = rnd();
      for (let k = 0; k < per; k++) {
        R.fishData.push({
          ox: sx, oz: sz, oy: sy,
          r: rnd.range(3, 13), a: rnd() * 6.28, sp: rnd.range(0.28, 0.62) * (rnd() < 0.5 ? -1 : 1),
          bob: rnd.range(0.3, 1.6), ph: rnd() * 6.28, sc: rnd.range(0.55, 1.9)
        });
        cc.setHSL(0.5 + hue * 0.16, 0.55, rnd.range(0.45, 0.72));
        R.fish.setColorAt(R.fishData.length - 1, cc);
      }
    }
    for (let i = R.fishData.length; i < R.fish.count; i++) setI(R.fish, i, 0, -9999, 0, 0.001, 0.001, 0.001, 0, 0, 0);

    /* الحطام */
    const [wx, wz] = spread(0, 1, 30, 95);
    R.wreck.position.set(wx, bed + 0.6, wz);
    R.wreck.rotation.y = rnd() * 6.28;
    R.wreck.visible = rnd() < 0.75;

    /* أشعة الضوء */
    if (R.rays) {
      for (let i = 0; i < R.rays.count; i++) {
        const [x, z] = spread(0, 1, 2, 120);
        const len = rnd.range(20, Math.abs(CFG.bedY - CFG.seaY) + 4);
        setI(R.rays, i, x, CFG.seaY - 0.4, z, rnd.range(0.6, 2.2), len, rnd.range(0.6, 2.2),
             rnd.range(-0.10, 0.10), rnd() * 6.28, rnd.range(-0.10, 0.10));
      }
      R.rays.instanceMatrix.needsUpdate = true;
    }

    /* الذرّات العالقة */
    for (let i = 0; i < R.mp.length; i += 3) {
      R.mp[i]     = gx + rnd.range(-60, 60);
      R.mp[i + 1] = bed + rnd.range(0.5, 34);
      R.mp[i + 2] = gz + rnd.range(-60, 60);
    }
    R.motes.geometry.attributes.position.needsUpdate = true;

    R.rocks.instanceMatrix.needsUpdate = true;
    R.kelp.instanceMatrix.needsUpdate = true;
    R.coral.instanceMatrix.needsUpdate = true;
    R.coral.instanceColor.needsUpdate = true;
    R.fish.instanceColor.needsUpdate = true;
  }

  /* حركة الأسماك وتمايل الأعشاب */
  const _rm = new THREE.Matrix4(), _rq = new THREE.Quaternion(),
        _re = new THREE.Euler(), _rp = new THREE.Vector3(), _rs = new THREE.Vector3(1, 1, 1);
  function updateReef(dt) {
    const R = state.reef;
    if (!R || !R.group.visible) return;
    R.t += dt;
    const D = R.fishData;
    for (let i = 0; i < D.length; i++) {
      const f = D[i];
      f.a += f.sp * dt;
      const x = f.ox + Math.cos(f.a) * f.r;
      const z = f.oz + Math.sin(f.a) * f.r;
      const y = f.oy + Math.sin(R.t * 0.9 + f.ph) * f.bob;
      _rp.set(x, y, z);
      _re.set(0, f.a + (f.sp > 0 ? -Math.PI / 2 : Math.PI / 2), Math.sin(R.t * 5 + f.ph) * 0.12);
      _rq.setFromEuler(_re);
      _rs.set(f.sc, f.sc, f.sc);
      _rm.compose(_rp, _rq, _rs);
      R.fish.setMatrixAt(i, _rm);
    }
    R.fish.instanceMatrix.needsUpdate = true;

    /* تمايل الأعشاب: كل ورقة تدور حول قاعدتها هي — تدوير الشبكة كلها
       يُبعد النسخ عشرات الأمتار لأنّها بعيدة عن مركز العالم. */
    const K = R.kelpData, bed = CFG.bedY;
    for (let i = 0; i < K.length; i++) {
      const d = K[i];
      const sway = Math.sin(R.t * 0.8 + d.ph) * d.amp;
      _rp.set(d.x, bed, d.z);
      _re.set(d.tx + sway, d.ry, d.tz + Math.cos(R.t * 0.62 + d.ph) * d.amp * 0.7);
      _rq.setFromEuler(_re);
      _rs.set(d.w, d.h, d.w2);
      _rm.compose(_rp, _rq, _rs);
      R.kelp.setMatrixAt(i, _rm);
    }
    if (K.length) R.kelp.instanceMatrix.needsUpdate = true;
  }

  /* مضلّع رباعي حرّ (يُستخدم لمنحدر الشاطئ) */
  function quadMesh(a, b, c, d, mat) {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array([
      a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2],
      a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]
    ]);
    const uv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    return m;
  }

  /* ------------------------------ جزيرة ---------------------------------- */
  function buildIsland(G, isl, rnd, quality) {
    const P = CFG.pitch, R = CFG.road, W = CFG.walk;
    const S = isl.span, HALF = isl.half, MARGIN = R;
    const OX = isl.cx, OZ = isl.cz;

    /* الأرض (أسفلت الشوارع) */
    const groundMat = state.groundMat || (state.groundMat = new THREE.MeshStandardMaterial({
      map: TEX.asphalt, roughness: 0.93, metalness: 0.0, color: 0xffffff
    }));
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(S + MARGIN * 2, S + MARGIN * 2), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(OX, 0, OZ);
    ground.receiveShadow = true;
    ground.name = 'ground' + isl.id;
    G.add(ground);

    /* الشاطئ الرملي */
    const sandMat = state.sandMat || (state.sandMat =
      new THREE.MeshStandardMaterial({ map: TEX.sand, roughness: 1, metalness: 0 }));
    const inner = S + MARGIN * 2, outer = isl.shore * 2;
    const B = (outer - inner) / 2;
    [[0, (inner + B) / 2, outer, B], [0, -(inner + B) / 2, outer, B],
     [(inner + B) / 2, 0, B, inner], [-(inner + B) / 2, 0, B, inner]].forEach(([x, z, sx, sz]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), sandMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(OX + x, -0.02, OZ + z);
      m.receiveShadow = true;
      G.add(m);
    });

    /* منحدر الشاطئ إلى قاع البحر (حتى لا تبدو الجزيرة طافية) */
    const SL = 55, DEEP = -7;
    const sh = isl.shore;
    const corners = [
      [[-sh, 0, sh], [sh, 0, sh], [sh + SL, DEEP, sh + SL], [-sh - SL, DEEP, sh + SL]],
      [[sh, 0, -sh], [-sh, 0, -sh], [-sh - SL, DEEP, -sh - SL], [sh + SL, DEEP, -sh - SL]],
      [[sh, 0, sh], [sh, 0, -sh], [sh + SL, DEEP, -sh - SL], [sh + SL, DEEP, sh + SL]],
      [[-sh, 0, -sh], [-sh, 0, sh], [-sh - SL, DEEP, sh + SL], [-sh - SL, DEEP, -sh - SL]]
    ];
    corners.forEach((q) => {
      const t = q.map((v) => [v[0] + OX, v[1], v[2] + OZ]);
      G.add(quadMesh(t[0], t[1], t[2], t[3], sandMat));
    });

    /* المربّعات السكنية: رصيف + سطح داخلي */
    const NB = isl.blocks;
    const blockSize = P - R;
    const innerSize = blockSize - W * 2;
    const slabGeo = state.slabGeo || (state.slabGeo = new THREE.BoxGeometry(blockSize, CFG.curb, blockSize));
    const slabMat = state.slabMat || (state.slabMat = (() => {
      const m = new THREE.MeshStandardMaterial({ map: TEX.walk.clone(), roughness: 0.9, metalness: 0 });
      m.map.repeat.set(blockSize / 4, blockSize / 4);
      m.map.needsUpdate = true;
      return m;
    })());
    const slabs = new THREE.InstancedMesh(slabGeo, slabMat, NB * NB);
    slabs.receiveShadow = true; slabs.castShadow = false;

    const lotGeo = state.lotGeo || (state.lotGeo = new THREE.PlaneGeometry(innerSize, innerSize));
    const lotMats = state.lotMats || (state.lotMats = {
      grass: new THREE.MeshStandardMaterial({ map: TEX.grass, roughness: 1, metalness: 0 }),
      lot: new THREE.MeshStandardMaterial({ map: TEX.lot, roughness: 0.95, metalness: 0 })
    });
    const lotsGrass = [], lotsPark = [];

    const mtx = new THREE.Matrix4(), qid = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    const blocks = [];
    let n = 0;
    for (let i = 0; i < NB; i++) {
      for (let j = 0; j < NB; j++) {
        const cx = OX - HALF + P * i + P / 2;
        const cz = OZ - HALF + P * j + P / 2;
        mtx.compose(new THREE.Vector3(cx, CFG.curb / 2, cz), qid, one);
        slabs.setMatrixAt(n++, mtx);
        const rect = { x0: cx - blockSize / 2, x1: cx + blockSize / 2,
                       z0: cz - blockSize / 2, z1: cz + blockSize / 2, cx, cz, island: isl.id };
        state.blockRects.push(rect);
        const dc = Math.max(Math.abs(i - (NB - 1) / 2), Math.abs(j - (NB - 1) / 2)) / (NB / 2);
        let kind = dc <= 0.22 ? 'downtown' : (dc >= 0.55 ? 'suburb' : 'mixed');
        const roll = rnd();
        if (roll < 0.05) kind = 'school';
        else if (roll < 0.11) kind = 'park';
        else if (roll < 0.16) kind = 'lot';
        blocks.push({ i, j, cx, cz, rect, kind });
        if (kind !== 'school') (kind === 'park' ? lotsGrass : lotsPark).push([cx, cz]);
      }
    }
    slabs.instanceMatrix.needsUpdate = true;
    slabs.computeBoundingSphere();
    G.add(slabs);

    [['grass', lotsGrass], ['lot', lotsPark]].forEach(([k, arr]) => {
      if (!arr.length) return;
      const im = new THREE.InstancedMesh(lotGeo, lotMats[k], arr.length);
      im.receiveShadow = true;
      arr.forEach(([x, z], idx) => {
        mtx.compose(new THREE.Vector3(x, CFG.curb + 0.012, z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), one);
        im.setMatrixAt(idx, mtx);
      });
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
      G.add(im);
    });

    buildRoadMarkings(G, rnd, isl);
    placeBuildings(G, blocks, rnd, isl);
    buildProps(G, rnd, quality, isl);
    buildSpawns(isl);
  }

  /* ------------------------------ الجسور --------------------------------- */
  /* الجسر قطعة واحدة متّصلة: بلاطة + حواجز جانبية + أعمدة تنزل إلى القاع.
     البناء بقطع منفصلة كان يترك فجوات وشرائح طائرة على المنحدرات. */
  function bridgeStrips(br) {
    const HW = br.width / 2, TH = 1.5, PW = 1.0, RH = 1.35;
    const a = br.axis === 'x' ? br.x0 : br.z0;
    const b = br.axis === 'x' ? br.x1 : br.z1;
    const n = Math.max(4, Math.ceil((b - a) / 10));
    const road = { pos: [], uv: [], idx: [] };
    const stru = { pos: [], uv: [], idx: [] };
    const line = { pos: [], uv: [], idx: [] };

    const put = (dst, s, y, t) => {
      if (br.axis === 'x') dst.pos.push(t, y, br.z + s);
      else                 dst.pos.push(br.x + s, y, t);
    };
    /* شريط رباعي ممتد على طول الجسر بين حافّتين */
    const strip = (dst, s0, o0, s1, o1, uRep, vDiv) => {
      const base = dst.pos.length / 3;
      for (let i = 0; i <= n; i++) {
        const t = a + (b - a) * i / n;
        const y = deckHeight(br, t);
        put(dst, s0, y + o0, t);
        put(dst, s1, y + o1, t);
        const v = (t - a) / (vDiv || 8);
        dst.uv.push(0, v, uRep || 1, v);
      }
      for (let i = 0; i < n; i++) {
        const k = base + i * 2;
        dst.idx.push(k, k + 1, k + 3, k, k + 3, k + 2);
      }
    };

    strip(road, -HW, 0, HW, 0, br.width / 8);              // سطح القيادة
    strip(stru, HW, -TH, -HW, -TH, br.width / 8);          // البطن
    strip(stru, -HW, -TH, -HW, RH, 1, 6);                  // الجدار الخارجي الأيسر
    strip(stru, HW, RH, HW, -TH, 1, 6);                    // الجدار الخارجي الأيمن
    strip(stru, -HW, RH, -HW + PW, RH, 1, 6);              // أعلى الحاجز الأيسر
    strip(stru, -HW + PW, RH, -HW + PW, 0, 1, 6);          // داخل الحاجز الأيسر
    strip(stru, HW - PW, RH, HW, RH, 1, 6);                // أعلى الحاجز الأيمن
    strip(stru, HW - PW, 0, HW - PW, RH, 1, 6);            // داخل الحاجز الأيمن
    strip(line, -0.22, 0.04, 0.22, 0.04, 1, 9);            // الخطّ المنقّط في المنتصف

    const mk = (d) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(d.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(d.uv, 2));
      g.setIndex(d.idx);
      g.computeVertexNormals();
      g.computeBoundingSphere();
      return g;
    };
    return { road: mk(road), stru: mk(stru), line: mk(line), TH };
  }

  function buildBridges(G, quality) {
    state.bridges = [];
    if (!state.bridgeMats) {
      const asf = TEX.asphalt.clone(); asf.repeat.set(1, 1); asf.needsUpdate = true;
      const dsh = TEX.dash.clone();    dsh.repeat.set(1, 1); dsh.needsUpdate = true;
      state.bridgeMats = {
        road: new THREE.MeshStandardMaterial({ map: asf, roughness: 0.92, metalness: 0.03,
                                               side: THREE.DoubleSide }),
        stru: new THREE.MeshStandardMaterial({ color: 0xb9c0c8, roughness: 0.78, metalness: 0.08,
                                               side: THREE.DoubleSide }),
        line: new THREE.MeshBasicMaterial({ map: dsh, transparent: true, opacity: 0.9,
                                            depthWrite: false, side: THREE.DoubleSide }),
        pylon: new THREE.MeshStandardMaterial({ color: 0x9aa3ac, roughness: 0.9, metalness: 0.05 })
      };
    }
    const MAT = state.bridgeMats;

    BRIDGES.forEach((spec) => {
      const A = CFG.islands[spec.a], B2 = CFG.islands[spec.b];
      const br = { a: spec.a, b: spec.b, axis: spec.axis, width: spec.width,
                   deckY: spec.deckY, ramp: spec.ramp };
      if (spec.axis === 'x') {
        br.z = A.cz;
        br.x0 = Math.min(A.cx, B2.cx) === A.cx ? A.cx + A.shore : B2.cx + B2.shore;
        br.x1 = Math.min(A.cx, B2.cx) === A.cx ? B2.cx - B2.shore : A.cx - A.shore;
        br.len = br.x1 - br.x0;
      } else {
        br.x = A.cx;
        br.z0 = Math.min(A.cz, B2.cz) === A.cz ? A.cz + A.shore : B2.cz + B2.shore;
        br.z1 = Math.min(A.cz, B2.cz) === A.cz ? B2.cz - B2.shore : A.cz - A.shore;
        br.len = br.z1 - br.z0;
      }
      state.bridges.push(br);

      const bg = new THREE.Group();
      bg.name = 'bridgeG';
      G.add(bg);
      br.group = bg;
      const S = bridgeStrips(br);
      const roadMesh = new THREE.Mesh(S.road, MAT.road);
      roadMesh.receiveShadow = true;
      const struMesh = new THREE.Mesh(S.stru, MAT.stru);
      struMesh.receiveShadow = true; struMesh.castShadow = quality.shadows;
      const lineMesh = new THREE.Mesh(S.line, MAT.line);
      lineMesh.renderOrder = 2;
      [roadMesh, struMesh, lineMesh].forEach((m) => { m.name = 'bridge'; bg.add(m); });

      /* أعمدة تنزل من البلاطة إلى قاع البحر + عارضة أعلى كل عمود */
      const a0 = br.axis === 'x' ? br.x0 : br.z0;
      const b0 = br.axis === 'x' ? br.x1 : br.z1;
      const SP = 130, towers = [];
      for (let t = a0 + SP; t < b0 - SP * 0.5; t += SP) {
        const y = deckHeight(br, t);
        if (y > 4) towers.push([t, y]);
      }
      if (towers.length) {
        const legGeo = new THREE.CylinderGeometry(2.0, 3.2, 1, 7);
        legGeo.translate(0, 0.5, 0);
        const legs = new THREE.InstancedMesh(legGeo, MAT.pylon, towers.length * 2);
        const capGeo = new THREE.BoxGeometry(br.width + 3, 1.6, 5.2);
        const caps = new THREE.InstancedMesh(capGeo, MAT.pylon, towers.length);
        legs.castShadow = caps.castShadow = quality.shadows;
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(),
              e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
        towers.forEach(([t, y], i) => {
          const h = y - S.TH - 1.2 - CFG.bedY;
          for (let sd = 0; sd < 2; sd++) {
            const off = (sd ? 1 : -1) * (br.width / 2 - 4);
            v.set(br.axis === 'x' ? t : br.x + off, CFG.bedY,
                  br.axis === 'x' ? br.z + off : t);
            m.compose(v, q, new THREE.Vector3(1, h, 1));
            legs.setMatrixAt(i * 2 + sd, m);
          }
          e.set(0, br.axis === 'x' ? 0 : Math.PI / 2, 0);
          q.setFromEuler(e);
          v.set(br.axis === 'x' ? t : br.x, y - S.TH - 0.8, br.axis === 'x' ? br.z : t);
          m.compose(v, q, one);
          caps.setMatrixAt(i, m);
          q.identity();
        });
        legs.instanceMatrix.needsUpdate = true; legs.computeBoundingSphere();
        caps.instanceMatrix.needsUpdate = true; caps.computeBoundingSphere();
        bg.add(legs); bg.add(caps);
      }

      /* أعمدة إنارة على الجسر */
      const lampPole = state.bridgeLampGeo || (state.bridgeLampGeo = (() => {
        const g = new THREE.CylinderGeometry(0.13, 0.19, 1, 6); g.translate(0, 0.5, 0); return g;
      })());
      const lampSpots = [];
      for (let t = a0 + 55, k = 0; t < b0 - 40; t += 55, k++) lampSpots.push([t, k % 2 ? 1 : -1]);
      if (lampSpots.length) {
        const poles = new THREE.InstancedMesh(lampPole, MAT.pylon, lampSpots.length);
        const headGeo = new THREE.BoxGeometry(1.9, 0.34, 0.85);
        const heads = new THREE.InstancedMesh(headGeo, state.lampMat || MAT.pylon, lampSpots.length);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(),
              e = new THREE.Euler(), v = new THREE.Vector3();
        lampSpots.forEach(([t, sd], i) => {
          const y = deckHeight(br, t) + 1.35;
          const off = sd * (br.width / 2 - 0.55);
          const px = br.axis === 'x' ? t : br.x + off;
          const pz = br.axis === 'x' ? br.z + off : t;
          v.set(px, y, pz);
          m.compose(v, q, new THREE.Vector3(1, 6.2, 1));
          poles.setMatrixAt(i, m);
          e.set(0, br.axis === 'x' ? Math.PI / 2 : 0, 0);
          q.setFromEuler(e);
          v.set(px - (br.axis === 'x' ? 0 : sd * 0.85), y + 6.2, pz - (br.axis === 'x' ? sd * 0.85 : 0));
          m.compose(v, q, new THREE.Vector3(1, 1, 1));
          heads.setMatrixAt(i, m);
          q.identity();
        });
        poles.instanceMatrix.needsUpdate = true; poles.computeBoundingSphere();
        heads.instanceMatrix.needsUpdate = true; heads.computeBoundingSphere();
        bg.add(poles); bg.add(heads);
      }

      /* حواجز التصادم على الجانبين */
      const halfW = br.width / 2;
      if (br.axis === 'x') {
        [-1, 1].forEach((sg) => state.colliders.push({
          minX: br.x0, maxX: br.x1,
          minZ: br.z + sg * halfW - 0.6, maxZ: br.z + sg * halfW + 0.6,
          h: 2.6, kind: 'rail'
        }));
      } else {
        [-1, 1].forEach((sg) => state.colliders.push({
          minX: br.x + sg * halfW - 0.6, maxX: br.x + sg * halfW + 0.6,
          minZ: br.z0, maxZ: br.z1, h: 2.6, kind: 'rail'
        }));
      }
    });
  }
  const qid0 = new THREE.Quaternion();

  /* --------------------------- خطوط الطرق -------------------------------- */
  function buildRoadMarkings(G, rnd, isl) {
    const NB = isl.blocks, P = CFG.pitch, HALF = isl.half, R = CFG.road;
    const OX = isl.cx, OZ = isl.cz;
    const segLen = P - R;                      // طول الخط بين تقاطعين
    const dashMat = new THREE.MeshBasicMaterial({ map: TEX.dash, transparent: true, depthWrite: false, opacity: 0.85 });
    TEX.dash.repeat.set(1, segLen / 7);
    const solidMat = new THREE.MeshBasicMaterial({ map: TEX.solid, transparent: true, depthWrite: false, opacity: 0.55 });
    const zebraMat = new THREE.MeshBasicMaterial({ map: TEX.zebra, transparent: true, depthWrite: false, opacity: 0.8 });

    const dashGeo = new THREE.PlaneGeometry(0.5, segLen);
    const edgeGeo = new THREE.PlaneGeometry(0.22, segLen);
    const zebraGeo = new THREE.PlaneGeometry(R - 2.5, 3.0);

    const dashes = [], edges = [], zebras = [];
    const rotFlat = new THREE.Euler(-Math.PI / 2, 0, 0);
    const rotFlatX = new THREE.Euler(-Math.PI / 2, 0, Math.PI / 2);

    for (let i = 0; i <= NB; i++) {
      const line = -HALF + i * P;
      for (let s = 0; s < NB; s++) {
        const mid = -HALF + s * P + P / 2;
        // شارع بمحور Z (خط عمودي)
        dashes.push([line, mid, rotFlat]);
        edges.push([line - R / 2 + 1.1, mid, rotFlat]);
        edges.push([line + R / 2 - 1.1, mid, rotFlat]);
        // شارع بمحور X (خط أفقي)
        dashes.push([mid, line, rotFlatX]);
        edges.push([mid, line - R / 2 + 1.1, rotFlatX]);
        edges.push([mid, line + R / 2 - 1.1, rotFlatX]);
      }
      // ممرات المشاة عند التقاطعات
      for (let k = 0; k <= NB; k++) {
        const other = -HALF + k * P;
        zebras.push([line, other - R / 2 + 2.2, rotFlatX]);
        zebras.push([line, other + R / 2 - 2.2, rotFlatX]);
        zebras.push([other - R / 2 + 2.2, line, rotFlat]);
        zebras.push([other + R / 2 - 2.2, line, rotFlat]);
      }
    }
    const put = (geo, mat, list, y) => {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
      list.forEach(([x, z, rot], i) => {
        q.setFromEuler(rot);
        m.compose(new THREE.Vector3(x + OX, y, z + OZ), q, one);
        im.setMatrixAt(i, m);
      });
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
      im.renderOrder = 2;
      G.add(im);
      return im;
    };
    put(dashGeo, dashMat, dashes, 0.015);
    put(edgeGeo, solidMat, edges, 0.014);
    put(zebraGeo, zebraMat, zebras, 0.016);
  }

  /* --------------------------- توزيع المباني ----------------------------- */
  /* كل المباني من النماذج المرفقة فقط. لكل نموذج واجهة معروفة ومقاس مناسب،
     وتُصفّ على أطراف المربّعات بحيث تواجه الشارع، مع تنويع حسب المنطقة.     */
  const BUILDING_DEFS = {
    building_stanley:      { face: 'x', minS: 0.60, maxS: 0.88, w: { downtown: 26, mixed: 12, suburb: 2 } },
    building_residential5: { face: 'z', minS: 0.85, maxS: 1.20, w: { downtown: 24, mixed: 30, suburb: 16 } },
    building_office2:      { face: 'z', yawFix: Math.PI, minS: 0.90, maxS: 1.30, w: { downtown: 32, mixed: 30, suburb: 16 } },
    building_shop:         { face: 'z', minS: 1.00, maxS: 1.55, w: { downtown: 8, mixed: 18, suburb: 26 }, cap: 320 },
    building_house:        { face: 'z', minS: 3.40, maxS: 4.40, w: { downtown: 0, mixed: 8, suburb: 30 }, cap: 70 }
  };
  const SCHOOL = { key: 'building_school', scale: 0.86 };

  /* أقصى مسافة ظهور لكل نموذج (بالمتر) — النماذج عالية التفاصيل تُخفى أبكر
     حتى تبقى اللعبة سريعة على الهاتف دون المساس بتفاصيل النماذج نفسها */
  const CULL = {
    building_residential5: 1e9, building_office2: 1e9, building_stanley: 620,
    building_school: 700, building_shop: 380, building_house: 260
  };

  function pickModel(kind, rnd, counts) {
    let total = 0;
    const opts = [];
    for (const key in BUILDING_DEFS) {
      const d = BUILDING_DEFS[key];
      if (!SC.assets.get(key)) continue;
      if (d.cap && counts[key] >= d.cap) continue;
      const w = d.w[kind] || 0;
      if (w <= 0) continue;
      total += w;
      opts.push([key, total]);
    }
    if (!opts.length) return null;
    const r = rnd() * total;
    for (const [key, acc] of opts) if (r <= acc) return key;
    return opts[opts.length - 1][0];
  }

  function placeBuildings(G, blocks, rnd) {
    const lists = {};
    const counts = {};
    Object.keys(BUILDING_DEFS).forEach((k) => { lists[k] = []; counts[k] = 0; });
    lists[SCHOOL.key] = []; counts[SCHOOL.key] = 0;

    const W = CFG.walk, P = CFG.pitch, R = CFG.road;
    const blockSize = P - R;
    const inner = blockSize - W * 2;

    // اتجاهات الواجهات الأربع: [متجه الخارج, دوران yaw]
    const sides = [
      { nx: 0, nz: 1, yaw: 0 },              // شمال (+Z)
      { nx: 1, nz: 0, yaw: Math.PI / 2 },    // شرق (+X)
      { nx: 0, nz: -1, yaw: Math.PI },       // جنوب (-Z)
      { nx: -1, nz: 0, yaw: -Math.PI / 2 }   // غرب (-X)
    ];

    const addCollider = (px, pz, ex, ez, h, shrink) => {
      const k = shrink == null ? 0.12 : shrink;
      state.colliders.push({
        minX: px - ex / 2 + k, maxX: px + ex / 2 - k,
        minZ: pz - ez / 2 + k, maxZ: pz + ez / 2 - k,
        h: h, kind: 'building'
      });
    };

    for (const b of blocks) {
      /* مدرسة تشغل مربّعاً كاملاً */
      if (b.kind === 'school' && SC.assets.get(SCHOOL.key)) {
        const model = SC.assets.get(SCHOOL.key);
        const fit = Math.min(inner / model.size.x, inner / model.size.z) * 0.99;
        const sc = Math.min(SCHOOL.scale, fit);
        const yaw = Math.floor(rnd() * 4) * Math.PI / 2;
        lists[SCHOOL.key].push(new THREE.Matrix4().compose(
          new THREE.Vector3(b.cx, CFG.curb, b.cz),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
          new THREE.Vector3(sc, sc, sc)));
        counts[SCHOOL.key]++;
        const ex = Math.abs(Math.cos(yaw)) * model.size.x * sc + Math.abs(Math.sin(yaw)) * model.size.z * sc;
        const ez = Math.abs(Math.sin(yaw)) * model.size.x * sc + Math.abs(Math.cos(yaw)) * model.size.z * sc;
        addCollider(b.cx, b.cz, ex * 0.92, ez * 0.92, model.size.y * sc, 0);
        continue;
      }
      if ((b.kind === 'park' || b.kind === 'lot') && rnd() > 0.5) continue;   // ساحة مفتوحة

      for (const side of sides) {
        if (rnd() < 0.10) continue;                        // فجوة في الصف
        const along = new THREE.Vector3(-side.nz, 0, side.nx);   // متجه على امتداد الواجهة
        let cursor = -inner / 2 + rnd.range(0, 12);
        let guard = 0;

        while (cursor < inner / 2 - 8 && guard++ < 14) {
          const key = pickModel(b.kind === 'park' || b.kind === 'lot' ? 'suburb' : b.kind, rnd, counts);
          if (!key) break;
          const d = BUILDING_DEFS[key];
          const model = SC.assets.get(key);
          const s = rnd.range(d.minS, d.maxS);
          // العرض على امتداد الواجهة والعمق للداخل بحسب محور واجهة النموذج
          const wSpan = (d.face === 'x' ? model.size.z : model.size.x) * s;
          const dSpan = (d.face === 'x' ? model.size.x : model.size.z) * s;
          if (cursor + wSpan > inner / 2) break;
          if (dSpan > inner * 0.64) { cursor += 8; continue; }

          const t = cursor + wSpan / 2;
          const depthOff = inner / 2 - dSpan / 2 - rnd.range(0.5, 4);
          const px = b.cx + along.x * t + side.nx * depthOff;
          const pz = b.cz + along.z * t + side.nz * depthOff;
          const yaw = side.yaw + (d.face === 'x' ? -Math.PI / 2 : 0) + (d.yawFix || 0);

          lists[key].push(new THREE.Matrix4().compose(
            new THREE.Vector3(px, CFG.curb, pz),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
            new THREE.Vector3(s, s, s)));
          counts[key]++;

          // صندوق التصادم (الدوران مضاعفات 90°، فالصندوق محاذٍ للمحاور)
          const ex = Math.abs(Math.cos(yaw)) * model.size.x * s + Math.abs(Math.sin(yaw)) * model.size.z * s;
          const ez = Math.abs(Math.sin(yaw)) * model.size.x * s + Math.abs(Math.cos(yaw)) * model.size.z * s;
          addCollider(px, pz, ex, ez, model.size.y * s);
          cursor += wSpan + rnd.range(2.5, 12);
        }
      }
    }

    // بناء نسخ InstancedMesh مقسّمة إلى أحياء لتحسين الاقتصاص
    let total = 0;
    for (const key in lists) {
      const all = lists[key];
      if (!all.length) continue;
      total += all.length;
      const chunks = new Map();
      const CH = CFG.pitch * 2;
      const pos = new THREE.Vector3();
      all.forEach((m) => {
        pos.setFromMatrixPosition(m);
        const k = Math.floor(pos.x / CH) + ',' + Math.floor(pos.z / CH);
        let a = chunks.get(k); if (!a) { a = []; chunks.set(k, a); }
        a.push(m);
      });
      chunks.forEach((mats) => {
        const tints = key === SCHOOL.key ? null : mats.map(() => new THREE.Color().setHSL(
          rnd.range(0.05, 0.15), rnd.range(0.02, 0.12), rnd.range(0.48, 0.58)).multiplyScalar(1.72));
        const g = SC.assets.buildInstanced(key, mats, { cast: true, receive: true, tints });
        g.name = 'chunk_' + key;
        const c = new THREE.Vector3(), bb = new THREE.Box3();
        mats.forEach((m) => bb.expandByPoint(c.setFromMatrixPosition(m)));
        bb.getCenter(c);
        g.userData.center = c.clone();
        g.userData.radius = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * 0.5 + 70;
        g.userData.cull = CULL[key] || 1e9;
        state.chunks.push(g);
        G.add(g);
      });
    }
    state.buildingCount = total;
    state.buildingMix = counts;
  }

  /* ------------------------ أعمدة الإنارة والحواجز ----------------------- */
  function buildProps(G, rnd, quality, isl) {
    const NB = isl.blocks, P = CFG.pitch, HALF = isl.half, R = CFG.road;
    const OX = isl.cx, OZ = isl.cz;

    /* عمود إنارة: عمود + ذراع + مصباح */
    const poleGeo = new THREE.CylinderGeometry(0.13, 0.17, 8.4, 6);
    const armGeo = new THREE.BoxGeometry(1.9, 0.16, 0.16);
    const headGeo = new THREE.BoxGeometry(1.1, 0.22, 0.5);
    const poleMat = state.poleMat || (state.poleMat =
      new THREE.MeshStandardMaterial({ color: 0x4c5258, roughness: 0.6, metalness: 0.55 }));
    state.lampMat = state.lampMat || new THREE.MeshStandardMaterial({
      color: 0x9aa3ad, emissive: 0xffe6ac, emissiveIntensity: 0, roughness: 0.35, metalness: 0.2
    });

    const lampPos = [];
    for (let i = 0; i <= NB; i++) {
      const line = -HALF + i * P;
      for (let s = 0; s < NB * 2; s++) {
        const t = -HALF + s * (P / 2) + P / 4;
        lampPos.push([OX + line - R / 2 - 1.6, OZ + t, 1]);     // على يمين الشارع العمودي
        lampPos.push([OX + t, OZ + line + R / 2 + 1.6, 2]);     // على الشارع الأفقي
      }
    }
    const mk = (geo, mat, count) => {
      const im = new THREE.InstancedMesh(geo, mat, count);
      im.castShadow = quality.shadows; im.receiveShadow = false; return im;
    };
    const poles = mk(poleGeo, poleMat, lampPos.length);
    const arms = mk(armGeo, poleMat, lampPos.length);
    const heads = mk(headGeo, state.lampMat, lampPos.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    lampPos.forEach(([x, z, dir], i) => {
      const yaw = dir === 1 ? 0 : Math.PI / 2;
      const sign = dir === 1 ? 1 : -1;
      q.setFromEuler(new THREE.Euler(0, yaw, 0));
      m.compose(new THREE.Vector3(x, 4.2, z), q, one); poles.setMatrixAt(i, m);
      const ax = dir === 1 ? x + sign * 1.0 : x, az = dir === 1 ? z : z + sign * 1.0;
      m.compose(new THREE.Vector3(ax, 8.3, az), q, one); arms.setMatrixAt(i, m);
      const hx = dir === 1 ? x + sign * 1.9 : x, hz = dir === 1 ? z : z + sign * 1.9;
      m.compose(new THREE.Vector3(hx, 8.1, hz), q, one); heads.setMatrixAt(i, m);
      state.lamps.push([hx, 8.1, hz]);
    });
    [poles, arms, heads].forEach((im) => { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); G.add(im); });

    /* هالة ضوء ليلية تحت كل مصباح */
    const glowGeo = new THREE.PlaneGeometry(11, 11);
    const glowMat = new THREE.MeshBasicMaterial({
      map: TEX.glow, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, opacity: 0.5
    });
    const glow = new THREE.InstancedMesh(glowGeo, glowMat, state.lamps.length - (state.lampBase || 0));
    state.lamps.slice(state.lampBase || 0).forEach(([x, y, z], i) => {
      m.compose(new THREE.Vector3(x, 0.06, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), one);
      glow.setMatrixAt(i, m);
    });
    glow.instanceMatrix.needsUpdate = true; glow.computeBoundingSphere();
    glow.visible = false; glow.renderOrder = 3;
    (state.lampGlows = state.lampGlows || []).push(glow);
    state.lampGlow = glow;
    state.lampBase = state.lamps.length;
    G.add(glow);

    /* مخاريط وحواجز متفرقة على الأرصفة */
    const coneGeo = new THREE.ConeGeometry(0.34, 0.85, 10);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.7 });
    const barGeo = new THREE.BoxGeometry(2.4, 0.85, 0.55);
    const barMat = new THREE.MeshStandardMaterial({ color: 0xd8d3c6, roughness: 0.85 });
    const cones = [], bars = [];
    for (let i = 0; i < 150; i++) {
      const b = state.blockRects[Math.floor(rnd() * state.blockRects.length)];
      const edge = Math.floor(rnd() * 4);
      const t = rnd.range(0.12, 0.88);
      const px = edge === 0 || edge === 2 ? U.lerp(b.x0, b.x1, t) : (edge === 1 ? b.x1 - 2.2 : b.x0 + 2.2);
      const pz = edge === 1 || edge === 3 ? U.lerp(b.z0, b.z1, t) : (edge === 0 ? b.z1 - 2.2 : b.z0 + 2.2);
      (rnd() < 0.62 ? cones : bars).push([px, pz, rnd() * 6.283]);
    }
    const put = (geo, mat, list, y, cast) => {
      if (!list.length) return;
      const im = mk(geo, mat, list.length);
      im.castShadow = cast && quality.shadows;
      list.forEach(([x, z, r], i) => {
        q.setFromEuler(new THREE.Euler(0, r, 0));
        m.compose(new THREE.Vector3(x, CFG.curb + y, z), q, one);
        im.setMatrixAt(i, m);
      });
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); G.add(im);
    };
    put(coneGeo, coneMat, cones, 0.43, true);
    put(barGeo, barMat, bars, 0.43, true);
  }

  /* ------------------------- نقاط الولادة والمواقف ----------------------- */
  function buildSpawns(isl) {
    const NB = isl.blocks, P = CFG.pitch, HALF = isl.half;
    for (let i = 0; i <= NB; i++) {
      for (let s = 0; s < NB; s++) {
        const line = -HALF + i * P;
        const mid = -HALF + s * P + P / 2;
        state.spawns.push({ x: isl.cx + line - 6, z: isl.cz + mid, yaw: 0 });
        state.spawns.push({ x: isl.cx + mid, z: isl.cz + line + 6, yaw: Math.PI / 2 });
      }
    }
  }
  function nearestSpawn(x, z) {
    let best = state.spawns[0], bd = Infinity;
    for (const s of state.spawns) {
      const d = (s.x - x) ** 2 + (s.z - z) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
  /* نقطة عشوائية على شارع (يمكن تحديد الجزيرة) */
  function randomRoadPoint(rnd, islandId) {
    const r = rnd || Math.random;
    const isl = islandId == null ? CFG.islands[Math.floor(r() * CFG.islands.length)]
                                 : CFG.islands[islandId];
    const NB = isl.blocks, P = CFG.pitch, H = isl.half;
    const i = Math.floor(r() * (NB + 1));
    const line = -H + i * P;
    const t = -H + r() * isl.span;
    return r() < 0.5 ? { x: isl.cx + line, z: isl.cz + t, island: isl.id }
                     : { x: isl.cx + t, z: isl.cz + line, island: isl.id };
  }

  /* تبديل مظهر «تحت الماء» */
  function setUnderwater(on, x, z) {
    if (state.reef && on) placeReef(x || 0, z || 0);
    if (state.reef) state.reef.group.visible = !!on;
    if (state.water && state.water.bed) state.water.bed.visible = !!on;
    if (state.underwater === on) return;
    state.underwater = on;
    const p = PRESETS[state.timeOfDay] || PRESETS.day;
    if (on) {
      state.fogBackup = { color: state.scene.fog.color.getHex(), near: state.scene.fog.near, far: state.scene.fog.far };
      state.scene.fog.color.setHex(0x0e5b82);
      state.scene.fog.near = 2;
      state.scene.fog.far = 135;
      state.hemi.intensity = 1.55;
      state.hemi.color.setHex(0x7ad4f2);
      state.hemi.groundColor && state.hemi.groundColor.setHex(0x1c5468);
      state.sun.intensity = 1.15;
      state.envBackup = state.scene.environmentIntensity;
      state.scene.environmentIntensity = 0.55;
    } else {
      const f = state.fogBackup || { color: p.fog, near: p.fogFar * 0.12, far: p.fogFar };
      state.scene.fog.color.setHex(f.color);
      state.scene.fog.near = f.near;
      state.scene.fog.far = f.far;
      state.hemi.intensity = p.hemi;
      state.hemi.color.setHex(p.amb);
      if (state.hemi.groundColor) state.hemi.groundColor.setHex(p.ground != null ? p.ground : 0x4a4238);
      state.sun.intensity = p.sunI;
      if (state.envBackup != null) state.scene.environmentIntensity = state.envBackup;
    }
  }

  /* ------------------------------ الفصول -------------------------------- */
  /* الشتاء: ثلج على الأرصفة والحدائق، سماء شاحبة، وثلج متساقط حول اللاعب */
  function buildSnow(G) {
    const N = 1500, SPAN = 130, HIGH = 46;
    const pos = new Float32Array(N * 3), vel = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * SPAN;
      pos[i * 3 + 1] = Math.random() * HIGH;
      pos[i * 3 + 2] = (Math.random() - 0.5) * SPAN;
      vel[i] = 2.2 + Math.random() * 3.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    if (!TEX.flake) {
      TEX.flake = canvasTex(64, 64, (c, w, h) => {
        const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.45, 'rgba(255,255,255,0.75)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
      }, 1, 1);
    }
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.38, sizeAttenuation: true, transparent: true,
      opacity: 0.95, depthWrite: false, map: TEX.flake
    }));
    pts.frustumCulled = false;
    pts.visible = false;
    pts.renderOrder = 4;
    G.add(pts);
    state.snow = { points: pts, pos, vel, span: SPAN, high: HIGH, t: 0 };
  }

  function updateSnow(dt, focus) {
    const S = state.snow;
    if (!S || !S.points.visible) return;
    S.t += dt;
    const P = S.pos, V = S.vel, half = S.span / 2;
    const wind = Math.sin(S.t * 0.35) * 1.6;
    for (let i = 0, j = 0; j < V.length; i += 3, j++) {
      P[i + 1] -= V[j] * dt;
      P[i]     += (wind + Math.sin(S.t * 1.7 + j) * 0.5) * dt;
      P[i + 2] += Math.cos(S.t * 1.3 + j) * 0.4 * dt;
      /* لفّ حول اللاعب حتى تكفي ألف ندفة لتغطية المشهد كلّه */
      let dx = P[i] - focus.x, dy = P[i + 1] - focus.y, dz = P[i + 2] - focus.z;
      if (dy < -4) { dy += S.high; }
      if (dy > S.high - 4) dy -= S.high;
      if (dx >  half) dx -= S.span; else if (dx < -half) dx += S.span;
      if (dz >  half) dz -= S.span; else if (dz < -half) dz += S.span;
      P[i] = focus.x + dx; P[i + 1] = focus.y + dy; P[i + 2] = focus.z + dz;
    }
    S.points.geometry.attributes.position.needsUpdate = true;
  }

  function setSeason(name) {
    const win = name === 'winter';
    state.season = win ? 'winter' : 'summer';
    const t = SEASON_TINT[state.season];
    const set = (m, hex) => { if (m && m.color) m.color.setHex(hex); };
    set(state.groundMat, t.ground);
    set(state.sandMat, t.sand);
    set(state.slabMat, t.slab);
    if (state.lotMats) { set(state.lotMats.grass, t.grass); set(state.lotMats.lot, t.lot); }
    if (state.water && state.water.material) state.water.material.color.setHex(t.water);
    if (state.bridgeMats) {
      state.bridgeMats.road.color.setHex(win ? 0xb4c0ca : 0xffffff);
      state.bridgeMats.stru.color.setHex(win ? 0xdfe8f0 : 0xb9c0c8);
    }
    if (state.snow) state.snow.points.visible = win;
    if (state.timeOfDay) setTimeOfDay(state.timeOfDay);
    if (state.pmrem && state.renderer) refreshEnv(state.renderer, state.pmrem);
  }

  function update(dt, focus) {
    // ظل الشمس يتبع اللاعب لتبقى دقة الظل عالية
    const sun = state.sun;
    if (sun && state.sunDir) {
      sun.target.position.set(focus.x, 0, focus.z);
      sun.position.set(focus.x + state.sunDir.x * 180, state.sunDir.y * 180 + 30, focus.z + state.sunDir.z * 180);
      sun.target.updateMatrixWorld();
    }
    if (state.sky) {
      state.sky.position.set(focus.x, 0, focus.z);
      state.sky.material.uniforms.uTime.value += dt;
    }
    if (state.underwater) updateReef(dt);
    updateSnow(dt, focus);
    if (state.water && state.water.material) {
      const n = state.water.material.normalMap;
      n.offset.x += dt * 0.012;
      n.offset.y += dt * 0.007;
    }

    /* جزيرة بعيدة = لا تُرسم إطلاقاً. مع ستّ جزر هذا يوفّر مئات النداءات. */
    const fogFar = state.scene.fog ? state.scene.fog.far : 900;
    const islCull = Math.max(2600, fogFar * 2.6);
    if (state.islandGroups) {
      for (const e of state.islandGroups) {
        const d = Math.max(Math.abs(focus.x - e.isl.cx), Math.abs(focus.z - e.isl.cz)) - e.isl.shore;
        e.group.visible = d < islCull;
      }
    }
    if (state.bridges) {
      for (const br of state.bridges) {
        if (!br.group) continue;
        let d;
        if (br.axis === 'x') {
          const cx = U.clamp(focus.x, br.x0, br.x1);
          d = Math.hypot(focus.x - cx, focus.z - br.z);
        } else {
          const cz = U.clamp(focus.z, br.z0, br.z1);
          d = Math.hypot(focus.x - br.x, focus.z - cz);
        }
        br.group.visible = d < islCull;
      }
    }

    // إخفاء أحياء المدينة البعيدة (خلف الضباب) لتوفير الأداء
    const fogCull = state.scene.fog ? state.scene.fog.far * 1.06 : 900;
    const qf = state.quality && state.quality.name === 'low' ? 0.62
             : state.quality && state.quality.name === 'medium' ? 0.82 : 1;
    for (const ch of state.chunks) {
      const c = ch.userData.center;
      const d = Math.hypot(c.x - focus.x, c.z - focus.z) - ch.userData.radius;
      ch.visible = d < Math.min(fogCull, ch.userData.cull * qf);
    }
  }

  return { CFG, TEX, state, build, update, groundHeight, onRoad, inBounds, queryColliders,
           snapToRoad, nearestSpawn, randomRoadPoint, setTimeOfDay, refreshEnv, canvasTex, PRESETS,
           isWater, distToWater, onSand, islandAt, islandById, nearestIsland, bridgeAt, BRIDGES,
           setUnderwater, placeReef, setSeason };
})();
