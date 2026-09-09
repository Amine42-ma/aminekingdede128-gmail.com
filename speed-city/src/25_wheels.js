/* ============================================================================
   SPEED CITY — استخراج العجلات من النموذج
   النماذج الجاهزة تدمج العجلات الأربع في شبكة واحدة، فنقسّمها إلى عجلات
   مستقلة (يمين/يسار × أمام/خلف) لتدور مع السرعة وتنعطف مع المقود.
   ========================================================================== */
SC.wheels = (function () {

  /* هل هذه الشبكة مرشّحة لتكون عجلات؟ (منخفضة وقصيرة مقارنة بالمركبة) */
  function isWheelMesh(mesh, box, modelBox) {
    const H = modelBox.max.y - modelBox.min.y;
    const h = box.max.y - box.min.y;
    const name = ((mesh.name || '') + ' ' + ((mesh.material && mesh.material.name) || '')).toLowerCase();
    if (/glass|window|body|paint|chassis|interior|seat/.test(name)) return false;
    const named = /tire|tyre|wheel|rim|brake|break|hub/.test(name);
    const lowAndShort = (box.min.y - modelBox.min.y) < H * 0.22 && h < H * 0.45;
    return named ? (box.min.y - modelBox.min.y) < H * 0.42 && h < H * 0.55 : lowAndShort;
  }

  /* تجميع المثلثات في عناقيد: يمين/يسار ثم فصل على محور الطول */
  function clusterTriangles(centroids, gap) {
    const sides = [[], []];
    centroids.forEach((c, i) => sides[c.x >= 0 ? 0 : 1].push(i));
    const clusters = [];
    for (const side of sides) {
      if (!side.length) continue;
      side.sort((a, b) => centroids[a].z - centroids[b].z);
      let cur = [side[0]];
      for (let k = 1; k < side.length; k++) {
        const prev = centroids[side[k - 1]].z, now = centroids[side[k]].z;
        if (now - prev > gap) { clusters.push(cur); cur = []; }
        cur.push(side[k]);
      }
      if (cur.length) clusters.push(cur);
    }
    return clusters;
  }

  /* يبني هندسة جديدة من مجموعة مثلثات */
  function buildGeometry(src, triIdx) {
    const pos = src.getAttribute('position');
    const nor = src.getAttribute('normal');
    const uv = src.getAttribute('uv');
    const P = new Float32Array(triIdx.length * 9);
    const N = nor ? new Float32Array(triIdx.length * 9) : null;
    const T = uv ? new Float32Array(triIdx.length * 6) : null;
    triIdx.forEach((t, k) => {
      for (let v = 0; v < 3; v++) {
        const i = t * 3 + v, o = k * 9 + v * 3;
        P[o] = pos.getX(i); P[o + 1] = pos.getY(i); P[o + 2] = pos.getZ(i);
        if (N) { N[o] = nor.getX(i); N[o + 1] = nor.getY(i); N[o + 2] = nor.getZ(i); }
        if (T) { const p = k * 6 + v * 2; T[p] = uv.getX(i); T[p + 1] = uv.getY(i); }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    if (N) g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    if (T) g.setAttribute('uv', new THREE.BufferAttribute(T, 2));
    return g;
  }

  /* ----------------------------------------------------------------------
     يستخرج العجلات من نسخة نموذج (root) ويعيد قائمة كائنات:
     { pivot, front, side, radius }  — pivot يدور حول محور المحور الأفقي
     ---------------------------------------------------------------------- */
  function extract(root) {
    const out = [];
    const dbg = { bail: null, cands: [], groups: [] };
    extract.debug = dbg;
    try {
      root.updateMatrixWorld(true);
      const modelBox = new THREE.Box3().setFromObject(root);
      const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();
      const meshes = [];
      root.traverse((o) => { if (o.isMesh) meshes.push(o); });

      const groups = new Map();   // مفتاح العنقود -> { tris:[{mesh,tri}], box }
      for (const mesh of meshes) {
        const box = new THREE.Box3().setFromObject(mesh);
        if (!isWheelMesh(mesh, box, modelBox)) continue;

        const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
        const pos = geo.getAttribute('position');
        const triCount = pos.count / 3;
        if (triCount < 40 || triCount > 40000) continue;

        // المقاسات بالأمتار: نعمل في فضاء العالم ثم نعود لفضاء المحور
        const toModel = mesh.matrixWorld;
        const centroids = new Array(triCount);
        const v = new THREE.Vector3();
        for (let t = 0; t < triCount; t++) {
          let x = 0, y = 0, z = 0;
          for (let k = 0; k < 3; k++) {
            const i = t * 3 + k;
            x += pos.getX(i); y += pos.getY(i); z += pos.getZ(i);
          }
          v.set(x / 3, y / 3, z / 3).applyMatrix4(toModel);
          centroids[t] = { x: v.x, y: v.y, z: v.z };
        }
        const clusters = clusterTriangles(centroids, 0.35);
        dbg.cands.push({ mesh: mesh.name, clusters: clusters.length, tris: triCount });
        if (clusters.length < 2 || clusters.length > 8) continue;

        for (const cl of clusters) {
          let cx = 0, cz = 0, minY = 1e9, maxY = -1e9, minZ = 1e9, maxZ = -1e9;
          for (const t of cl) {
            const c = centroids[t];
            cx += c.x; cz += c.z;
            minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
            minZ = Math.min(minZ, c.z); maxZ = Math.max(maxZ, c.z);
          }
          cx /= cl.length; cz /= cl.length;
          // ندمج العنقود مع أقرب مجموعة موجودة (نفس العجلة من شبكات مختلفة)
          let key = null, bd = 0.75;
          groups.forEach((g2, k) => {
            const d = Math.hypot(g2.cx / g2.n - cx, g2.cz / g2.n - cz);
            if (d < bd) { bd = d; key = k; }
          });
          if (key === null) key = (cx >= 0 ? 'R' : 'L') + groups.size;
          let g = groups.get(key);
          if (!g) { g = { parts: [], cx: 0, cz: 0, n: 0, minY: 1e9, maxY: -1e9, minZ: 1e9, maxZ: -1e9 }; groups.set(key, g); }
          g.parts.push({ mesh, geo, tris: cl, toModel });
          g.cx += cx * cl.length; g.cz += cz * cl.length; g.n += cl.length;
          g.minY = Math.min(g.minY, minY); g.maxY = Math.max(g.maxY, maxY);
          g.minZ = Math.min(g.minZ, minZ); g.maxZ = Math.max(g.maxZ, maxZ);
        }
      }
      if (groups.size < 2) { dbg.bail = 'groups<2 (' + groups.size + ')'; return []; }

      // تحقّق من أنّ كل عنقود يشبه عجلة (ارتفاعه قريب من عمقه)
      const list = Array.from(groups.values());
      for (const g of list) {
        g.cx /= g.n; g.cz /= g.n;
        const h = g.maxY - g.minY, d = g.maxZ - g.minZ;
        if (h <= 0.03 || d <= 0.03) { dbg.bail = 'flat cluster h=' + h.toFixed(3) + ' d=' + d.toFixed(3); return []; }
        const ratio = h / d;
        dbg.groups.push({ cx: +g.cx.toFixed(2), cz: +g.cz.toFixed(2), h: +h.toFixed(2), d: +d.toFixed(2), ratio: +ratio.toFixed(2), parts: g.parts.length });
        if (ratio < 0.45 || ratio > 2.2) { dbg.bail = 'ratio ' + ratio.toFixed(2); return []; }
      }

      const zs = list.map((g) => g.cz);
      const zMin = Math.min(...zs), zMax = Math.max(...zs);
      if (zMax - zMin < 0.5) { dbg.bail = 'z spread ' + (zMax - zMin).toFixed(2); return []; }

      for (const g of list) {
        const pivot = new THREE.Group();
        const pivotWorld = new THREE.Vector3(g.cx, (g.minY + g.maxY) / 2, g.cz);
        pivot.position.copy(pivotWorld).applyMatrix4(rootInv);   // موضعه داخل النموذج
        root.add(pivot);
        root.updateMatrixWorld(true);
        const toPivot = new THREE.Matrix4().copy(pivot.matrixWorld).invert();

        for (const part of g.parts) {
          const geo = buildGeometry(part.geo, part.tris);
          // من فضاء الشبكة إلى فضاء العالم ثم إلى فضاء محور العجلة
          geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toPivot, part.mesh.matrixWorld));
          geo.computeVertexNormals();
          const m = new THREE.Mesh(geo, part.mesh.material);
          m.castShadow = part.mesh.castShadow;
          m.receiveShadow = false;
          pivot.add(m);
          // نخفي المثلثات الأصلية بحذفها من الشبكة القديمة
          part.mesh.userData._stripped = part.mesh.userData._stripped || [];
          part.mesh.userData._stripped.push(part.tris);
        }
        out.push({
          pivot,
          front: g.cz > (zMin + zMax) / 2,
          side: g.cx >= 0 ? 1 : -1,
          radius: Math.max(0.15, (g.maxY - g.minY) / 2),
          restY: pivotWorld.y
        });
      }

      // إزالة المثلثات المنقولة من الشبكات الأصلية
      const touched = new Set();
      root.traverse((o) => { if (o.isMesh && o.userData._stripped) touched.add(o); });
      for (const mesh of touched) {
        const keep = new Set();
        const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
        const total = geo.getAttribute('position').count / 3;
        const removed = new Set();
        mesh.userData._stripped.forEach((arr) => arr.forEach((t) => removed.add(t)));
        for (let t = 0; t < total; t++) if (!removed.has(t)) keep.add(t);
        if (keep.size === 0) { mesh.visible = false; continue; }
        mesh.geometry = buildGeometry(geo, Array.from(keep));
      }
      return out;
    } catch (e) {
      console.warn('تعذّر فصل العجلات:', e);
      return out;
    }
  }

  return { extract };
})();
