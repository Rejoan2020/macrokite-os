import { DomainError } from "@/lib/engine";
import { guardedWrite } from "@/lib/server/http";
import { isPushConfigured, removeSubscription, saveSubscription } from "@/lib/server/push";
import { requireMember } from "@/lib/server/repository";

// This device's push notifications: POST { subscription } turns them on for the signed-in member,
// DELETE { endpoint } turns them off.
export const POST = (request) =>
  guardedWrite(request, async (identity, body) => {
    if (!isPushConfigured()) throw new DomainError("Push notifications aren’t set up on the server.", { status: 503 });
    if (!(await saveSubscription(await requireMember(identity), body?.subscription))) throw new DomainError("That device can’t receive notifications.");
    return { ok: true };
  });

export const DELETE = (request) =>
  guardedWrite(request, async (identity, body) => {
    await removeSubscription(await requireMember(identity), body?.endpoint);
    return { ok: true };
  });
