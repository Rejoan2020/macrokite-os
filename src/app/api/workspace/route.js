import { connection } from "next/server";
import { requireIdentity } from "@/lib/server/auth";
import { isDatabaseConfigured } from "@/lib/server/db";
import { getWorkspace } from "@/lib/server/repository";
import { errorResponse, handleCreateWorkspace, json } from "@/lib/server/http";

// Reports the storage mode and, in database mode, the signed-in account's workspace
// (or what they need to do first: create a workspace or get an invite). Polls pass ?version=<n>, the
// version they have, and get { status: "unchanged" } when nothing changed.
export async function GET(request) {
  await connection();
  if (!isDatabaseConfigured()) return json({ mode: "demo" });
  try {
    const param = new URL(request.url).searchParams.get("version");
    const version = param !== null && /^\d+$/.test(param) ? Number(param) : undefined;
    return json({ mode: "database", ...(await getWorkspace(await requireIdentity(), { version })) });
  } catch (error) {
    return errorResponse(error);
  }
}

export const POST = handleCreateWorkspace;
