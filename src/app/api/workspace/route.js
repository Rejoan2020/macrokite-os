import { connection } from "next/server";
import { isDatabaseConfigured } from "@/lib/server/db";
import { getWorkspace } from "@/lib/server/repository";
import { errorResponse, json, mutation } from "@/lib/server/http";

// Reports the storage mode and, in database mode, returns the organization snapshot.
export async function GET() {
  await connection();
  if (!isDatabaseConfigured()) return json({ mode: "demo" });
  try {
    const { currentUserId, ...data } = await getWorkspace();
    return json({ mode: "database", currentUserId, data });
  } catch (error) {
    return errorResponse(error);
  }
}

export const PATCH = mutation((_, body) => ({ type: "workspace.update", data: body }));
