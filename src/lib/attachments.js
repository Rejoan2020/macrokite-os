import { pluralize } from "./format";

// Files sent in chat. The file itself lives in private Vercel Blob storage under the workspace's
// folder; a message keeps { pathname, name, size, contentType, width, height } for each one and
// the app serves it to signed-in members from /api/files/<pathname>.

/** The workspace's folder in Blob storage. Every upload and every file a message names must be in it. */
export const attachmentFolder = (orgId) => `orgs/${orgId}/chat/`;

// Images shown inline in a message. SVG is left out: it can carry scripts.
const INLINE_IMAGES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"];
// Types the browser may open in a tab; everything else downloads.
const INLINE_TYPES = [...INLINE_IMAGES, "application/pdf", "video/mp4", "video/webm", "audio/mpeg", "audio/mp4", "audio/wav", "audio/webm", "text/plain"];

export const isInlineImage = (contentType) => INLINE_IMAGES.includes(contentType);
export const opensInline = (contentType) => INLINE_TYPES.includes(contentType);

export const messageAttachments = (message) => message.attachments ?? [];

export function attachmentUrl(attachment, { download = false } = {}) {
  const path = attachment.pathname.split("/").map(encodeURIComponent).join("/");
  return `/api/files/${path}${download ? "?download=1" : ""}`;
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/** One line for lists and notifications: the text, or what was sent when there is none. */
export function messagePreview(message) {
  if (message.body) return message.body;
  const files = messageAttachments(message);
  if (!files.length) return "";
  if (files.every((f) => isInlineImage(f.contentType))) return files.length === 1 ? "Sent a photo" : `Sent ${pluralize(files.length, "photo")}`;
  return files.length === 1 ? `Sent ${files[0].name}` : `Sent ${pluralize(files.length, "file")}`;
}
