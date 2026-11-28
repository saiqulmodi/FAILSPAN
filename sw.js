/* sw.js — Offline-first PWA service worker for SETU-SHILPA (FAILSPAN) */
const CACHE = "setu-shilpa-v5";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./game.json",
  "./js/truss.js",
  "./js/i18n.js",
  "./js/unlock.js",
  "./js/intro.js",
  "./js/view3d.js",
  "./js/game.js",
  "./data/levels.json",
  "./data/projects.json",
  "./data/books.json",
  "./vendor/three.module.min.js"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});