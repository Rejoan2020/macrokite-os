import { connection } from "next/server";
import { handleUpload } from "@vercel/blob/client";
import { attachmentFolder } from "@/lib/attachments";
import { MAX_ATTACHMENT_BYTES } from "@/lib/constants";
import { DomainError } from "@/lib/engine";
import { requireIdentity } from "@/lib/server/auth";
import { isDatabaseConfigured } from "@/lib/server/db";
import { isBlobConfigured } from "@/lib/server/files";
import { errorResponse, json, rejectCrossSite } from "@/lib/server/http";
import { requireMember } from "@/lib/server/repository";

// Hands the browser a short-lived token to upload one chat file straight to Blob storage, into
// its own workspace's folder. The message that uses the file is saved afterwards via /api/actions.
export async function POST(request) {
  await connection();
  const rejected = rejectCrossSite(request);
  if (rejected) return rejected;
  if (!isDatabaseConfigured()) return json({ error: "Files can’t be sent in demo mode." }, 409);
  if (!isBlobConfigured()) return json({ error: "File uploads aren’t set up yet. Add BLOB_READ_WRITE_TOKEN on the server." }, 503);
  try {
    const body = await request.json();
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        const { orgId } = await requireMember(await requireIdentity());
        if (!pathname.startsWith(attachmentFolder(orgId)) || pathname.includes("..")) {
          throw new DomainError("Files can only be added to your own workspace.", { status: 403 });
        }
        return { maximumSizeInBytes: MAX_ATTACHMENT_BYTES, addRandomSuffix: true, validUntil: Date.now() + 15 * 60 * 1000 };
      },
    });
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
