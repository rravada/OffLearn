const CACHE_NAME = "offlearn-v6";

const PRECACHE_URLS = ["/", "/manifest.json", "/curriculum/index.json"];

function cachePutSafe(cache, request, response) {
  if (!response || !response.ok) return Promise.resolve();
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

/** Cache-first: offline-safe (returns cached on network failure). */
async function cacheFirst(cache, request) {
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    await cachePutSafe(cache, request, response);
    return response;
  } catch {
    const again = await cache.match(request);
    if (again) return again;
    throw new Error("offline-miss");
  }
}

/** Network-first with cache fallback (for curriculum index updates). */
async function networkFirstWithCacheFallback(cache, request) {
  try {
    const response = await fetch(request);
    await cachePutSafe(cache, request, response);
    return response;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw new Error("offline-miss");
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        PRECACHE_URLS.map(async (path) => {
          try {
            await cache.add(path);
          } catch {
            try {
              const res = await fetch(path);
              if (res.ok) await cache.put(path, res.clone());
            } catch {
              /* precache best-effort */
            }
          }
        })
      );
    })
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
          .catch(() =>
            cache
              .match(event.request)
              .then((r) => r || new Response("", { status: 503 }))
          )
      )
    );
    return;
  }

  if (url.pathname.startsWith("/curriculum/")) {
    const isCourseIndex =
      url.pathname === "/curriculum/index.json" ||
      url.pathname.endsWith("/curriculum/index.json");
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        isCourseIndex
          ? networkFirstWithCacheFallback(cache, event.request).catch(async () => {
              const hit = await cache.match(event.request);
              if (hit) return hit;
              return new Response(
                JSON.stringify({ error: "offline", path: url.pathname }),
                { status: 503, headers: { "Content-Type": "application/json" } }
              );
            })
          : cacheFirst(cache, event.request).catch(async () => {
              const hit = await cache.match(event.request);
              if (hit) return hit;
              return new Response(
                JSON.stringify({ error: "offline", path: url.pathname }),
                { status: 503, headers: { "Content-Type": "application/json" } }
              );
            })
      )
    );
    return;
  }

  if (
    url.pathname.startsWith("/mediapipe-wasm/") ||
    url.pathname.startsWith("/knowledge-packs/") ||
    url.pathname.startsWith("/testprep/") ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".wasm") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".json")
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cacheFirst(cache, event.request).catch(async () => {
          const hit = await cache.match(event.request);
          if (hit) return hit;
          return new Response("", { status: 503, statusText: "Offline" });
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
          .catch(() =>
            offlineNavigationFallback(event.request).then(
              (res) =>
                res ||
                new Response("<!DOCTYPE html><html><body>Offline</body></html>", {
                  status: 503,
                  headers: { "Content-Type": "text/html; charset=utf-8" },
                })
            )
          )
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .catch(() => caches.match(event.request))
        .then((res) => res || new Response("", { status: 503 }));
    })
  );
});
