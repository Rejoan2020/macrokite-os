// Push notifications on this device (database mode). The browser asks permission once; the device's
// subscription is then saved on the server, which sends to it (see lib/server/push.js).

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** "unsupported", "unconfigured" (no server keys), "denied" (blocked for this site), or "available". */
export function pushAvailability() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (!PUBLIC_KEY) return "unconfigured";
  return Notification.permission === "denied" ? "denied" : "available";
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (!existing) await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return navigator.serviceWorker.ready;
}

/** This device's subscription, if notifications are on. */
export async function currentSubscription() {
  if (pushAvailability() === "unsupported") return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

const send = (method, body) =>
  fetch("/api/push", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (res) => {
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn’t save that on the server.");
  });

function keyBytes(base64) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/** Asks permission and turns notifications on. Returns the permission: "granted", "denied" or "default". */
export async function turnOnPush() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;
  const reg = await registration();
  const subscription = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }));
  await send("POST", { subscription: subscription.toJSON() });
  return permission;
}

/** Turns notifications off on this device. Best effort: the device stops receiving them either way. */
export async function turnOffPush() {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await send("DELETE", { endpoint: subscription.endpoint }).catch(() => {});
  await subscription.unsubscribe().catch(() => {});
}
