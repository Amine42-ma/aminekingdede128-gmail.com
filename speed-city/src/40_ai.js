/* ============================================================================
   SPEED CITY — قيادة الذكاء الاصطناعي: مرور المدينة ومنافسو السباقات
   ========================================================================== */
SC.AIDriver = (function () {
  const U = SC.util;

  class AIDriver {
    constructor(vehicle, opts) {
      opts = opts || {};
      this.v = vehicle;
      this.skill = opts.skill == null ? 0.8 : opts.skill;   // 0..1
      this.targetSpeed = opts.targetSpeed || 18;
      this.path = opts.path || null;                        // مسار السباق
      this.wp = 0; this.lap = 0; this.progress = 0;
      this.stuck = 0; this.reverse = 0;
      this.avoid = 0;
      this.input = { throttle: 0, brake: 0, steer: 0, handbrake: 0, boost: 0 };
    }

    /* الهدف التالي على المسار مع مسافة استباقية حسب السرعة */
    pathTarget() {
      const p = this.path;
      const look = 9 + this.v.kmh * 0.16;
      let idx = this.wp;
      const pos = this.v.pos;
      // تقدّم إلى نقطة المسار التالية عند الاقتراب
      let guard = 0;
      while (guard++ < p.length) {
        const t = p[idx];
        const d = Math.hypot(t.x - pos.x, t.z - pos.z);
        if (d < Math.max(11, look * 0.55)) {
          idx = (idx + 1) % p.length;
          if (idx === 0) this.lap++;
          this.wp = idx;
          this.progress++;
        } else break;
      }
      const a = p[idx], b = p[(idx + 1) % p.length];
      const d = Math.hypot(a.x - pos.x, a.z - pos.z);
      const k = U.clamp((look - d) / Math.max(1, Math.hypot(b.x - a.x, b.z - a.z)), 0, 1);
      return { x: U.lerp(a.x, b.x, k), z: U.lerp(a.z, b.z, k), next: b };
    }

    /* انحناء المسار القادم لتقدير السرعة الآمنة */
    curveAhead() {
      if (!this.path) return 0;
      const p = this.path, n = p.length;
      const a = p[this.wp], b = p[(this.wp + 1) % n], c = p[(this.wp + 2) % n];
      const a1 = Math.atan2(b.x - a.x, b.z - a.z);
      const a2 = Math.atan2(c.x - b.x, c.z - b.z);
      return Math.abs(U.angleDelta(a1, a2));
    }

    steerTo(tx, tz) {
      const v = this.v;
      const desired = Math.atan2(tx - v.pos.x, tz - v.pos.z);
      const diff = U.angleDelta(v.yaw, desired);
      return U.clamp(diff * (1.9 + this.skill * 0.8) - v.yawRate * 0.30, -1, 1);
    }

    update(dt, others) {
      const v = this.v;
      const inp = this.input;
      let target, wantSpeed = this.targetSpeed;

      if (this.path) {
        target = this.pathTarget();
        const curve = this.curveAhead();
        const limit = U.lerp(12, this.targetSpeed, U.clamp(1 - curve * 1.35, 0.18, 1));
        wantSpeed = limit * (0.82 + this.skill * 0.24);
      } else {
        target = this.wander(dt);
      }

      inp.steer = this.steerTo(target.x, target.z);

      /* تفادي المركبات الأمامية */
      let block = 0;
      if (others) {
        for (const o of others) {
          if (o === v) continue;
          const dx = o.pos.x - v.pos.x, dz = o.pos.z - v.pos.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 26) continue;
          const fwdDot = (dx * Math.sin(v.yaw) + dz * Math.cos(v.yaw)) / (dist || 1);
          if (fwdDot < 0.55) continue;
          const lateral = dx * Math.cos(v.yaw) - dz * Math.sin(v.yaw);
          if (Math.abs(lateral) > 3.6) continue;
          block = Math.max(block, U.clamp(1 - (dist - 6) / 20, 0, 1));
          inp.steer += (lateral > 0 ? -0.5 : 0.5) * block * 0.7;
        }
      }
      inp.steer = U.clamp(inp.steer, -1, 1);
      wantSpeed *= (1 - block * 0.85);

      const spd = v.speed;
      const err = wantSpeed - spd;
      inp.throttle = U.clamp(err * 0.35, 0, 1);
      inp.brake = U.clamp(-err * 0.22, 0, 1);
      inp.handbrake = 0;
      inp.boost = (this.path && this.skill > 0.7 && Math.abs(inp.steer) < 0.2 && spd > this.targetSpeed * 0.6) ? 1 : 0;

      /* الخروج من الانحشار */
      if (Math.abs(spd) < 1.2 && this.reverse <= 0) this.stuck += dt; else this.stuck = 0;
      if (this.stuck > 1.6) { this.reverse = 1.1; this.stuck = 0; }
      if (this.reverse > 0) {
        this.reverse -= dt;
        inp.throttle = 0; inp.brake = 1; inp.steer *= -1;
      }
      v.input = inp;
      v.update(dt, inp);
      return this;
    }

    /* ------------------ تجوال في شوارع المدينة (مرور) ------------------- */
    wander(dt) {
      const W = SC.world, P = W.CFG.pitch, H = W.CFG.half;
      const v = this.v;
      if (!this.dir) {
        const snapped = W.snapToRoad(v.pos.x, v.pos.z);
        this.dir = snapped.axis === 'z' ? { x: 0, z: 1 } : { x: 1, z: 0 };
        this.lane = snapped;
        this.node = this.nextNode();
      }
      const d = Math.hypot(this.node.x - v.pos.x, this.node.z - v.pos.z);
      if (d < 16) {
        // عند التقاطع: استمر أو انعطف (بدون العودة للخلف)
        const r = Math.random();
        if (r < 0.45) { /* استمرار */ }
        else if (r < 0.72) this.dir = { x: -this.dir.z, z: this.dir.x };
        else this.dir = { x: this.dir.z, z: -this.dir.x };
        this.node = this.nextNode();
      }
      // القيادة على يمين الشارع
      const off = 5.5;
      return { x: this.node.x - this.dir.z * off, z: this.node.z + this.dir.x * off };
    }

    nextNode() {
      const W = SC.world, P = W.CFG.pitch, H = W.CFG.half;
      const v = this.v;
      const gx = Math.round((v.pos.x + H) / P), gz = Math.round((v.pos.z + H) / P);
      let nx = gx + this.dir.x, nz = gz + this.dir.z;
      const N = W.CFG.blocks;
      if (nx < 0 || nx > N || nz < 0 || nz > N) {          // ارتد عند الحافة
        this.dir = { x: -this.dir.x, z: -this.dir.z };
        nx = gx + this.dir.x; nz = gz + this.dir.z;
      }
      return { x: -H + U.clamp(nx, 0, N) * P, z: -H + U.clamp(nz, 0, N) * P };
    }
  }

  return AIDriver;
})();

/* ---------------------------------------------------------------------------
   مدير مرور المدينة: سيارات تتحرك حول اللاعب وتُعاد ولادتها عند الابتعاد
   ------------------------------------------------------------------------- */
SC.traffic = (function () {
  const U = SC.util;
  const cars = [];
  let scene = null, maxCars = 0;

  function spawnOne(near) {
    const W = SC.world;
    const ids = ['cortina', 'van', 'bike'];
    const id = ids[Math.floor(Math.random() * (Math.random() < 0.65 ? 1 : ids.length))];
    const v = new SC.Vehicle(id);
    const p = pickSpot(near);
    v.place(p.x, p.z, p.yaw);
    v.isTraffic = true;
    const tint = [0xd8d8d8, 0x2a3550, 0x7c1f1f, 0x1f5233, 0xb8860b, 0x30302f][Math.floor(Math.random() * 6)];
    v.setColor(tint);
    scene.add(v.root);
    const ai = new SC.AIDriver(v, { skill: 0.35 + Math.random() * 0.25, targetSpeed: 12 + Math.random() * 8 });
    cars.push(ai);
    return ai;
  }

  function pickSpot(near) {
    const W = SC.world, P = W.CFG.pitch, H = W.CFG.half;
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 90 + Math.random() * 190;
      const x = (near ? near.x : 0) + Math.cos(a) * r;
      const z = (near ? near.z : 0) + Math.sin(a) * r;
      if (!W.inBounds(x, z)) continue;
      const s = W.snapToRoad(x, z);
      const off = 5.5;
      const px = s.axis === 'z' ? s.x + off : s.x;
      const pz = s.axis === 'z' ? s.z : s.z - off;
      if (!W.inBounds(px, pz)) continue;
      return { x: px, z: pz, yaw: s.axis === 'z' ? 0 : Math.PI / 2 };
    }
    return { x: 0, z: 0, yaw: 0 };
  }

  function init(sc, count) {
    scene = sc; maxCars = count;
    cars.length = 0;
  }
  function setCount(n, near) {
    maxCars = n;
    while (cars.length > maxCars) remove(cars.length - 1);
    while (cars.length < maxCars) spawnOne(near);
  }
  function remove(i) {
    const ai = cars[i];
    scene.remove(ai.v.root);
    cars.splice(i, 1);
  }

  function update(dt, player, vehicles) {
    for (let i = cars.length - 1; i >= 0; i--) {
      const ai = cars[i];
      const d = Math.hypot(ai.v.pos.x - player.pos.x, ai.v.pos.z - player.pos.z);
      if (d > 430) {                       // بعيدة: أعِد ولادتها قرب اللاعب
        const p = pickSpot(player.pos);
        ai.v.place(p.x, p.z, p.yaw);
        ai.dir = null;
        continue;
      }
      if (d > 240) { ai.v.update(dt, ai.input); continue; }   // تحديث مبسّط
      ai.update(dt, vehicles);
    }
  }
  const list = () => cars;
  const vehicles = () => cars.map((c) => c.v);

  return { init, setCount, update, list, vehicles, cars };
})();
