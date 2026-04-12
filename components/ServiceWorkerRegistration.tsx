"use client";

import { useEffect } from "react";

/**
 * Same registration on every deploy: localhost, static hosting, or any CDN.
 * Browsers only run service workers on secure contexts (HTTPS, or http://localhost).
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => reg.update())
        .catch(() => {});
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
