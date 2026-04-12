const CACHE_NAME = "offlearn-v5";

const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/curriculum/index.json",
];

function cachePutSafe(cache, request, response) {
  if (!response || !response.ok) return;
  const clone = response.clone();
  return cache.put(request, clone).catch(() => {});
}

async function offlineNavigationFallback(request) {
  const origin = new URL(request.url).origin;
  const candidates = [
    request,
    new Request(`${origin}/`),
    new Request(`${origin}/index.html`),
    new Request(`${origin}`),
  ];
  for (const key of candidates) {
    const hit = await caches.match(key);
    if (hit) return hit;
  }
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  for (const req of keys) {
    const u = req.url;
    if (u.endsWith("/") || u.endsWith("index.html")) {
      const hit = await caches.match(req);
      if (hit) return hit;
    }
  }
  return undefined;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/models/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        fetch(event.request)
          .then((response) => {
            cachePutSafe(cache, event.request, response);
            return response;
          })
          .catch(() => caches.match(event.request))
      )
    );
    return;
  }

  // Curriculum index: network-first so the course list can update after deploy.
  // Lesson JSON: cache-first so reopening a lesson is instant after the first load.
  if (url.pathname.startsWith("/curriculum/")) {
    const isCourseIndex =
      url.pathname === "/curriculum/index.json" ||
      url.pathname.endsWith("/curriculum/index.json");
    if (isCourseIndex) {
      event.respondWith(
        caches.open(CACHE_NAME).then((cache) =>
          fetch(event.request)
            .then((response) => {
              cachePutSafe(cache, event.request, response);
              return response;
            })
            .catch(() => caches.match(event.request))
        )
      );
      return;
    }
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            cachePutSafe(cache, event.request, response);
            return response;
          });
        })
      )
    );
    return;
  }

  if (
    url.pathname.startsWith("/mediapipe-wasm/") ||
    url.pathname.startsWith("/knowledge-packs/") ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".wasm") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".json")
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            cachePutSafe(cache, event.request, response);
            return response;
          });
        })
      )
    );
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        fetch(event.request)
          .then((response) => {
            cachePutSafe(cache, event.request, response);
            return response;
          })
          .catch(() => offlineNavigationFallback(event.request))
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(
      (cached) => cached || fetch(event.request)
    )
  );
});
