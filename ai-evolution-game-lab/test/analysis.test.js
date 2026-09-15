import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { analyzeJs, tokenize, normalizedTokens } from '../src/analysis/js.js';
import { analyzeHtml } from '../src/analysis/html.js';
import { analyzeCss } from '../src/analysis/css.js';
import { analyzeGlb } from '../src/analysis/glb.js';
import { analyzeImageStructure, readDimensions } from '../src/analysis/image.js';
import { extractConcepts } from '../src/analysis/concepts.js';
import { buildRelations, roleOf } from '../src/analysis/relations.js';
import { detectLicenseFromFiles, licenseProfile, LICENSE_UNKNOWN } from '../src/licensing/license.js';

const GAME_SRC = `
// a small game
const GRAVITY = 0.7, SPEED = 4;
class Player extends Entity {
  constructor() { super(); this.vy = 0; }
  update(dt) { this.vy += GRAVITY * dt; }
}
function spawnEnemy() { enemies.push({ x: 0, speed: 2 }); }
function updatePhysics(dt) { player.update(dt); spawnEnemy(); }
function render() { const ctx = canvas.getContext('2d'); ctx.fillRect(0, 0, 1, 1); }
function loop(now) { const dt = now - last; last = now; updatePhysics(dt); render(); requestAnimationFrame(loop); }
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
document.addEventListener('visibilitychange', () => paused = document.hidden);
localStorage.setItem('save', JSON.stringify(state));
const re = /a\\/b/g;
const tpl = \`value \${x} end\`;
requestAnimationFrame(loop);
`;

test('tokenizer handles regex, templates, strings and comments', () => {
  const toks = tokenize(GAME_SRC);
  assert.ok(toks.some((t) => t.t === 'regex'), 'regex literal must be recognised');
  assert.ok(toks.some((t) => t.t === 'tmpl'), 'template literal must be recognised');
  assert.ok(toks.some((t) => t.t === 'comment'), 'comment must be recognised');
  // the division-vs-regex distinction: `a / b / c` is arithmetic, not a regex
  const arith = tokenize('var x = a / b / c;');
  assert.equal(arith.filter((t) => t.t === 'regex').length, 0);
});

test('js analyzer extracts structure, apis, idioms and tuning constants', () => {
  const a = analyzeJs(GAME_SRC, { file: 'game.js' });
  assert.deepEqual(a.functions.map((f) => f.name).sort(), ['loop', 'render', 'spawnEnemy', 'updatePhysics']);
  assert.equal(a.classes[0].name, 'Player');
  assert.equal(a.classes[0].extends, 'Entity');
  assert.ok(a.classes[0].methods.includes('update'));
  assert.equal(a.loopStyle, 'raf-delta');
  assert.ok(a.apis.raf >= 1 && a.apis['canvas-context'] === 1 && a.apis['local-storage'] === 1);
  assert.deepEqual(a.events, ['keydown', 'visibilitychange']);
  assert.deepEqual(a.tuning.gravity, [0.7]);
  assert.ok(a.patterns.includes('pause-on-blur'));
  assert.ok(a.patterns.includes('save-load'));
  assert.ok(a.callGraph.some((e) => e.from === 'loop' && e.to === 'render'), 'hoisted calls must appear in the call graph');
  // `in` walks the prototype chain, so check own keys: the point is that a
  // `constructor()` method never gets counted as a browser API.
  assert.ok(!Object.prototype.hasOwnProperty.call(a.apis, 'constructor'), 'prototype keys must not leak into the api map');
  assert.ok(!Object.keys(a.apis).some((k) => k.includes('native code')));
});

test('normalized tokens hide identifier renames', () => {
  const a = normalizedTokens('function alpha(x){ return x + 1; }').join(' ');
  const b = normalizedTokens('function beta(y){ return y + 1; }').join(' ');
  assert.equal(a, b, 'renaming variables must not change the normalized stream');
});

test('html analyzer finds scripts, styles, canvas and viewport', () => {
  const h = analyzeHtml(`<!DOCTYPE html><html lang="en"><head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Demo</title><link rel="stylesheet" href="s.css">
    <style>body{margin:0}</style></head>
    <body><canvas id="c" width="480"></canvas><button onclick="go()">go</button>
    <script src="https://cdn.example/three.min.js"></script>
    <script>var x = 1;</script></body></html>`);
  assert.equal(h.title, 'Demo');
  assert.equal(h.canvasCount, 1);
  assert.ok(h.responsiveViewport);
  assert.equal(h.scripts.external.length, 1);
  assert.equal(h.scripts.inlineCount, 1);
  assert.equal(h.styles.external.length, 1);
  assert.equal(h.inlineHandlers.length, 1);
  assert.equal(h.inlineSources.js[0].trim(), 'var x = 1;');
});

test('css analyzer reports layout systems, tokens and media queries', () => {
  const c = analyzeCss(`:root{--ink:#fff;--bg:#000}
    .a{display:flex;gap:4px}
    .b{display:grid;grid-template-columns:1fr 1fr}
    @media (max-width:600px){.a{gap:2px}}
    @keyframes pulse{from{opacity:0}to{opacity:1}}`);
  assert.ok(c.layout.flex && c.layout.grid && c.layout.animations);
  assert.equal(c.mediaQueries.length, 1);
  assert.deepEqual(c.keyframes, ['pulse']);
  assert.equal(c.customProperties.length, 2);
  assert.ok(c.palette.length >= 2);
});

function makeGlb() {
  const gltf = {
    asset: { version: '2.0' },
    nodes: [{ name: 'mixamorigHips', mesh: 0, skin: 0 }],
    meshes: [{ name: 'Hero', primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
    materials: [{ name: 'skin' }],
    skins: [{ joints: [0] }],
    animations: [{ name: 'Run', channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }], samplers: [{ input: 3, output: 4 }] }],
    accessors: [
      { count: 120, type: 'VEC3', componentType: 5126, min: [-0.5, 0, -0.3], max: [0.5, 1.8, 0.3] },
      { count: 120, type: 'VEC3', componentType: 5126 },
      { count: 300, type: 'SCALAR', componentType: 5123 },
      { count: 8, type: 'SCALAR', componentType: 5126, min: [0], max: [1.5] },
      { count: 8, type: 'VEC3', componentType: 5126 },
    ],
    bufferViews: [{ buffer: 0, byteLength: 8 }],
    buffers: [{ byteLength: 8 }],
  };
  const js = Buffer.from(JSON.stringify(gltf), 'utf8');
  const pad = (4 - (js.length % 4)) % 4;
  const jsonChunk = Buffer.concat([js, Buffer.alloc(pad, 0x20)]);
  const bin = Buffer.alloc(8);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4);
  const c1 = Buffer.alloc(8); c1.writeUInt32LE(jsonChunk.length, 0); c1.writeUInt32LE(0x4e4f534a, 4);
  const c2 = Buffer.alloc(8); c2.writeUInt32LE(bin.length, 0); c2.writeUInt32LE(0x004e4942, 4);
  const glb = Buffer.concat([head, c1, jsonChunk, c2, bin]);
  glb.writeUInt32LE(glb.length, 8);
  return glb;
}

test('glb analyzer parses the real binary container', () => {
  const g = analyzeGlb(makeGlb(), { file: 'hero.glb' });
  assert.equal(g.container, 'glb');
  assert.equal(g.counts.vertices, 120);
  assert.equal(g.counts.triangles, 100);
  assert.equal(g.modelType, 'character');
  assert.equal(g.animationClips[0].name, 'Run');
  assert.equal(g.animationClips[0].duration, 1.5);
  assert.deepEqual(g.boundingBox.size, [1, 1.8, 0.6]);
  assert.ok(g.possibleUsage.includes('player avatar'));
});

function makePng(w, h, paint) {
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    const o = y * (1 + w * 4);
    raw[o] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = paint(x, y);
      const p = o + 1 + x * 4;
      raw[p] = r; raw[p + 1] = g; raw[p + 2] = b; raw[p + 3] = 255;
    }
  }
  const table = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
  const crc = (b) => { let c = -1; for (const v of b) c = table[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const t = Buffer.from(type, 'ascii');
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

test('png decoder reads pixels and finds layout regions', () => {
  const png = makePng(32, 32, (x, y) => (y < 4 || x < 4 ? [230, 220, 200] : [16, 18, 26]));
  assert.deepEqual(readDimensions(png), { kind: 'png', width: 32, height: 32 });
  const r = analyzeImageStructure(png, { file: 'sketch.png' });
  assert.equal(r.decoded, true);
  assert.ok(r.darkTheme);
  assert.ok(r.structure.regions.some((x) => x.includes('top band')));
  assert.ok(r.structure.regions.some((x) => x.includes('left column')));
  assert.ok(r.note.includes('no semantic vision model'), 'must not overstate what it did');
});

test('concept extraction and relation roles', () => {
  const js = analyzeJs(GAME_SRC, { file: 'game.js' });
  const concepts = extractConcepts({ js: [js], html: [], css: [], glb: [], json: [], images: [] });
  const keys = concepts.map((c) => c.key);
  assert.ok(keys.includes('game-loop.raf-delta'));
  assert.ok(keys.includes('render.canvas2d'));
  assert.ok(keys.includes('data.save-localstorage'));
  for (const c of concepts) assert.ok(c.evidence.length > 0, `${c.key} must carry evidence`);

  assert.equal(roleOf('updatePhysics'), 'physics');
  assert.equal(roleOf('renderScene'), 'render');
  const rel = buildRelations([js]);
  assert.ok(rel.nodes.length > 2);
  assert.ok(rel.pipeline.length > 1);
});

test('licence detection never assumes permission', () => {
  const mit = detectLicenseFromFiles([{ rel: 'LICENSE', text: 'MIT License\\nCopyright (c) 2024' }]);
  assert.equal(mit.license, 'MIT');
  assert.equal(licenseProfile('MIT').commercialUse, 'allowed');

  const none = detectLicenseFromFiles([{ rel: 'readme.md', text: 'hello' }]);
  assert.equal(none.license, LICENSE_UNKNOWN);
  const profile = licenseProfile(none.license);
  assert.equal(profile.known, false);
  assert.equal(profile.commercialUse, 'unknown-do-not-assume');
  assert.ok(profile.warning);

  assert.equal(licenseProfile('CC-BY-NC-4.0').commercialUse, 'not-allowed');
  assert.equal(licenseProfile('GPL-3.0').copyleft, true);
});
