/* NEXUS model compression — runs in the browser before a .glb is uploaded.
   Geometry: duplicate data removed, unused data pruned, meshopt compression
   (EXT_meshopt_compression, read by three.js GLTFLoader + MeshoptDecoder).
   Textures: larger than maxTexture are scaled down and re-encoded as WebP
   (EXT_texture_webp) — only when that makes them smaller.
   Built into nexus/lib/model-compress.js: npm install && npm run build
   (then add the license header back at the top of the output). */
import { WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, prune, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

async function toWebP(bytes, mime, max, quality) {
  const bmp = await createImageBitmap(new Blob([bytes], { type: mime }));
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
  let blob;
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(w, h);
    c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    blob = await c.convertToBlob({ type: 'image/webp', quality });
  } else {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    blob = await new Promise(r => c.toBlob(r, 'image/webp', quality));
  }
  bmp.close && bmp.close();
  /* a browser that cannot write WebP returns PNG — then keep the original */
  if (!blob || blob.type !== 'image/webp') return null;
  return { bytes: new Uint8Array(await blob.arrayBuffer()), w, h };
}

export async function compressModel(input, { maxTexture = 1024, quality = 0.85 } = {}) {
  await MeshoptEncoder.ready; await MeshoptDecoder.ready;
  const io = new WebIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const src = input instanceof Uint8Array ? input : new Uint8Array(input);
  const doc = await io.readBinary(src);
  const report = { before: src.byteLength, textures: [] };

  await doc.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));

  let webp = false;
  for (const t of doc.getRoot().listTextures()) {
    const img = t.getImage(), mime = t.getMimeType();
    if (!img || !/^image\/(png|jpeg|webp)$/.test(mime)) continue;
    try {
      const r = await toWebP(img, mime, maxTexture, quality);
      if (r && r.bytes.byteLength < img.byteLength) {
        t.setImage(r.bytes).setMimeType('image/webp');
        if (t.getURI()) t.setURI(t.getURI().replace(/\.(png|jpe?g)$/i, '.webp'));
        report.textures.push({ from: img.byteLength, to: r.bytes.byteLength, size: r.w + '×' + r.h });
        webp = true;
      }
    } catch (e) { /* this texture stays as it is */ }
  }
  if (webp) doc.createExtension(EXTTextureWebP).setRequired(true);

  const out = await io.writeBinary(doc);
  report.after = out.byteLength;
  return { bytes: out, report };
}
