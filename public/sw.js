const CACHE_NAME = "offlearn-v12";

/**
 * Production: replaced in `out/sw.js` by scripts/bake-sw-remote-model.js from
 * NEXT_PUBLIC_GEMMA_MODEL_URL so the SW can cache the remote .task for offline.
 * @type {string}
 */
const BAKED_GEMMA_REMOTE_URL = "";

/** App shell + manifest index (full list in precache-manifest.json). */
const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/curriculum/index.json",
  "/testprep/sat-math.json",
  "/testprep/sat-reading.json",
  "/testprep/act-math.json",
  "/precache-manifest.json",
];

function cachePutSafe(cache, request, response) {
  if (!response || !response.ok) return Promise.resolve();
  const clone = response.clone();
  return cache.put(request, clone).catch(() => {});
}

/** Precache many URLs in small batches (reliable on CDN / mobile). */
async function precacheUrlList(cache, urls) {
  if (!Array.isArray(urls) || urls.length === 0) return;
  const BATCH = 16;
  for (let i = 0; i < urls.length; i += BATCH) {
    const slice = urls.slice(i, i + BATCH);
    await Promise.allSettled(
      slice.map((u) =>
        cache.add(u).catch(async () => {
          try {
            const r = await fetch(u);
            if (r.ok) await cache.put(u, r.clone());
          } catch {
            /* skip */
          }
        })
      )
    );
  }
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

/**
 * Large .task models: browsers / MediaPipe may use Range or varying headers.
 * Cache API keys requests by full URL + headers, so offline misses the entry.
 * We always store and look up by a plain GET to pathname only.
 */
function modelCacheKeyRequest(request) {
  const url = new URL(request.url);
  return new Request(`${url.origin}${url.pathname}`, { method: "GET" });
}

async function serveModelAsset(cache, request) {
  const keyReq = modelCacheKeyRequest(request);
  const fromCache = await cache.match(keyReq);
  if (fromCache) return fromCache;

  try {
    const response = await fetch(request);
    const fullOk =
      response &&
      response.ok &&
      response.status === 200 &&
      !response.headers.get("Content-Range");
    if (fullOk) {
      try {
        await cache.put(keyReq, response.clone());
      } catch {
        /* disk quota / huge file — still return live response */
      }
    }
    return response;
  } catch {
    const again = await cache.match(keyReq);
    if (again) return again;
    return new Response("", { status: 503, statusText: "Model not cached" });
  }
}

/** Remote Gemma .task (Vercel + HF CDN redirects): same file, varying huggingface.co hosts. */
function isRemoteGemmaModelRequest(url) {
  if (!BAKED_GEMMA_REMOTE_URL) return false;
  let baked;
  try {
    baked = new URL(BAKED_GEMMA_REMOTE_URL);
  } catch {
    return false;
  }
  if (!url.pathname.endsWith("/gemma-4-E2B-it-web.task")) return false;
  if (url.origin === baked.origin && url.pathname === baked.pathname) return true;
  if (
    baked.hostname.includes("huggingface.co") &&
    url.hostname.includes("huggingface.co")
  ) {
    return true;
  }
  return false;
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
              /* best-effort */
            }
          }
        })
      );

      try {
        const res = await fetch("/precache-manifest.json", { cache: "reload" });
        if (!res.ok) return;
        const data = await res.json();
        const urls = data.urls;
        if (Array.isArray(urls) && urls.length > 0) {
          await precacheUrlList(cache, urls);
        }
      } catch {
        /* dev or missing file */
      }
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

  if (isRemoteGemmaModelRequest(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        serveModelAsset(cache, event.request)
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/models/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        serveModelAsset(cache, event.request)
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
