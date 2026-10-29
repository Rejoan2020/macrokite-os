// Macrokite OS service worker. Opening the app with no connection shows a small offline page instead
// of the browser's error. Nothing else is cached: the app always loads fresh from the server.

const CACHE = "macrokite-offline-v1";
const OFFLINE_PAGE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_PAGE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Starts page loads while the worker wakes up, so it doesn't slow them down.
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    (async () => {
      try {
        return (await event.preloadResponse) || (await fetch(event.request));
      } catch {
        return (await caches.match(OFFLINE_PAGE)) || Response.error();
      }
    })()
  );
});
