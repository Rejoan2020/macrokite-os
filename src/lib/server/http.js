import "server-only";
import { connection } from "next/server";
import { DomainError } from "../engine";
import { isDatabaseConfigured } from "./db";
import { runAction } from "./repository";

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
 * Wraps a mutation route. `toAction` maps the request to a domain action; organization and user
 * context are added on the server by the repository, never read from the request.
 */
export function mutation(toAction) {
  return async (request, { params } = {}) => {
    await connection();
    if (!isDatabaseConfigured()) {
      return json({ error: "Database mode is not configured. The app is running in browser demo mode." }, 409);
    }
    try {
      const resolvedParams = (await params) ?? {};
      const body = request.method === "DELETE" ? {} : await readBody(request);
      const action = toAction(resolvedParams, body);
      const { result, changes } = await runAction(action);
      return json({ result, changes }, action.type.endsWith(".create") ? 201 : 200);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
