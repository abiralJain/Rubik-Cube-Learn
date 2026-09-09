// Minimal offline shell: cache the app shell on install, network-first for everything else.
// The app may be served from a repo subpath (GitHub Pages), so every path is derived from this worker's own scope.
const SHELL = 'cube-shell-v1';
const BASE = new URL('./', self.location).pathname;
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll([BASE, `${BASE}index.html`, `${BASE}manifest.webmanifest`])));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((m) => m || caches.match(BASE)))
  );
});
