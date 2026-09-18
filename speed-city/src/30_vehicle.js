/* ============================================================================
   SPEED CITY — فيزياء المركبات (نموذج الدرّاجة Bicycle Model المبسّط)
   إحساس أركيد: تسارع سريع، انزلاق عند اليد الفرامل، وثبات على السرعات العالية
   ========================================================================== */
SC.cars = {
  /* إضافة سيارة جديدة = إدخال واحد هنا. الحقول المطلوبة:
       key        مفتاح النموذج في SC.assets (من قائمة MODELS في 95_boot.js)
       name/tag   الاسم والوصف
       price      السعر (0 = مملوكة من البداية)
       cls        الفئة D..S
       mass/power/brake/topSpeed/grip/steerMax/dragK/nitro   إحساس القيادة
       stats      أعمدة المتجر (speed/accel/grip من 0 إلى 100)
       driver     مقعد السائق ومقوده وعينه
     إن لم يُحمَّل النموذج، تعمل السيارة بنموذج بديل ولا تتعطّل اللعبة. */
  defs: {
    cortina: {
      key: 'car_cortina', name: 'فورد كورتينا لوتس', tag: 'كلاسيكية · 1965',
      price: 0, cls: 'B', color: 0xf2f2f2,
      mass: 1050, power: 9800, brake: 15000, topSpeed: 51,       // م/ث ≈ 184 كم/س
      grip: 1.06, steerMax: 0.60, dragK: 0.42, nitro: 1.0,
      stats: { speed: 62, accel: 58, grip: 70 }, seatH: 0.62, lean: 0.075,
      driver: { pose: 'car', scale: 0.92, seat: [0.32, 0.40, 0.08], wheel: [0.30, 0.83, 0.58],
                wheelR: 0.19, eye: [0.32, 1.12, 0.02] }
    },
    bike: {
      key: 'bike_cyberpunk', name: 'دراجة سايبر X', tag: 'خارقة · تجريبية',
      price: 32000, cls: 'S', color: 0x22d3ee,
      mass: 260, power: 4200, brake: 7200, topSpeed: 68,          // ≈ 245 كم/س
      grip: 1.02, steerMax: 0.68, dragK: 0.18, nitro: 1.35,
      stats: { speed: 92, accel: 95, grip: 66 }, seatH: 0.55, lean: 0.62, leanIn: true,
      driver: { pose: 'bike', scale: 0.90, seat: [0, 0.71, -0.20], wheel: [0, 0.86, 0.47],
                wheelR: 0.235, eye: [0, 1.34, -0.02] }
    },
    van: {
      key: 'van_motorhome', name: 'بيت متنقّل GMC', tag: 'ثقيلة · رحلات',
      price: 58000, cls: 'D', color: 0xd08a2a,
      mass: 3400, power: 21000, brake: 30000, topSpeed: 39,       // ≈ 140 كم/س
      grip: 0.86, steerMax: 0.46, dragK: 1.05, nitro: 0.75,
      stats: { speed: 40, accel: 30, grip: 42 }, seatH: 1.35, lean: 0.06,
      driver: { pose: 'car', scale: 1.0, seat: [0.70, 1.26, 2.98], wheel: [0.70, 1.84, 3.32],
                wheelR: 0.22, eye: [0.70, 1.99, 2.94] }
    },

    /* ------- نسخ مضبوطة تُباع في المعرض: إحساس قيادة مختلف تماماً ------- */
    cortina_gt: {
      key: 'car_cortina', name: 'كورتينا GT سباق', tag: 'مضبوطة · حلبة',
      price: 24000, cls: 'A', color: 0xd92b2b,
      mass: 940, power: 14200, brake: 19000, topSpeed: 60,        // ≈ 216 كم/س
      grip: 1.18, steerMax: 0.66, dragK: 0.36, nitro: 1.2,
      stats: { speed: 76, accel: 78, grip: 84 }, seatH: 0.62, lean: 0.055,
      driver: { pose: 'car', scale: 0.92, seat: [0.32, 0.40, 0.08], wheel: [0.30, 0.83, 0.58],
                wheelR: 0.19, eye: [0.32, 1.12, 0.02] }
    },
    cortina_drift: {
      key: 'car_cortina', name: 'كورتينا دريفت', tag: 'خلفية · انزلاق',
      price: 41000, cls: 'A', color: 0x1f2937,
      mass: 1000, power: 16500, brake: 16000, topSpeed: 57,       // ≈ 205 كم/س
      grip: 0.92, steerMax: 0.74, dragK: 0.40, nitro: 1.25,
      stats: { speed: 70, accel: 84, grip: 52 }, seatH: 0.62, lean: 0.09,
      driver: { pose: 'car', scale: 0.92, seat: [0.32, 0.40, 0.08], wheel: [0.30, 0.83, 0.58],
                wheelR: 0.19, eye: [0.32, 1.12, 0.02] }
    },
    bike_street: {
      key: 'bike_cyberpunk', name: 'دراجة الشارع', tag: 'خفيفة · للمدينة',
      price: 12500, cls: 'B', color: 0xf59e0b,
      mass: 220, power: 2700, brake: 6200, topSpeed: 52,          // ≈ 187 كم/س
      grip: 1.10, steerMax: 0.72, dragK: 0.20, nitro: 1.0,
      stats: { speed: 62, accel: 72, grip: 74 }, seatH: 0.55, lean: 0.55, leanIn: true,
      driver: { pose: 'bike', scale: 0.90, seat: [0, 0.71, -0.20], wheel: [0, 0.86, 0.47],
                wheelR: 0.235, eye: [0, 1.34, -0.02] }
    },
    van_box: {
      key: 'van_motorhome', name: 'شاحنة نقل', tag: 'حمولات · مُحسَّنة',
      price: 96000, cls: 'C', color: 0x2563eb,
      mass: 3000, power: 26000, brake: 33000, topSpeed: 45,       // ≈ 162 كم/س
      grip: 0.95, steerMax: 0.50, dragK: 0.92, nitro: 0.9,
      stats: { speed: 52, accel: 44, grip: 55 }, seatH: 1.35, lean: 0.05,
      driver: { pose: 'car', scale: 1.0, seat: [0.70, 1.26, 2.98], wheel: [0.70, 1.84, 3.32],
                wheelR: 0.22, eye: [0.70, 1.99, 2.94] }
    }
  }
};
/* ترتيب العرض في المعرض: الأرخص أولاً */
SC.cars.order = Object.keys(SC.cars.defs)
  .sort((a, b) => SC.cars.defs[a].price - SC.cars.defs[b].price);
/* المركبات التي تصلح لمهام كل فئة */
SC.cars.family = (id) => {
  const k = (SC.cars.defs[id] || {}).key || '';
  return k.indexOf('bike') >= 0 ? 'bike' : k.indexOf('van') >= 0 ? 'van' : 'cortina';
};

SC.Vehicle = (function () {
  const U = SC.util;
  const G = 9.81;
  const _v = new THREE.Vector3();

  class Vehicle {
    constructor(id, opts) {
      opts = opts || {};
      this.id = id;
      this.def = SC.cars.defs[id];
      this.isPlayer = !!opts.player;
      this.upgrades = opts.upgrades || { engine: 0, tires: 0, brakes: 0, nitro: 0 };

      let model = SC.assets.get(this.def.key);
      this.root = new THREE.Group();
      if (model) {
        this.size = model.size.clone();
        this.body = SC.assets.clone(this.def.key);
      } else {
        /* النموذج لم يُحمَّل: نبني هيكلاً بديلاً حتى تبقى اللعبة قابلة للّعب */
        console.warn('نموذج مفقود: ' + this.def.key + ' — استُخدم هيكل بديل');
        this.size = new THREE.Vector3(1.8, 1.4, 4.3);
        this.body = SC.Vehicle.placeholder(this.def.color || 0x9aa4b2, this.size);
      }
      this.root.add(this.body);

      this.halfLen = this.size.z * 0.5;
      this.halfWid = this.size.x * 0.5;
      this.wheelBase = this.size.z * 0.62;

      /* حالة الفيزياء */
      this.pos = new THREE.Vector3();
      this.yaw = 0;
      this.vLong = 0; this.vLat = 0; this.yawRate = 0;
      this.speed = 0;                       // م/ث (موجب للأمام)
      this.gear = 1; this.rpm = 0.15;
      this.nitro = 1; this.nitroActive = false;
      this.groundY = 0; this.bodyY = 0; this.bodyVY = 0; this.sink = 0;
      this.roll = 0; this.pitch = 0;
      this.isBike = !!this.def.leanIn;      // الدرّاجات تميل داخل المنعطف
      this.wheelie = 0; this.wheelieTime = 0; this.stoppie = 0;
      this.slip = 0; this.impact = 0; this.airborne = false;
      this.distance = 0; this.topSpeedSeen = 0;
      this.input = { throttle: 0, brake: 0, steer: 0, handbrake: 0, boost: 0, wheelie: 0 };
      this.steerAngle = 0;

      this.cabin = new THREE.Group();       // تتبع ميلان الهيكل ليجلس السائق بثبات
      this.root.add(this.cabin);

      this._setupWheels();
      this._setupLights();
      this._setupShadow();
      if (opts.driver !== false) this._setupDriver(opts);
    }

    /* --------------------------- السائق/الراكب -------------------------- */
    _setupDriver(opts) {
      const cfg = this.def.driver;
      if (!cfg || !SC.character) return;
      const colors = {};
      if (cfg.pose === 'bike') colors.helmet = opts.helmet || 0xe23b3b;
      this.driver = opts.simpleDriver
        ? SC.character.createSimple({ pose: cfg.pose, variant: opts.variant })
        : SC.character.create({ pose: cfg.pose, colors });
      this.driver.root.position.set(cfg.seat[0], cfg.seat[1], cfg.seat[2]);
      this.driver.root.scale.setScalar(cfg.scale || 1);
      this.cabin.add(this.driver.root);
      this.wheelPos = new THREE.Vector3(cfg.wheel[0], cfg.wheel[1], cfg.wheel[2]);
      this._handL = new THREE.Vector3();
      this._handR = new THREE.Vector3();
      /* مقود ظاهر للدراجة فقط (المقود موجود أصلاً داخل نماذج السيارات) */
      if (cfg.bars) {
        const bar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.022, cfg.wheelR * 2.2, 8),
          new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.4, metalness: 0.6 })
        );
        bar.rotation.z = Math.PI / 2;
        bar.position.copy(this.wheelPos);
        this.cabin.add(bar);
      }
    }

    _updateDriver(dt) {
      if (!this.driver || this.driver.simple) return;
      const cfg = this.def.driver;
      const r = cfg.wheelR;
      // اليدان تنزلقان على المقود مع زاوية التوجيه
      const a = U.clamp(this.steerAngle * 2.2, -0.9, 0.9);
      const base = cfg.pose === 'bike' ? 0 : 0.85;      // وضع اليدين ١٠ و٢
      const aL = base + a, aR = -base + a;
      this._handL.set(this.wheelPos.x + Math.cos(aL) * r, this.wheelPos.y + Math.sin(aL) * r * 0.72, this.wheelPos.z - Math.sin(aL) * r * 0.30);
      this._handR.set(this.wheelPos.x - Math.cos(aR) * r, this.wheelPos.y - Math.sin(aR) * r * 0.72, this.wheelPos.z + Math.sin(aR) * r * 0.30);
      this.cabin.updateMatrixWorld(true);
      const hL = this.cabin.localToWorld(this._handL.clone());
      const hR = this.cabin.localToWorld(this._handR.clone());
      this.driver.update(dt, {
        hands: [hL, hR],
        lat: U.clamp(this.vLat / 6, -1, 1),
        lon: U.clamp(this.accLongSmooth / 9, -1, 1),
        look: U.clamp(this.steerAngle * 1.6, -1, 1)
      });
    }

    /* ------------------------------ التجهيز ---------------------------- */
    _setupWheels() {
      this.wheels = [];
      this.body.traverse((o) => {
        if (o.userData && o.userData.wheel) this.wheels.push({ pivot: o, ...o.userData.wheel, spin: 0 });
      });
      this.wheels.forEach((w) => { w.pivot.rotation.order = 'YXZ'; });
      this.hasWheels = this.wheels.length >= 2;
    }

    _setupLights() {
      const S = this.size;
      const mk = (w, h, color, ei) => new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({
          color, emissive: color, emissiveIntensity: ei, roughness: 0.3,
          transparent: true, opacity: 0.95, side: THREE.DoubleSide
        })
      );
      this.tail = new THREE.Group();
      const tw = Math.min(0.42, S.x * 0.22);
      [-1, 1].forEach((s) => {
        const l = mk(tw, 0.16, 0xff2b18, 0);
        l.position.set(s * S.x * 0.32, S.y * 0.36, -S.z * 0.5 - 0.02);
        l.rotation.y = Math.PI;
        this.tail.add(l);
      });
      this.root.add(this.tail);

      this.head = new THREE.Group();
      [-1, 1].forEach((s) => {
        const l = mk(tw * 0.9, 0.18, 0xfff2cc, 0);
        l.position.set(s * S.x * 0.33, S.y * 0.42, S.z * 0.5 + 0.02);
        this.head.add(l);
      });
      this.root.add(this.head);

      /* مخروط ضوء أمامي يظهر ليلاً */
      const beamGeo = new THREE.ConeGeometry(2.6, 17, 14, 1, true);
      beamGeo.translate(0, -8.5, 0);
      beamGeo.rotateX(Math.PI / 2);
      this.beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
        color: 0xfff0c8, transparent: true, opacity: 0.028,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      }));
      this.beam.position.set(0, S.y * 0.42, S.z * 0.5);
      this.beam.visible = false;
      this.root.add(this.beam);

      /* بركة ضوء على الأرض أمام المركبة */
      const pool = new THREE.Mesh(
        new THREE.PlaneGeometry(9, 20),
        new THREE.MeshBasicMaterial({
          map: SC.world.TEX.smoke, color: 0xffe9bb, transparent: true, opacity: 0.30,
          blending: THREE.AdditiveBlending, depthWrite: false
        })
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(0, 0.05, S.z * 0.5 + 8);
      pool.renderOrder = 3;
      pool.visible = false;
      this.pool = pool;
      this.root.add(pool);

      /* لهب العادم عند النيترو */
      const fl = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 1.15, 8),
        new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      fl.rotation.x = Math.PI / 2;
      fl.position.set(0, S.y * 0.22, -S.z * 0.52);
      fl.visible = false;
      this.flame = fl;
      this.root.add(fl);
    }

    _setupShadow() {
      if (!SC.world.TEX.smoke) return;
      const geo = new THREE.PlaneGeometry(this.size.x * 2.1, this.size.z * 1.25);
      const mat = new THREE.MeshBasicMaterial({
        map: SC.world.TEX.smoke, color: 0x000000, transparent: true,
        opacity: 0.34, depthWrite: false
      });
      const s = new THREE.Mesh(geo, mat);
      s.rotation.x = -Math.PI / 2;
      s.renderOrder = 4;
      this.contact = s;
      this.root.add(s);
    }

    setFirstPerson(on) {
      this.firstPerson = !!on;
      if (this.driver) this.driver.setFirstPerson(!!on);
      /* ضوء خافت داخل المقصورة: بدونه تبدو لوحة القيادة سوداء تماماً */
      if (on && !this.cabinLight) {
        const d = this.def.driver;
        const eye = d ? d.eye : [0, this.def.seatH + 0.35, 0];
        const L = new THREE.PointLight(0xdfe8f5, 2.6, 4.2, 2);
        L.position.set(eye[0], eye[1] + 0.30, eye[2] + 0.30);
        this.cabin.add(L);
        this.cabinLight = L;
      }
      if (this.cabinLight) this.cabinLight.visible = !!on;
    }

    setColor(hex) {
      this.body.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (m && /paint|body|color|carpaint/i.test(m.name || '')) {
            if (!m.userData._orig) { m.userData._orig = true; }
            m.color.setHex(hex);
          }
        });
      });
    }

    /* --------------------------- إعادة الوضع --------------------------- */
    place(x, z, yaw) {
      this.sink = 0;
      this.wheelie = 0; this.stoppie = 0; this.wheelieTime = 0;
      this.pos.set(x, SC.world.groundHeight(x, z), z);
      this.yaw = yaw || 0;
      this.vLong = this.vLat = this.yawRate = this.speed = 0;
      this.roll = this.pitch = this.bodyVY = 0;
      this._gx = this._gz = null;
      this.root.position.copy(this.pos);
      this.root.rotation.set(0, this.yaw, 0);
      this.body.rotation.set(0, 0, 0);
    }

    get power() { return this.def.power * (1 + this.upgrades.engine * 0.11); }
    get gripMul() { return 1 + this.upgrades.tires * 0.07; }
    get brakeForce() { return this.def.brake * (1 + this.upgrades.brakes * 0.13); }
    get nitroPower() { return this.def.nitro * (1 + this.upgrades.nitro * 0.15); }
    get kmh() { return Math.abs(this.speed) * 3.6; }

    /* ------------------------------ التحديث ---------------------------- */
    update(dt, input) {
      dt = Math.min(dt, 1 / 30);
      const inp = input || this.input;
      const def = this.def;
      const mass = def.mass;

      /* --- المقود: تقلّ زاويته كلما زادت السرعة --- */
      const spd = Math.abs(this.vLong);
      /* أثناء الوقوف على عجلة تفقد العجلة الأمامية ملامسة الأرض، فيضعف التوجيه */
      const wlift = this.wheelie || 0, slift = this.stoppie || 0;
      const steerLimit = def.steerMax * (1 - 0.38 * U.clamp(spd / 46, 0, 1)) * (1 - 0.62 * wlift);
      const steerRate = (5.2 - 2.2 * U.clamp(spd / 40, 0, 1)) * dt;
      // ملاحظة: محور yaw في three يدور نحو +X، وهو يسار الشاشة عند النظر للأمام،
      // لذا نعكس الإشارة حتى يكون "يمين" في الأزرار = يمين على الشاشة فعلاً.
      this.steerAngle = U.moveToward(this.steerAngle, -inp.steer * steerLimit, steerRate * def.steerMax * 4);
      this.steerAngle = U.clamp(this.steerAngle, -steerLimit, steerLimit);
      if (Math.abs(inp.steer) < 0.02) this.steerAngle = U.damp(this.steerAngle, 0, 9, dt);

      /* مساعدة الثبات: تصحيح تلقائي خفيف عكس الانزلاق (يمكن إطفاؤها) */
      if (SC.settings && SC.settings.assist !== false && inp.handbrake < 0.5 && spd > 4) {
        const beta = Math.atan2(this.vLat, Math.abs(this.vLong) + 1.5);
        this.steerAngle = U.clamp(this.steerAngle + U.clamp(beta * 0.42, -0.14, 0.14),
          -steerLimit * 1.35, steerLimit * 1.35);
      }

      /* --- النيترو --- */
      const wantBoost = inp.boost > 0.5 && this.nitro > 0.02 && this.vLong > -1;
      this.nitroActive = wantBoost;
      this.nitro = U.clamp(this.nitro + (wantBoost ? -0.34 : 0.085) * dt, 0, 1);

      /* --- القوى الطولية --- */
      const vmax = def.topSpeed * (1 + this.upgrades.engine * 0.035) * (this.nitroActive ? 1.18 : 1);
      let F = 0;
      const thr = inp.throttle, brk = inp.brake;
      if (thr > 0.01) {
        const fade = U.clamp(1 - Math.max(0, this.vLong) / vmax, 0, 1);
        F += this.power * thr * (0.35 + 0.65 * fade) * (this.nitroActive ? (1 + this.nitroPower) : 1);
      }
      if (brk > 0.01) {
        if (this.vLong > 0.4) F -= this.brakeForce * brk;
        else if (this.vLong > -8.5) F -= this.power * 0.5 * brk;   // رجوع للخلف بسرعة محدودة
      }
      F -= def.dragK * this.vLong * Math.abs(this.vLong);   // مقاومة الهواء
      F -= Math.abs(this.vLat) * 26;                        // احتكاك الإطارات في المنعطف
      F -= 11 * this.vLong;                                 // مقاومة الدحرجة
      if (inp.handbrake > 0.5 && this.vLong > 0) F -= this.brakeForce * 0.45;

      /* --- انزلاق العجلات (نموذج الدرّاجة) --- */
      const grip = def.grip * this.gripMul * (SC.world.onRoad(this.pos.x, this.pos.z) ? 1 : 0.78);
      const a = this.wheelBase * 0.5, b = this.wheelBase * 0.5;
      const eps = 2.2;
      const vAbs = Math.max(Math.abs(this.vLong), eps);
      const hb = inp.handbrake > 0.5;

      let slipF = Math.atan2(this.vLat + this.yawRate * a, vAbs) - this.steerAngle * Math.sign(this.vLong || 1);
      let slipR = Math.atan2(this.vLat - this.yawRate * b, vAbs);
      /* ثبات خلفي يزداد مع السرعة (مثل الضغط الهوائي): انعطاف حادّ في المدينة
         بلا فقدان السيطرة على السرعات العالية */
      const dfR = 1 + U.clamp(Math.abs(this.vLong) / 52, 0, 0.95);
      /* نقل الحِمل: رفع المقدّمة يفرّغ الإطار الأمامي ويضغط الخلفي، والعكس بالعكس */
      const loadF = 1 - 0.86 * wlift + 0.30 * slift;
      const loadR = 1 + 0.22 * wlift - 0.88 * slift;
      const Cf = 14.0 * mass * grip * loadF, Cr = 13.0 * mass * grip * dfR * (hb ? 0.42 : 1) * loadR;
      const maxF = grip * mass * G * 0.64 * loadF;
      const maxR = grip * mass * G * 0.58 * dfR * (hb ? 0.42 : 1) * loadR;
      let Fyf = U.clamp(-Cf * slipF, -maxF, maxF);
      let Fyr = U.clamp(-Cr * slipR, -maxR, maxR);

      /* دائرة الالتصاق: القوة الدافعة تقلّل التماسك الجانبي الخلفي */
      const useLong = Math.abs(F) / (grip * mass * G);
      if (useLong > 0.75) Fyr *= U.clamp(1.75 - useLong, 0.25, 1);

      const accLong = F / mass + this.yawRate * this.vLat;
      const accLat = (Fyf * Math.cos(this.steerAngle) + Fyr) / mass - this.yawRate * this.vLong;
      const Izz = mass * (this.wheelBase * this.wheelBase + this.size.x * this.size.x) / 11;
      /* تخميد الالتفاف: يمنع دوران المركبة حول نفسها بلا توقّف */
      const yawDamp = this.yawRate * (1.15 + Math.abs(this.vLong) * 0.045 + 2.6 * wlift + 1.4 * slift) * (hb ? 0.4 : 1);
      const yawAcc = (a * Fyf * Math.cos(this.steerAngle) - b * Fyr) / Izz - yawDamp;

      this.vLong += accLong * dt;
      this.vLat += accLat * dt;
      this.yawRate += yawAcc * dt;

      /* عند السرعات المنخفضة نستخدم توجيهاً هندسياً لتفادي الاهتزاز */
      const lowT = U.clamp((Math.abs(this.vLong) - 0.6) / 5.0, 0, 1);
      const kinYaw = (this.vLong / this.wheelBase) * Math.tan(this.steerAngle);
      this.yawRate = U.lerp(kinYaw, this.yawRate, lowT);
      this.vLat *= (0.02 + 0.98 * lowT);
      if (Math.abs(this.vLong) < 0.25 && thr < 0.02 && brk < 0.02) { this.vLong *= 0.86; this.yawRate *= 0.7; }
      /* عند السرعة شبه المعدومة لا معنى لدوران المركبة حول نفسها */
      if (Math.abs(this.vLong) < 1.2) this.yawRate = U.damp(this.yawRate, 0, 9, dt);
      const yawCap = Math.min(3.2, 0.9 + Math.abs(this.vLong) * 0.20);
      this.yawRate = U.clamp(this.yawRate, -yawCap, yawCap);

      /* --- دمج الحركة --- */
      this.yaw += this.yawRate * dt;
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      const dx = (this.vLong * s + this.vLat * c) * dt;
      const dz = (this.vLong * c - this.vLat * s) * dt;
      this.pos.x += dx; this.pos.z += dz;
      this.distance += Math.hypot(dx, dz);
      this.speed = this.vLong;
      this.topSpeedSeen = Math.max(this.topSpeedSeen, this.kmh);
      this.slip = U.clamp(Math.abs(this.vLat) / 7, 0, 1);

      this._collide(dt);
      this._followGround(dt, accLong, accLat);
      this._visuals(dt, accLong, accLat);
      this._engine(dt);
      this.impact = Math.max(0, this.impact - dt * 2.6);
      return this;
    }

    /* --------------------------- الاصطدامات ---------------------------- */
    _collide(dt) {
      const r = this.halfWid * 0.95;
      const s0 = Math.sin(this.yaw), c0 = Math.cos(this.yaw);
      const L = this.halfLen;
      const pts = [
        { x: this.pos.x + s0 * L * 0.80, z: this.pos.z + c0 * L * 0.80 },
        { x: this.pos.x, z: this.pos.z },
        { x: this.pos.x - s0 * L * 0.80, z: this.pos.z - c0 * L * 0.80 }
      ];
      const list = SC.world.queryColliders(this.pos.x, this.pos.z, this.halfLen + 2);
      let hit = 0, nx = 0, nz = 0;

      for (const col of list) {
        for (const p of pts) {
          const cx = U.clamp(p.x, col.minX, col.maxX);
          const cz = U.clamp(p.z, col.minZ, col.maxZ);
          let ddx = p.x - cx, ddz = p.z - cz;
          let d2 = ddx * ddx + ddz * ddz;
          if (d2 > r * r) continue;
          let d = Math.sqrt(d2);
          if (d < 1e-4) {                        // داخل الصندوق: ادفع لأقرب حافة
            const dl = p.x - col.minX, dr = col.maxX - p.x;
            const db = p.z - col.minZ, dt2 = col.maxZ - p.z;
            const m = Math.min(dl, dr, db, dt2);
            ddx = m === dl ? -1 : m === dr ? 1 : 0;
            ddz = m === db ? -1 : m === dt2 ? 1 : 0;
            d = 0.001;
          }
          const inv = 1 / d;
          const ux = ddx * inv, uz = ddz * inv;
          const push = (r - d);
          this.pos.x += ux * push; this.pos.z += uz * push;
          nx += ux; nz += uz; hit++;
        }
      }
      if (!hit) return;
      const inv = 1 / Math.hypot(nx, nz) || 0;
      nx *= inv; nz *= inv;
      // تحويل متجه الاصطدام إلى إحداثيات المركبة
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      const nLong = nx * s + nz * c;
      const nLat = nx * c - nz * s;
      const vN = this.vLong * nLong + this.vLat * nLat;
      if (vN < 0) {
        const j = -vN * 1.28;
        this.vLong += j * nLong; this.vLat += j * nLat;
        this.vLong *= 0.72; this.vLat *= 0.72;
        this.yawRate *= 0.55;
        this.impact = Math.min(1, Math.abs(vN) / 14);
        this.bodyVY += Math.min(2.4, Math.abs(vN) * 0.14);
        if (this.onImpact) this.onImpact(this.impact);
      }
    }

    /* ------------------------ ملامسة الأرض والرصيف ---------------------- */
    _followGround(dt, accLong) {
      const gy = SC.world.groundHeight(this.pos.x, this.pos.z);
      const diff = gy - this.groundY;
      /* الرصيف حافّة مفاجئة، أمّا منحدر الجسر فصعود ناعم. نميّز بينهما
         بالميل لا بفرق الارتفاع: على 120 كم/س يرتفع الجسر ٥ سم كل إطار،
         وكان ذلك يُحسب رصيفاً في كل إطار فيهتزّ المشهد ويرتجّ التعليق. */
      const moved = Math.hypot(this.pos.x - (this._gx == null ? this.pos.x : this._gx),
                               this.pos.z - (this._gz == null ? this.pos.z : this._gz));
      const grade = Math.abs(diff) / Math.max(moved, 0.004);
      this._gx = this.pos.x; this._gz = this.pos.z;
      if (Math.abs(diff) > 0.02 && grade > 0.40) {  // صعود/نزول رصيف حقيقي
        this.bodyVY += diff > 0 ? 1.5 : -1.1;
        if (this.kmh > 25 && this.onCurb) this.onCurb(Math.min(1, this.kmh / 90));
        if (diff > 0) { this.vLong *= 0.985; }
      }
      this.groundY = gy;
      this.pos.y = gy - (this.sink || 0);      // الغرق في البحر

      /* ارتداد التعليق */
      this.bodyVY += (-this.bodyY * 46 - this.bodyVY * 8.5) * dt;
      this.bodyY += this.bodyVY * dt;
      this.bodyY = U.clamp(this.bodyY, -0.12, 0.34);
    }

    /* ------------------- حيل الدرّاجة: الوقوف على عجلة -------------------
       شرطها واقعي: غاز قويّ وسرعة معقولة ومقود شبه مستقيم. أثناءها ترتفع
       المقدّمة فيقلّ أثر التوجيه ويزداد تخميد الانعراج حتى تبقى مسيطراً. */
    _updateStunts(dt) {
      if (!this.isBike) { this.wheelie = 0; this.stoppie = 0; return; }
      const v = Math.abs(this.vLong);
      /* المقود المائل بشدّة يُنزل العجلة — لا يمكن الانعطاف الحادّ على عجلة واحدة */
      const turning = Math.abs(this.input.steer || 0);
      const wantWheelie = (this.input.wheelie > 0.5) && this.input.throttle > 0.55 &&
                          v > 4 && v < this.def.topSpeed * 0.92 &&
                          turning < 0.55 && !this.airborne;
      const wantStoppie = !wantWheelie && this.input.brake > 0.75 && v > 9 && turning < 0.40;
      this.wheelie = U.damp(this.wheelie, wantWheelie ? 1 : 0, wantWheelie ? 3.4 : 5.5, dt);
      this.stoppie = U.damp(this.stoppie, wantStoppie ? 1 : 0, wantStoppie ? 4.5 : 7, dt);
      if (this.wheelie < 0.01) this.wheelie = 0;
      if (this.stoppie < 0.01) this.stoppie = 0;

      /* عدّاد مدّة الحيلة — تُكافأ عند إنهائها */
      const doing = this.wheelie > 0.45 || this.stoppie > 0.45;
      if (doing) this.wheelieTime += dt;
      else if (this.wheelieTime > 0) {
        if (this.onStunt) this.onStunt(this.wheelieTime, this.wheelie > this.stoppie ? 'wheelie' : 'stoppie');
        this.wheelieTime = 0;
      }
    }

    /* --------------------------- المظهر والميلان ------------------------ */
    _visuals(dt, accLong, accLat) {
      this._updateStunts(dt);
      /* ميلان الهيكل: السيارات تميل قليلاً، والدراجة تميل كثيراً كالحقيقة */
      const leanK = (this.def.lean || 0.08) * U.clamp(this.kmh / 55, 0, 1);
      const leanDir = this.def.leanIn ? 1 : -1;     // الدراجة تميل داخل المنعطف
      const targetRoll = U.clamp(-accLat / 22, -1, 1) * leanK * leanDir * (1 - this.wheelie * 0.55);
      let targetPitch = U.clamp(accLong / 40, -0.32, 0.32) * 0.55;
      /* رفع المقدّمة / الوقوف على المقدّمة */
      targetPitch += this.wheelie * 0.62 - this.stoppie * 0.36;
      this.roll = U.damp(this.roll, targetRoll, 7, dt);
      this.pitch = U.damp(this.pitch, targetPitch, 6.5, dt);

      this.root.position.set(this.pos.x, this.pos.y, this.pos.z);
      this.root.rotation.set(0, this.yaw, 0);
      /* الدوران حول العجلة الملامسة للأرض لا حول مركز الهيكل — كالواقع:
         في الوقوف على عجلة المحور هو الخلفية، وفي الوقوف على المقدّمة الأمامية.
         نرفع الهيكل ونزيحه بمقدار يُبقي تلك العجلة ثابتة على الأسفلت. */
      const stuntPitch = this.wheelie * 0.62 - this.stoppie * 0.36;
      let lift = 0, pivotZ = 0;
      if (Math.abs(stuntPitch) > 0.001) {
        const wz = this.halfLen * 0.78;
        const cz = stuntPitch > 0 ? -wz : wz;        // العجلة التي تبقى على الأرض
        lift = -cz * Math.sin(stuntPitch);
        pivotZ = cz - cz * Math.cos(stuntPitch);
      }
      this.body.position.set(0, this.bodyY + lift, pivotZ);
      this.body.rotation.set(-this.pitch, 0, this.roll);
      this.cabin.position.set(0, this.bodyY + lift, pivotZ);
      this.cabin.rotation.set(-this.pitch, 0, this.roll);
      this.accLongSmooth = U.damp(this.accLongSmooth || 0, accLong, 6, dt);
      this._updateDriver(dt);

      if (this.contact) { this.contact.position.y = 0.03 - this.bodyY * 0.4; }

      /* العجلات: دوران مع السرعة + انعطاف الأمامية */
      if (this.hasWheels) {
        for (const w of this.wheels) {
          w.spin -= (this.vLong / Math.max(0.2, w.radius)) * dt;
          w.pivot.rotation.x = w.spin;
          if (w.front) w.pivot.rotation.y = this.steerAngle * 0.9;
        }
      }

      /* الأضواء */
      const braking = this.input.brake > 0.05 && this.vLong > -0.5;
      this.tail.children.forEach((l) => {
        l.material.emissiveIntensity = U.damp(l.material.emissiveIntensity, braking ? 4.2 : (this.lightsOn ? 1.4 : 0), 16, dt);
      });
      this.head.children.forEach((l) => { l.material.emissiveIntensity = this.lightsOn ? 3.4 : 0; });
      if (this.beam) this.beam.visible = !!this.lightsOn;
      if (this.pool) this.pool.visible = !!this.lightsOn;
      if (this.flame) {
        this.flame.visible = this.nitroActive;
        if (this.nitroActive) {
          this.flame.scale.set(0.8 + Math.random() * 0.5, 0.7 + Math.random() * 0.8, 0.8 + Math.random() * 0.5);
        }
      }
    }

    /* ------------------------------ المحرك ------------------------------ */
    _engine(dt) {
      const ratio = U.clamp(Math.abs(this.vLong) / this.def.topSpeed, 0, 1.2);
      const gears = 6;
      const g = U.clamp(Math.floor(ratio * gears) + 1, 1, gears);
      const inGear = (ratio * gears) % 1;
      if (g !== this.gear) { this.gear = g; this.shiftFlash = 0.35; }
      const target = U.clamp(0.16 + inGear * 0.84 + (this.input.throttle > 0.1 ? 0.08 : -0.05), 0.08, 1.1);
      this.rpm = U.damp(this.rpm, this.vLong < -0.5 ? 0.35 : target, 8, dt);
      if (this.shiftFlash) this.shiftFlash = Math.max(0, this.shiftFlash - dt);
    }

    /* موضع نقطة على المركبة (للكاميرا والمؤثرات) */
    localToWorld(x, y, z) {
      return _v.set(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw).add(this.pos).clone();
    }
    get forward() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  }

  /* هيكل بديل بسيط يُستخدم إن تعذّر تحميل نموذج السيارة */
  Vehicle.placeholder = function (color, size) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.45, metalness: 0.35 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x1b2430, roughness: 0.15, metalness: 0.6 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y * 0.55, size.z), mat);
    body.position.y = size.y * 0.34;
    const top = new THREE.Mesh(new THREE.BoxGeometry(size.x * 0.82, size.y * 0.42, size.z * 0.48), glass);
    top.position.set(0, size.y * 0.76, -size.z * 0.05);
    [body, top].forEach((m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); });
    g.userData.size = size.clone();
    return g;
  };

  return Vehicle;
})();
