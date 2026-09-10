/* ============================================================================
   SPEED CITY — شخصية السائق/الراكب
   جسم مبني هندسياً بمفاصل حقيقية: كتفان ومرفقان ويدان تتبع المقود (IK)،
   وركبتان وقدمان، ورأس يلتفت مع المنعطف، وخوذة لراكب الدراجة.
   ========================================================================== */
SC.character = (function () {
  const U = SC.util;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const PALETTE = {
    skin:   0xd9a17a, skinDark: 0xc08a63,
    jacket: 0x24303f, jacket2: 0x1b2430,
    jeans:  0x2f3d5c, boots: 0x1a1a1c,
    glove:  0x2a2a2e, helmet: 0xe23b3b, visor: 0x101318,
    hair:   0x2b2119, shirt: 0xd8dde5
  };

  /* ذاكرة الأشكال: تُبنى مرّة واحدة وتُشارك بين كل الشخصيات */
  const GEO = {};
  function geo(key, make) {
    if (!GEO[key]) GEO[key] = make();
    return GEO[key];
  }

  function mat(color, rough, metal) {
    return new THREE.MeshStandardMaterial({
      color, roughness: rough == null ? 0.72 : rough, metalness: metal == null ? 0.05 : metal
    });
  }

  /* عظمة: كبسولة تتدلّى من المفصل نحو -Y */
  function boneGeo(r1, len, r2) {
    const g = new THREE.CapsuleGeometry(r1, len, 4, 10);
    g.translate(0, -len / 2 - r1, 0);
    if (r2 && r2 !== r1) {                      // تنعيم التدرّج (ساعد/ساق)
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const t = U.clamp(-y / (len + r1 * 2), 0, 1);
        const k = U.lerp(1, r2 / r1, t);
        pos.setX(i, pos.getX(i) * k);
        pos.setZ(i, pos.getZ(i) * k);
      }
      g.computeVertexNormals();
    }
    return g;
  }
  function bone(r1, len, material, r2) {
    const g = geo('bone' + r1 + '_' + len + '_' + (r2 || r1), () => boneGeo(r1, len, r2));
    const m = new THREE.Mesh(g, material);
    m.castShadow = true;
    return m;
  }

  function joint(parent, x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.order = 'YXZ';
    parent.add(g);
    return g;
  }

  /* ---------------------------------------------------------------------- */
  function create(opts) {
    opts = opts || {};
    const P = Object.assign({}, PALETTE, opts.colors || {});
    const M = {
      skin: mat(P.skin, 0.62), jacket: mat(P.jacket, 0.68), jacket2: mat(P.jacket2, 0.62),
      jeans: mat(P.jeans, 0.85), boots: mat(P.boots, 0.55, 0.1), glove: mat(P.glove, 0.6),
      helmet: mat(P.helmet, 0.28, 0.35), visor: new THREE.MeshStandardMaterial({
        color: P.visor, roughness: 0.08, metalness: 0.9
      }), hair: mat(P.hair, 0.8), shirt: mat(P.shirt, 0.75)
    };

    const root = new THREE.Group();
    root.name = 'driver';

    /* الحوض والجذع */
    const pelvis = joint(root, 0, 0, 0);
    const hips = bone(0.135, 0.10, M.jeans);
    hips.position.y = 0.10;
    hips.scale.set(1.25, 1, 0.95);
    pelvis.add(hips);

    const torso = joint(pelvis, 0, 0.06, 0);
    const chest = bone(0.148, 0.30, M.jacket);
    chest.position.y = 0.40;
    chest.scale.set(1.32, 1, 0.86);
    torso.add(chest);
    const collar = new THREE.Mesh(geo('collar', () => new THREE.CylinderGeometry(0.085, 0.10, 0.06, 12)), M.jacket2);
    collar.position.y = 0.415;
    torso.add(collar);
    /* سحّاب أمامي + حزام + شارة صدر */
    const zip = new THREE.Mesh(geo('zip', () => new THREE.BoxGeometry(0.022, 0.30, 0.015)), M.jacket2);
    zip.position.set(0, 0.28, 0.128);
    torso.add(zip);
    const belt = new THREE.Mesh(geo('belt', () => new THREE.BoxGeometry(0.30, 0.045, 0.185)), M.boots);
    belt.position.set(0, 0.075, 0);
    torso.add(belt);
    const badge = new THREE.Mesh(geo('badge', () => new THREE.BoxGeometry(0.055, 0.03, 0.012)),
      new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.35, metalness: 0.6 }));
    badge.position.set(0.075, 0.34, 0.126);
    torso.add(badge);

    /* الرأس */
    const neck = joint(torso, 0, 0.44, 0);
    const neckMesh = new THREE.Mesh(geo('neck', () => new THREE.CylinderGeometry(0.052, 0.058, 0.07, 10)), M.skin);
    neckMesh.position.y = 0.03;
    neck.add(neckMesh);
    const headPivot = joint(neck, 0, 0.075, 0);
    const head = new THREE.Group();
    headPivot.add(head);

    const skull = new THREE.Mesh(geo('skull', () => new THREE.SphereGeometry(0.098, 18, 14)), M.skin);
    skull.scale.set(0.95, 1.08, 1.0);
    skull.position.y = 0.075;
    skull.castShadow = true;
    head.add(skull);
    const jaw = new THREE.Mesh(geo('jaw', () => new THREE.SphereGeometry(0.072, 12, 10)), M.skin);
    jaw.scale.set(0.92, 0.8, 1.05);
    jaw.position.set(0, 0.028, 0.022);
    head.add(jaw);
    const nose = new THREE.Mesh(geo('nose', () => new THREE.ConeGeometry(0.021, 0.05, 8)), M.skin);
    nose.rotation.x = Math.PI / 2.1;
    nose.position.set(0, 0.062, 0.088);
    head.add(nose);
    [-1, 1].forEach((sx) => {
      const eye = new THREE.Mesh(geo('eye', () => new THREE.SphereGeometry(0.016, 10, 8)),
        new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.25 }));
      eye.position.set(sx * 0.035, 0.088, 0.079);
      head.add(eye);
      const brow = new THREE.Mesh(geo('brow', () => new THREE.BoxGeometry(0.034, 0.008, 0.012)), M.hair);
      brow.position.set(sx * 0.036, 0.108, 0.082);
      head.add(brow);
      const ear = new THREE.Mesh(geo('ear', () => new THREE.SphereGeometry(0.022, 8, 6)), M.skin);
      ear.scale.set(0.45, 1, 0.8);
      ear.position.set(sx * 0.094, 0.072, 0.0);
      head.add(ear);
    });

    const hair = new THREE.Mesh(geo('hair', () => new THREE.SphereGeometry(0.104, 16, 12,
      0, Math.PI * 2, 0, Math.PI * 0.58)), M.hair);
    hair.scale.set(0.98, 1.12, 1.02);
    hair.position.y = 0.078;
    head.add(hair);

    /* الخوذة (لراكب الدراجة) */
    const helmet = new THREE.Group();
    const shell = new THREE.Mesh(geo('shell', () => new THREE.SphereGeometry(0.132, 20, 16)), M.helmet);
    shell.scale.set(1, 1.04, 1.06);
    shell.position.y = 0.072;
    shell.castShadow = true;
    helmet.add(shell);
    const chin = new THREE.Mesh(geo('chin', () => new THREE.TorusGeometry(0.104, 0.036, 8, 18, Math.PI)), M.helmet);
    chin.rotation.set(Math.PI / 2, 0, 0);
    chin.position.set(0, 0.012, 0.012);
    helmet.add(chin);
    const visor = new THREE.Mesh(geo('visor', () => new THREE.SphereGeometry(0.134, 20, 14,
      -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.34, Math.PI * 0.30)), M.visor);
    visor.scale.set(1, 1.04, 1.08);
    visor.position.y = 0.072;
    visor.rotation.y = Math.PI;
    helmet.add(visor);
    const stripe = new THREE.Mesh(geo('stripe', () => new THREE.TorusGeometry(0.126, 0.012, 6, 20, Math.PI * 0.9)),
      mat(0xf2f2f2, 0.3, 0.2));
    stripe.rotation.set(0, Math.PI / 2, Math.PI * 0.05);
    stripe.position.y = 0.082;
    helmet.add(stripe);
    const vent = new THREE.Mesh(geo('vent', () => new THREE.BoxGeometry(0.075, 0.022, 0.05)), M.visor);
    vent.position.set(0, 0.155, 0.095);
    vent.rotation.x = -0.35;
    helmet.add(vent);
    const rim = new THREE.Mesh(geo('hrim', () => new THREE.TorusGeometry(0.128, 0.014, 8, 22)), M.jacket2);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.005;
    helmet.add(rim);
    helmet.visible = false;
    head.add(helmet);

    /* الذراعان */
    function arm(side) {
      const shoulder = joint(torso, side * 0.175, 0.395, 0);
      const pad = new THREE.Mesh(geo('jaw', () => new THREE.SphereGeometry(0.072, 12, 10)), M.jacket);
      pad.scale.set(1, 0.9, 0.95);
      shoulder.add(pad);
      const upper = bone(0.050, 0.20, M.jacket, 0.043);
      shoulder.add(upper);
      const elbow = joint(shoulder, 0, -0.29, 0);
      const fore = bone(0.042, 0.19, M.jacket2, 0.036);
      elbow.add(fore);
      const wrist = joint(elbow, 0, -0.27, 0);
      const hand = new THREE.Mesh(geo('hand', () => new THREE.BoxGeometry(0.052, 0.092, 0.070)), M.glove);
      hand.position.y = -0.042;
      hand.castShadow = true;
      wrist.add(hand);
      const thumb = new THREE.Mesh(geo('thumb', () => new THREE.CapsuleGeometry(0.017, 0.04, 3, 6)), M.glove);
      thumb.rotation.z = side * 0.9;
      thumb.position.set(-side * 0.032, -0.032, 0.02);
      wrist.add(thumb);
      /* أصابع مبسّطة + سوار المعصم */
      for (let f = 0; f < 3; f++) {
        const fin = new THREE.Mesh(geo('finger', () => new THREE.CapsuleGeometry(0.013, 0.040, 3, 5)), M.glove);
        fin.rotation.x = 1.25;                            // أصابع منحنية للقبض
        fin.position.set((f - 1) * 0.019, -0.086, 0.034);
        wrist.add(fin);
      }
      const cuff = new THREE.Mesh(geo('cuff', () => new THREE.CylinderGeometry(0.052, 0.046, 0.045, 10)), M.jacket);
      cuff.position.y = 0.012;
      wrist.add(cuff);
      return { shoulder, elbow, wrist, hand, upperLen: 0.29, foreLen: 0.27, side };
    }
    const armL = arm(1), armR = arm(-1);

    /* الساقان */
    function leg(side) {
      const hip = joint(pelvis, side * 0.085, 0.02, 0);
      const thigh = bone(0.083, 0.28, M.jeans, 0.072);
      hip.add(thigh);
      const knee = joint(hip, 0, -0.40, 0);
      const shin = bone(0.068, 0.28, M.jeans, 0.055);
      knee.add(shin);
      const ankle = joint(knee, 0, -0.38, 0);
      const foot = new THREE.Mesh(geo('foot', () => new THREE.BoxGeometry(0.088, 0.062, 0.215)), M.boots);
      foot.position.set(0, -0.03, 0.062);
      const sole = new THREE.Mesh(geo('sole', () => new THREE.BoxGeometry(0.094, 0.022, 0.225)),
        new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.95 }));
      sole.position.set(0, -0.062, 0.066);
      ankle.add(sole);
      const kneePad = new THREE.Mesh(geo('kneepad', () => new THREE.SphereGeometry(0.068, 10, 8)), M.jacket2);
      kneePad.scale.set(1, 0.85, 0.9);
      kneePad.position.set(0, 0.01, 0.02);
      knee.add(kneePad);
      foot.castShadow = true;
      ankle.add(foot);
      return { hip, knee, ankle, foot, thighLen: 0.40, shinLen: 0.38, side };
    }
    const legL = leg(1), legR = leg(-1);

    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });

    /* ------------------------------ الوضعيات --------------------------- */
    const POSES = {
      car: () => {
        torso.rotation.set(-0.12, 0, 0);
        headPivot.rotation.set(0.06, 0, 0);
        legL.hip.rotation.set(-1.32, 0.10, 0.10);
        legR.hip.rotation.set(-1.36, -0.10, -0.10);
        legL.knee.rotation.set(1.15, 0, 0);
        legR.knee.rotation.set(1.22, 0, 0);
        legL.ankle.rotation.set(0.28, 0, 0);
        legR.ankle.rotation.set(0.22, 0, 0);
        helmet.visible = false; hair.visible = true;
      },
      bike: () => {
        torso.rotation.set(0.55, 0, 0);
        headPivot.rotation.set(-0.42, 0, 0);
        legL.hip.rotation.set(-1.05, 0.30, 0.24);
        legR.hip.rotation.set(-1.05, -0.30, -0.24);
        legL.knee.rotation.set(1.95, 0, 0);
        legR.knee.rotation.set(1.95, 0, 0);
        legL.ankle.rotation.set(0.40, 0, 0);
        legR.ankle.rotation.set(0.40, 0, 0);
        helmet.visible = true; hair.visible = false;
      }
    };

    /* --------------------- حلّ حركي عكسي بسيط للذراع -------------------- */
    /* الهدف يُعطى بإحداثيات العالم؛ نحوّله إلى فضاء الجذع ثم نحسب زاويتَي
       الكتف والمرفق بقانون جيب التمام، ونوجّه المرفق نحو متجه القطب.        */
    const _d = new THREE.Vector3(), _axis = new THREE.Vector3(), _q = new THREE.Quaternion();
    const _t = new THREE.Vector3(), _local = new THREE.Vector3(), _qa = new THREE.Quaternion();
    const DOWN = new THREE.Vector3(0, -1, 0);

    function reachArm(a, targetWorld, pole) {
      torso.updateWorldMatrix(true, false);
      _t.copy(targetWorld);
      torso.worldToLocal(_t);
      _d.copy(_t).sub(a.shoulder.position);
      const dist = U.clamp(_d.length(), 0.12, a.upperLen + a.foreLen - 0.03);
      _d.normalize();

      const L1 = a.upperLen, L2 = a.foreLen;
      const angA = Math.acos(U.clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1));
      const beta = Math.acos(U.clamp((L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2), -1, 1));
      const bend = Math.PI - beta;

      _axis.copy(_d).cross(pole);
      if (_axis.lengthSq() < 1e-6) _axis.set(1, 0, 0);
      _axis.normalize();

      _q.setFromUnitVectors(DOWN, _d);
      _qa.setFromAxisAngle(_axis, angA);
      a.shoulder.quaternion.copy(_qa).multiply(_q);

      _local.copy(_axis).applyQuaternion(_qa.copy(a.shoulder.quaternion).invert()).normalize();
      a.elbow.quaternion.setFromAxisAngle(_local, -bend);
      a.wrist.rotation.set(1.15, 0, a.side * 0.42);   // تلتفّ الكفّ حول الإطار
    }

    /* ------------------------------ الواجهة ---------------------------- */
    const api = {
      root, parts: { pelvis, torso, neck, headPivot, head, helmet, hair, armL, armR, legL, legR },
      pose: 'car',
      setPose(name) { api.pose = name; (POSES[name] || POSES.car)(); },
      setFirstPerson(on) {
        head.visible = !on;
        neckMesh.visible = !on;
        chest.visible = !on;
        collar.visible = !on;
      },
      /* تحديث: يدان على المقود/المقود اليدوي + ميلان الجذع والرأس */
      update(dt, st) {
        st = st || {};
        const hands = st.hands;
        if (hands) {
          const poleL = st.poleL || V(0.75, -0.55, -0.35);
          const poleR = st.poleR || V(-0.75, -0.55, -0.35);
          reachArm(armL, hands[0], poleL.clone().normalize());
          reachArm(armR, hands[1], poleR.clone().normalize());
        }
        const lean = U.clamp(st.lat || 0, -1, 1);
        const push = U.clamp(st.lon || 0, -1, 1);
        torso.rotation.z = U.damp(torso.rotation.z, -lean * 0.10, 8, dt);
        torso.rotation.x = U.damp(torso.rotation.x, (api.pose === 'bike' ? 0.55 : -0.12) - push * 0.10, 8, dt);
        headPivot.rotation.y = U.damp(headPivot.rotation.y, -(st.look || 0) * 0.55, 7, dt);
        headPivot.rotation.z = U.damp(headPivot.rotation.z, lean * 0.14, 7, dt);
      },
      setColors(c) {
        if (c.helmet) M.helmet.color.setHex(c.helmet);
        if (c.jacket) { M.jacket.color.setHex(c.jacket); }
      },
      dispose() {
        root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } });
      }
    };
    api.setPose(opts.pose || 'car');
    return api;
  }

  /* ------------- شخصية مبسّطة لسيارات المرور (رسمتان فقط) -------------- */
  const simpleMats = {};
  function createSimple(opts) {
    opts = opts || {};
    const key = opts.pose === 'bike' ? 'bike' : 'car';
    if (!simpleMats.body) {
      simpleMats.body = mat(PALETTE.jacket, 0.75);
      simpleMats.head = mat(PALETTE.skin, 0.65);
      simpleMats.helmet = mat(PALETTE.helmet, 0.3, 0.3);
    }
    const root = new THREE.Group();
    const torso = new THREE.Mesh(geo('sTorso', () => {
      const g = new THREE.CapsuleGeometry(0.17, 0.34, 4, 10);
      g.translate(0, 0.30, 0);
      return g;
    }), simpleMats.body);
    torso.scale.set(1.25, 1, 0.88);
    torso.castShadow = true;
    root.add(torso);
    const head = new THREE.Mesh(geo('sHead', () => {
      const g = new THREE.SphereGeometry(key === 'bike' ? 0.135 : 0.105, 12, 10);
      g.translate(0, 0.60, 0);
      return g;
    }), key === 'bike' ? simpleMats.helmet : simpleMats.head);
    head.castShadow = true;
    root.add(head);
    return {
      root, simple: true, pose: key,
      setPose() {}, setFirstPerson(on) { root.visible = !on; },
      update() {}, setColors() {}, dispose() {}
    };
  }

  /* ====================================================================
     المارّة: جسم مدموج بألوان مخبوزة في الرؤوس (٣ رسمات فقط لكل شخص)
     ==================================================================== */
  function mergeParts(parts) {
    let vtot = 0, itot = 0;
    parts.forEach((p) => {
      const g = p.geo;
      vtot += g.attributes.position.count;
      itot += g.index ? g.index.count : g.attributes.position.count;
    });
    const P = new Float32Array(vtot * 3), N = new Float32Array(vtot * 3), C = new Float32Array(vtot * 3);
    const I = new Uint32Array(itot);
    let vo = 0, io = 0;
    const v = new THREE.Vector3(), col = new THREE.Color();
    parts.forEach((p) => {
      const g = p.geo, pos = g.attributes.position, nor = g.attributes.normal;
      const nm = new THREE.Matrix3().getNormalMatrix(p.matrix);
      col.setHex(p.color).convertSRGBToLinear();
      for (let i = 0; i < pos.count; i++) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(p.matrix);
        P[(vo + i) * 3] = v.x; P[(vo + i) * 3 + 1] = v.y; P[(vo + i) * 3 + 2] = v.z;
        if (nor) {
          v.set(nor.getX(i), nor.getY(i), nor.getZ(i)).applyMatrix3(nm).normalize();
          N[(vo + i) * 3] = v.x; N[(vo + i) * 3 + 1] = v.y; N[(vo + i) * 3 + 2] = v.z;
        }
        C[(vo + i) * 3] = col.r; C[(vo + i) * 3 + 1] = col.g; C[(vo + i) * 3 + 2] = col.b;
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) I[io + i] = g.index.getX(i) + vo;
      else for (let i = 0; i < pos.count; i++) I[io + i] = i + vo;
      io += g.index ? g.index.count : pos.count;
      vo += pos.count;
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(P, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    out.setAttribute('color', new THREE.BufferAttribute(C, 3));
    out.setIndex(new THREE.BufferAttribute(I, 1));
    out.computeBoundingSphere();
    return out;
  }

  const M4 = (x, y, z, rx, ry, rz, sx, sy, sz) => new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
    new THREE.Vector3(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz));

  const PED_OUTFITS = [
    { skin: 0xd9a17a, hair: 0x2b2119, top: 0x2f4f7a, pants: 0x2a2f3a, shoe: 0x1a1a1c },
    { skin: 0xf0c9a0, hair: 0x6b4a2a, top: 0x8c2f2f, pants: 0x3b4250, shoe: 0x222 },
    { skin: 0xa9714b, hair: 0x141414, top: 0x2f7a52, pants: 0x54586a, shoe: 0x2a2a2a },
    { skin: 0xe8b98d, hair: 0xa8823c, top: 0xd9b13a, pants: 0x27303f, shoe: 0x191919 },
    { skin: 0x8d5a3b, hair: 0x1c1712, top: 0x6b4a9e, pants: 0x3a3f4a, shoe: 0x202020 },
    { skin: 0xf2d3b3, hair: 0x8a8a8a, top: 0xdedede, pants: 0x2f3548, shoe: 0x151515 }
  ];

  /* يبني أشكال المارّة مرّة واحدة: الجزء العلوي + ساقان */
  let pedCache = null;
  function walkerVariants() {
    if (pedCache) return pedCache;
    const capsule = (r, len, seg) => new THREE.CapsuleGeometry(r, len, 3, seg || 8);
    const sphere = (r, s) => new THREE.SphereGeometry(r, s || 10, 8);
    const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);

    pedCache = PED_OUTFITS.map((o) => {
      const arm = (side) => mergeParts([
        { geo: capsule(0.05, 0.17, 8), matrix: M4(0, -0.13, 0), color: o.top },
        { geo: capsule(0.044, 0.15, 8), matrix: M4(0, -0.38, 0.01), color: o.skin },
        { geo: sphere(0.038, 8), matrix: M4(0, -0.53, 0.02), color: o.skin }
      ]);
      const upper = mergeParts([
        { geo: capsule(0.135, 0.30, 10), matrix: M4(0, 1.18, 0, 0, 0, 0, 1.28, 1, 0.82), color: o.top },
        { geo: capsule(0.10, 0.12, 8), matrix: M4(0, 0.95, 0, 0, 0, 0, 1.25, 1, 0.9), color: o.pants },
        { geo: new THREE.CylinderGeometry(0.05, 0.055, 0.07, 8), matrix: M4(0, 1.44, 0), color: o.skin },
        { geo: sphere(0.093, 12), matrix: M4(0, 1.545, 0, 0, 0, 0, 0.95, 1.06, 1), color: o.skin },
        { geo: new THREE.SphereGeometry(0.098, 12, 8, 0, 6.283, 0, 1.9), matrix: M4(0, 1.548, -0.004, 0, 0, 0, 0.99, 1.06, 1.02), color: o.hair },
        { geo: sphere(0.021, 6), matrix: M4(0, 1.53, 0.085), color: o.skin },
        { geo: new THREE.CylinderGeometry(0.115, 0.125, 0.05, 12), matrix: M4(0, 1.40, 0), color: o.pants }
      ]);
      // الساق: أصلها عند مفصل الورك (0,0,0) وتتدلّى للأسفل
      const leg = (side) => mergeParts([
        { geo: capsule(0.072, 0.30, 8), matrix: M4(0, -0.22, 0), color: o.pants },
        { geo: capsule(0.06, 0.26, 8), matrix: M4(0, -0.62, 0), color: o.pants },
        { geo: box(0.085, 0.06, 0.20), matrix: M4(0, -0.855, 0.045), color: o.shoe }
      ]);
      return { upper, legL: leg(1), legR: leg(-1), armL: arm(1), armR: arm(-1), outfit: o };
    });
    return pedCache;
  }

  let pedMat = null;
  function walkerMaterial() {
    if (!pedMat) pedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.02 });
    return pedMat;
  }

  /* يبني ماشياً جاهزاً للتحريك */
  function createWalker(variantIndex) {
    const vars = walkerVariants();
    const v = vars[variantIndex % vars.length];
    const mat = walkerMaterial();
    const root = new THREE.Group();
    const upper = new THREE.Mesh(v.upper, mat);
    upper.castShadow = true;
    root.add(upper);
    const hipY = 0.92;
    const legL = new THREE.Group(); legL.position.set(0.085, hipY, 0);
    const legR = new THREE.Group(); legR.position.set(-0.085, hipY, 0);
    const mL = new THREE.Mesh(v.legL, mat), mR = new THREE.Mesh(v.legR, mat);
    mL.castShadow = mR.castShadow = true;
    legL.add(mL); legR.add(mR);
    root.add(legL); root.add(legR);

    const shY = 1.38;
    const armL = new THREE.Group(); armL.position.set(0.185, shY, 0);
    const armR = new THREE.Group(); armR.position.set(-0.185, shY, 0);
    const aL = new THREE.Mesh(v.armL, mat), aR = new THREE.Mesh(v.armR, mat);
    aL.castShadow = aR.castShadow = true;
    armL.add(aL); armR.add(aR);
    root.add(armL); root.add(armR);

    return { root, upper, legL, legR, armL, armR, phase: Math.random() * 6.283 };
  }

  /* ------------------------ مقود قابل للدوران ------------------------- */
  function steeringWheel(radius, color) {
    const g = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.09, 10, 28),
      new THREE.MeshStandardMaterial({ color: color || 0x3a2a18, roughness: 0.45, metalness: 0.15 }));
    g.add(rim);
    const hubMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.35, metalness: 0.75 });
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.20, radius * 0.20, radius * 0.10, 14), hubMat);
    hub.rotation.x = Math.PI / 2;
    g.add(hub);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.9, radius * 0.07, radius * 0.05), hubMat);
      spoke.position.set(Math.cos(a) * radius * 0.45, Math.sin(a) * radius * 0.45, 0);
      spoke.rotation.z = a;
      g.add(spoke);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    return g;
  }

  return { create, createSimple, createWalker, walkerVariants, mergeParts, steeringWheel, PALETTE, PED_OUTFITS };
})();
