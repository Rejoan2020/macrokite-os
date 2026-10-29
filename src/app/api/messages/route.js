import { connection } from "next/server";
import { DomainError } from "@/lib/engine";
import { requireIdentity } from "@/lib/server/auth";
import { isDatabaseConfigured } from "@/lib/server/db";
import { olderMessages } from "@/lib/server/repository";
import { errorResponse, json } from "@/lib/server/http";

// Older messages of a conversation, a page at a time, for scrolling back:
// ?conversation=<id>&before=<ISO time of the oldest message loaded>.
export async function GET(request) {
  await connection();
  if (!isDatabaseConfigured()) return json({ error: "Database mode is not configured." }, 409);
  try {
    const params = new URL(request.url).searchParams;
    const conversationId = params.get("conversation");
    const before = params.get("before");
    if (!conversationId || !before) throw new DomainError("Choose a conversation and a time.");
    return json(await olderMessages(await requireIdentity(), conversationId, before));
  } catch (error) {
    return errorResponse(error);
  }
}
