import { GEMMA_MODEL_ASSET_URL } from "@/lib/inference/gemmaModelUrl";
import { SW_CACHE_NAME } from "@/lib/offline/swCacheName";

function canonicalModelRequest(modelUrl: string): Request {
  const u = new URL(modelUrl);
  return new Request(`${u.origin}${u.pathname}`, { method: "GET" });
}

/**
 * MediaPipe often loads the .task from a worker; that path may not populate the
 * Cache API entry the SW uses, so offline gets 503. We fetch once from the main
 * thread **before** `LLMSession.getInstance()` so the SW (or this fallback) is
 * guaranteed to store a full 200 before the model initializes.
 */
export async function primeRemoteGemmaModelCacheIfNeeded(): Promise<void> {
  const url = GEMMA_MODEL_ASSET_URL;
  if (!url.startsWith("http") || typeof caches === "undefined") return;

  const keyReq = canonicalModelRequest(url);
  const cache = await caches.open(SW_CACHE_NAME);
  if (await cache.match(keyReq)) return;

  const res = await fetch(url, {
    mode: "cors",
    credentials: "omit",
    cache: "reload",
  });

  const cacheable =
    res.ok &&
    res.status === 200 &&
    !res.headers.get("Content-Range");

  if (!cacheable) {
    console.warn(
      "[OffLearn] Gemma cache prime: unexpected response",
      res.status,
      res.headers.get("Content-Range")
    );
    return;
  }

  if (!(await cache.match(keyReq))) {
    try {
      await cache.put(keyReq, res.clone());
    } catch (e) {
      console.warn("[OffLearn] Gemma cache put failed (quota?)", e);
    }
  }

  try {
    await res.arrayBuffer();
  } catch {
    /* drain body if put used clone only */
  }
}
