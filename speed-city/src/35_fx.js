/* ============================================================================
   SPEED CITY — المؤثرات: آثار الإطارات، الدخان، الشرر، وعلامات الأهداف
   ========================================================================== */
SC.fx = (function () {
  const U = SC.util;
  let skid = null, particles = null, scene = null;

  /* --------------------------- آثار الإطارات ---------------------------- */
  function initSkid(sc, capacity) {
    const N = capacity || 900;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 6 * 3);        // مربّعان لكل أثر (6 رؤوس)
    const col = new Float32Array(N * 6 * 4);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false, opacity: 1
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    sc.add(mesh);
    skid = { mesh, geo, pos, col, N, head: 0, used: 0, born: new Float32Array(N), last: new Map() };
  }

  /* يضيف قطعة أثر بين الموضع السابق والحالي لعجلة ما */
  function addSkid(id, x, z, dirX, dirZ, width, strength, t) {
    if (!skid) return;
    const prev = skid.last.get(id);
    skid.last.set(id, { x, z });
    if (!prev) return;
    const dx = x - prev.x, dz = z - prev.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.12 || len > 6) return;

    const nx = -dz / len * width * 0.5, nz = dx / len * width * 0.5;
    const y = SC.world.groundHeight(x, z) + 0.021;
    const i = skid.head;
    const o = i * 18;
    const P = skid.pos;
    const ax = prev.x, az = prev.z;
    // مثلثان يشكّلان شريط الأثر
    const verts = [
      ax + nx, y, az + nz, ax - nx, y, az - nz, x + nx, y, z + nz,
      ax - nx, y, az - nz, x - nx, y, z - nz, x + nx, y, z + nz
    ];
    for (let k = 0; k < 18; k++) P[o + k] = verts[k];
    const a = U.clamp(strength, 0, 1) * 0.55;
    for (let v = 0; v < 6; v++) {
      const c = i * 24 + v * 4;
      skid.col[c] = 0.05; skid.col[c + 1] = 0.045; skid.col[c + 2] = 0.05; skid.col[c + 3] = a;
    }
    skid.born[i] = t;
    skid.head = (i + 1) % skid.N;
    skid.used = Math.min(skid.used + 1, skid.N);
    skid.geo.setDrawRange(0, skid.used * 6);
    skid.geo.attributes.position.needsUpdate = true;
    skid.geo.attributes.color.needsUpdate = true;
  }
  function endSkid(id) { if (skid) skid.last.delete(id); }

  /* تلاشي الآثار القديمة (يُستدعى بمعدّل منخفض) */
  function fadeSkid(t) {
    if (!skid || !skid.used) return;
    const LIFE = 26;
    let dirty = false;
    for (let i = 0; i < skid.used; i++) {
      const age = t - skid.born[i];
      if (age < 0 || age > LIFE + 4) continue;
      const f = U.clamp(1 - age / LIFE, 0, 1);
      for (let v = 0; v < 6; v++) {
        const c = i * 24 + v * 4;
        const target = skid.col[c + 3];
        if (target > 0) { skid.col[c + 3] = Math.min(target, 0.55 * f); dirty = true; }
      }
    }
    if (dirty) skid.geo.attributes.color.needsUpdate = true;
  }

  /* ------------------------------- الجزيئات ----------------------------- */
  const P_VS = `
    attribute float size; attribute float alpha; attribute vec3 pcolor;
    varying float vAlpha; varying vec3 vCol;
    void main(){
      vAlpha = alpha; vCol = pcolor;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (300.0 / max(1.0, -mv.z));
      gl_Position = projectionMatrix * mv;
    }`;
  const P_FS = `
    uniform sampler2D map; varying float vAlpha; varying vec3 vCol;
    void main(){
      vec4 t = texture2D(map, gl_PointCoord);
      gl_FragColor = vec4(vCol, t.a * vAlpha);
      if (gl_FragColor.a < 0.01) discard;
    }`;

  function initParticles(sc, capacity) {
    const N = capacity || 420;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const alpha = new Float32Array(N);
    const pcolor = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) pos[i * 3 + 1] = -999;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('pcolor', new THREE.BufferAttribute(pcolor, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      vertexShader: P_VS, fragmentShader: P_FS,
      uniforms: { map: { value: SC.world.TEX.smoke } },
      transparent: true, depthWrite: false
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 5;
    sc.add(pts);
    particles = {
      pts, geo, pos, size, alpha, pcolor, N, head: 0,
      vel: new Float32Array(N * 3), life: new Float32Array(N), max: new Float32Array(N),
      grow: new Float32Array(N), fade: new Float32Array(N)
    };
  }

  function emit(x, y, z, vx, vy, vz, opt) {
    if (!particles) return;
    const i = particles.head;
    particles.head = (i + 1) % particles.N;
    particles.pos[i * 3] = x; particles.pos[i * 3 + 1] = y; particles.pos[i * 3 + 2] = z;
    particles.vel[i * 3] = vx; particles.vel[i * 3 + 1] = vy; particles.vel[i * 3 + 2] = vz;
    particles.life[i] = 0;
    particles.max[i] = opt.life || 1.1;
    particles.size[i] = opt.size || 1.2;
    particles.grow[i] = opt.grow == null ? 2.2 : opt.grow;
    particles.alpha[i] = opt.alpha == null ? 0.5 : opt.alpha;
    particles.fade[i] = opt.alpha == null ? 0.5 : opt.alpha;
    const c = opt.color || [0.85, 0.85, 0.85];
    particles.pcolor[i * 3] = c[0]; particles.pcolor[i * 3 + 1] = c[1]; particles.pcolor[i * 3 + 2] = c[2];
  }

  const smoke = (x, y, z, str) => emit(
    x, y + 0.1, z, (Math.random() - 0.5) * 1.4, 0.5 + Math.random() * 1.1, (Math.random() - 0.5) * 1.4,
    { life: 1.0 + Math.random() * 0.8, size: 1.1, grow: 3.4, alpha: 0.16 + str * 0.24, color: [0.82, 0.82, 0.84] }
  );
  const spark = (x, y, z, dx, dz) => emit(
    x, y, z, dx * 3 + (Math.random() - 0.5) * 5, 1.5 + Math.random() * 3.5, dz * 3 + (Math.random() - 0.5) * 5,
    { life: 0.45, size: 0.35, grow: -0.4, alpha: 0.95, color: [1.0, 0.72, 0.25] }
  );
  const dust = (x, y, z) => emit(
    x, y, z, (Math.random() - 0.5) * 2, 0.6 + Math.random(), (Math.random() - 0.5) * 2,
    { life: 0.9, size: 1.0, grow: 2.6, alpha: 0.22, color: [0.76, 0.7, 0.58] }
  );

  function updateParticles(dt) {
    if (!particles) return;
    const p = particles;
    for (let i = 0; i < p.N; i++) {
      if (p.alpha[i] <= 0) continue;
      p.life[i] += dt;
      const t = p.life[i] / p.max[i];
      if (t >= 1) { p.alpha[i] = 0; p.pos[i * 3 + 1] = -999; continue; }
      p.vel[i * 3 + 1] -= 2.2 * dt;
      p.pos[i * 3] += p.vel[i * 3] * dt;
      p.pos[i * 3 + 1] += p.vel[i * 3 + 1] * dt;
      p.pos[i * 3 + 2] += p.vel[i * 3 + 2] * dt;
      p.vel[i * 3] *= 0.97; p.vel[i * 3 + 2] *= 0.97;
      p.size[i] += p.grow[i] * dt;
      p.alpha[i] = p.fade[i] * (1 - t * t);
    }
    p.geo.attributes.position.needsUpdate = true;
    p.geo.attributes.size.needsUpdate = true;
    p.geo.attributes.alpha.needsUpdate = true;
    p.geo.attributes.pcolor.needsUpdate = true;
  }

  /* ---------------------------- علامة الهدف ----------------------------- */
  function makeMarker(color, radius) {
    const g = new THREE.Group();
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 9, 26, 1, true),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.30, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending
      })
    );
    cyl.position.y = 4.5;
    g.add(cyl);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.82, radius, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08;
    g.add(ring);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, 60, 10, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    beam.position.y = 30;
    g.add(beam);
    g.userData.spin = ring;
    g.renderOrder = 4;
    return g;
  }

  function init(sc) {
    scene = sc;
    initSkid(sc, SC.quality.skidCount);
    initParticles(sc, SC.quality.particles);
  }
  function clearSkid() {
    if (!skid) return;
    skid.used = 0; skid.head = 0; skid.last.clear();
    skid.geo.setDrawRange(0, 0);
  }

  return { init, addSkid, endSkid, fadeSkid, clearSkid, emit, smoke, spark, dust, updateParticles, makeMarker };
})();
