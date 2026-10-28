import "server-only";
import { del } from "@vercel/blob";

// Chat files are stored privately in Vercel Blob. The browser uploads them straight to Blob with a
// short-lived token from /api/upload (so large files skip the 4.5 MB function body limit), and
// /api/files streams them back to signed-in members of the workspace.

export const isBlobConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());

/** Removes stored files whose messages were deleted. Failures are logged, never thrown. */
export async function deleteFiles(pathnames) {
  if (!pathnames?.length || !isBlobConfigured()) return;
  try {
    await del(pathnames);
  } catch (error) {
    console.error("[files] couldn't delete", pathnames, error);
  }
}
