/* ============================================================================
   SPEED CITY — بناء المدينة: الشوارع، الأرصفة، الإنارة، والمباني
   المباني كلها من النماذج المرفقة فقط (لا مبانٍ مولّدة برمجياً)
   ========================================================================== */
SC.world = (function () {
  const U = SC.util;

  /* ------------------------- إعدادات المدينة ---------------------------- */
  const CFG = {
    blocks: 16,       // عدد المربّعات السكنية في كل اتجاه
    pitch: 176,       // المسافة بين محاور الشوارع (م)
    road: 22,         // عرض الشارع (م)
    walk: 6,          // عرض الرصيف (م)
    curb: 0.16,       // ارتفاع الرصيف (م)
    beach: 190,       // عرض الشاطئ الرملي حول المدينة (م)
    seed: 20250909
  };
  CFG.span = CFG.blocks * CFG.pitch;         // طول ضلع المدينة (≈ 2.8 كم)
  CFG.half = CFG.span / 2;
  CFG.shore = CFG.half + CFG.road / 2 + CFG.beach;   // حدّ الماء

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
    sky.scale.setScalar(Math.max(1200, (SC.quality ? SC.quality.far : 1000) * 3.4));
    sky.frustumCulled = false;
    sky.renderOrder = -1000;
    scene.add(sky);
    return sky;
  }

  /* ضبط وقت اليوم: يعيد ضبط السماء، الشمس، الضباب والإضاءة */
  function setTimeOfDay(name) {
    const p = PRESETS[name] || PRESETS.day;
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
    if (state.lampGlow) state.lampGlow.visible = state.isNight;
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

  /* ارتفاع الأرض عند نقطة (الرصيف أعلى من الشارع) */
  function groundHeight(x, z) {
    for (const b of state.blockRects) {
      if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return CFG.curb;
    }
    return 0;
  }
  const onRoad = (x, z) => groundHeight(x, z) === 0;

  /* هل النقطة داخل حدود المدينة (بدون الشاطئ) */
  function inBounds(x, z) {
    const lim = CFG.half + CFG.road * 0.5 + 8;
    return x > -lim && x < lim && z > -lim && z < lim;
  }
  /* الماء يبدأ بعد الشاطئ */
  const isWater = (x, z) => Math.max(Math.abs(x), Math.abs(z)) > CFG.shore;
  /* المسافة إلى خطّ الماء (سالبة داخل الماء) */
  const distToWater = (x, z) => CFG.shore - Math.max(Math.abs(x), Math.abs(z));
  const onSand = (x, z) => {
    const d = Math.max(Math.abs(x), Math.abs(z));
    return d > CFG.half + CFG.road * 0.5 && d <= CFG.shore;
  };
  /* أقرب مركز شارع (يُستخدم للولادة وطُرق الذكاء الاصطناعي) */
  function snapToRoad(x, z) {
    const P = CFG.pitch, H = CFG.half;
    const gx = Math.round((x + H) / P) * P - H;
    const gz = Math.round((z + H) / P) * P - H;
    return Math.abs(x - gx) < Math.abs(z - gz)
      ? { x: gx, z: U.clamp(z, -H, H), axis: 'z' }
      : { x: U.clamp(x, -H, H), z: gz, axis: 'x' };
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
    state.chunks.length = 0;

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
    state.sky.scale.setScalar(Math.max(1200, quality.far * 3.4));

    /* --- الأرض: أسفلت المدينة، ثم شاطئ رملي، ثم البحر --- */
    const S = CFG.span, HALF = CFG.half, MARGIN = CFG.road;
    const groundMat = new THREE.MeshStandardMaterial({
      map: TEX.asphalt, roughness: 0.93, metalness: 0.0, color: 0xffffff
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(S + MARGIN * 2, S + MARGIN * 2), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'ground';
    G.add(ground);

    const sandMat = new THREE.MeshStandardMaterial({ map: TEX.sand, roughness: 1, metalness: 0 });
    const inner = S + MARGIN * 2, outer = CFG.shore * 2;
    const B = (CFG.shore * 2 - inner) / 2;
    [[0, (inner + B) / 2, outer, B], [0, -(inner + B) / 2, outer, B],
     [(inner + B) / 2, 0, B, inner], [-(inner + B) / 2, 0, B, inner]].forEach(([x, z, sx, sz]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), sandMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, -0.02, z);
      m.receiveShadow = true;
      G.add(m);
    });

    /* البحر: حلقة حول الشاطئ فقط (لا يمتدّ تحت المدينة حتى لا يتداخل مع الأسفلت) */
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x246e91, roughness: 0.08, metalness: 0.62,
      normalMap: TEX.waterN, normalScale: new THREE.Vector2(0.85, 0.85)
    });
    const sea = new THREE.Group();
    sea.name = 'water';
    const wIn = CFG.shore * 2, wOut = 24000, WB = (wOut - wIn) / 2;
    [[0, (wIn + WB) / 2, wOut, WB], [0, -(wIn + WB) / 2, wOut, WB],
     [(wIn + WB) / 2, 0, WB, wIn], [-(wIn + WB) / 2, 0, WB, wIn]].forEach(([x, z, sx, sz]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), waterMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, -0.35, z);
      G.add(m);
      sea.add(m.clone());       // نسخة للمرجع فقط
    });
    state.water = { material: waterMat, visible: true };

    /* --- المربعات السكنية: رصيف + سطح داخلي --- */
    const NB = CFG.blocks, P = CFG.pitch, R = CFG.road, W = CFG.walk;
    const blockSize = P - R;                       // ضلع المربّع مع الرصيف
    const innerSize = blockSize - W * 2;           // المساحة القابلة للبناء
    const slabGeo = new THREE.BoxGeometry(blockSize, CFG.curb, blockSize);
    const slabMat = new THREE.MeshStandardMaterial({ map: TEX.walk, roughness: 0.9, metalness: 0 });
    slabMat.map.repeat.set(blockSize / 4, blockSize / 4);
    const slabs = new THREE.InstancedMesh(slabGeo, slabMat, NB * NB);
    slabs.receiveShadow = true; slabs.castShadow = false;

    const lotGeo = new THREE.PlaneGeometry(innerSize, innerSize);
    const lotMats = {
      grass: new THREE.MeshStandardMaterial({ map: TEX.grass, roughness: 1, metalness: 0 }),
      lot: new THREE.MeshStandardMaterial({ map: TEX.lot, roughness: 0.95, metalness: 0 })
    };
    const lotsGrass = [], lotsPark = [];

    const mtx = new THREE.Matrix4(), qid = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    const blocks = [];
    let n = 0;
    for (let i = 0; i < NB; i++) {
      for (let j = 0; j < NB; j++) {
        const cx = -HALF + P * i + P / 2;
        const cz = -HALF + P * j + P / 2;
        mtx.compose(new THREE.Vector3(cx, CFG.curb / 2, cz), qid, one);
        slabs.setMatrixAt(n++, mtx);
        const rect = { x0: cx - blockSize / 2, x1: cx + blockSize / 2, z0: cz - blockSize / 2, z1: cz + blockSize / 2, cx, cz };
        state.blockRects.push(rect);
        // نوع المربّع: مركز المدينة مبانٍ كبيرة، الأطراف سكنية، وبعضها ساحات
        const dc = Math.max(Math.abs(i - (NB - 1) / 2), Math.abs(j - (NB - 1) / 2));
        let kind = dc <= 1 ? 'downtown' : (dc >= 2.5 ? 'suburb' : 'mixed');
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

    /* --- خطوط الشارع --- */
    buildRoadMarkings(G, rnd);

    /* --- المباني (من النماذج المرفقة فقط) --- */
    placeBuildings(G, blocks, rnd);

    /* --- الأعمدة والإنارة والحواجز --- */
    buildProps(G, rnd, quality);


    buildGrid();
    buildSpawns();

    /* --- خريطة البيئة للانعكاسات على السيارات --- */
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    setTimeOfDay('day');
    refreshEnv(renderer, pmrem);
    state.pmrem = pmrem;

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

  /* --------------------------- خطوط الطرق -------------------------------- */
  function buildRoadMarkings(G, rnd) {
    const NB = CFG.blocks, P = CFG.pitch, HALF = CFG.half, R = CFG.road;
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
        m.compose(new THREE.Vector3(x, y, z), q, one);
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
  function buildProps(G, rnd, quality) {
    const NB = CFG.blocks, P = CFG.pitch, HALF = CFG.half, R = CFG.road;

    /* عمود إنارة: عمود + ذراع + مصباح */
    const poleGeo = new THREE.CylinderGeometry(0.13, 0.17, 8.4, 6);
    const armGeo = new THREE.BoxGeometry(1.9, 0.16, 0.16);
    const headGeo = new THREE.BoxGeometry(1.1, 0.22, 0.5);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x4c5258, roughness: 0.6, metalness: 0.55 });
    state.lampMat = new THREE.MeshStandardMaterial({
      color: 0x9aa3ad, emissive: 0xffe6ac, emissiveIntensity: 0, roughness: 0.35, metalness: 0.2
    });

    const lampPos = [];
    for (let i = 0; i <= NB; i++) {
      const line = -HALF + i * P;
      for (let s = 0; s < NB * 2; s++) {
        const t = -HALF + s * (P / 2) + P / 4;
        lampPos.push([line - R / 2 - 1.6, t, 1]);     // على يمين الشارع العمودي
        lampPos.push([t, line + R / 2 + 1.6, 2]);     // على الشارع الأفقي
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
    const glow = new THREE.InstancedMesh(glowGeo, glowMat, state.lamps.length);
    state.lamps.forEach(([x, y, z], i) => {
      m.compose(new THREE.Vector3(x, 0.06, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), one);
      glow.setMatrixAt(i, m);
    });
    glow.instanceMatrix.needsUpdate = true; glow.computeBoundingSphere();
    glow.visible = false; glow.renderOrder = 3;
    state.lampGlow = glow;
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
  function buildSpawns() {
    const NB = CFG.blocks, P = CFG.pitch, HALF = CFG.half;
    for (let i = 0; i <= NB; i++) {
      for (let s = 0; s < NB; s++) {
        const line = -HALF + i * P;
        const mid = -HALF + s * P + P / 2;
        state.spawns.push({ x: line - 6, z: mid, yaw: 0 });          // يمين الشارع
        state.spawns.push({ x: mid, z: line + 6, yaw: Math.PI / 2 });
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
  /* نقطة عشوائية على الشارع (لمهمّات التوصيل والسباقات) */
  function randomRoadPoint(rnd) {
    const r = rnd || Math.random;
    const NB = CFG.blocks, P = CFG.pitch, HALF = CFG.half;
    const i = Math.floor(r() * (NB + 1));
    const line = -HALF + i * P;
    const t = -HALF + r() * CFG.span;
    return r() < 0.5 ? { x: line, z: t } : { x: t, z: line };
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
    if (state.water && state.water.material) {
      const n = state.water.material.normalMap;
      n.offset.x += dt * 0.012;
      n.offset.y += dt * 0.007;
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
           isWater, distToWater, onSand };
})();
