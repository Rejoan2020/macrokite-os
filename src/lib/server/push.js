import "server-only";
import webpush from "web-push";
import { PushSubscription } from "./models";

// Push notifications (Web Push). The keys are generated once with web-push; the public one is also
// given to browsers when they subscribe. Without them, pushes are off and nothing else changes.

export const isPushConfigured = () => Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim());

let ready = false;
function setup() {
  if (ready) return;
  // Push services contact this address about problems; the app's own URL works.
  webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || "https://macrokite-os.vercel.app", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.trim(), process.env.VAPID_PRIVATE_KEY.trim());
  ready = true;
}

/** Saves a device's subscription for the member. A device moves to whoever subscribed it last. */
export async function saveSubscription({ orgId, userId }, subscription) {
  const { endpoint, keys } = subscription ?? {};
  const valid = typeof endpoint === "string" && endpoint.startsWith("https://") && endpoint.length < 2000 && typeof keys?.p256dh === "string" && typeof keys?.auth === "string";
  if (!valid) return false;
  await PushSubscription.updateOne(
    { endpoint },
    { $set: { orgId, userId, keys: { p256dh: keys.p256dh, auth: keys.auth }, createdAt: new Date().toISOString() }, $setOnInsert: { _id: crypto.randomUUID() } },
    { upsert: true }
  );
  return true;
}

export const removeSubscription = ({ orgId, userId }, endpoint) => PushSubscription.deleteOne({ orgId, userId, endpoint: String(endpoint ?? "") });

/**
 * Sends pushes ([{ orgId, userId, title, body, url, tag }]) to every device each person subscribed.
 * Devices the push service no longer knows are forgotten. Failures are logged, never thrown.
 */
export async function sendPushes(pushes) {
  if (!pushes?.length || !isPushConfigured()) return;
  try {
    setup();
    const devices = await PushSubscription.find({ $or: pushes.map(({ orgId, userId }) => ({ orgId, userId })) }).lean();
    const gone = [];
    await Promise.all(
      pushes.flatMap(({ orgId, userId, title, body, url, tag }) =>
        devices
          .filter((d) => d.orgId === orgId && d.userId === userId)
          .map((device) =>
            webpush
              .sendNotification({ endpoint: device.endpoint, keys: device.keys }, JSON.stringify({ title, body, url, tag }), { TTL: 24 * 60 * 60, urgency: "high" })
              .catch((error) => {
                if (error?.statusCode === 404 || error?.statusCode === 410) gone.push(device._id);
                else console.error("[push] couldn't send", error?.statusCode ?? error);
              })
          )
      )
    );
    if (gone.length) await PushSubscription.deleteMany({ _id: { $in: gone } });
  } catch (error) {
    console.error("[push]", error);
  }
}
