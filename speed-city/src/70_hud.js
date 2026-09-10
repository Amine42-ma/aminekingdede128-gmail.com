/* ============================================================================
   SPEED CITY — واجهة اللعب: العدّاد، الخريطة المصغّرة، التنبيهات، لوحة المهمّة
   ========================================================================== */
SC.hud = (function () {
  const U = SC.util;
  const dom = {};
  let cityMap = null, cityScale = 1, cityOrigin = 0, mapSize = 1100;
  let speedCtx = null, miniCtx = null;
  let accMini = 0, accSpeed = 0;
  const markers = [];              // {x,z,color,icon,label,type}

  /* ---------------------- رسم خرائط الجزر مرّة واحدة --------------------- */
  const maps = [];          // لكل جزيرة: { canvas, isl, scale, size, origin }
  let worldBox = null;      // حدود العالم كلّه (للخريطة الكبيرة)

  function buildCityMap() {
    const W = SC.world, CFG = W.CFG;
    maps.length = 0;

    CFG.islands.forEach((isl) => {
      const pad = CFG.beach + 120;
      const world = isl.span + pad * 2;
      const size = 1024;
      const scale = size / world;
      const origin = isl.half + pad;          // إحداثيات الجزيرة المحلّية
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      const X = (wx) => (wx - isl.cx + origin) * scale;
      const Z = (wz) => (wz - isl.cz + origin) * scale;

      g.fillStyle = '#123a4e'; g.fillRect(0, 0, size, size);
      g.fillStyle = '#c9b98c';
      g.fillRect(X(isl.cx - isl.shore), Z(isl.cz - isl.shore), isl.shore * 2 * scale, isl.shore * 2 * scale);
      const gl = isl.half + CFG.road / 2;
      g.fillStyle = '#10141c';
      g.fillRect(X(isl.cx - gl), Z(isl.cz - gl), gl * 2 * scale, gl * 2 * scale);

      /* المربّعات */
      g.fillStyle = '#1c2230';
      W.state.blockRects.forEach((b) => {
        if (b.island !== isl.id) return;
        g.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * scale, (b.z1 - b.z0) * scale);
      });

      /* الشوارع */
      g.strokeStyle = '#39414f';
      g.lineWidth = CFG.road * scale;
      for (let i = 0; i <= isl.blocks; i++) {
        const line = -isl.half + i * CFG.pitch;
        g.beginPath(); g.moveTo(X(isl.cx + line), Z(isl.cz - isl.half - CFG.road));
        g.lineTo(X(isl.cx + line), Z(isl.cz + isl.half + CFG.road)); g.stroke();
        g.beginPath(); g.moveTo(X(isl.cx - isl.half - CFG.road), Z(isl.cz + line));
        g.lineTo(X(isl.cx + isl.half + CFG.road), Z(isl.cz + line)); g.stroke();
      }
      g.strokeStyle = 'rgba(220,220,190,0.16)';
      g.lineWidth = Math.max(0.6, 1.4 * scale);
      g.setLineDash([5, 7]);
      for (let i = 0; i <= isl.blocks; i++) {
        const line = -isl.half + i * CFG.pitch;
        g.beginPath(); g.moveTo(X(isl.cx + line), Z(isl.cz - isl.half));
        g.lineTo(X(isl.cx + line), Z(isl.cz + isl.half)); g.stroke();
        g.beginPath(); g.moveTo(X(isl.cx - isl.half), Z(isl.cz + line));
        g.lineTo(X(isl.cx + isl.half), Z(isl.cz + line)); g.stroke();
      }
      g.setLineDash([]);

      /* المباني */
      g.fillStyle = '#525c6e';
      W.state.colliders.forEach((col) => {
        if (col.kind !== 'building') return;
        const cx = (col.minX + col.maxX) / 2, cz = (col.minZ + col.maxZ) / 2;
        if (Math.abs(cx - isl.cx) > isl.half + 60 || Math.abs(cz - isl.cz) > isl.half + 60) return;
        g.fillRect(X(col.minX), Z(col.minZ), (col.maxX - col.minX) * scale, (col.maxZ - col.minZ) * scale);
      });

      maps.push({ canvas: c, isl, scale, size, origin });
    });

    /* حدود العالم */
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    CFG.islands.forEach((i) => {
      minX = Math.min(minX, i.cx - i.shore); maxX = Math.max(maxX, i.cx + i.shore);
      minZ = Math.min(minZ, i.cz - i.shore); maxZ = Math.max(maxZ, i.cz + i.shore);
    });
    worldBox = { minX: minX - 400, maxX: maxX + 400, minZ: minZ - 400, maxZ: maxZ + 400 };
    cityScale = maps[0].scale;
    return maps[0].canvas;
  }

  const mapFor = (x, z) => {
    const isl = SC.world.islandAt(x, z) || SC.world.nearestIsland(x, z);
    return maps[isl.id] || maps[0];
  };
  const mapX = (wx, m) => { m = m || maps[0]; return (wx - m.isl.cx + m.origin) * m.scale; };
  const mapZ = (wz, m) => { m = m || maps[0]; return (wz - m.isl.cz + m.origin) * m.scale; };

  /* ------------------------------ التهيئة ------------------------------- */
  function init(refs) {
    Object.assign(dom, refs);
    if (dom.speed) {
      dom.speed.width = 300; dom.speed.height = 190;
      speedCtx = dom.speed.getContext('2d');
    }
    if (dom.mini) {
      const s = 260;
      dom.mini.width = s; dom.mini.height = s;
      miniCtx = dom.mini.getContext('2d');
    }
  }

  /* ---------------------------- عدّاد السرعة ---------------------------- */
  function drawSpeed(car, game) {
    const g = speedCtx;
    if (!g) return;
    const W = dom.speed.width, H = dom.speed.height;
    g.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H - 46, R = 96;
    const kmh = car.kmh;
    const maxKmh = car.def.topSpeed * 3.6 * 1.12;
    const t = U.clamp(kmh / maxKmh, 0, 1);
    const a0 = Math.PI * 0.98, a1 = Math.PI * 2.02;

    g.lineCap = 'round';
    g.strokeStyle = 'rgba(255,255,255,0.10)';
    g.lineWidth = 13;
    g.beginPath(); g.arc(cx, cy, R, a0, a1); g.stroke();

    /* تدرّج السرعة */
    const grad = g.createLinearGradient(cx - R, 0, cx + R, 0);
    grad.addColorStop(0, '#38e0a0'); grad.addColorStop(0.55, '#ffd23f'); grad.addColorStop(1, '#ff4d4d');
    g.strokeStyle = grad;
    g.lineWidth = 13;
    g.beginPath(); g.arc(cx, cy, R, a0, a0 + (a1 - a0) * t); g.stroke();

    /* علامات */
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 2;
    for (let i = 0; i <= 8; i++) {
      const a = a0 + (a1 - a0) * (i / 8);
      const x1 = cx + Math.cos(a) * (R - 12), y1 = cy + Math.sin(a) * (R - 12);
      const x2 = cx + Math.cos(a) * (R - 20), y2 = cy + Math.sin(a) * (R - 20);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }

    /* الرقم */
    g.textAlign = 'center';
    g.fillStyle = '#ffffff';
    g.font = '700 50px system-ui, -apple-system, "Segoe UI", sans-serif';
    g.fillText(Math.round(kmh), cx, cy - 6);
    g.font = '600 15px system-ui, sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.62)';
    g.fillText('كم/س', cx, cy + 14);

    /* الترس */
    g.font = '800 20px system-ui, sans-serif';
    g.fillStyle = car.speed < -0.4 ? '#ff8a5c' : (car.shiftFlash ? '#ffd23f' : '#7fe8c0');
    g.fillText(car.speed < -0.4 ? 'R' : String(car.gear), cx + R - 18, cy - 44);

    /* شريط النيترو */
    const bw = 148, bh = 8, bx = cx - bw / 2, by = cy + 26;
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(bx, by, bw, bh);
    const ng = g.createLinearGradient(bx, 0, bx + bw, 0);
    ng.addColorStop(0, '#38bdf8'); ng.addColorStop(1, '#a78bfa');
    g.fillStyle = ng;
    g.fillRect(bx, by, bw * car.nitro, bh);
    if (car.nitroActive) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(bx, by, bw * car.nitro, bh); }
  }

  /* --------------------------- الخريطة المصغّرة -------------------------- */
  function drawMini(car, game) {
    const g = miniCtx;
    if (!g || !maps.length) return;
    const S = dom.mini.width, R = S / 2;
    const zoom = game.miniZoom || 3.0;           // بكسل لكل متر
    const m = mapFor(car.pos.x, car.pos.z);
    g.save();
    g.clearRect(0, 0, S, S);
    g.beginPath(); g.arc(R, R, R - 2, 0, 7); g.clip();
    g.fillStyle = '#123a4e'; g.fillRect(0, 0, S, S);      // البحر خلفية

    const rot = game.mapRotate === false ? Math.PI : car.yaw + Math.PI;
    g.translate(R, R);
    g.rotate(rot);
    const scale = zoom / m.scale;
    g.scale(scale, scale);
    g.imageSmoothingEnabled = true;
    g.drawImage(m.canvas, -mapX(car.pos.x, m), -mapZ(car.pos.z, m));
    g.setTransform(1, 0, 0, 1, 0, 0);

    lastMini = { R, zoom, rot, car };

    /* الجسور */
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const toMini = (wx, wz) => {
      const dx = (wx - car.pos.x) * zoom, dz = (wz - car.pos.z) * zoom;
      return { x: R + dx * cos - dz * sin, y: R + dx * sin + dz * cos };
    };
    g.strokeStyle = '#7c8798';
    g.lineWidth = Math.max(2, 26 * zoom);
    (SC.world.state.bridges || []).forEach((br) => {
      const a = br.axis === 'x' ? toMini(br.x0, br.z) : toMini(br.x, br.z0);
      const b2 = br.axis === 'x' ? toMini(br.x1, br.z) : toMini(br.x, br.z1);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b2.x, b2.y); g.stroke();
    });

    const drawDot = (wx, wz, color, size, ring) => {
      const p = projectMini(wx, wz);
      let px = p.x - R, py = p.y - R;
      const d = Math.hypot(px, py);
      const edge = R - 10;
      const clamped = d > edge;
      if (clamped) { px = px / d * edge; py = py / d * edge; }
      g.beginPath(); g.arc(R + px, R + py, size, 0, 7);
      g.fillStyle = color; g.fill();
      if (ring || clamped) { g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.6; g.stroke(); }
    };

    (game.traffic || []).forEach((v) => drawDot(v.pos.x, v.pos.z, 'rgba(255,255,255,0.45)', 2.4));
    (game.rivals || []).forEach((v) => drawDot(v.pos.x, v.pos.z, '#ff5c5c', 3.6, true));
    markers.forEach((mk) => drawDot(mk.x, mk.z, mk.color, mk.size || 5, true));
    if (game.waypoint) drawDot(game.waypoint.x, game.waypoint.z, '#38bdf8', 5, true);

    /* سهم اللاعب */
    g.save();
    g.translate(R, R);
    if (game.mapRotate === false) g.rotate(Math.PI - car.yaw);
    g.beginPath();
    g.moveTo(0, -9); g.lineTo(6.5, 8); g.lineTo(0, 4.5); g.lineTo(-6.5, 8);
    g.closePath();
    g.fillStyle = '#ffd23f'; g.strokeStyle = '#1b1b1b'; g.lineWidth = 1.4;
    g.fill(); g.stroke();
    g.restore();
    g.restore();

    if (dom.compass) {
      dom.compass.style.transform = 'rotate(' + (game.mapRotate === false ? 0 : car.yaw) + 'rad)';
    }
  }

  /* إسقاط نقطة عالمية على الخريطة المصغّرة (يُستخدم للرسم وللاختبار) */
  let lastMini = null;
  function projectMini(wx, wz) {
    if (!lastMini) return { x: 0, y: 0 };
    const { R, zoom, rot, car } = lastMini;
    const dx = (wx - car.pos.x) * zoom, dz = (wz - car.pos.z) * zoom;
    const cos = Math.cos(rot), sin = Math.sin(rot);
    return { x: R + dx * cos - dz * sin, y: R + dx * sin + dz * cos };
  }

  /* -------------------------- الخريطة الكبيرة --------------------------- */
  function drawBigMap(canvas, view, game) {
    const g = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    g.fillStyle = '#0a2434'; g.fillRect(0, 0, W, H);
    if (!maps.length || !worldBox) return;

    const wSpanX = worldBox.maxX - worldBox.minX, wSpanZ = worldBox.maxZ - worldBox.minZ;
    const fit = Math.min(W / wSpanX, H / wSpanZ);
    const s = fit * view.zoom * 2.2;
    const toScreen = (wx, wz) => ({
      x: W / 2 + view.px + (wx - (worldBox.minX + wSpanX / 2)) * s,
      y: H / 2 + view.py + (wz - (worldBox.minZ + wSpanZ / 2)) * s
    });
    canvas._toWorld = (sx, sy) => ({
      x: (sx - W / 2 - view.px) / s + worldBox.minX + wSpanX / 2,
      z: (sy - H / 2 - view.py) / s + worldBox.minZ + wSpanZ / 2
    });

    /* الجسور */
    g.strokeStyle = '#6f7a89';
    (SC.world.state.bridges || []).forEach((br) => {
      const a = br.axis === 'x' ? toScreen(br.x0, br.z) : toScreen(br.x, br.z0);
      const b2 = br.axis === 'x' ? toScreen(br.x1, br.z) : toScreen(br.x, br.z1);
      g.lineWidth = Math.max(2, br.width * s);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b2.x, b2.y); g.stroke();
    });

    /* الجزر */
    maps.forEach((m) => {
      const isl = m.isl;
      const p = toScreen(isl.cx - m.origin, isl.cz - m.origin);
      const size = (m.size / m.scale) * s;
      g.drawImage(m.canvas, p.x, p.y, size, size);
      g.font = '800 14px system-ui, sans-serif';
      g.textAlign = 'center';
      const c = toScreen(isl.cx, isl.cz - isl.shore);
      const ly = c.y - 12;                       // فوق حافة الجزيرة بمسافة ثابتة
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.75)';
      g.strokeText(isl.name, c.x, ly);
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.fillText(isl.name, c.x, ly);
    });

    const icon = (wx, wz, color, label, r) => {
      const p = toScreen(wx, wz);
      g.beginPath(); g.arc(p.x, p.y, r || 9, 0, 7);
      g.fillStyle = color; g.fill();
      g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.stroke();
      if (label) {
        g.font = '700 12px system-ui, sans-serif';
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(label, p.x, p.y + 0.5);
      }
    };
    markers.forEach((m) => icon(m.x, m.z, m.color, m.icon || '', 9));
    if (game && game.waypoint) icon(game.waypoint.x, game.waypoint.z, '#38bdf8', '⚑', 9);

    if (game && game.car) {
      const p = toScreen(game.car.pos.x, game.car.pos.z);
      g.save();
      g.translate(p.x, p.y); g.rotate(Math.PI - game.car.yaw);
      g.beginPath(); g.moveTo(0, -12); g.lineTo(8, 10); g.lineTo(0, 5.5); g.lineTo(-8, 10);
      g.closePath();
      g.fillStyle = '#ffd23f'; g.strokeStyle = '#000'; g.lineWidth = 2;
      g.fill(); g.stroke();
      g.restore();
    }
    return toScreen;
  }
  /* يجعل نقطة عالمية في مركز الخريطة الكبيرة */
  function focusBigMap(canvas, view, wx, wz) {
    if (!worldBox) return;
    const W = canvas.width, H = canvas.height;
    const wSpanX = worldBox.maxX - worldBox.minX, wSpanZ = worldBox.maxZ - worldBox.minZ;
    const s = Math.min(W / wSpanX, H / wSpanZ) * view.zoom * 2.2;
    view.px = -(wx - (worldBox.minX + wSpanX / 2)) * s;
    view.py = -(wz - (worldBox.minZ + wSpanZ / 2)) * s;
  }

  function screenToWorld(canvas, view, sx, sy) {
    if (canvas._toWorld) return canvas._toWorld(sx, sy);
    return { x: 0, z: 0 };
  }

  /* ------------------------------ العلامات ------------------------------ */
  function setMarkers(list) { markers.length = 0; list.forEach((m) => markers.push(m)); }
  function addMarker(m) { markers.push(m); return m; }
  function clearMarkers() { markers.length = 0; }

  /* ------------------------------ التنبيهات ----------------------------- */
  function toast(text, kind, ms) {
    if (!dom.toasts) return;
    const t = U.el('div', 'toast ' + (kind || ''), text);
    dom.toasts.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 400);
    }, ms || 2600);
  }
  function banner(title, sub, ms) {
    if (!dom.banner) return;
    dom.banner.innerHTML = '<div class="b-title">' + title + '</div>' +
      (sub ? '<div class="b-sub">' + sub + '</div>' : '');
    dom.banner.classList.add('show');
    clearTimeout(banner._t);
    banner._t = setTimeout(() => dom.banner.classList.remove('show'), ms || 1800);
  }

  /* --------------------------- لوحة المهمّة ----------------------------- */
  function setObjective(o) {
    if (!dom.objective) return;
    if (!o) { dom.objective.classList.remove('show'); return; }
    dom.objective.classList.add('show');
    dom.objTitle.textContent = o.title || '';
    dom.objText.innerHTML = o.text || '';
    dom.objMeta.innerHTML = o.meta || '';
    dom.objective.classList.toggle('warn', !!o.warn);
  }

  function update(dt, game) {
    const car = game.car;
    accSpeed += dt; accMini += dt;
    if (accSpeed > 1 / 30) { drawSpeed(car, game); accSpeed = 0; }
    if (accMini > 1 / 22) { drawMini(car, game); accMini = 0; }
  }

  return { init, buildCityMap, update, toast, banner, setObjective, drawBigMap, screenToWorld, projectMini,
           setMarkers, addMarker, clearMarkers, markers, maps, mapFor, focusBigMap,
           mapX, mapZ, get cityScale() { return cityScale; } };
})();
