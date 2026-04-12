const CACHE_NAME = "offlearn-v4";

// Precache runs while installing (usually online). Seeds the app shell + curriculum
// index so a first offline open still has something to show.
const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/curriculum/index.json",
];

function cachePutSafe(cache, request, response) {
  if (!response || !response.ok) return;
  const clone = response.clone();
  return cache.put(request, clone).catch(() => {
    /* QuotaExceededError for huge assets — ignore */
  });
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

  // Same-origin only (ignore chrome-extension etc.)
  if (url.origin !== self.location.origin) {
    return;
  }

  // Large model weights: network-first, cache when possible, offline = last good copy
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

  // Curriculum: network-first so lists stay fresh online; offline uses cache
  if (url.pathname.startsWith("/curriculum/")) {
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

  // Static assets & WASM
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

  // HTML navigations
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

  // Default: cache then network
  event.respondWith(
    caches.match(event.request).then(
      (cached) => cached || fetch(event.request)
    )
  );
});
