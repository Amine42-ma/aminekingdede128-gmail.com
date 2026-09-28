/* NEXUS tests · a real, minimal .glb (a coloured box standing on y = 0) — the test library's
   models are files NEXUS downloads, parses with its GLTFLoader and places like any upload. */
export function boxGLB(name, [sx, sy, sz], [r, g, b] = [0.6, 0.6, 0.6]) {
  const x = sx / 2, z = sz / 2;
  const faces = [
    [[1, 0, 0], [[x, 0, -z], [x, sy, -z], [x, sy, z], [x, 0, z]]],
    [[-1, 0, 0], [[-x, 0, z], [-x, sy, z], [-x, sy, -z], [-x, 0, -z]]],
    [[0, 1, 0], [[-x, sy, -z], [-x, sy, z], [x, sy, z], [x, sy, -z]]],
    [[0, -1, 0], [[-x, 0, z], [-x, 0, -z], [x, 0, -z], [x, 0, z]]],
    [[0, 0, 1], [[x, 0, z], [x, sy, z], [-x, sy, z], [-x, 0, z]]],
    [[0, 0, -1], [[-x, 0, -z], [-x, sy, -z], [x, sy, -z], [x, 0, -z]]]
  ];
  const pos = [], nrm = [], idx = [];
  faces.forEach(([n, vs], f) => { vs.forEach(v => { pos.push(...v); nrm.push(...n); }); const o = f * 4; idx.push(o, o + 1, o + 2, o, o + 2, o + 3); });
  const P = Buffer.from(new Float32Array(pos).buffer), N = Buffer.from(new Float32Array(nrm).buffer), I = Buffer.from(new Uint16Array(idx).buffer);
  const bin = Buffer.concat([P, N, I, Buffer.alloc((4 - (P.length + N.length + I.length) % 4) % 4)]);
  const json = {
    asset: { version: '2.0', generator: 'nexus-tests' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name }], meshes: [{ name, primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
    materials: [{ name, pbrMetallicRoughness: { baseColorFactor: [r, g, b, 1], metallicFactor: 0, roughnessFactor: 0.8 } }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: P.length, target: 34962 }, { buffer: 0, byteOffset: P.length, byteLength: N.length, target: 34962 },
      { buffer: 0, byteOffset: P.length + N.length, byteLength: I.length, target: 34963 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', min: [-x, 0, -z], max: [x, sy, z] },
      { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' }, { bufferView: 2, componentType: 5123, count: 36, type: 'SCALAR' }]
  };
  let j = Buffer.from(JSON.stringify(json));
  j = Buffer.concat([j, Buffer.alloc((4 - j.length % 4) % 4, 0x20)]);
  const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + j.length + 8 + bin.length, 8);
  jh.writeUInt32LE(j.length, 0); jh.writeUInt32LE(0x4E4F534A, 4);
  bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004E4942, 4);
  return Buffer.concat([head, jh, j, bh, bin]);
}
