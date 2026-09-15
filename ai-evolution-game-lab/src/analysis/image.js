/**
 * Image analyzer (spec 23).
 *
 * IMPORTANT HONESTY NOTE: this is *structural* image analysis - dimensions,
 * palette, ink density, region/grid layout. It is not semantic vision. The lab
 * never claims to "understand" a sketch unless a vision-capable model provider
 * is configured; see src/models/provider.js. PNGs are genuinely decoded here
 * (zlib + scanline unfilter), other formats report header data only.
 */
import zlib from 'node:zlib';

export function imageKind(buf) {
  if (buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpeg';
  if (buf.length > 6 && buf.toString('ascii', 0, 3) === 'GIF') return 'gif';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buf.length > 5 && buf.toString('ascii', 0, 5) === '<?xml') return 'svg';
  if (buf.length > 4 && buf.toString('ascii', 0, 4) === '<svg') return 'svg';
  return null;
}

export function readDimensions(buf) {
  const kind = imageKind(buf);
  try {
    if (kind === 'png') return { kind, width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (kind === 'gif') return { kind, width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    if (kind === 'webp') {
      const fmt = buf.toString('ascii', 12, 16);
      if (fmt === 'VP8X') return { kind, width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
      if (fmt === 'VP8L') {
        const b = buf.readUInt32LE(21);
        return { kind, width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
      }
      if (fmt === 'VP8 ') return { kind, width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    if (kind === 'jpeg') {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        const len = buf.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { kind, height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + len;
      }
    }
    if (kind === 'svg') {
      const s = buf.toString('utf8', 0, 2048);
      const w = (s.match(/width\s*=\s*"(\d+)/) || [])[1];
      const h = (s.match(/height\s*=\s*"(\d+)/) || [])[1];
      const vb = (s.match(/viewBox\s*=\s*"([^"]+)"/) || [])[1];
      if (w && h) return { kind, width: +w, height: +h };
      if (vb) { const p = vb.split(/[\s,]+/).map(Number); return { kind, width: p[2], height: p[3] }; }
      return { kind, width: null, height: null };
    }
  } catch { /* fall through */ }
  return { kind, width: null, height: null };
}

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Decode a (non-interlaced, 8-bit) PNG to RGBA. Returns null for exotic PNGs. */
export function decodePng(buf) {
  if (imageKind(buf) !== 'png') return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  const interlace = buf[28];
  if (bitDepth !== 8 || interlace !== 0) return null;
  if (width * height > 8e6) return null;

  const idat = [];
  let palette = null;
  let trns = null;
  let off = 8;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const start = off + 8;
    if (type === 'IDAT') idat.push(buf.slice(start, start + len));
    else if (type === 'PLTE') palette = buf.slice(start, start + len);
    else if (type === 'tRNS') trns = buf.slice(start, start + len);
    else if (type === 'IEND') break;
    off = start + len + 4;
  }
  if (!idat.length) return null;

  let raw;
  try { raw = zlib.inflateSync(Buffer.concat(idat)); } catch { return null; }

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) return null;
  const bpp = channels;
  const stride = width * bpp;
  const out = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  let pos = 0;

  for (let y = 0; y < height; y++) {
    if (pos >= raw.length) break;
    const filter = raw[pos++];
    const line = Buffer.from(raw.slice(pos, pos + stride));
    pos += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      switch (filter) {
        case 1: line[x] = (line[x] + a) & 0xff; break;
        case 2: line[x] = (line[x] + b) & 0xff; break;
        case 3: line[x] = (line[x] + ((a + b) >> 1)) & 0xff; break;
        case 4: line[x] = (line[x] + paeth(a, b, c)) & 0xff; break;
        default: break;
      }
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const i = x * bpp;
      if (colorType === 0) { const v = line[i]; out[o] = v; out[o + 1] = v; out[o + 2] = v; out[o + 3] = 255; }
      else if (colorType === 2) { out[o] = line[i]; out[o + 1] = line[i + 1]; out[o + 2] = line[i + 2]; out[o + 3] = 255; }
      else if (colorType === 3 && palette) {
        const p = line[i] * 3;
        out[o] = palette[p]; out[o + 1] = palette[p + 1]; out[o + 2] = palette[p + 2];
        out[o + 3] = trns && line[i] < trns.length ? trns[line[i]] : 255;
      } else if (colorType === 4) { const v = line[i]; out[o] = v; out[o + 1] = v; out[o + 2] = v; out[o + 3] = line[i + 1]; }
      else if (colorType === 6) { out[o] = line[i]; out[o + 1] = line[i + 1]; out[o + 2] = line[i + 2]; out[o + 3] = line[i + 3]; }
    }
    prev = line;
  }
  return { width, height, data: out };
}

const hex = (r, g, b) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/**
 * Structural read of a sketch / screenshot / concept image.
 * Produces: palette, ink coverage, coarse occupancy grid, detected rows and
 * columns (panels, roads, UI bands) and a layout guess.
 */
export function analyzeImageStructure(buf, { file = 'image.png', grid = 16 } = {}) {
  const dims = readDimensions(buf);
  const base = {
    file,
    kind: dims.kind,
    width: dims.width,
    height: dims.height,
    bytes: buf.length,
    aspect: dims.width && dims.height ? Math.round((dims.width / dims.height) * 100) / 100 : null,
    decoded: false,
    note: 'structural analysis only - no semantic vision model was used',
  };
  const png = decodePng(buf);
  if (!png) return base;

  const { width, height, data } = png;
  const counts = new Map();
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 60000)));
  let lum = 0, samples = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const o = (y * width + x) * 4;
      if (data[o + 3] < 8) continue;
      const q = hex(data[o] & 0xf0, data[o + 1] & 0xf0, data[o + 2] & 0xf0);
      counts.set(q, (counts.get(q) || 0) + 1);
      lum += 0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2];
      samples++;
    }
  }
  const palette = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
    .map(([color, n]) => ({ color, share: Math.round((n / Math.max(1, samples)) * 1000) / 1000 }));
  const background = palette[0]?.color || null;

  // occupancy grid: cells that differ from the background
  const cells = [];
  const cw = Math.max(1, Math.floor(width / grid));
  const ch = Math.max(1, Math.floor(height / grid));
  const bgRgb = background ? [parseInt(background.slice(1, 3), 16), parseInt(background.slice(3, 5), 16), parseInt(background.slice(5, 7), 16)] : [255, 255, 255];
  let inkTotal = 0;

  for (let gy = 0; gy < grid; gy++) {
    const row = [];
    for (let gx = 0; gx < grid; gx++) {
      let ink = 0, total = 0;
      for (let y = gy * ch; y < Math.min((gy + 1) * ch, height); y += step) {
        for (let x = gx * cw; x < Math.min((gx + 1) * cw, width); x += step) {
          const o = (y * width + x) * 4;
          total++;
          const d = Math.abs(data[o] - bgRgb[0]) + Math.abs(data[o + 1] - bgRgb[1]) + Math.abs(data[o + 2] - bgRgb[2]);
          if (d > 90 || data[o + 3] < 200) ink++;
        }
      }
      const v = total ? ink / total : 0;
      inkTotal += v;
      row.push(Math.round(v * 100) / 100);
    }
    cells.push(row);
  }

  const rowDensity = cells.map((r) => r.reduce((s, v) => s + v, 0) / grid);
  const colDensity = Array.from({ length: grid }, (_, gx) => cells.reduce((s, r) => s + r[gx], 0) / grid);
  const dense = (arr, t) => arr.map((v, i) => ({ i, v })).filter((o) => o.v > t).map((o) => o.i);

  const bandRows = dense(rowDensity, 0.45);
  const bandCols = dense(colDensity, 0.45);
  const regions = [];
  if (rowDensity.slice(0, 2).some((v) => v > 0.25)) regions.push('top band (header / HUD)');
  if (rowDensity.slice(-2).some((v) => v > 0.25)) regions.push('bottom band (controls / status bar)');
  if (colDensity.slice(0, 2).some((v) => v > 0.3)) regions.push('left column (sidebar / menu)');
  if (colDensity.slice(-2).some((v) => v > 0.3)) regions.push('right column (panel / minimap)');
  const centerInk = cells.slice(4, 12).reduce((s, r) => s + r.slice(4, 12).reduce((a, b) => a + b, 0), 0) / 64;
  if (centerInk > 0.2) regions.push('busy centre (play field / main subject)');

  return {
    ...base,
    decoded: true,
    averageLuminance: Math.round(lum / Math.max(1, samples)),
    darkTheme: lum / Math.max(1, samples) < 110,
    palette,
    background,
    inkCoverage: Math.round((inkTotal / (grid * grid)) * 1000) / 1000,
    occupancy: cells,
    structure: {
      denseRows: bandRows,
      denseColumns: bandCols,
      likelyGridArt: bandRows.length >= 3 && bandCols.length >= 3,
      regions,
    },
  };
}
