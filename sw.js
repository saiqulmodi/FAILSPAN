// Offline once loaded: the game files are cached on install; each class's questions are cached the first time it opens.
const CACHE = "failspan-v4";
const CORE = ["./", "index.html", "js/truss.js", "js/i18n.js", "js/intro.js", "js/game.js", "js/view3d.js", "vendor/fonts/chakra-petch-600.woff2", "vendor/fonts/chakra-petch-700.woff2", "data/levels.json", "data/projects.json", "favicon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  // network first so updates arrive; fall back to the cache when offline
  e.respondWith(fetch(e.request.url, { cache: "no-cache" }).then(r => {
    const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request)));
});
