import { connection } from "next/server";
import { get } from "@vercel/blob";
import { attachmentFolder, opensInline } from "@/lib/attachments";
import { DomainError } from "@/lib/engine";
import { requireIdentity } from "@/lib/server/auth";
import { isBlobConfigured } from "@/lib/server/files";
import { errorResponse, json } from "@/lib/server/http";
import { requireMember } from "@/lib/server/repository";

// Streams a chat file to a signed-in member of the workspace it belongs to. ?download=1 saves it
// instead of opening it. Paths carry a random suffix and never change, so browsers keep them.
export async function GET(request, { params }) {
  await connection();
  if (!isBlobConfigured()) return json({ error: "File storage isn’t set up." }, 503);
  try {
    const pathname = (await params).path.join("/");
    const { orgId } = await requireMember(await requireIdentity());
    if (!pathname.startsWith(attachmentFolder(orgId)) || pathname.includes("..")) throw new DomainError("File not found.", { status: 404 });

    const file = await get(pathname, { access: "private", ifNoneMatch: request.headers.get("if-none-match") ?? undefined });
    if (!file) throw new DomainError("File not found.", { status: 404 });
    const headers = { "Cache-Control": "private, max-age=31536000, immutable", ETag: file.blob.etag, "X-Content-Type-Options": "nosniff" };
    if (file.statusCode === 304) return new Response(null, { status: 304, headers });

    const type = file.blob.contentType || "application/octet-stream";
    const download = new URL(request.url).searchParams.has("download") || !opensInline(type);
    const name = pathname.split("/").pop();
    headers["Content-Type"] = type;
    headers["Content-Length"] = String(file.blob.size);
    headers["Content-Disposition"] = `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(name)}`;
    // Opened files can't run scripts on this origin. Chrome won't show PDFs in a sandbox.
    if (type !== "application/pdf") headers["Content-Security-Policy"] = "sandbox; default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'";
    return new Response(file.stream, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}
