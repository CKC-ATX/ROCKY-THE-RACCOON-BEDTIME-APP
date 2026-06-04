const CACHE_NAME = "bedtime-routine-v5";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./script.js",
  "./manifest.json",
  "./assets/bedtime-dash.png",
  "./assets/bedtime-brush-teeth.png",
  "./assets/bedtime-pjs.png",
  "./assets/bedtime-storybook.png",
  "./assets/bedtime-prayer.png",
  "./assets/bedtime-head-pillow.png",
  "./assets/bedtime-custom-task.png",
  "./assets/bedtime-sleep.png",
  "./assets/lets-start.m4a",
  "./assets/teeth.m4a",
  "./assets/pj.m4a",
  "./assets/storybook.m4a",
  "./assets/prayer.m4a",
  "./assets/pillow.m4a",
  "./assets/added-task.m4a",
  "./assets/start.m4a",
  "./assets/brush-teeth.m4a",
  "./assets/pjs.m4a",
  "./assets/head-pillow.m4a",
  "./assets/goodnight.m4a",
  "./assets/custom-task.m4a"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then((networkResponse) => {
          const responseCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseCopy);
          });
          return networkResponse;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
