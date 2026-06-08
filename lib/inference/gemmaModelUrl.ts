/**
 * Gemma `.task` asset URL for MediaPipe `modelAssetPath`.
 *
 * - **Portable (localhost:3000):** served from /model/ by the local Python server
 *   created by `npm run export:portable`. Detected at runtime via window.location.
 * - **Local dev:** place `gemma-4-E2B-it-web.task` under `public/models/` and run
 *   dev on a port other than 3000 (`next dev -p 3001`), or set NEXT_PUBLIC_GEMMA_MODEL_URL.
 * - **Vercel / production:** set `NEXT_PUBLIC_GEMMA_MODEL_URL` to a stable HTTPS URL
 *   (HF `resolve` link, R2, etc.). CORS must allow your origin. The build injects
 *   this URL into `sw.js` so the service worker caches the file for offline use
 *   after the first successful online load.
 *
 * @see https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/tree/main
 */
export const GEMMA_MODEL_ASSET_URL = (() => {
  if (
    typeof window !== "undefined" &&
    window.location.hostname === "localhost" &&
    window.location.port === "3000"
  ) {
    return "/model/gemma-4-E2B-it-web.task";
  }
  return (
    (typeof process !== "undefined" &&
      typeof process.env.NEXT_PUBLIC_GEMMA_MODEL_URL === "string" &&
      process.env.NEXT_PUBLIC_GEMMA_MODEL_URL.trim()) ||
    "/models/gemma-4-E2B-it-web.task"
  );
})();
