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

  /* ---------------------- رسم خريطة المدينة مرّة واحدة ------------------ */
  function buildCityMap() {
    const W = SC.world, CFG = W.CFG;
    const pad = CFG.beach + 90;
    const world = CFG.span + pad * 2;
    cityScale = mapSize / world;
    cityOrigin = CFG.half + pad;

    const c = document.createElement('canvas');
    c.width = c.height = mapSize;
    const g = c.getContext('2d');

    const X = (wx) => (wx + cityOrigin) * cityScale;
    const Z = (wz) => (wz + cityOrigin) * cityScale;

    /* البحر ثم الشاطئ ثم أرض المدينة */
    g.fillStyle = '#123a4e'; g.fillRect(0, 0, mapSize, mapSize);
    g.fillStyle = '#c9b98c';
    g.fillRect(X(-CFG.shore), Z(-CFG.shore), CFG.shore * 2 * cityScale, CFG.shore * 2 * cityScale);
    const gl = CFG.half + CFG.road / 2;
    g.fillStyle = '#10141c';
    g.fillRect(X(-gl), Z(-gl), gl * 2 * cityScale, gl * 2 * cityScale);

    /* المربّعات السكنية */
    g.fillStyle = '#1c2230';
    W.state.blockRects.forEach((b) => {
      g.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * cityScale, (b.z1 - b.z0) * cityScale);
    });

    /* الشوارع */
    g.strokeStyle = '#39414f';
    g.lineWidth = CFG.road * cityScale;
    g.lineCap = 'butt';
    for (let i = 0; i <= CFG.blocks; i++) {
      const line = -CFG.half + i * CFG.pitch;
      g.beginPath(); g.moveTo(X(line), Z(-CFG.half - CFG.road)); g.lineTo(X(line), Z(CFG.half + CFG.road)); g.stroke();
      g.beginPath(); g.moveTo(X(-CFG.half - CFG.road), Z(line)); g.lineTo(X(CFG.half + CFG.road), Z(line)); g.stroke();
    }
    /* خط منقّط في منتصف الشوارع */
    g.strokeStyle = 'rgba(220,220,190,0.16)';
    g.lineWidth = Math.max(0.6, 0.7 * cityScale * 2);
    g.setLineDash([5, 7]);
    for (let i = 0; i <= CFG.blocks; i++) {
      const line = -CFG.half + i * CFG.pitch;
      g.beginPath(); g.moveTo(X(line), Z(-CFG.half)); g.lineTo(X(line), Z(CFG.half)); g.stroke();
      g.beginPath(); g.moveTo(X(-CFG.half), Z(line)); g.lineTo(X(CFG.half), Z(line)); g.stroke();
    }
    g.setLineDash([]);

    /* المباني */
    g.fillStyle = '#525c6e';
    W.state.colliders.forEach((col) => {
      if (col.kind !== 'building') return;
      g.fillRect(X(col.minX), Z(col.minZ), (col.maxX - col.minX) * cityScale, (col.maxZ - col.minZ) * cityScale);
    });

    /* حدود المدينة */
    g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 2;
    g.strokeRect(X(-CFG.half - CFG.road / 2), Z(-CFG.half - CFG.road / 2),
      (CFG.span + CFG.road) * cityScale, (CFG.span + CFG.road) * cityScale);

    cityMap = c;
    return c;
  }

  const mapX = (wx) => (wx + cityOrigin) * cityScale;
  const mapZ = (wz) => (wz + cityOrigin) * cityScale;

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
    if (!g || !cityMap) return;
    const S = dom.mini.width, R = S / 2;
    const zoom = game.miniZoom || 3.2;           // بكسل لكل متر
    g.save();
    g.clearRect(0, 0, S, S);
    g.beginPath(); g.arc(R, R, R - 2, 0, 7); g.clip();
    g.fillStyle = '#0b0f17'; g.fillRect(0, 0, S, S);

    g.translate(R, R);
    const rot = game.mapRotate === false ? 0 : -car.yaw;
    g.rotate(rot);
    const scale = zoom / cityScale;
    g.scale(scale, scale);
    g.imageSmoothingEnabled = true;
    g.drawImage(cityMap, -mapX(car.pos.x), -mapZ(car.pos.z));
    g.setTransform(1, 0, 0, 1, 0, 0);

    /* العلامات */
    const drawDot = (wx, wz, color, size, ring) => {
      const dx = (wx - car.pos.x) * zoom, dz = (wz - car.pos.z) * zoom;
      const cos = Math.cos(rot), sin = Math.sin(rot);
      let px = dx * cos - dz * sin, py = dx * sin + dz * cos;
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
    markers.forEach((m) => drawDot(m.x, m.z, m.color, m.size || 5, true));
    if (game.waypoint) drawDot(game.waypoint.x, game.waypoint.z, '#38bdf8', 5, true);

    /* سهم اللاعب */
    g.save();
    g.translate(R, R);
    if (game.mapRotate === false) g.rotate(car.yaw);
    g.beginPath();
    g.moveTo(0, -9); g.lineTo(6.5, 8); g.lineTo(0, 4.5); g.lineTo(-6.5, 8);
    g.closePath();
    g.fillStyle = '#ffd23f'; g.strokeStyle = '#1b1b1b'; g.lineWidth = 1.4;
    g.fill(); g.stroke();
    g.restore();
    g.restore();

    /* بوصلة */
    if (dom.compass) {
      const ang = -car.yaw;
      dom.compass.style.transform = 'rotate(' + (game.mapRotate === false ? 0 : ang) + 'rad)';
    }
  }

  /* -------------------------- الخريطة الكبيرة --------------------------- */
  function drawBigMap(canvas, view, game) {
    const g = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    g.fillStyle = '#080b12'; g.fillRect(0, 0, W, H);
    if (!cityMap) return;
    const s = view.zoom;
    g.save();
    g.translate(W / 2 + view.px, H / 2 + view.py);
    g.scale(s, s);
    g.drawImage(cityMap, -mapSize / 2, -mapSize / 2);
    g.restore();

    const toScreen = (wx, wz) => ({
      x: W / 2 + view.px + (mapX(wx) - mapSize / 2) * s,
      y: H / 2 + view.py + (mapZ(wz) - mapSize / 2) * s
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

    markers.forEach((m) => icon(m.x, m.z, m.color, m.icon || '', 10));
    if (game && game.waypoint) icon(game.waypoint.x, game.waypoint.z, '#38bdf8', '⚑', 10);

    /* اللاعب */
    if (game && game.car) {
      const p = toScreen(game.car.pos.x, game.car.pos.z);
      g.save();
      g.translate(p.x, p.y); g.rotate(game.car.yaw);
      g.beginPath(); g.moveTo(0, -12); g.lineTo(8, 10); g.lineTo(0, 5.5); g.lineTo(-8, 10);
      g.closePath();
      g.fillStyle = '#ffd23f'; g.strokeStyle = '#000'; g.lineWidth = 2;
      g.fill(); g.stroke();
      g.restore();
    }
    return toScreen;
  }
  function screenToWorld(canvas, view, sx, sy) {
    const W = canvas.width, H = canvas.height, s = view.zoom;
    const mx = (sx - W / 2 - view.px) / s + mapSize / 2;
    const my = (sy - H / 2 - view.py) / s + mapSize / 2;
    return { x: mx / cityScale - cityOrigin, z: my / cityScale - cityOrigin };
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

  return { init, buildCityMap, update, toast, banner, setObjective, drawBigMap, screenToWorld,
           setMarkers, addMarker, clearMarkers, markers, get cityMap() { return cityMap; },
           mapX, mapZ, get cityScale() { return cityScale; } };
})();
