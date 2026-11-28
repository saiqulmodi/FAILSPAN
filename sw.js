/* sw.js — Offline-first PWA service worker for SETU-SHILPA (FAILSPAN) */
const CACHE = "setu-shilpa-v8";
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

// every class's questions and the handbook too (about 6.3 MB), so classes never opened still work offline;
// the class list comes from data/levels.json. One file failing does not stop the install. data/archive/ never.
const EXTRA_ASSETS = levels => levels.map(l => `./data/q/${l.l}.json`).concat(["./data/handbook.json"]);
const isArchive = url => new URL(url, self.location).pathname.includes("/data/archive/");
// install fetches skip the browser's HTTP cache, so a new version never caches stale copies of its files
const fresh = url => new Request(url, { cache: "reload" });

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE_ASSETS.map(fresh))    // must all succeed, as before
      .then(() => c.match("./data/levels.json").then(r => r.json())
        .then(lv => Promise.allSettled(EXTRA_ASSETS(lv.levels).filter(u => !isArchive(u)).map(u => c.add(fresh(u)))))
        .catch(() => {})))                                              // extras: best effort
      .then(() => self.skipWaiting())
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
  if (e.request.method !== "GET" || isArchive(e.request.url)) return;
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