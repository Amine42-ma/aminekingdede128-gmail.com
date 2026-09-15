/**
 * GLB / glTF 2.0 analyzer (spec 21).
 *
 * Parses the real binary container: header, JSON chunk, BIN chunk. Everything
 * reported here is read out of the file, not guessed — except the fields marked
 * `approx`, where we say so (bounding box ignores node transforms, since we do
 * not evaluate the scene graph).
 */

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

const COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

export function parseGlbContainer(buf) {
  if (buf.length < 12 || buf.readUInt32LE(0) !== GLB_MAGIC) {
    // maybe a .gltf JSON file
    const text = buf.toString('utf8', 0, Math.min(buf.length, 64)).trim();
    if (text.startsWith('{')) return { json: JSON.parse(buf.toString('utf8')), bin: null, container: 'gltf-json' };
    throw new Error('not a GLB/glTF file');
  }
  const version = buf.readUInt32LE(4);
  const total = buf.readUInt32LE(8);
  let off = 12;
  let json = null;
  let bin = null;
  while (off + 8 <= Math.min(total, buf.length)) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const start = off + 8;
    const end = Math.min(start + len, buf.length);
    if (type === CHUNK_JSON) json = JSON.parse(buf.toString('utf8', start, end));
    else if (type === CHUNK_BIN) bin = buf.slice(start, end);
    off = start + len + ((4 - (len % 4)) % 4);
  }
  if (!json) throw new Error('GLB has no JSON chunk');
  return { json, bin, container: 'glb', version };
}

const HUMANOID_HINTS = ['hips', 'spine', 'head', 'neck', 'shoulder', 'arm', 'leg', 'foot', 'hand', 'thigh', 'knee', 'pelvis', 'mixamorig'];
const VEHICLE_HINTS = ['wheel', 'chassis', 'tyre', 'tire', 'car', 'truck', 'vehicle', 'bike', 'engine'];
const NATURE_HINTS = ['tree', 'rock', 'grass', 'plant', 'leaf', 'bush', 'stone', 'terrain', 'cliff'];
const BUILDING_HINTS = ['house', 'building', 'wall', 'door', 'window', 'roof', 'floor', 'room', 'tower'];
const WEAPON_HINTS = ['gun', 'sword', 'rifle', 'pistol', 'blade', 'weapon', 'bow', 'axe'];

function hintScore(names, hints) {
  const text = names.join(' ').toLowerCase();
  return hints.reduce((s, h) => s + (text.includes(h) ? 1 : 0), 0);
}

export function analyzeGlb(buf, { file = 'model.glb' } = {}) {
  const { json, bin, container, version } = parseGlbContainer(buf);
  const j = json;
  const accessors = j.accessors || [];
  const meshes = j.meshes || [];
  const nodes = j.nodes || [];
  const materials = j.materials || [];
  const animations = j.animations || [];
  const skins = j.skins || [];
  const images = j.images || [];
  const textures = j.textures || [];
  const bufferViews = j.bufferViews || [];

  let vertices = 0;
  let triangles = 0;
  let primitives = 0;
  let untexturedPrims = 0;
  const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  const attrsUsed = new Set();

  for (const mesh of meshes) {
    for (const prim of mesh.primitives || []) {
      primitives++;
      const posIdx = prim.attributes?.POSITION;
      for (const a of Object.keys(prim.attributes || {})) attrsUsed.add(a);
      if (posIdx != null && accessors[posIdx]) {
        const acc = accessors[posIdx];
        vertices += acc.count || 0;
        if (Array.isArray(acc.min) && Array.isArray(acc.max)) {
          for (let i = 0; i < 3; i++) {
            box.min[i] = Math.min(box.min[i], acc.min[i]);
            box.max[i] = Math.max(box.max[i], acc.max[i]);
          }
        }
      }
      const mode = prim.mode ?? 4;
      if (prim.indices != null && accessors[prim.indices]) {
        const c = accessors[prim.indices].count || 0;
        if (mode === 4) triangles += Math.floor(c / 3);
        else if (mode === 5 || mode === 6) triangles += Math.max(0, c - 2);
      } else if (posIdx != null && accessors[posIdx] && mode === 4) {
        triangles += Math.floor((accessors[posIdx].count || 0) / 3);
      }
      if (prim.material == null) untexturedPrims++;
    }
  }

  const finiteBox = Number.isFinite(box.min[0]) && Number.isFinite(box.max[0]);
  const size = finiteBox ? [box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]] : null;

  const clips = animations.map((a, i) => {
    let duration = 0;
    for (const s of a.samplers || []) {
      const inAcc = accessors[s.input];
      if (inAcc?.max?.[0] != null) duration = Math.max(duration, inAcc.max[0]);
    }
    return {
      name: a.name || `clip_${i}`,
      channels: (a.channels || []).length,
      duration: Math.round(duration * 1000) / 1000,
      targets: [...new Set((a.channels || []).map((c) => c.target?.path).filter(Boolean))],
    };
  });

  const names = [
    ...nodes.map((n) => n.name || ''),
    ...meshes.map((m) => m.name || ''),
    ...(skins.flatMap((s) => (s.joints || []).map((idx) => nodes[idx]?.name || ''))),
    file,
  ].filter(Boolean);

  const scores = {
    character: hintScore(names, HUMANOID_HINTS) * 2 + (skins.length ? 4 : 0) + (clips.length ? 2 : 0),
    vehicle: hintScore(names, VEHICLE_HINTS) * 3,
    nature: hintScore(names, NATURE_HINTS) * 3,
    building: hintScore(names, BUILDING_HINTS) * 3,
    weapon: hintScore(names, WEAPON_HINTS) * 3,
  };
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const modelType = best[1] > 0 ? best[0] : 'prop';

  const imageBytes = images.reduce((s, img) => {
    if (img.bufferView != null && bufferViews[img.bufferView]) return s + (bufferViews[img.bufferView].byteLength || 0);
    return s;
  }, 0);

  const suggestions = [];
  if (triangles > 150000) suggestions.push(`high triangle count (${triangles.toLocaleString()}) - consider an LOD or decimation pass before using it in a real-time scene`);
  if (materials.length > 12) suggestions.push(`${materials.length} materials means at least that many draw calls per instance - atlas or merge where possible`);
  if (imageBytes > 8 * 1024 * 1024) suggestions.push('embedded textures exceed 8MB - consider KHR_texture_basisu / smaller textures for the web');
  if (!(j.extensionsUsed || []).some((e) => /draco|meshopt/i.test(e)) && vertices > 60000) suggestions.push('geometry is uncompressed - Draco or meshopt would cut download size');
  if (untexturedPrims) suggestions.push(`${untexturedPrims} primitive(s) have no material assigned - they will render with the default material`);
  if (!attrsUsed.has('NORMAL')) suggestions.push('no NORMAL attribute - lighting will need generated normals (flat shading)');
  if (!attrsUsed.has('TEXCOORD_0') && materials.length) suggestions.push('no UV set - textured materials cannot be mapped');
  if (size && Math.max(...size) > 500) suggestions.push('model is very large in scene units - rescale to keep camera/physics sane');
  if (size && Math.max(...size) < 0.05) suggestions.push('model is very small in scene units - rescale before use');

  const usage = [];
  if (modelType === 'character') usage.push('player avatar', 'NPC', 'enemy');
  if (modelType === 'vehicle') usage.push('drivable vehicle', 'traffic prop', 'racing game entity');
  if (modelType === 'nature') usage.push('environment scatter', 'obstacle', 'cover');
  if (modelType === 'building') usage.push('level geometry', 'interior space', 'landmark');
  if (modelType === 'weapon') usage.push('pickup item', 'held item', 'projectile source');
  if (!usage.length) usage.push('scene prop', 'collectible', 'decoration');

  return {
    file,
    container,
    version: version ?? j.asset?.version ?? null,
    generator: j.asset?.generator || null,
    copyright: j.asset?.copyright || null,
    bytes: buf.length,
    binBytes: bin ? bin.length : 0,
    counts: {
      meshes: meshes.length,
      primitives,
      nodes: nodes.length,
      materials: materials.length,
      textures: textures.length,
      images: images.length,
      animations: animations.length,
      skins: skins.length,
      cameras: (j.cameras || []).length,
      vertices,
      triangles,
    },
    attributes: [...attrsUsed],
    boundingBox: finiteBox ? { min: box.min, max: box.max, size, approx: 'union of mesh accessor bounds; node transforms not applied' } : null,
    animationClips: clips,
    skinned: skins.length > 0,
    extensionsUsed: j.extensionsUsed || [],
    extensionsRequired: j.extensionsRequired || [],
    embeddedTextureBytes: imageBytes,
    externalResources: [
      ...images.map((i) => i.uri).filter(Boolean),
      ...(j.buffers || []).map((b) => b.uri).filter(Boolean),
    ],
    modelType,
    possibleUsage: usage,
    hasAnimation: clips.length > 0,
    optimizationSuggestions: suggestions,
  };
}
