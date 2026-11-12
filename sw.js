// Bump VERSION (and APP_VERSION in js/version.js) with every release.
const VERSION = '2.3.0';
const CACHE = 'system-' + VERSION;
const ASSETS = [
  './', './index.html', './app.css', './manifest.webmanifest',
  './js/app.js', './js/engine.js', './js/program.js', './js/store.js', './js/sync.js', './js/characters.js', './js/version.js', './js/library.js', './js/importer.js',
  './vendor/firebase.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
  './characters/hunter-1.jpg', './characters/hunter-2.jpg', './characters/hunter-3.jpg', './characters/hunter-4.jpg',
  './characters/hunter-1-face.jpg', './characters/hunter-2-face.jpg', './characters/hunter-3-face.jpg', './characters/hunter-4-face.jpg'
];

self.addEventListener('install', e => {
  // Do not take over on our own: the page shows an "update available" banner
  // and tells us when to switch.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('system-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Only this app's own files. Network first so updates show up right away;
// the cached copy is the fallback when offline. Requests to Google/Firebase
// are never touched.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(new URL('./', self.location).pathname)) return;
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request, { ignoreSearch: true }).then(cached => {
        // App code comes from this version's cache so a half-updated mix can't happen;
        // pages (and anything not cached yet) go to the network first.
        if (cached && e.request.mode !== 'navigate') return cached;
        return fetch(e.request)
          .then(res => { if (res.ok && e.request.mode !== 'navigate') cache.put(e.request, res.clone()); return res; })
          .catch(() => cached || cache.match('./index.html'));
      })
    )
  );
});
