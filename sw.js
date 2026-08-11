// Offline app shell. Bump CACHE on every deploy to push updates to installed phones.
const CACHE = "china-trip-v11";
const ASSETS = [
  "./", "index.html", "logic.js", "crypto.js", "seed.enc.json", "manifest.json", "icon.svg",
  // Le foto delle città: ~444 KB, scaricate PRIMA di partire. In Cina github.io non risponde.
  "img/pechino.jpg", "img/xian.jpg", "img/emeishan.jpg", "img/chengdu.jpg",
  "img/wulingyuan.jpg", "img/zjjwest.jpg", "img/yangshuo.jpg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: serve cache instantly, refresh it in the background.
// User state lives in localStorage (keyed by stable ids), so a refreshed seed.json never clobbers it.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(e.request).then((cached) => {
        const network = fetch(e.request).then((res) => {
          if (res && res.status === 200) cache.put(e.request, res.clone());
          return res;
        }).catch(() => cached || cache.match("index.html"));
        return cached || network;
      })
    )
  );
});
