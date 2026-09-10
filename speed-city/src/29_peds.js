/* ============================================================================
   SPEED CITY — المارّة في الشوارع + نظام الثقة (السمعة)
   يمشون على الأرصفة، يخافون من السيارة المسرعة، وإن صدمتهم تنخفض ثقتهم بك.
   ========================================================================== */
SC.peds = (function () {
  const U = SC.util;
  const list = [];
  let scene = null, maxPeds = 0, hitCooldown = 0;

  const STATE = { WALK: 0, PANIC: 1, DOWN: 2, WAIT: 3, RIDE: 4 };

  /* نقطة على رصيف قريبة من موضع معيّن */
  let cachedRects = null, cacheKey = '';
  function nearbyRects(near, maxR) {
    const W = SC.world;
    const key = Math.round(near.x / 300) + ',' + Math.round(near.z / 300);
    if (key === cacheKey && cachedRects) return cachedRects;
    const lim = (maxR || 200) + 260;
    cachedRects = W.state.blockRects.filter((b) =>
      Math.abs(b.cx - near.x) < lim && Math.abs(b.cz - near.z) < lim);
    cacheKey = key;
    return cachedRects;
  }

  function sidewalkSpot(near, minR, maxR) {
    const W = SC.world;
    const rects = near ? nearbyRects(near, maxR) : W.state.blockRects;
    if (!rects.length) return null;
    for (let i = 0; i < 30; i++) {
      const b = rects[Math.floor(Math.random() * rects.length)];
      if (!b) break;
      const edge = Math.floor(Math.random() * 4);
      const t = Math.random();
      const inset = 2.4;
      let x, z, dx, dz;
      if (edge === 0) { x = U.lerp(b.x0 + inset, b.x1 - inset, t); z = b.z1 - inset; dx = 1; dz = 0; }
      else if (edge === 1) { x = b.x1 - inset; z = U.lerp(b.z0 + inset, b.z1 - inset, t); dx = 0; dz = -1; }
      else if (edge === 2) { x = U.lerp(b.x0 + inset, b.x1 - inset, t); z = b.z0 + inset; dx = -1; dz = 0; }
      else { x = b.x0 + inset; z = U.lerp(b.z0 + inset, b.z1 - inset, t); dx = 0; dz = 1; }
      const d = near ? Math.hypot(x - near.x, z - near.z) : 50;
      if (d < (minR || 0) || d > (maxR || 1e9)) continue;
      return { x, z, dx, dz, block: b, edge };
    }
    return null;
  }

  function spawnOne(near) {
    const spot = sidewalkSpot(near, 25, 170);
    if (!spot) return null;
    const w = SC.character.createWalker(Math.floor(Math.random() * 6));
    w.root.position.set(spot.x, SC.world.groundHeight(spot.x, spot.z), spot.z);
    scene.add(w.root);
    const p = {
      w, x: spot.x, z: spot.z, block: spot.block, edge: spot.edge,
      dirX: spot.dx, dirZ: spot.dz, speed: 1.1 + Math.random() * 0.7,
      state: STATE.WALK, timer: 0, yaw: Math.atan2(spot.dx, spot.dz),
      bob: 0, down: 0, hitBy: 0
    };
    list.push(p);
    return p;
  }

  function init(sc, count) {
    scene = sc;
    list.length = 0;
    maxPeds = count;
  }
  function setCount(n, near) {
    maxPeds = n;
    while (list.length > maxPeds) remove(list.length - 1);
    let guard = 0;
    while (list.length < maxPeds && guard++ < 60) spawnOne(near);
  }
  function remove(i) {
    scene.remove(list[i].w.root);
    list.splice(i, 1);
  }

  /* يمشي على محيط المربّع السكني ويستدير عند الزوايا */
  function walkStep(p, dt) {
    const b = p.block, inset = 2.4;
    p.x += p.dirX * p.speed * dt;
    p.z += p.dirZ * p.speed * dt;
    const x0 = b.x0 + inset, x1 = b.x1 - inset, z0 = b.z0 + inset, z1 = b.z1 - inset;
    let turned = false;
    if (p.x > x1) { p.x = x1; turned = true; }
    if (p.x < x0) { p.x = x0; turned = true; }
    if (p.z > z1) { p.z = z1; turned = true; }
    if (p.z < z0) { p.z = z0; turned = true; }
    if (turned) {
      // انعطاف بزاوية قائمة مع محيط المربّع
      const nx = -p.dirZ, nz = p.dirX;
      p.dirX = nx; p.dirZ = nz;
      p.yaw = Math.atan2(p.dirX, p.dirZ);
    }
    pushOutOfBuildings(p);
  }

  /* لا يمشون داخل المباني */
  function pushOutOfBuildings(p) {
    const list2 = SC.world.queryColliders(p.x, p.z, 1.4);
    for (const c of list2) {
      const pad = 0.45;
      if (p.x > c.minX - pad && p.x < c.maxX + pad && p.z > c.minZ - pad && p.z < c.maxZ + pad) {
        const dl = p.x - (c.minX - pad), dr = (c.maxX + pad) - p.x;
        const db = p.z - (c.minZ - pad), dt = (c.maxZ + pad) - p.z;
        const m = Math.min(dl, dr, db, dt);
        if (m === dl) { p.x = c.minX - pad; p.dirX = -Math.abs(p.dirX); }
        else if (m === dr) { p.x = c.maxX + pad; p.dirX = Math.abs(p.dirX); }
        else if (m === db) { p.z = c.minZ - pad; p.dirZ = -Math.abs(p.dirZ); }
        else { p.z = c.maxZ + pad; p.dirZ = Math.abs(p.dirZ); }
        if (Math.abs(p.dirX) < 0.01 && Math.abs(p.dirZ) < 0.01) p.dirZ = 1;
        p.yaw = Math.atan2(p.dirX, p.dirZ);
      }
    }
  }

  function update(dt, car, game) {
    hitCooldown = Math.max(0, hitCooldown - dt);
    const cx = car.pos.x, cz = car.pos.z;
    const kmh = car.kmh;

    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      const d = Math.hypot(p.x - cx, p.z - cz);

      /* إعادة الولادة عند الابتعاد */
      if (d > 260 && p.state !== STATE.RIDE) {
        const spot = sidewalkSpot(car.pos, 60, 170);
        if (spot) {
          p.x = spot.x; p.z = spot.z; p.block = spot.block;
          p.dirX = spot.dx; p.dirZ = spot.dz;
          p.state = STATE.WALK; p.down = 0;
          p.w.root.rotation.set(0, 0, 0);
        }
        continue;
      }
      if (p.state === STATE.RIDE) continue;

      /* السقوط بعد الاصطدام */
      if (p.state === STATE.DOWN) {
        p.down += dt;
        p.w.root.rotation.x = U.damp(p.w.root.rotation.x, -Math.PI / 2 * 0.92, 6, dt);
        p.w.root.position.y = U.damp(p.w.root.position.y, SC.world.groundHeight(p.x, p.z) + 0.18, 5, dt);
        if (p.down > 6) {
          p.state = STATE.WALK; p.down = 0;
          p.w.root.rotation.x = 0;
        }
        continue;
      }

      /* الخوف من السيارة المسرعة */
      const danger = d < 14 && kmh > 22;
      if (danger && p.state !== STATE.PANIC) { p.state = STATE.PANIC; p.timer = 1.4; }
      if (p.state === STATE.PANIC) {
        p.timer -= dt;
        // اهرب بعيداً عن السيارة
        const ax = (p.x - cx) / (d || 1), az = (p.z - cz) / (d || 1);
        p.x += ax * 3.1 * dt;
        p.z += az * 3.1 * dt;
        p.yaw = Math.atan2(ax, az);
        pushOutOfBuildings(p);
        if (p.timer <= 0) p.state = STATE.WALK;
      } else if (p.state === STATE.WALK) {
        walkStep(p, dt);
      }

      /* الاصطدام بالمركبة */
      if (d < 1.5 && kmh > 6 && hitCooldown <= 0) {
        p.state = STATE.DOWN; p.down = 0; hitCooldown = 0.5;
        const power = U.clamp(kmh / 90, 0.15, 1);
        if (game && game.onPedHit) game.onPedHit(power, p);
      }

      /* تحديث الشكل */
      const speed = p.state === STATE.PANIC ? 3.1 : (p.state === STATE.WALK ? p.speed : 0);
      p.w.phase += dt * speed * 3.4;
      const sw = Math.sin(p.w.phase) * (speed > 2 ? 0.85 : 0.55);
      p.w.legL.rotation.x = sw;
      p.w.legR.rotation.x = -sw;
      if (p.w.armL) {
        p.w.armL.rotation.x = -sw * 0.75;
        p.w.armR.rotation.x = sw * 0.75;
        p.w.armL.rotation.z = 0.12;
        p.w.armR.rotation.z = -0.12;
      }
      p.w.upper.rotation.x = speed > 2 ? 0.14 : 0.03;
      p.w.root.position.set(p.x, SC.world.groundHeight(p.x, p.z) + Math.abs(Math.sin(p.w.phase)) * 0.03, p.z);
      p.w.root.rotation.y = U.damp(p.w.root.rotation.y, p.yaw, 9, dt);
    }
  }

  /* راكب ينتظر سيارة أجرة عند نقطة محدّدة */
  function makeWaiting(x, z) {
    const w = SC.character.createWalker(Math.floor(Math.random() * 6));
    w.root.position.set(x, SC.world.groundHeight(x, z), z);
    scene.add(w.root);
    const p = { w, x, z, state: STATE.WAIT, yaw: 0, timer: 0, waiting: true,
                block: null, dirX: 0, dirZ: 1, speed: 0, down: 0 };
    list.push(p);
    return p;
  }
  function removePed(p) {
    const i = list.indexOf(p);
    if (i >= 0) remove(i);
  }
  function hide(p, on) { if (p && p.w) p.w.root.visible = !on; }

  const count = () => list.length;
  const all = () => list;

  return { init, setCount, update, spawnOne, makeWaiting, removePed, hide, count, all, STATE };
})();
