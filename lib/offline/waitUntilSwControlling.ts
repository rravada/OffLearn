/**
 * Ensures the first heavy fetches (e.g. Gemma .task) go through the service worker
 * so they can be cached for offline. On first paint, `controller` is often null until
 * `clients.claim()` runs after SW activation.
 */
export async function waitUntilSwControlling(timeoutMs = 12000): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (navigator.serviceWorker.controller) return;

  await new Promise<void>((resolve) => {
    const done = () => resolve();
    const t = window.setTimeout(done, timeoutMs);
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => {
        window.clearTimeout(t);
        done();
      },
      { once: true }
    );
  });
}
