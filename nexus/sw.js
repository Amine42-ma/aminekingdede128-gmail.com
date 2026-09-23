/* NEXUS offline support.
   Keeps NEXUS itself, its libraries and the files of games already opened on
   this phone, so NEXUS opens fast and a game that needs no internet can be
   played without it. Firestore data (games, builds, projects) is kept by
   Firestore's own cache on the device; this worker never touches Firestore,
   Auth or any upload. */
const V = 'v1';
const SHELL = 'nexus-shell-' + V;   // index.html
const LIBS = 'nexus-libs-' + V;     // three.js, Firebase SDK, fonts — versioned URLs, never change
const MEDIA = 'nexus-media-' + V;   // game files (Firebase Storage or Google Drive): models, textures, sounds, covers, snapshots
const KEEP = [SHELL, LIBS, MEDIA];
const MEDIA_MAX = 400;              // entries kept; the oldest go first

const SCOPE = new URL(self.registration.scope);
const PAGE_KEY = SCOPE.href;        // one key for the page, however it was opened
const LIB_RE = /^https:\/\/(cdn\.jsdelivr\.net\/npm\/three@|www\.gstatic\.com\/firebasejs\/|fonts\.gstatic\.com\/)/;
const FONT_CSS_RE = /^https:\/\/fonts\.googleapis\.com\/css/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL)
    .then(c => fetch(PAGE_KEY, { cache: 'no-cache' }).then(r => r.ok && c.put(PAGE_KEY, r)))
    .catch(() => {})
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('nexus-') && !KEEP.includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* the page lists what it downloaded before this worker was in control */
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type !== 'cache' || !Array.isArray(d.urls)) return;
  e.waitUntil(caches.open(LIBS).then(c => Promise.all(d.urls
    .filter(u => LIB_RE.test(u) || FONT_CSS_RE.test(u))
    .map(u => c.match(u).then(hit => hit || fetch(u, { mode: 'cors' }).then(r => { if (r.ok) return c.put(u, r); }).catch(() => {}))))));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate' && url.origin === SCOPE.origin &&
      (url.pathname === SCOPE.pathname || url.pathname === SCOPE.pathname + 'index.html')) {
    e.respondWith(page(req, e));
    return;
  }
  if (LIB_RE.test(req.url)) { e.respondWith(cacheFirst(req)); return; }
  if (FONT_CSS_RE.test(req.url)) { e.respondWith(staleWhileRevalidate(req, e)); return; }
  const storageFile = url.hostname === 'firebasestorage.googleapis.com';
  const driveFile = url.hostname === 'www.googleapis.com' && /^\/drive\/v3\/files\/[^/]+$/.test(url.pathname);
  if ((storageFile || driveFile) && url.searchParams.get('alt') === 'media' && !req.headers.has('range')) {
    e.respondWith(media(req, e));
    return;
  }
  /* everything else (Firestore, Auth, uploads, video ranges) goes straight to the network */
});

/* index.html: the fresh copy whenever the network answers within 3 s (so a
   new upload reaches every phone), the saved copy otherwise — at once when
   there is no internet. The fresh copy always replaces the saved one. */
async function page(req, e) {
  const cache = await caches.open(SHELL);
  const saved = await cache.match(PAGE_KEY);
  const net = fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); e.waitUntil(cache.put(PAGE_KEY, copy)); }
    return r;
  });
  if (!saved) return net;
  e.waitUntil(net.catch(() => {}));
  return Promise.race([
    net.then(r => r.ok ? r : saved, () => saved),
    new Promise(res => setTimeout(() => res(saved), 3000))
  ]);
}

/* versioned library files never change: the saved copy, or download and keep */
async function cacheFirst(req) {
  const cache = await caches.open(LIBS);
  const hit = await cache.match(req.url);
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok || r.type === 'opaque') cache.put(req.url, r.clone()).catch(() => {});
  return r;
}

async function staleWhileRevalidate(req, e) {
  const cache = await caches.open(LIBS);
  const hit = await cache.match(req.url);
  const net = fetch(req).then(r => { if (r.ok) cache.put(req.url, r.clone()).catch(() => {}); return r; });
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  return net;
}

/* game files (Storage / Drive): always the current file when online (a
   republished game may reuse a path), the saved copy when offline */
async function media(req, e) {
  const cache = await caches.open(MEDIA);
  try {
    const r = await fetch(req);
    if (r.status === 200 || r.type === 'opaque') e.waitUntil(cache.put(req, r.clone()).then(() => trim(cache)).catch(() => {}));
    return r;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw err;
  }
}

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MEDIA_MAX; i++) await cache.delete(keys[i]);
}
