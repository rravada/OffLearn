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
      /** Tear down SW from earlier sessions so dev always loads fresh bundles from Next. */
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) => {
          for (const r of regs) void r.unregister();
        })
        .catch(() => {});
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => reg.update())
      .catch(() => {});
  }, []);

  return null;
}
