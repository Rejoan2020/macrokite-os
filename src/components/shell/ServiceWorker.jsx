"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Registers the service worker (public/sw.js): the offline page and push notifications. Production
 * only, so it never gets in the way of `next dev`; turning on notifications registers it anywhere.
 * A tapped notification asks the open app to show its page.
 */
export function ServiceWorker() {
  const router = useRouter();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    const onMessage = (event) => {
      if (event.data?.type === "open" && typeof event.data.path === "string" && event.data.path.startsWith("/")) router.push(event.data.path);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  return null;
}
