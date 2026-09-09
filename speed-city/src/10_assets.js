/* ============================================================================
   SPEED CITY — تحميل النماذج ثلاثية الأبعاد وتوحيد مقاساتها
   كل النماذج تُوحَّد بحيث: المركز عند (0,0)، القاعدة عند y=0، والاتجاه الأمامي +Z
   ========================================================================== */
SC.assets = (function () {
  const models = {};      // key -> { root, size, box }
  let loader = null;

  function getLoader() {
    if (!loader) {
      loader = new THREE.GLTFLoader();
      if (THREE.MeshoptDecoder) loader.setMeshoptDecoder(THREE.MeshoptDecoder);
    }
    return loader;
  }

  /* base64 -> ArrayBuffer (بدون شبكة، يعمل من ملف محلي) */
  function b64ToBuffer(b64) {
    const clean = b64.replace(/[\s]/g, '');
    const bin = atob(clean);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  function parseBuffer(buf) {
    return new Promise((res, rej) => getLoader().parse(buf, '', (g) => res(g), rej));
  }

  function fetchBuffer(url) {
    return fetch(url).then((r) => {
      if (!r.ok) throw new Error('تعذّر تحميل ' + url + ' (' + r.status + ')');
      return r.arrayBuffer();
    });
  }

  /* ---------------------------------------------------------------------- */
  /* إصلاح الخامات: ظلال، حدة النسيج، تحويل الخامات غير المضاءة إلى PBR      */
  function fixMaterials(root, opts) {
    opts = opts || {};
    const seen = new Set();
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = opts.cast !== false;
      o.receiveShadow = opts.receive !== false;
      o.frustumCulled = true;
      /* لا نغيّر نوع الخامات إطلاقاً: كل نموذج يظهر بألوانه الأصلية */
      const list = Array.isArray(o.material) ? o.material : [o.material];
      list.forEach((m) => {
        if (!m || seen.has(m.uuid)) return;
        seen.add(m.uuid);
        if (m.map) { m.map.anisotropy = 8; m.map.colorSpace = THREE.SRGBColorSpace; }
        if (m.envMapIntensity !== undefined) m.envMapIntensity = opts.env != null ? opts.env : 1.0;
        // الزجاج الشفاف مكلف جداً على الهاتف: نستبدله بشفافية بسيطة
        if (m.transmission !== undefined && m.transmission > 0) {
          m.transmission = 0; m.transparent = true;
          m.opacity = Math.min(m.opacity, 0.42); m.roughness = Math.min(m.roughness, 0.12);
          m.metalness = Math.max(m.metalness, 0.1); m.depthWrite = false;
        }
        m.shadowSide = THREE.FrontSide;
      });
    });
  }

  /* ---------------------------------------------------------------------- */
  /* توحيد النموذج داخل مجموعة مرجعية:
     - يدور بمقدار yaw ثم يُقاس، فيوضع مركزه أفقياً على المحور وقاعدته على الأرض
     - إن حُدّد length: يُقاس الطول على محور Z، أو height/width بدلاً منه       */
  function normalize(gltfScene, cfg) {
    cfg = cfg || {};
    const inner = new THREE.Group();
    inner.add(gltfScene);
    if (cfg.yaw) inner.rotation.y = cfg.yaw;
    if (cfg.pitch) inner.rotation.x = cfg.pitch;
    inner.updateMatrixWorld(true);

    let box = new THREE.Box3().setFromObject(inner);
    let size = box.getSize(new THREE.Vector3());

    let s = 1;
    if (cfg.length) s = cfg.length / size.z;
    else if (cfg.width) s = cfg.width / size.x;
    else if (cfg.height) s = cfg.height / size.y;
    else if (cfg.scale) s = cfg.scale;

    const root = new THREE.Group();
    root.name = cfg.name || 'model';
    root.add(inner);
    root.scale.setScalar(s);
    root.updateMatrixWorld(true);

    box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    // إزاحة داخلية لجعل المركز على (0,*,0) والقاعدة على y=0
    inner.position.set(-center.x / s, -box.min.y / s, -center.z / s);
    if (cfg.offset) inner.position.add(new THREE.Vector3(cfg.offset[0] / s, cfg.offset[1] / s, cfg.offset[2] / s));
    root.updateMatrixWorld(true);

    box = new THREE.Box3().setFromObject(root);
    size = box.getSize(new THREE.Vector3());
    return { root, box, size };
  }

  /* ---------------------------------------------------------------------- */
  /* تحميل مجموعة نماذج. sources = { key: {data|url, ...cfg} }              */
  async function loadAll(sources, onProgress) {
    const keys = Object.keys(sources);
    let done = 0;
    for (const key of keys) {
      const cfg = sources[key];
      if (onProgress) onProgress(done / keys.length, cfg.label || key);
      const buf = cfg.data ? b64ToBuffer(cfg.data) : await fetchBuffer(cfg.url);
      const gltf = await parseBuffer(buf);
      fixMaterials(gltf.scene, cfg);
      const m = normalize(gltf.scene, Object.assign({ name: key }, cfg));
      m.cfg = cfg;
      models[key] = m;
      done++;
      if (onProgress) onProgress(done / keys.length, cfg.label || key);
      await new Promise((r) => setTimeout(r, 0)); // إفساح المجال لتحديث شاشة التحميل
    }
    return models;
  }

  const get = (key) => models[key];
  const clone = (key) => {
    const m = models[key];
    if (!m) throw new Error('نموذج غير محمّل: ' + key);
    const c = m.root.clone(true);
    c.userData.size = m.size.clone();
    return c;
  };

  /* ---------------------------------------------------------------------- */
  /* دمج شبكات النموذج حسب الخامة: يقلّل عدد رسمات الإطار بشكل كبير
     (بعض النماذج تحوي أكثر من مئة شبكة صغيرة تشترك في نفس الخامة)          */
  function bakedParts(key) {
    const m = models[key];
    if (!m) return [];
    if (m._parts) return m._parts;
    m.root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(m.root.matrixWorld).invert();
    const groups = new Map();

    m.root.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      if (Array.isArray(o.material)) { groups.set('multi_' + o.id, { mat: o.material, single: o }); return; }
      const local = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      const nrm = new THREE.Matrix3().getNormalMatrix(local);
      const g = o.geometry;
      const pos = g.getAttribute('position');
      const nor = g.getAttribute('normal');
      const uv = g.getAttribute('uv');
      const idx = g.getIndex();
      const key2 = o.material.uuid;
      let acc = groups.get(key2);
      if (!acc) { acc = { mat: o.material, P: [], N: [], T: [], I: [], base: 0 }; groups.set(key2, acc); }

      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(local);
        acc.P.push(v.x, v.y, v.z);
        if (nor) { v.set(nor.getX(i), nor.getY(i), nor.getZ(i)).applyMatrix3(nrm).normalize(); acc.N.push(v.x, v.y, v.z); }
        else acc.N.push(0, 1, 0);
        acc.T.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
      }
      if (idx) for (let i = 0; i < idx.count; i++) acc.I.push(idx.getX(i) + acc.base);
      else for (let i = 0; i < pos.count; i++) acc.I.push(i + acc.base);
      acc.base += pos.count;
    });

    const parts = [];
    groups.forEach((acc) => {
      if (acc.single) {                       // شبكة متعدّدة الخامات: تُترك كما هي
        const local = new THREE.Matrix4().multiplyMatrices(inv, acc.single.matrixWorld);
        parts.push({ geo: acc.single.geometry, mat: acc.mat, local });
        return;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(acc.P), 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(acc.N), 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(acc.T), 2));
      geo.setIndex(acc.base > 65535
        ? new THREE.BufferAttribute(new Uint32Array(acc.I), 1)
        : new THREE.BufferAttribute(new Uint16Array(acc.I), 1));
      geo.computeBoundingSphere();
      parts.push({ geo, mat: acc.mat, local: new THREE.Matrix4() });
    });
    m._parts = parts;
    return parts;
  }

  /* بناء InstancedMesh من نموذج موحّد: رسمة واحدة لكل خامة بدل مئات النسخ  */
  function buildInstanced(key, matrices, opts) {
    opts = opts || {};
    const m = models[key];
    const group = new THREE.Group();
    if (!m || !matrices.length) return group;
    const parts = bakedParts(key);

    const tmp = new THREE.Matrix4();
    for (const p of parts) {
      const im = new THREE.InstancedMesh(p.geo, p.mat, matrices.length);
      for (let i = 0; i < matrices.length; i++) {
        // مصفوفة النسخة = وضع المبنى في المدينة × مصفوفة الجزء داخل النموذج
        tmp.multiplyMatrices(matrices[i], p.local);
        im.setMatrixAt(i, tmp);
      }
      im.instanceMatrix.needsUpdate = true;
      if (opts.tints) {
        for (let i = 0; i < opts.tints.length; i++) im.setColorAt(i, opts.tints[i]);
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
      }
      im.castShadow = opts.cast !== false;
      im.receiveShadow = opts.receive !== false;
      im.computeBoundingSphere();
      im.matrixAutoUpdate = false;
      group.add(im);
    }
    return group;
  }

  /* ---------------------------------------------------------------------- */
  /* صورة مصغّرة للمركبة تُعرض في المتجر (تُرسم مرّة واحدة عند الإقلاع)      */
  function renderThumb(renderer, key, w, h) {
    w = w || 440; h = h || 250;
    const m = models[key];
    if (!m) return null;
    const scene = new THREE.Scene();
    const obj = m.root.clone(true);
    scene.add(obj);
    scene.add(new THREE.HemisphereLight(0xdfeaff, 0x30343c, 2.0));
    const dl = new THREE.DirectionalLight(0xfff4e0, 2.6);
    dl.position.set(4, 7, 5);
    scene.add(dl);
    const rim = new THREE.DirectionalLight(0x86b8ff, 1.5);
    rim.position.set(-5, 3, -4);
    scene.add(rim);
    if (SC.world && SC.world.state && SC.world.state.envRT) scene.environment = SC.world.state.envRT.texture;

    const size = m.size;
    const r = Math.max(size.x, size.z);
    const cam = new THREE.PerspectiveCamera(32, w / h, 0.1, 200);
    cam.position.set(r * 0.95, size.y * 0.95 + r * 0.30, r * 1.15);
    cam.lookAt(0, size.y * 0.42, 0);

    const rt = new THREE.WebGLRenderTarget(w, h, { samples: 4 });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    const prevRT = renderer.getRenderTarget();
    const prevAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(rt);
    renderer.setClearAlpha(0);
    renderer.clear(true, true, true);
    renderer.render(scene, cam);

    const buf = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
    renderer.setRenderTarget(prevRT);
    renderer.setClearAlpha(prevAlpha);
    rt.dispose();

    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {                      // قلب المحور الرأسي
      const src = (h - 1 - y) * w * 4, dst = y * w * 4;
      img.data.set(buf.subarray(src, src + w * 4), dst);
    }
    ctx.putImageData(img, 0, 0);
    m.thumb = cv.toDataURL('image/png');
    return m.thumb;
  }

  return { loadAll, get, clone, models, normalize, fixMaterials, buildInstanced, bakedParts,
           b64ToBuffer, parseBuffer, renderThumb };
})();
