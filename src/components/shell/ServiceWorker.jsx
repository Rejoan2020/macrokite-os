"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (public/sw.js), which shows an offline page when the installed app
 * opens without a connection. Production only, so it never gets in the way of `next dev`.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}
