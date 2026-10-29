"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Download, FileText, Loader2, X } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { cx } from "@/components/ui/primitives";
import { attachmentFolder, attachmentUrl, formatBytes, isInlineImage, messageAttachments } from "@/lib/attachments";
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS } from "@/lib/constants";

// Larger files go up in parallel parts, which also retries a part that fails.
const MULTIPART_BYTES = 8 * 1024 * 1024;

/** A file name safe for a storage path; the original name is kept on the message. */
const storageName = (name) => name.replace(/[^\w.\- ]+/g, "-").replace(/\s+/g, "-").slice(-100) || "file";

function imageSize(src) {
  if (!src) return Promise.resolve({});
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({});
    img.src = src;
  });
}

/**
 * Files picked for the next message. Each one starts uploading to Blob storage as soon as it is
 * added; `ready` holds the uploaded ones, as the message stores them.
 */
export function useUploads() {
  const { data } = useWorkspace();
  const toast = useToast();
  const [files, setFiles] = useState([]);
  // The current list for upload callbacks, which outlive the render that started them.
  const filesRef = useRef(files);
  const commit = useCallback((next) => {
    filesRef.current = next;
    setFiles(next);
  }, []);

  const update = (key, patch) => commit(filesRef.current.map((f) => (f.key === key ? { ...f, ...patch } : f)));

  // Leaving the conversation stops unfinished uploads and frees the image previews.
  useEffect(
    () => () =>
      filesRef.current.forEach((f) => {
        f.controller.abort();
        if (f.preview) URL.revokeObjectURL(f.preview);
      }),
    []
  );

  const start = async (entry, file) => {
    try {
      const [size, blob] = await Promise.all([
        imageSize(entry.preview),
        upload(attachmentFolder(data.org._id) + storageName(file.name), file, {
          access: "private",
          handleUploadUrl: "/api/upload",
          contentType: file.type || undefined,
          multipart: file.size > MULTIPART_BYTES,
          abortSignal: entry.controller.signal,
          onUploadProgress: ({ percentage }) => update(entry.key, { progress: percentage }),
        }),
      ]);
      const attachment = { pathname: blob.pathname, name: file.name, size: file.size, contentType: blob.contentType || file.type, ...size };
      update(entry.key, { status: "done", attachment });
    } catch (error) {
      if (entry.controller.signal.aborted) return;
      update(entry.key, { status: "error" });
      toast.error(`Couldn’t upload ${file.name}`, error?.message || "Check your connection and try again.");
    }
  };

  const add = (fileList) => {
    const picked = [...(fileList ?? [])];
    const room = MAX_ATTACHMENTS - filesRef.current.length;
    if (picked.length > room) toast.error(`Send ${MAX_ATTACHMENTS} files or fewer at a time`, room > 0 ? `Only the first ${room} were added.` : undefined);
    for (const file of picked.slice(0, Math.max(room, 0))) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${file.name} is too big`, `Files must be ${formatBytes(MAX_ATTACHMENT_BYTES)} or smaller.`);
        continue;
      }
      const entry = {
        key: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        contentType: file.type,
        preview: isInlineImage(file.type) ? URL.createObjectURL(file) : null,
        progress: 0,
        status: "uploading",
        controller: new AbortController(),
      };
      commit([...filesRef.current, entry]);
      start(entry, file);
    }
  };

  const remove = (key) => {
    const entry = filesRef.current.find((f) => f.key === key);
    if (!entry) return;
    entry.controller.abort();
    if (entry.preview) URL.revokeObjectURL(entry.preview);
    commit(filesRef.current.filter((f) => f.key !== key));
  };

  const clear = useCallback(() => {
    filesRef.current.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    commit([]);
  }, [commit]);

  /** Takes the files out for sending. `restore` puts them back if it fails; `release` frees them once sent. */
  const take = () => {
    const taken = filesRef.current;
    commit([]);
    return taken;
  };
  const restore = (taken) => commit([...taken, ...filesRef.current]);
  const release = (taken) => taken.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));

  return {
    files,
    add,
    remove,
    clear,
    take,
    restore,
    release,
    uploading: files.some((f) => f.status === "uploading"),
    failed: files.some((f) => f.status === "error"),
    ready: files.filter((f) => f.status === "done").map((f) => f.attachment),
  };
}

/** The files waiting to be sent, above the message input: thumbnails for images, chips for the rest. */
export function PendingFiles({ files, onRemove }) {
  if (!files.length) return null;
  return (
    <ul aria-label="Files to send" className="flex flex-wrap gap-2 px-1">
      {files.map((f) => (
        <li key={f.key} className="group/file relative">
          {f.preview ? (
            <img src={f.preview} alt={f.name} className={cx("block size-16 rounded-[14px] object-cover", f.status === "error" && "opacity-40")} />
          ) : (
            <span className={cx("flex h-16 w-52 items-center gap-2.5 rounded-[14px] border border-row bg-card px-3", f.status === "error" && "opacity-60")}>
              <FileText className="size-5 shrink-0 text-info" aria-hidden />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-medium text-fg">{f.name}</span>
                <span className="text-[11px] text-faint">{f.status === "error" ? "Upload failed" : formatBytes(f.size)}</span>
              </span>
            </span>
          )}
          {f.status === "uploading" && (
            <span className="absolute inset-0 grid place-items-center rounded-[14px] bg-black/35 text-[11px] font-semibold text-white">
              <span className="flex items-center gap-1">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                {Math.round(f.progress)}%
              </span>
            </span>
          )}
          <button
            type="button"
            onClick={() => onRemove(f.key)}
            aria-label={`Remove ${f.name}`}
            title="Remove"
            className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border border-line bg-card text-secondary shadow-pop hover:text-fg"
          >
            <X className="size-3" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Images and files sent in a message. Images open full size in a new tab; files download. */
export function MessageAttachments({ message }) {
  const attachments = messageAttachments(message);
  if (!attachments.length) return null;
  const images = attachments.filter((a) => isInlineImage(a.contentType));
  const others = attachments.filter((a) => !isInlineImage(a.contentType));
  return (
    <>
      {images.length === 1 ? (
        <a href={attachmentUrl(images[0])} target="_blank" rel="noopener noreferrer" className="block max-w-full overflow-hidden rounded-[18px] border border-row bg-input">
          <img
            src={attachmentUrl(images[0])}
            alt={images[0].name}
            width={images[0].width ?? undefined}
            height={images[0].height ?? undefined}
            loading="lazy"
            className="block h-auto max-h-[360px] w-auto max-w-[min(360px,100%)] object-contain transition-opacity hover:opacity-90"
          />
        </a>
      ) : images.length > 1 ? (
        <div className="grid w-[360px] max-w-full grid-cols-2 gap-1.5">
          {images.map((image) => (
            <a key={image.pathname} href={attachmentUrl(image)} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-[14px] bg-input">
              <img src={attachmentUrl(image)} alt={image.name} loading="lazy" className="size-full object-cover transition-opacity hover:opacity-90" />
            </a>
          ))}
        </div>
      ) : null}
      {others.map((file) => (
        <a
          key={file.pathname}
          href={attachmentUrl(file, { download: true })}
          download={file.name}
          className="group/file flex w-[320px] max-w-full items-center gap-3 rounded-[18px] border border-row bg-card p-2.5 pr-3.5"
        >
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-info-tint text-info">
            <FileText className="size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-fg">{file.name}</span>
            <span className="text-xs text-faint">{formatBytes(file.size)}</span>
          </span>
          <Download className="size-4 shrink-0 text-faint transition-colors group-hover/file:text-fg" aria-label="Download" />
        </a>
      ))}
    </>
  );
}
