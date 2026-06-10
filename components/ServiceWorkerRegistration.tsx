"use client";

import { useEffect } from "react";

/**
 * Same registration on every deploy: localhost, static hosting, or any CDN.
 * Browsers only run service workers on secure contexts (HTTPS, or http://localhost).
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "development") {
      /**
       * Tear down any SW left over from a production build so dev always loads
       * fresh files from Next. unregister() alone is not enough: the active
       * worker keeps controlling THIS page (and serving its stale cache) until
       * the page reloads without a controller, which is why newly added
       * curriculum files appear to "load forever." So we also delete the SW
       * caches and reload once when a stale controller is still in charge.
       */
      void (async () => {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
          if (navigator.serviceWorker.controller) {
            if (!sessionStorage.getItem("sw-dev-reloaded")) {
              sessionStorage.setItem("sw-dev-reloaded", "1");
              window.location.reload();
            }
          } else {
            sessionStorage.removeItem("sw-dev-reloaded");
          }
        } catch {
          /* best-effort cleanup */
        }
      })();
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => reg.update())
      .catch(() => {});
  }, []);

  return null;
}
