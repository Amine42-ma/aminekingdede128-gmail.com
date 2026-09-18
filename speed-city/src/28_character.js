/* ============================================================================
   SPEED CITY — شخصية السائق/الراكب
   جسم مبني هندسياً بمفاصل حقيقية: كتفان ومرفقان ويدان تتبع المقود (IK)،
   وركبتان وقدمان، ورأس يلتفت مع المنعطف، وخوذة لراكب الدراجة.
   ========================================================================== */
SC.character = (function () {
  const U = SC.util;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const PALETTE = {
    skin:   0xe0aa83, skinDark: 0xc08a63,
    jacket: 0x2f5f96, jacket2: 0x1d3f68,     // سترة سباق زرقاء
    accent: 0xff8a2b,                         // خطوط برتقالية
    jeans:  0x3a4a64, boots: 0x26262b,
    glove:  0x33343a, helmet: 0xe23b3b, visor: 0x101318,
    hair:   0x3a2a1e, shirt: 0xe8edf3
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
      }), hair: mat(P.hair, 0.8), shirt: mat(P.shirt, 0.75),
      accent: mat(P.accent, 0.45, 0.12)
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
    const collar = new THREE.Mesh(geo('collar', () => new THREE.CylinderGeometry(0.085, 0.105, 0.075, 14)), M.jacket2);
    collar.position.y = 0.412;
    torso.add(collar);
    /* واقي رقبة ناعم فوق الياقة */
    const neckWarm = new THREE.Mesh(geo('neckWarm', () => new THREE.TorusGeometry(0.078, 0.028, 8, 18)), M.jacket2);
    neckWarm.rotation.x = Math.PI / 2;
    neckWarm.position.y = 0.448;
    torso.add(neckWarm);
    /* خطّان برتقاليان على الصدر يعطيان الشخصية طابع سائق سباق */
    [-1, 1].forEach((sx) => {
      const stripe = new THREE.Mesh(geo('cstripe', () => new THREE.BoxGeometry(0.030, 0.30, 0.016)), M.accent);
      stripe.position.set(sx * 0.052, 0.28, 0.122);
      torso.add(stripe);
    });
    /* كتفان بارزان يعطيان الجسم عرضاً طبيعياً */
    [-1, 1].forEach((sx) => {
      const delt = new THREE.Mesh(geo('delt', () => new THREE.SphereGeometry(0.082, 14, 10)), M.jacket);
      delt.scale.set(1, 0.82, 0.92);
      delt.position.set(sx * 0.150, 0.392, 0);
      torso.add(delt);
      const epaul = new THREE.Mesh(geo('epaul', () => new THREE.BoxGeometry(0.090, 0.020, 0.110)), M.accent);
      epaul.position.set(sx * 0.146, 0.438, 0);
      epaul.rotation.z = sx * 0.16;
      torso.add(epaul);
    });
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
    /* جيبان على الصدر ورقعة على الكتف */
    [-1, 1].forEach((sx) => {
      const pocket = new THREE.Mesh(geo('pocket', () => new THREE.BoxGeometry(0.072, 0.062, 0.014)), M.jacket2);
      pocket.position.set(sx * 0.088, 0.205, 0.122);
      torso.add(pocket);
      const flap = new THREE.Mesh(geo('flap', () => new THREE.BoxGeometry(0.078, 0.018, 0.020)), M.jacket2);
      flap.position.set(sx * 0.088, 0.240, 0.124);
      torso.add(flap);
    });
    const buckle = new THREE.Mesh(geo('buckle', () => new THREE.BoxGeometry(0.052, 0.038, 0.016)),
      new THREE.MeshStandardMaterial({ color: 0xc9ad5f, roughness: 0.3, metalness: 0.8 }));
    buckle.position.set(0, 0.075, 0.098);
    torso.add(buckle);

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
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.22 });
    const irisMat = new THREE.MeshStandardMaterial({ color: 0x3d6b57, roughness: 0.18, metalness: 0.05 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x0d0d12, roughness: 0.2 });
    [-1, 1].forEach((sx) => {
      /* بياض العين ثم القزحية ثم البؤبؤ — تعطي نظرة حيّة بدل نقطة سوداء */
      const white = new THREE.Mesh(geo('eyeWhite', () => new THREE.SphereGeometry(0.018, 12, 10)), eyeWhiteMat);
      white.scale.set(1, 0.78, 0.72);
      white.position.set(sx * 0.036, 0.088, 0.076);
      head.add(white);
      const iris = new THREE.Mesh(geo('iris', () => new THREE.SphereGeometry(0.0095, 10, 8)), irisMat);
      iris.position.set(sx * 0.036, 0.0875, 0.0885);
      head.add(iris);
      const pupil = new THREE.Mesh(geo('pupil', () => new THREE.SphereGeometry(0.0048, 8, 6)), pupilMat);
      pupil.position.set(sx * 0.036, 0.0875, 0.0925);
      head.add(pupil);
      /* جفن علوي */
      const lid = new THREE.Mesh(geo('lid', () => new THREE.SphereGeometry(0.0195, 12, 8,
        0, Math.PI * 2, 0, Math.PI * 0.42)), M.skin);
      lid.scale.set(1, 0.8, 0.75);
      lid.position.set(sx * 0.036, 0.0895, 0.0755);
      lid.rotation.x = -0.28;
      head.add(lid);
      const brow = new THREE.Mesh(geo('brow', () => new THREE.BoxGeometry(0.036, 0.009, 0.014)), M.hair);
      brow.position.set(sx * 0.036, 0.109, 0.0815);
      brow.rotation.z = sx * 0.10;
      head.add(brow);
      const ear = new THREE.Mesh(geo('ear', () => new THREE.SphereGeometry(0.022, 8, 6)), M.skin);
      ear.scale.set(0.45, 1, 0.8);
      ear.position.set(sx * 0.094, 0.072, 0.0);
      head.add(ear);
      /* سالفة الشعر */
      const burn = new THREE.Mesh(geo('burn', () => new THREE.BoxGeometry(0.016, 0.042, 0.030)), M.hair);
      burn.position.set(sx * 0.086, 0.078, 0.006);
      head.add(burn);
    });
    /* الفم والذقن */
    const mouth = new THREE.Mesh(geo('mouth', () => new THREE.BoxGeometry(0.040, 0.007, 0.010)),
      new THREE.MeshStandardMaterial({ color: 0x7b4a44, roughness: 0.55 }));
    mouth.position.set(0, 0.018, 0.086);
    head.add(mouth);
    const lipLo = new THREE.Mesh(geo('lipLo', () => new THREE.SphereGeometry(0.022, 10, 8)), M.skin);
    lipLo.scale.set(1, 0.34, 0.45);
    lipLo.position.set(0, 0.009, 0.083);
    head.add(lipLo);
    const stubble = new THREE.Mesh(geo('stubble', () => new THREE.SphereGeometry(0.070, 12, 10,
      0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48)),
      new THREE.MeshStandardMaterial({ color: 0x3a2f2a, roughness: 0.95, transparent: true, opacity: 0.5 }));
    stubble.scale.set(0.94, 0.82, 1.06);
    stubble.position.set(0, 0.030, 0.022);
    head.add(stubble);

    const hair = new THREE.Mesh(geo('hair', () => new THREE.SphereGeometry(0.106, 18, 14,
      0, Math.PI * 2, 0, Math.PI * 0.60)), M.hair);
    hair.scale.set(0.99, 1.14, 1.04);
    hair.position.y = 0.076;
    head.add(hair);
    /* خصلة أمامية وقفا يكسران استدارة الكرة */
    const fringe = new THREE.Mesh(geo('fringe', () => new THREE.SphereGeometry(0.072, 12, 9,
      0, Math.PI, 0, Math.PI * 0.5)), M.hair);
    fringe.scale.set(1.35, 0.55, 0.72);
    fringe.position.set(0, 0.126, 0.052);
    fringe.rotation.set(0.35, Math.PI / 2, 0);
    hair.add(fringe);
    const nape = new THREE.Mesh(geo('nape', () => new THREE.BoxGeometry(0.130, 0.055, 0.040)), M.hair);
    nape.position.set(0, -0.030, -0.078);
    hair.add(nape);

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
    /* الزجاج الأمامي: شريحة كروية تغطّي واجهة الخوذة بالضبط.
       phi = π/2 هو اتجاه +Z أي الأمام في three.js. */
    const visor = new THREE.Mesh(geo('visor', () => new THREE.SphereGeometry(0.136, 24, 16,
      Math.PI * 0.5 - Math.PI * 0.40, Math.PI * 0.80,
      Math.PI * 0.30, Math.PI * 0.34)), M.visor);
    visor.scale.set(1, 1.04, 1.06);
    visor.position.y = 0.072;
    helmet.add(visor);
    /* إطار الزجاج */
    const vrim = new THREE.Mesh(geo('vrim', () => new THREE.TorusGeometry(0.118, 0.009, 6, 20, Math.PI * 0.86)),
      M.jacket2);
    vrim.rotation.set(Math.PI / 2, 0, Math.PI * 0.57);
    vrim.position.set(0, 0.104, 0.008);
    helmet.add(vrim);
    /* خطّ أبيض على منتصف القبّة من الأمام إلى الخلف */
    const stripe = new THREE.Mesh(geo('stripe', () => new THREE.TorusGeometry(0.1275, 0.0105, 10, 30, Math.PI * 0.70)),
      mat(0xf4f4f4, 0.3, 0.2));
    stripe.rotation.set(0, Math.PI / 2, Math.PI * 0.30);
    stripe.position.y = 0.074;
    helmet.add(stripe);
    /* فتحتا تهوية على القمّة */
    [-1, 1].forEach((sx) => {
      const vent = new THREE.Mesh(geo('vent', () => new THREE.BoxGeometry(0.026, 0.016, 0.048)), M.jacket2);
      vent.position.set(sx * 0.046, 0.176, 0.062);
      vent.rotation.x = -0.42;
      helmet.add(vent);
    });
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
      const sleeve = new THREE.Mesh(geo('sleeve', () => new THREE.TorusGeometry(0.049, 0.010, 6, 16)), M.accent);
      sleeve.rotation.x = Math.PI / 2;
      sleeve.position.y = -0.20;
      shoulder.add(sleeve);
      const sleeve2 = new THREE.Mesh(geo('sleeve2', () => new THREE.TorusGeometry(0.0455, 0.009, 6, 16)), M.accent);
      sleeve2.rotation.x = Math.PI / 2;
      sleeve2.position.y = -0.245;
      shoulder.add(sleeve2);
      const elbow = joint(shoulder, 0, -0.29, 0);
      const fore = bone(0.042, 0.19, M.jacket2, 0.036);
      elbow.add(fore);
      const wrist = joint(elbow, 0, -0.27, 0);
      const hand = new THREE.Mesh(geo('hand', () => new THREE.BoxGeometry(0.052, 0.092, 0.070)), M.glove);
      hand.position.y = -0.042;
      hand.castShadow = true;
      wrist.add(hand);
      /* الإبهام بمفصلين */
      const thumb = new THREE.Mesh(geo('thumb', () => new THREE.CapsuleGeometry(0.017, 0.038, 3, 7)), M.glove);
      thumb.rotation.set(0.5, 0, side * 1.0);
      thumb.position.set(-side * 0.034, -0.030, 0.028);
      wrist.add(thumb);
      const thumbTip = new THREE.Mesh(geo('thumbTip', () => new THREE.CapsuleGeometry(0.0145, 0.026, 3, 6)), M.glove);
      thumbTip.rotation.set(1.15, 0, side * 0.55);
      thumbTip.position.set(-side * 0.046, -0.060, 0.050);
      wrist.add(thumbTip);
      /* أربعة أصابع بأطوال متدرّجة، كل واحد بمفصلين — قبضة واقعية */
      const FL = [0.040, 0.046, 0.043, 0.034];
      for (let f = 0; f < 4; f++) {
        const x = (f - 1.5) * 0.0162 * (side >= 0 ? 1 : -1);
        const len = FL[f];
        const p1 = new THREE.Mesh(geo('fingerA' + f, () => new THREE.CapsuleGeometry(0.0118, len, 3, 6)), M.glove);
        p1.rotation.x = 1.30;
        p1.position.set(x, -0.083, 0.030);
        wrist.add(p1);
        const p2 = new THREE.Mesh(geo('fingerB' + f, () => new THREE.CapsuleGeometry(0.0108, len * 0.72, 3, 6)), M.glove);
        p2.rotation.x = 2.45;
        p2.position.set(x, -0.100, 0.058);
        wrist.add(p2);
        const knuck = new THREE.Mesh(geo('knuck', () => new THREE.SphereGeometry(0.0125, 8, 6)), M.glove);
        knuck.position.set(x, -0.074, 0.020);
        wrist.add(knuck);
      }
      /* راحة اليد ومفصل الكفّ */
      const palm = new THREE.Mesh(geo('palm', () => new THREE.SphereGeometry(0.040, 12, 10)), M.glove);
      palm.scale.set(0.92, 0.70, 0.78);
      palm.position.set(0, -0.058, 0.020);
      wrist.add(palm);
      const cuff = new THREE.Mesh(geo('cuff', () => new THREE.CylinderGeometry(0.054, 0.047, 0.050, 12)), M.jacket);
      cuff.position.y = 0.012;
      wrist.add(cuff);
      const cuffRim = new THREE.Mesh(geo('cuffRim', () => new THREE.TorusGeometry(0.052, 0.007, 6, 14)), M.jacket2);
      cuffRim.rotation.x = Math.PI / 2;
      cuffRim.position.y = -0.012;
      wrist.add(cuffRim);
      if (side > 0) {                                    // ساعة يد
        const band = new THREE.Mesh(geo('band', () => new THREE.TorusGeometry(0.046, 0.009, 6, 14)), M.boots);
        band.rotation.x = Math.PI / 2;
        band.position.y = 0.036;
        wrist.add(band);
        const dial = new THREE.Mesh(geo('dial', () => new THREE.CylinderGeometry(0.019, 0.019, 0.011, 12)),
          new THREE.MeshStandardMaterial({ color: 0xd9dde3, roughness: 0.25, metalness: 0.75 }));
        dial.rotation.set(Math.PI / 2, 0, 0);
        dial.position.set(0, 0.036, 0.044);
        wrist.add(dial);
      }
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
      const kneePad = new THREE.Mesh(geo('kneepad', () => new THREE.SphereGeometry(0.070, 12, 9)), M.jacket2);
      kneePad.scale.set(1, 0.86, 0.92);
      kneePad.position.set(0, 0.01, 0.022);
      knee.add(kneePad);
      const kneeTrim = new THREE.Mesh(geo('kneeTrim', () => new THREE.TorusGeometry(0.056, 0.008, 6, 14)), M.accent);
      kneeTrim.rotation.x = Math.PI / 2.1;
      kneeTrim.position.set(0, -0.004, 0.030);
      knee.add(kneeTrim);
      const shinGuard = new THREE.Mesh(geo('shinGuard', () => new THREE.BoxGeometry(0.090, 0.150, 0.030)), M.jacket2);
      shinGuard.position.set(0, -0.20, 0.056);
      knee.add(shinGuard);
      const laces = new THREE.Mesh(geo('laces', () => new THREE.BoxGeometry(0.052, 0.010, 0.085)),
        new THREE.MeshStandardMaterial({ color: 0xe4e0d6, roughness: 0.85 }));
      laces.position.set(0, 0.006, 0.052);
      ankle.add(laces);
      const toeCap = new THREE.Mesh(geo('toeCap', () => new THREE.SphereGeometry(0.046, 10, 8)), M.boots);
      toeCap.scale.set(0.95, 0.66, 1.1);
      toeCap.position.set(0, -0.032, 0.148);
      ankle.add(toeCap);
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
        /* الفخذ شبه أفقيّ كجلسة سيارة منخفضة: الوضعية السابقة كانت
           تُدلّي الساقين فتخرج الأقدام من أسفل الهيكل وتُرى تحت العتبة */
        legL.hip.rotation.set(-1.64, 0.10, 0.10);
        legR.hip.rotation.set(-1.68, -0.10, -0.10);
        legL.knee.rotation.set(1.18, 0, 0);
        legR.knee.rotation.set(1.25, 0, 0);
        legL.ankle.rotation.set(0.30, 0, 0);
        legR.ankle.rotation.set(0.24, 0, 0);
        /* ما دون الركبة مخفيّ داخل السيارة: النماذج بلا حيّز للأقدام،
           فكانت الأحذية تبرز من أسفل العتبة وتُرى من الخارج. لا أحد يرى
           داخل حيّز الأقدام أصلاً، وعلى الدرّاجة تبقى الساقان ظاهرتين. */
        legL.knee.visible = false; legR.knee.visible = false;
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
        legL.knee.visible = true; legR.knee.visible = true;
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
  const SIMPLE_LOOKS = [
    { skin: 0xd9a17a, hair: 0x2b2119, top: 0x30435f, trim: 0xdfe6ef, glove: 0x2b2d33, helmet: 0xe23b3b },
    { skin: 0xf0c9a0, hair: 0x6b4a2a, top: 0x7a3030, trim: 0xf0d8b0, glove: 0x33343a, helmet: 0x2f6fd0 },
    { skin: 0xa9714b, hair: 0x141414, top: 0x2f6a52, trim: 0xd8e8dc, glove: 0x26272c, helmet: 0xf2c14e },
    { skin: 0xe8b98d, hair: 0x6b4f22, top: 0x5a4e8c, trim: 0xe2dcf4, glove: 0x2f3036, helmet: 0x22d3ee },
    { skin: 0x8d5a3b, hair: 0x1c1712, top: 0x8a6a2c, trim: 0xf2e6c6, glove: 0x2a2b30, helmet: 0xe8e8e8 },
    { skin: 0xf2d3b3, hair: 0x55575c, top: 0x3c4450, trim: 0xc9d2de, glove: 0x303138, helmet: 0x7fe8c0 }
  ];

  /* سائقو السيارات المارّة: شبكة واحدة مدمجة بألوان رأسية — أرخص من
     شبكتين منفصلتين ومع ذلك فيها كتفان وذراعان على المقود ووجه وشعر. */
  const simpleCache = {};
  function createSimple(opts) {
    opts = opts || {};
    const key = opts.pose === 'bike' ? 'bike' : 'car';
    const tone = (opts.variant == null ? 0 : opts.variant) % SIMPLE_LOOKS.length;
    const cacheKey = key + tone;
    if (!simpleMats.vcol) {
      simpleMats.vcol = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.02 });
    }
    if (!simpleCache[cacheKey]) {
      const L = SIMPLE_LOOKS[tone];
      const cap = (r, len, seg) => new THREE.CapsuleGeometry(r, len, 3, seg || 10);
      const sph = (r, s) => new THREE.SphereGeometry(r, s || 12, 9);
      const bx = (x, y, z) => new THREE.BoxGeometry(x, y, z);
      const parts = [
        /* الجذع والكتفان */
        { geo: cap(0.165, 0.30, 12), matrix: M4(0, 0.30, 0, 0, 0, 0, 1.26, 1, 0.88), color: L.top },
        { geo: sph(0.085, 10), matrix: M4(0.175, 0.455, 0, 0, 0, 0, 1, 0.85, 0.95), color: L.top },
        { geo: sph(0.085, 10), matrix: M4(-0.175, 0.455, 0, 0, 0, 0, 1, 0.85, 0.95), color: L.top },
        { geo: bx(0.022, 0.26, 0.014), matrix: M4(0, 0.31, 0.140), color: L.trim },
        /* الياقة والرقبة */
        { geo: new THREE.CylinderGeometry(0.100, 0.116, 0.046, 12), matrix: M4(0, 0.487, 0), color: L.trim },
        { geo: new THREE.CylinderGeometry(0.050, 0.055, 0.070, 8), matrix: M4(0, 0.527, 0), color: L.skin }
      ];
      if (key === 'bike') {
        /* خوذة كاملة بزجاج أمامي */
        parts.push({ geo: sph(0.134, 14), matrix: M4(0, 0.640, 0, 0, 0, 0, 1, 1.04, 1.06), color: L.helmet });
        parts.push({ geo: new THREE.SphereGeometry(0.136, 16, 10,
            Math.PI * 0.5 - Math.PI * 0.38, Math.PI * 0.76, Math.PI * 0.32, Math.PI * 0.32),
            matrix: M4(0, 0.640, 0, 0, 0, 0, 1, 1.04, 1.07), color: 0x101318 });
        parts.push({ geo: new THREE.TorusGeometry(0.128, 0.014, 6, 16), matrix: M4(0, 0.566, 0, Math.PI / 2, 0, 0), color: L.trim });
      } else {
        /* رأس بوجه وشعر */
        parts.push({ geo: sph(0.100, 14), matrix: M4(0, 0.640, 0, 0, 0, 0, 0.95, 1.07, 1), color: L.skin });
        parts.push({ geo: sph(0.076, 10), matrix: M4(0, 0.598, 0.020, 0, 0, 0, 0.90, 0.80, 1.02), color: L.skin });
        parts.push({ geo: sph(0.017, 8), matrix: M4(0.037, 0.660, 0.081, 0, 0, 0, 1, 0.8, 0.7), color: 0xf4f4f2 });
        parts.push({ geo: sph(0.017, 8), matrix: M4(-0.037, 0.660, 0.081, 0, 0, 0, 1, 0.8, 0.7), color: 0xf4f4f2 });
        parts.push({ geo: sph(0.0085, 6), matrix: M4(0.037, 0.659, 0.092), color: 0x141418 });
        parts.push({ geo: sph(0.0085, 6), matrix: M4(-0.037, 0.659, 0.092), color: 0x141418 });
        parts.push({ geo: bx(0.034, 0.008, 0.012), matrix: M4(0.037, 0.683, 0.087), color: L.hair });
        parts.push({ geo: bx(0.034, 0.008, 0.012), matrix: M4(-0.037, 0.683, 0.087), color: L.hair });
        parts.push({ geo: sph(0.020, 6), matrix: M4(0, 0.638, 0.091, 0, 0, 0, 0.8, 0.9, 1.1), color: L.skin });
        parts.push({ geo: bx(0.036, 0.007, 0.010), matrix: M4(0, 0.604, 0.089), color: 0x8a5450 });
        parts.push({ geo: new THREE.SphereGeometry(0.105, 14, 10, 0, 6.283, 0, 1.85),
            matrix: M4(0, 0.644, -0.004, 0, 0, 0, 0.99, 1.05, 1.03), color: L.hair });
        parts.push({ geo: sph(0.021, 6), matrix: M4(0.096, 0.640, 0, 0, 0, 0, 0.45, 1, 0.8), color: L.skin });
        parts.push({ geo: sph(0.021, 6), matrix: M4(-0.096, 0.640, 0, 0, 0, 0, 0.45, 1, 0.8), color: L.skin });
      }
      /* ذراعان ممدودتان إلى الأمام كأنّهما على المقود */
      [1, -1].forEach((sd) => {
        parts.push({ geo: cap(0.052, 0.20, 8),
                     matrix: M4(sd * 0.175, 0.365, 0.085, -0.95, 0, sd * 0.14), color: L.top });
        parts.push({ geo: cap(0.045, 0.16, 8),
                     matrix: M4(sd * 0.168, 0.300, 0.280, -1.32, 0, sd * 0.10), color: L.skin });
        parts.push({ geo: sph(0.046, 8),
                     matrix: M4(sd * 0.160, 0.272, 0.375, 0, 0, 0, 0.9, 0.85, 0.8), color: L.glove });
      });
      simpleCache[cacheKey] = mergeParts(parts);
    }
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(simpleCache[cacheKey], simpleMats.vcol);
    mesh.castShadow = true;
    root.add(mesh);
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

  /* تعتيم لون بنسبة — لتوليد ظلال الياقة والأكمام من لون الزيّ نفسه */
  function shade(hex, k) {
    const r = Math.max(0, Math.min(255, ((hex >> 16) & 255) * k)) | 0;
    const g = Math.max(0, Math.min(255, ((hex >> 8) & 255) * k)) | 0;
    const b = Math.max(0, Math.min(255, (hex & 255) * k)) | 0;
    return (r << 16) | (g << 8) | b;
  }

  /* الأزياء: لكل شخص لون وبنية وطول وتسريحة — حتى لا يتكرّر المارّة */
  const PED_OUTFITS = [
    { skin: 0xd9a17a, hair: 0x2b2119, top: 0x2f4f7a, pants: 0x2a2f3a, shoe: 0x1a1a1c, trim: 0xe8eef5,
      hat: null, build: 1.00, tall: 1.00, hairStyle: 'short', beard: false, eye: 0x4a3b2a },
    { skin: 0xf0c9a0, hair: 0x6b4a2a, top: 0x8c2f2f, pants: 0x3b4250, shoe: 0x222222, trim: 0xf2d9a0,
      hat: null, build: 0.94, tall: 0.96, hairStyle: 'long', beard: false, eye: 0x3a6a4a },
    { skin: 0xa9714b, hair: 0x141414, top: 0x2f7a52, pants: 0x54586a, shoe: 0x2a2a2a, trim: 0xd8e8dc,
      hat: 0x20323f, build: 1.08, tall: 1.03, hairStyle: 'cap', beard: true, eye: 0x2e2018 },
    { skin: 0xe8b98d, hair: 0x6b4f22, top: 0xd9b13a, pants: 0x27303f, shoe: 0x191919, trim: 0x5a4418,
      hat: null, build: 0.97, tall: 1.01, hairStyle: 'short', beard: false, eye: 0x2f5a7a },
    { skin: 0x8d5a3b, hair: 0x1c1712, top: 0x6b4a9e, pants: 0x3a3f4a, shoe: 0x202020, trim: 0xe0d4f2,
      hat: null, build: 1.02, tall: 0.98, hairStyle: 'bun', beard: false, eye: 0x33241a },
    { skin: 0xf2d3b3, hair: 0x55575c, top: 0xdedede, pants: 0x2f3548, shoe: 0x151515, trim: 0x9aa4b2,
      hat: 0x8c2f2f, build: 1.10, tall: 0.99, hairStyle: 'bald', beard: true, eye: 0x4a4a52 },
    { skin: 0xc98d63, hair: 0x33241a, top: 0x1f6f8c, pants: 0x232a36, shoe: 0x1d1d20, trim: 0xf0f6fa,
      hat: null, build: 0.92, tall: 1.05, hairStyle: 'long', beard: false, eye: 0x2e4a3a },
    { skin: 0xffd9b8, hair: 0x4a2f1e, top: 0xe07a3c, pants: 0x46506a, shoe: 0x262626, trim: 0x2a2118,
      hat: null, build: 1.00, tall: 0.94, hairStyle: 'bun', beard: false, eye: 0x5a4028 },
    { skin: 0x9c6842, hair: 0x0f0f0f, top: 0x3b4b66, pants: 0x6a6f7e, shoe: 0x232323, trim: 0xc7d2e0,
      hat: 0x2f4f7a, build: 1.05, tall: 1.02, hairStyle: 'cap', beard: false, eye: 0x241a14 },
    { skin: 0xecc39b, hair: 0x7a6318, top: 0xb03a6a, pants: 0x2b3244, shoe: 0x1b1b1e, trim: 0xf6d9e6,
      hat: null, build: 0.95, tall: 0.97, hairStyle: 'long', beard: false, eye: 0x3f6ea0 }
  ];

  /* ====================================================================
     بناء المارّة — تشريح مبسّط لكنّه متّصل: لا فجوات بين الكتف والذراع
     ولا بين الورك والفخذ، ووجه بملامح حقيقية (جفن، حاجب، أنف، شفتان،
     ذقن، أذنان). كل شخص ٥ رسمات فقط لأن الألوان مخبوزة في الرؤوس.
     ==================================================================== */
  let pedCache = null;
  function walkerVariants() {
    if (pedCache) return pedCache;
    const cap = (r, len, seg) => new THREE.CapsuleGeometry(r, len, 4, seg || 10);
    const sph = (r, s, t) => new THREE.SphereGeometry(r, s || 10, t || (s ? Math.max(6, s - 2) : 8));
    const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
    /* مخروط ناقص: العضلة تضيق نحو المفصل فيبدو الطرف طبيعياً لا أنبوباً */
    const taper = (r1, r2, h, seg) => new THREE.CylinderGeometry(r1, r2, h, seg || 10, 1);

    pedCache = PED_OUTFITS.map((o) => {
      const B = o.build;                       // عرض البنية
      const sleeve = shade(o.top, 0.88);
      const dark = shade(o.top, 0.58);
      const skinDark = shade(o.skin, 0.80);
      const lip = shade(o.skin, 0.66);

      /* ---------------------------- الذراع ---------------------------- *
         تبدأ من داخل الجذع: كرة الكتف تتداخل مع الصدر فلا يظهر فاصل. */
      const arm = (side) => mergeParts([
        { geo: sph(0.063, 12), matrix: M4(0, -0.006, 0, 0, 0, 0, 0.96, 1.02, 0.96), color: o.top },
        { geo: taper(0.057, 0.048, 0.205, 10), matrix: M4(0, -0.122, 0), color: sleeve },
        { geo: new THREE.TorusGeometry(0.047, 0.010, 6, 12), matrix: M4(0, -0.228, 0, Math.PI / 2, 0, 0), color: dark },
        { geo: sph(0.046, 10), matrix: M4(0, -0.246, 0), color: o.skin },            // المرفق
        { geo: taper(0.045, 0.037, 0.185, 10), matrix: M4(0, -0.342, 0.004), color: o.skin },
        { geo: sph(0.038, 10), matrix: M4(0, -0.438, 0.008, 0, 0, 0, 1, 0.9, 1), color: o.skin },  // الرسغ
        /* الكفّ: راحة وإبهام وثلاثة أصابع */
        { geo: box(0.046, 0.062, 0.028), matrix: M4(0, -0.482, 0.012), color: o.skin },
        { geo: box(0.020, 0.038, 0.020), matrix: M4(side * 0.028, -0.470, 0.016, 0, 0, side * 0.55), color: o.skin },
        { geo: box(0.041, 0.040, 0.022), matrix: M4(0, -0.526, 0.014), color: o.skin },
        { geo: box(0.013, 0.014, 0.019), matrix: M4(-0.013, -0.549, 0.014), color: skinDark },
        { geo: box(0.013, 0.014, 0.019), matrix: M4(0.013, -0.549, 0.014), color: skinDark }
      ]);

      /* ------------------------- الجذع والرأس ------------------------- */
      const parts = [
        /* صدر عريض يضيق عند الخصر */
        { geo: cap(0.126, 0.20, 14), matrix: M4(0, 1.247, 0, 0, 0, 0, 1.34 * B, 1, 0.86), color: o.top },
        { geo: cap(0.112, 0.09, 12), matrix: M4(0, 1.098, 0, 0, 0, 0, 1.22 * B, 1, 0.84), color: o.top },
        { geo: cap(0.104, 0.07, 12), matrix: M4(0, 0.985, 0, 0, 0, 0, 1.26 * B, 1, 0.90), color: o.pants },
        /* كتفان يتداخلان مع الصدر فلا فجوة عند الذراع */
        { geo: sph(0.071, 12), matrix: M4(0.132 * B, 1.352, 0, 0, 0, 0, 1, 0.86, 0.96), color: o.top },
        { geo: sph(0.071, 12), matrix: M4(-0.132 * B, 1.352, 0, 0, 0, 0, 1, 0.86, 0.96), color: o.top },
        /* تفاصيل الزيّ: سحّاب، جيبان، حزام بإبزيم */
        { geo: box(0.014, 0.25, 0.010), matrix: M4(0, 1.212, 0.109), color: dark },
        { geo: box(0.052, 0.040, 0.010), matrix: M4(0.072, 1.145, 0.104), color: dark },
        { geo: box(0.052, 0.040, 0.010), matrix: M4(-0.072, 1.145, 0.104), color: dark },
        { geo: box(0.236 * B, 0.030, 0.150), matrix: M4(0, 1.030, 0), color: o.shoe },
        { geo: box(0.040, 0.026, 0.013), matrix: M4(0, 1.030, 0.078), color: o.trim },
        /* ياقة ورقبة */
        { geo: new THREE.CylinderGeometry(0.060, 0.084, 0.042, 14), matrix: M4(0, 1.398, 0), color: shade(o.top, 0.74) },
        { geo: taper(0.044, 0.050, 0.085, 10), matrix: M4(0, 1.442, -0.002), color: o.skin },
        { geo: sph(0.030, 8), matrix: M4(0, 1.462, 0.038, 0, 0, 0, 0.9, 1.1, 0.7), color: o.skin },   // حنجرة

        /* ------------------------------ الرأس -------------------------
           كل ملمح موضوع بحيث يبرز ملّيمترات قليلة عن سطح الجمجمة: لو غاص
           اختفى، ولو زاد صار خطماً. أنصاف أقطار الجمجمة: ٠٫٠٨٧ أفقياً
           و٠٫٠٩٢ رأسياً، ومركزها ١٫٥٥٦. */
        { geo: sph(0.087, 18, 14), matrix: M4(0, 1.556, 0, 0, 0, 0, 0.94, 1.06, 1.00), color: o.skin },
        /* فكّ وذقن وخدّان: يشكّلون الوجه بلا نتوء */
        { geo: sph(0.074, 12), matrix: M4(0, 1.5125, 0.006, 0, 0, 0, 0.93, 0.72, 0.96), color: o.skin },
        { geo: sph(0.031, 10), matrix: M4(0, 1.4885, 0.032, 0, 0, 0, 1.05, 0.82, 0.86), color: o.skin },
        { geo: sph(0.027, 8), matrix: M4(0.047, 1.5315, 0.036, 0, 0, 0, 0.95, 0.88, 0.72), color: o.skin },
        { geo: sph(0.027, 8), matrix: M4(-0.047, 1.5315, 0.036, 0, 0, 0, 0.95, 0.88, 0.72), color: o.skin },
        /* حافّة الحاجب: ظلّ خفيف فوق العينين */
        { geo: box(0.092, 0.012, 0.018), matrix: M4(0, 1.5835, 0.0625, -0.22, 0, 0), color: o.skin },
        /* العينان: محجر رفيع، بياض بارز قليلاً، قزحية، بؤبؤ، جفن علوي */
        { geo: sph(0.0165, 8), matrix: M4(0.031, 1.5625, 0.0725, 0, 0, 0, 1, 0.76, 0.42), color: skinDark },
        { geo: sph(0.0165, 8), matrix: M4(-0.031, 1.5625, 0.0725, 0, 0, 0, 1, 0.76, 0.42), color: skinDark },
        { geo: sph(0.0132, 10), matrix: M4(0.031, 1.5625, 0.0782, 0, 0, 0, 1, 0.78, 0.50), color: 0xf6f5f2 },
        { geo: sph(0.0132, 10), matrix: M4(-0.031, 1.5625, 0.0782, 0, 0, 0, 1, 0.78, 0.50), color: 0xf6f5f2 },
        { geo: sph(0.0064, 8), matrix: M4(0.031, 1.5620, 0.0836, 0, 0, 0, 1, 1, 0.5), color: o.eye },
        { geo: sph(0.0064, 8), matrix: M4(-0.031, 1.5620, 0.0836, 0, 0, 0, 1, 1, 0.5), color: o.eye },
        { geo: sph(0.0029, 6), matrix: M4(0.031, 1.5620, 0.0854), color: 0x0d0d10 },
        { geo: sph(0.0029, 6), matrix: M4(-0.031, 1.5620, 0.0854), color: 0x0d0d10 },
        { geo: box(0.030, 0.0075, 0.011), matrix: M4(0.031, 1.5695, 0.0778, -0.34, 0, 0), color: o.skin },
        { geo: box(0.030, 0.0075, 0.011), matrix: M4(-0.031, 1.5695, 0.0778, -0.34, 0, 0), color: o.skin },
        /* حاجبان رفيعان مائلان */
        { geo: box(0.031, 0.0055, 0.009), matrix: M4(0.032, 1.5830, 0.0775, -0.10, 0, -0.12), color: o.hair },
        { geo: box(0.031, 0.0055, 0.009), matrix: M4(-0.032, 1.5830, 0.0775, -0.10, 0, 0.12), color: o.hair },
        /* أنف: جسر ثم أرنبة ثم منخران */
        { geo: box(0.016, 0.042, 0.018), matrix: M4(0, 1.5510, 0.0735, 0.14, 0, 0), color: o.skin },
        { geo: sph(0.0125, 8), matrix: M4(0, 1.5310, 0.0765, 0, 0, 0, 1.10, 0.95, 1.00), color: o.skin },
        { geo: sph(0.0048, 6), matrix: M4(0.0090, 1.5268, 0.0752), color: skinDark },
        { geo: sph(0.0048, 6), matrix: M4(-0.0090, 1.5268, 0.0752), color: skinDark },
        /* شفتان */
        { geo: box(0.025, 0.0060, 0.009), matrix: M4(0, 1.5095, 0.0700), color: lip },
        { geo: box(0.027, 0.0022, 0.009), matrix: M4(0, 1.5058, 0.0702), color: shade(o.skin, 0.52) },
        { geo: box(0.023, 0.0070, 0.009), matrix: M4(0, 1.5015, 0.0692), color: shade(o.skin, 0.82) },
        /* أذنان بشحمة */
        { geo: sph(0.019, 8), matrix: M4(0.082, 1.5510, 0.002, 0, 0, 0, 0.46, 1.10, 0.82), color: o.skin },
        { geo: sph(0.019, 8), matrix: M4(-0.082, 1.5510, 0.002, 0, 0, 0, 0.46, 1.10, 0.82), color: o.skin },
        { geo: sph(0.0080, 6), matrix: M4(0.0835, 1.5335, 0.002), color: skinDark },
        { geo: sph(0.0080, 6), matrix: M4(-0.0835, 1.5335, 0.002), color: skinDark }
      ];

      if (o.beard) {
        parts.push({ geo: sph(0.0755, 12), matrix: M4(0, 1.5115, 0.006, 0, 0, 0, 0.94, 0.73, 0.97), color: o.hair });
        parts.push({ geo: box(0.034, 0.010, 0.012), matrix: M4(0, 1.5195, 0.0715), color: o.hair });   // شارب
      }

      /* ------------------------ الشعر أو القبّعة ------------------------ */
      /* الشعر قشرتان: تاج يقف عند خطّ الشعر فوق الحاجب، ومؤخّرة تنزل
         خلف الأذن. الغطاء الكامل كان يدفن الوجه كلّه تحت خوذة. */
      /* الشعر قشرة تتبع الجمجمة نفسها (٠٫٩٤ × ١٫٠٦ × ١٫٠٠) وتكبرها بقليل
         فقط، وتقف عند خطّ الشعر فوق الحاجب؛ والمؤخّرة تنزل خلف الأذن. */
      const SK = [0.96, 1.08, 1.02];                       // مقياس الشعر فوق الجمجمة
      const crown = (r, th) => new THREE.SphereGeometry(r, 18, 12, 0, 6.283, 0, th);
      const backHalf = (r, th) => new THREE.SphereGeometry(r, 14, 10, Math.PI, Math.PI, 0, th);
      /* رقعة على الجبهة تتبع انحناء الجمجمة تماماً — بديل الخصلة الطائرة */
      const fringe = (r) => new THREE.SphereGeometry(r, 14, 6, Math.PI * 0.5 - 0.62, 1.24, 0.80, 0.46);
      if (o.hat) {
        parts.push({ geo: crown(0.0885, 1.22),
                     matrix: M4(0, 1.556, -0.002, 0, 0, 0, SK[0] + 0.02, SK[1] - 0.02, SK[2] + 0.02), color: o.hat });
        parts.push({ geo: backHalf(0.0890, 1.62),
                     matrix: M4(0, 1.556, -0.002, 0, 0, 0, SK[0] + 0.02, SK[1] - 0.02, SK[2] + 0.02), color: o.hat });
        /* حافّة القبّعة أمام الجبين */
        parts.push({ geo: box(0.158, 0.013, 0.082), matrix: M4(0, 1.5985, 0.070, -0.16, 0, 0), color: shade(o.hat, 0.8) });
        parts.push({ geo: sph(0.018, 8), matrix: M4(0, 1.6255, -0.002, 0, 0, 0, 1, 0.5, 1), color: shade(o.hat, 1.2) });
        parts.push({ geo: box(0.130, 0.042, 0.028), matrix: M4(0, 1.514, -0.078), color: o.hair });
      } else if (o.hairStyle === 'bald') {
        parts.push({ geo: new THREE.SphereGeometry(0.0875, 16, 8, 0, 6.283, 1.12, 0.62),
                     matrix: M4(0, 1.556, -0.002, 0, 0, 0, SK[0], SK[1] - 0.02, SK[2]), color: o.hair });
      } else {
        parts.push({ geo: crown(0.0872, 1.18),
                     matrix: M4(0, 1.556, -0.002, 0, 0, 0, SK[0], SK[1], SK[2]), color: o.hair });
        parts.push({ geo: backHalf(0.0876, 1.86),
                     matrix: M4(0, 1.556, -0.002, 0, 0, 0, SK[0], SK[1], SK[2]), color: o.hair });
        parts.push({ geo: fringe(0.0874),
                     matrix: M4(0, 1.556, -0.002, 0, 0, 0, SK[0] + 0.01, SK[1] + 0.01, SK[2] + 0.01), color: o.hair });
        if (o.hairStyle === 'long') {
          parts.push({ geo: box(0.142, 0.150, 0.046), matrix: M4(0, 1.474, -0.062), color: o.hair });
          parts.push({ geo: sph(0.038, 10), matrix: M4(0.077, 1.502, -0.024, 0, 0, 0, 0.72, 1.55, 0.95), color: o.hair });
          parts.push({ geo: sph(0.038, 10), matrix: M4(-0.077, 1.502, -0.024, 0, 0, 0, 0.72, 1.55, 0.95), color: o.hair });
        } else if (o.hairStyle === 'bun') {
          parts.push({ geo: sph(0.043, 12), matrix: M4(0, 1.578, -0.094), color: o.hair });
          parts.push({ geo: new THREE.TorusGeometry(0.037, 0.0075, 6, 14), matrix: M4(0, 1.578, -0.094), color: shade(o.hair, 1.35) });
        } else {
          parts.push({ geo: box(0.120, 0.048, 0.032), matrix: M4(0, 1.508, -0.070), color: o.hair });
        }
      }
      const upper = mergeParts(parts);

      /* ----------------------------- الساق ---------------------------- */
      const leg = (side) => mergeParts([
        { geo: sph(0.079, 12), matrix: M4(0, -0.014, 0, 0, 0, 0, 1, 0.95, 1), color: o.pants },
        { geo: taper(0.074, 0.062, 0.325, 10), matrix: M4(0, -0.205, 0), color: o.pants },
        { geo: sph(0.063, 10), matrix: M4(0, -0.392, 0.004), color: o.pants },
        { geo: taper(0.060, 0.047, 0.300, 10), matrix: M4(0, -0.556, -0.002), color: o.pants },
        { geo: new THREE.TorusGeometry(0.050, 0.009, 6, 12), matrix: M4(0, -0.706, -0.002, Math.PI / 2, 0, 0), color: shade(o.pants, 0.78) },
        { geo: sph(0.043, 10), matrix: M4(0, -0.730, 0.002), color: o.shoe },
        { geo: box(0.082, 0.056, 0.170), matrix: M4(0, -0.786, 0.038), color: o.shoe },
        { geo: sph(0.042, 10), matrix: M4(0, -0.782, 0.112, 0, 0, 0, 0.95, 0.66, 1.0), color: o.shoe },
        { geo: box(0.090, 0.020, 0.192), matrix: M4(0, -0.820, 0.041), color: 0x24242a },
        { geo: box(0.070, 0.010, 0.030), matrix: M4(0, -0.772, -0.044), color: o.trim }
      ]);

      return { upper, legL: leg(1), legR: leg(-1), armL: arm(1), armR: arm(-1),
               outfit: o, armX: 0.166 * B, legX: 0.082 * B, tall: o.tall };
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
    const hipY = 0.92;

    /* أخفض نقطة في الحذاء بالنسبة إلى أصل المجسّم: بدون إزاحتها كان
       المارّة يقفون معلّقين فوق الرصيف (٩ سم) بدل أن تلمس أقدامهم الأرض،
       ويزداد الخطأ مع اختلاف الأطوال لأن المقياس يضاعفه. */
    if (v.footOff == null) {
      v.legL.computeBoundingBox();
      v.footOff = hipY + v.legL.boundingBox.min.y;
    }

    const root = new THREE.Group();
    root.scale.setScalar(v.tall || 1);           // فروق الطول بين الناس
    const rig = new THREE.Group();
    rig.position.y = -v.footOff;                 // تُلامس الأقدام y = 0 تماماً
    root.add(rig);

    const upper = new THREE.Mesh(v.upper, mat);
    upper.castShadow = true;
    rig.add(upper);
    const legX = v.legX || 0.085;
    const legL = new THREE.Group(); legL.position.set(legX, hipY, 0);
    const legR = new THREE.Group(); legR.position.set(-legX, hipY, 0);
    const mL = new THREE.Mesh(v.legL, mat), mR = new THREE.Mesh(v.legR, mat);
    mL.castShadow = mR.castShadow = true;
    legL.add(mL); legR.add(mR);
    rig.add(legL); rig.add(legR);

    const shY = 1.352;
    const armX = v.armX || 0.166;
    const armL = new THREE.Group(); armL.position.set(armX, shY, 0);
    const armR = new THREE.Group(); armR.position.set(-armX, shY, 0);
    const aL = new THREE.Mesh(v.armL, mat), aR = new THREE.Mesh(v.armR, mat);
    aL.castShadow = aR.castShadow = true;
    armL.add(aL); armR.add(aR);
    rig.add(armL); rig.add(armR);

    return { root, rig, upper, legL, legR, armL, armR, phase: Math.random() * 6.283 };
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

  function pedVariantCount() { return PED_OUTFITS.length; }

  return { create, createSimple, createWalker, walkerVariants, mergeParts, steeringWheel,
           pedVariantCount, PALETTE, PED_OUTFITS };
})();
