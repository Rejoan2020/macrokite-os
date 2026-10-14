import "server-only";
import { connection } from "next/server";
import { ACTION_TYPES, DomainError } from "../engine";
import { requireIdentity } from "./auth";
import { isDatabaseConfigured } from "./db";
import { createWorkspace, runAction } from "./repository";

export const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export function errorResponse(error) {
  if (error instanceof DomainError) {
    return json({ error: error.message, fieldErrors: error.fieldErrors }, error.status);
  }
  console.error("[api]", error);
  const unavailable = /ECONNREFUSED|ENOTFOUND|Server selection|querySrv|authentication failed/i.test(String(error?.message));
  return json(
    { error: unavailable ? "The database is unreachable. Check MONGODB_URI and that MongoDB is running." : "Something went wrong on the server." },
    unavailable ? 503 : 500
  );
}

async function readBody(request) {
  try {
    const text = await request.text();
    return text ? JSON.parse(text) : {};
  } catch {
    throw new DomainError("Request body must be valid JSON.");
  }
}

/**
 * Cross-site request forgery guard, on top of the SameSite=Lax session cookie. Without it any page
 * the user visits could send a "simple" text/plain POST to the API. Requiring a JSON content type
 * forces a CORS preflight that other origins fail, and an explicit foreign Origin is rejected.
 */
function rejectCrossSite(request) {
  const origin = request.headers.get("origin");
  if (origin) {
    let originHost = null;
    try {
      originHost = new URL(origin).host;
    } catch {}
    if (originHost !== request.headers.get("host")) return json({ error: "Cross-origin requests are not allowed." }, 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "Requests must use Content-Type: application/json." }, 415);
  }
  return null;
}

/** Shared guard for database-mode writes: same-origin JSON from a signed-in account. */
async function guardedWrite(request, handle) {
  await connection();
  const rejected = rejectCrossSite(request);
  if (rejected) return rejected;
  if (!isDatabaseConfigured()) {
    return json({ error: "Database mode is not configured. The app is running in browser demo mode." }, 409);
  }
  try {
    const identity = await requireIdentity();
    const body = await readBody(request);
    return json(await handle(identity, body));
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Handles POST /api/actions. The body names one domain action: { type, id?, data? }.
 * Organization and user context come from the signed-in account on the server, never from the request.
 */
export const handleAction = (request) =>
  guardedWrite(request, async (identity, body) => {
    if (!ACTION_TYPES.includes(body?.type)) throw new DomainError("Unknown action.");
    if (body.id !== undefined && typeof body.id !== "string") throw new DomainError("Action id must be a string.");
    if (body.data !== undefined && (typeof body.data !== "object" || body.data === null || Array.isArray(body.data))) {
      throw new DomainError("Action data must be an object.");
    }
    const { result, changes } = await runAction(identity, { type: body.type, id: body.id, data: body.data ?? {} });
    return { result, changes };
  });

/** Handles POST /api/workspace: { name } starts a new workspace with the caller as admin. */
export const handleCreateWorkspace = (request) => guardedWrite(request, async (identity, body) => ({ result: await createWorkspace(identity, body) }));
