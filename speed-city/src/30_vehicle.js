/* ============================================================================
   SPEED CITY — فيزياء المركبات (نموذج الدرّاجة Bicycle Model المبسّط)
   إحساس أركيد: تسارع سريع، انزلاق عند اليد الفرامل، وثبات على السرعات العالية
   ========================================================================== */
SC.cars = {
  order: ['cortina', 'bike', 'van'],
  defs: {
    cortina: {
      key: 'car_cortina', name: 'فورد كورتينا لوتس', tag: 'كلاسيكية · 1965',
      price: 0, cls: 'B', color: 0xf2f2f2,
      mass: 1050, power: 9800, brake: 15000, topSpeed: 51,       // م/ث ≈ 184 كم/س
      grip: 1.06, steerMax: 0.60, dragK: 0.42, nitro: 1.0,
      stats: { speed: 62, accel: 58, grip: 70 }, seatH: 0.62
    },
    bike: {
      key: 'bike_cyberpunk', name: 'دراجة سايبر X', tag: 'خارقة · تجريبية',
      price: 32000, cls: 'S', color: 0x22d3ee,
      mass: 260, power: 4200, brake: 7200, topSpeed: 68,          // ≈ 245 كم/س
      grip: 1.02, steerMax: 0.68, dragK: 0.18, nitro: 1.35,
      stats: { speed: 92, accel: 95, grip: 66 }, seatH: 0.55, lean: 0.55
    },
    van: {
      key: 'van_motorhome', name: 'بيت متنقّل GMC', tag: 'ثقيلة · رحلات',
      price: 58000, cls: 'D', color: 0xd08a2a,
      mass: 3400, power: 21000, brake: 30000, topSpeed: 39,       // ≈ 140 كم/س
      grip: 0.86, steerMax: 0.46, dragK: 1.05, nitro: 0.75,
      stats: { speed: 40, accel: 30, grip: 42 }, seatH: 1.35
    }
  }
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

      const model = SC.assets.get(this.def.key);
      this.size = model.size.clone();
      this.root = new THREE.Group();
      this.body = SC.assets.clone(this.def.key);
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
      this.groundY = 0; this.bodyY = 0; this.bodyVY = 0;
      this.roll = 0; this.pitch = 0;
      this.slip = 0; this.impact = 0; this.airborne = false;
      this.distance = 0; this.topSpeedSeen = 0;
      this.input = { throttle: 0, brake: 0, steer: 0, handbrake: 0, boost: 0 };
      this.steerAngle = 0;

      this._setupWheels();
      this._setupLights();
      this._setupShadow();
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
      this.pos.set(x, SC.world.groundHeight(x, z), z);
      this.yaw = yaw || 0;
      this.vLong = this.vLat = this.yawRate = this.speed = 0;
      this.roll = this.pitch = this.bodyVY = 0;
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
      const steerLimit = def.steerMax * (1 - 0.55 * U.clamp(spd / 42, 0, 1));
      const steerRate = (5.2 - 2.2 * U.clamp(spd / 40, 0, 1)) * dt;
      this.steerAngle = U.moveToward(this.steerAngle, inp.steer * steerLimit, steerRate * def.steerMax * 4);
      this.steerAngle = U.clamp(this.steerAngle, -steerLimit, steerLimit);
      if (Math.abs(inp.steer) < 0.02) this.steerAngle = U.damp(this.steerAngle, 0, 9, dt);

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
      const Cf = 11.5 * mass * grip, Cr = 12.5 * mass * grip * (hb ? 0.42 : 1);
      const maxF = grip * mass * G * 0.55;
      const maxR = grip * mass * G * 0.55 * (hb ? 0.42 : 1);
      let Fyf = U.clamp(-Cf * slipF, -maxF, maxF);
      let Fyr = U.clamp(-Cr * slipR, -maxR, maxR);

      /* دائرة الالتصاق: القوة الدافعة تقلّل التماسك الجانبي الخلفي */
      const useLong = Math.abs(F) / (grip * mass * G);
      if (useLong > 0.75) Fyr *= U.clamp(1.75 - useLong, 0.25, 1);

      const accLong = F / mass + this.yawRate * this.vLat;
      const accLat = (Fyf * Math.cos(this.steerAngle) + Fyr) / mass - this.yawRate * this.vLong;
      const Izz = mass * (this.wheelBase * this.wheelBase + this.size.x * this.size.x) / 11;
      const yawAcc = (a * Fyf * Math.cos(this.steerAngle) - b * Fyr) / Izz;

      this.vLong += accLong * dt;
      this.vLat += accLat * dt;
      this.yawRate += yawAcc * dt;

      /* عند السرعات المنخفضة نستخدم توجيهاً هندسياً لتفادي الاهتزاز */
      const lowT = U.clamp((Math.abs(this.vLong) - 0.6) / 5.0, 0, 1);
      const kinYaw = (this.vLong / this.wheelBase) * Math.tan(this.steerAngle);
      this.yawRate = U.lerp(kinYaw, this.yawRate, lowT);
      this.vLat *= (0.02 + 0.98 * lowT);
      if (Math.abs(this.vLong) < 0.25 && thr < 0.02 && brk < 0.02) { this.vLong *= 0.86; this.yawRate *= 0.7; }
      this.yawRate = U.clamp(this.yawRate, -3.4, 3.4);

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
      const r = this.halfWid * 0.92;
      const pts = [
        { x: this.pos.x + Math.sin(this.yaw) * this.halfLen * 0.62, z: this.pos.z + Math.cos(this.yaw) * this.halfLen * 0.62 },
        { x: this.pos.x - Math.sin(this.yaw) * this.halfLen * 0.62, z: this.pos.z - Math.cos(this.yaw) * this.halfLen * 0.62 }
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
      if (Math.abs(diff) > 0.02) {                 // صعود/نزول رصيف
        this.bodyVY += diff > 0 ? 1.5 : -1.1;
        if (this.kmh > 25 && this.onCurb) this.onCurb(Math.min(1, this.kmh / 90));
        if (diff > 0) { this.vLong *= 0.985; }
      }
      this.groundY = gy;
      this.pos.y = gy;

      /* ارتداد التعليق */
      this.bodyVY += (-this.bodyY * 46 - this.bodyVY * 8.5) * dt;
      this.bodyY += this.bodyVY * dt;
      this.bodyY = U.clamp(this.bodyY, -0.12, 0.34);
    }

    /* --------------------------- المظهر والميلان ------------------------ */
    _visuals(dt, accLong, accLat) {
      const lean = this.def.lean || 0.16;
      const targetRoll = U.clamp(-accLat / 26, -0.5, 0.5) * (this.def.lean ? 1.9 : 1) * lean * 6;
      const targetPitch = U.clamp(accLong / 40, -0.32, 0.32) * 0.55;
      this.roll = U.damp(this.roll, targetRoll, 7, dt);
      this.pitch = U.damp(this.pitch, targetPitch, 6.5, dt);

      this.root.position.set(this.pos.x, this.pos.y, this.pos.z);
      this.root.rotation.set(0, this.yaw, 0);
      this.body.position.y = this.bodyY;
      this.body.rotation.set(-this.pitch, 0, this.roll);

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

  return Vehicle;
})();
