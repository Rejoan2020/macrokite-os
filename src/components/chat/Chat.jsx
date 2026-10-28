"use client";

import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ListPlus, Paperclip, Pencil, Trash2 } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { useAction } from "@/lib/client/useAction";
import { Avatar, Button, cx, DayDivider } from "@/components/ui/primitives";
import { firstName, formatDay, formatTime, todayISO } from "@/lib/format";
import { mentionHandle, mentionSuggestions, socialLinks, tokenize } from "@/lib/text";
import { canDeleteMessage, canEditMessage, canManageTasks } from "@/lib/permissions";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { MessageAttachments, PendingFiles, useUploads } from "./Attachments";

/** Marks a conversation read whenever it is on screen with unread messages. */
export function useMarkRead(conversationId) {
  const { unread, dispatch } = useWorkspace();
  const count = conversationId ? unread[conversationId]?.count ?? 0 : 0;
  useEffect(() => {
    if (!count || document.visibilityState !== "visible") return;
    dispatch({ type: "conversation.read", id: conversationId }).catch(() => {});
  }, [conversationId, count, dispatch]);
}

/** Keeps a scroll container pinned to the newest message. */
export function useStickToBottom(dependency) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [dependency]);
  return ref;
}

export function conversationMessages(data, conversationId) {
  return data.messages.filter((m) => m.conversationId === conversationId && !m.deletedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Renders day dividers between messages from different days. */
export function withDayDividers(messages, render) {
  return messages.map((m, i) => {
    const day = todayISO(new Date(m.createdAt));
    const showDay = i === 0 || todayISO(new Date(messages[i - 1].createdAt)) !== day;
    return (
      <Fragment key={m._id}>
        {showDay && <DayDivider>{formatDay(m.createdAt)}</DayDivider>}
        {render(m, i)}
      </Fragment>
    );
  });
}

export function MessageText({ body, className }) {
  const { data } = useWorkspace();
  return (
    <p className={cx("leading-[1.55] break-words whitespace-pre-wrap", className)}>
      {tokenize(body, data.users).map((part, i) =>
        part.type === "link" ? (
          <a key={i} href={part.value} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline underline-offset-[3px]">
            {part.value}
          </a>
        ) : part.type === "mention" ? (
          <span key={i} className="rounded-full bg-accent-tint px-1.5 py-px font-medium text-accent-tint-text">
            {part.value}
          </span>
        ) : (
          <Fragment key={i}>{part.value}</Fragment>
        )
      )}
    </p>
  );
}

const PLATFORM_ICONS = {
  Instagram: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" />
    </svg>
  ),
  Facebook: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  ),
};

function postTitle({ platform, url }) {
  try {
    const { pathname } = new URL(url);
    if (platform === "Instagram") return pathname.includes("/reel") ? "Instagram reel" : "Instagram post";
    if (/\/(videos|watch|reel)/.test(pathname) || new URL(url).hostname === "fb.watch") return "Facebook video";
    return "Facebook post";
  } catch {
    return "Post";
  }
}

// One request per link per page load, shared by every message that repeats it.
const previews = new Map();

function loadPreview(url) {
  if (!previews.has(url)) {
    previews.set(
      url,
      fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null)
    );
  }
  return previews.get(url);
}

function usePreview(url) {
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    let live = true;
    loadPreview(url).then((p) => live && setPreview(p));
    return () => {
      live = false;
    };
  }, [url]);
  return preview;
}

/** Facebook / Instagram links as cards: the post's photo and caption when the post shares them. */
export function LinkCards({ body }) {
  const links = socialLinks(body);
  if (!links.length) return null;
  return links.map((link) => <LinkCard key={link.url} link={link} />);
}

function LinkCard({ link }) {
  const preview = usePreview(link.url);
  const [broken, setBroken] = useState(false);

  if (preview && !broken) {
    return (
      <a href={link.url} target="_blank" rel="noopener noreferrer" className="group/card mt-0.5 flex w-[360px] max-w-full flex-col overflow-hidden rounded-[18px] border border-row bg-card">
        <span className="relative block bg-input">
          <img
            src={preview.image}
            alt={preview.title}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setBroken(true)}
            className="block max-h-[360px] w-full object-cover transition-opacity group-hover/card:opacity-90"
          />
          {preview.video && (
            <span aria-hidden className="absolute inset-0 grid place-items-center">
              <span className="grid size-12 place-items-center rounded-full bg-black/55 text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5.5v13l11-6.5z" />
                </svg>
              </span>
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-1 px-3.5 pt-3 pb-3.5">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
            <span className="[&>svg]:size-3.5">{PLATFORM_ICONS[link.platform]}</span>
            {link.platform}
          </span>
          {preview.title && <span className="line-clamp-2 text-sm font-semibold text-fg">{preview.title}</span>}
          {preview.description && <span className="line-clamp-2 text-xs text-secondary">{preview.description}</span>}
        </span>
      </a>
    );
  }

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-0.5 flex w-[420px] max-w-full items-center gap-3.5 rounded-[18px] border border-row bg-card p-3"
    >
      <span aria-hidden className="grid size-16 shrink-0 place-items-center rounded-[14px] bg-info-tint text-info">
        {PLATFORM_ICONS[link.platform]}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">{link.platform}</span>
        <span className="mt-[3px] truncate font-semibold text-fg">{postTitle(link)}</span>
        <span className="mt-1.5 text-xs font-medium text-accent">Open post</span>
      </span>
    </a>
  );
}

/**
 * "Create task from message": opens the task dialog prefilled from the message. Null when the
 * current user can't create tasks there (only project leads and admins can), so callers hide it.
 */
export function useTaskFromMessage(projectId) {
  const overlays = useOverlays();
  const { lookup, currentUser, data } = useWorkspace();
  const allowed = projectId ? canManageTasks(lookup.projects[projectId], currentUser) : data.projects.some((p) => !p.archived && canManageTasks(p, currentUser));
  if (!allowed) return null;
  return (message) =>
    overlays.newTask({
      title: (message.body || (message.attachments ?? []).map((a) => a.name).join(", ")).replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 200),
      messageId: message._id,
      projectId,
    });
}

/** "changed status from **To do** to **Done**" with the starred parts in bold. */
function EventText({ text }) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <b key={i} className="font-semibold text-secondary">{part}</b> : <Fragment key={i}>{part}</Fragment>));
}

/**
 * Edits a sent message's text in place: Enter saves, Shift+Enter adds a line, Escape cancels.
 * A message with files may be left without text.
 */
function MessageEditor({ message, onDone }) {
  const { run, busy } = useAction();
  const [body, setBody] = useState(message.body);
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [body]);

  useEffect(() => {
    const el = ref.current;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const text = body.trim();
  const canSave = Boolean(text || (message.attachments ?? []).length);

  const save = async (e) => {
    e?.preventDefault();
    if (!canSave || busy) return;
    if (text === message.body || (await run({ type: "message.edit", id: message._id, data: { body: text } }))) onDone();
  };

  return (
    <form onSubmit={save} className="flex w-full max-w-[560px] flex-col gap-2">
      <textarea
        ref={ref}
        rows={1}
        value={body}
        aria-label="Edit message"
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onDone();
          } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) save(e);
        }}
        className="w-full resize-none rounded-[4px_16px_16px_16px] border border-line bg-input px-3.5 py-[9px] text-sm leading-[22px] text-fg outline-none focus:border-accent"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" type="submit" loading={busy} disabled={!canSave}>
          Save
        </Button>
        <span className="text-[11px] text-faint">Enter to save · Esc to cancel</span>
      </div>
    </form>
  );
}

/**
 * A message: avatar, name, time and the text in a soft bubble. A task's logged changes show as a
 * quiet line instead ("● You changed status from To do to Done"). On hover: create a task from it,
 * edit it (its author) and delete it (its author or an admin).
 */
export function ChannelMessage({ message, onCreateTask }) {
  const { lookup, currentUserId, currentUser } = useWorkspace();
  const { run, busy } = useAction();
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const author = lookup.users[message.authorId];
  const canEdit = canEditMessage(message, currentUser);
  const canDelete = canDeleteMessage(message, currentUser);
  if (message.event) {
    return (
      <div className="-my-0.5 ml-1 flex items-center gap-2.5 text-xs text-faint">
        <span aria-hidden className="mr-2.5 ml-3 size-1.5 shrink-0 rounded-full bg-dash" />
        <span className="min-w-0">
          <b className="font-semibold text-secondary">{message.authorId === currentUserId ? "You" : firstName(author?.name ?? "Former member")}</b> <EventText text={message.event} />
        </span>
        <time dateTime={message.createdAt} className="ml-auto whitespace-nowrap">
          {formatTime(message.createdAt)}
        </time>
      </div>
    );
  }
  return (
    <article className="group relative flex gap-3">
      <Avatar user={author} size="chat" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-fg">{author?.name ?? "Former member"}</span>
          <time dateTime={message.createdAt} className="text-[11px] text-faint">
            {formatTime(message.createdAt)}
          </time>
          {message.editedAt && (
            <span className="text-[11px] text-faint" title={`Edited ${formatDay(message.editedAt)} ${formatTime(message.editedAt)}`}>
              (edited)
            </span>
          )}
        </div>
        {editing ? (
          <MessageEditor message={message} onDone={() => setEditing(false)} />
        ) : (
          message.body && <MessageText body={message.body} className="max-w-full rounded-[4px_16px_16px_16px] bg-input px-3.5 py-[9px] text-sm leading-[22px] text-fg" />
        )}
        <MessageAttachments message={message} />
        {message.body && <LinkCards body={message.body} />}
      </div>
      {(onCreateTask || canEdit || canDelete) && !editing && (
        <div className="reveal absolute -top-1 right-0 flex items-center gap-1.5 transition-opacity">
          {onCreateTask && (
            <button
              type="button"
              onClick={() => onCreateTask(message)}
              className="flex h-8 items-center gap-1.5 rounded-full border border-line bg-card px-2.5 text-xs text-secondary hover:text-fg"
            >
              <ListPlus className="size-3.5" aria-hidden />
              Create task
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Edit message"
              title="Edit message"
              className="grid size-8 place-items-center rounded-full border border-line bg-card text-secondary hover:text-fg"
            >
              <Pencil className="size-3.5" aria-hidden />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label="Delete message"
              title="Delete message"
              className="grid size-8 place-items-center rounded-full border border-line bg-card text-secondary hover:text-danger"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          )}
        </div>
      )}
      {canDelete && (
        <ConfirmDialog
          open={confirming}
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            if (await run({ type: "message.delete", id: message._id }, { success: "Message deleted" })) setConfirming(false);
          }}
          title="Delete this message?"
          description={
            message.authorId === currentUserId
              ? "It’s removed for everyone, along with any files in it. This can’t be undone."
              : `This removes ${firstName(author?.name ?? "this person")}’s message for everyone, along with any files in it. This can’t be undone.`
          }
          confirmLabel="Delete"
          tone="danger"
          busy={busy}
        />
      )}
    </article>
  );
}

/** The "@query" the caret is in, if any: { start, query }. */
function mentionAt(text, caret) {
  const match = /(^|[^\w@])@([\w.-]*)$/.exec(text.slice(0, caret));
  return match ? { start: caret - match[2].length - 1, query: match[2] } : null;
}

/**
 * Message input: Enter sends, Shift+Enter adds a line. Typing @ suggests `people` (the people who
 * can be mentioned here); arrows move, Enter or Tab picks, Escape closes. Files can be added with
 * the paperclip, by pasting or by dropping them on the input (database mode only: demo mode has
 * no file storage). onSend(body, attachments) resolves true once the message is saved.
 */
export function Composer({ placeholder, label, onSend, hint, compact, people = [] }) {
  const { mode } = useWorkspace();
  const canAttach = mode === "database";
  const uploads = useUploads();
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [caret, setCaret] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const [dismissedAt, setDismissedAt] = useState(null);
  const ref = useRef(null);
  const listId = useId();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [body]);

  const mention = people.length ? mentionAt(body, caret) : null;
  const suggestions = mention && mention.start !== dismissedAt ? mentionSuggestions(mention.query, people) : [];
  const open = suggestions.length > 0;
  const active = Math.min(highlight, suggestions.length - 1);

  const trackCaret = (e) => setCaret(e.currentTarget.selectionStart);

  const pick = (user) => {
    const insert = `@${mentionHandle(user, people)} `;
    const next = body.slice(0, mention.start) + insert + body.slice(caret);
    const position = mention.start + insert.length;
    setBody(next);
    setCaret(position);
    setHighlight(0);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(position, position);
    });
  };

  const ready = Boolean(body.trim() || uploads.ready.length) && !uploads.uploading && !uploads.failed;

  const send = async (e) => {
    e?.preventDefault();
    if (!ready || sending) return;
    setSending(true);
    const ok = await onSend(body.trim(), uploads.ready);
    setSending(false);
    if (ok) {
      setBody("");
      setCaret(0);
      uploads.clear();
    }
    ref.current?.focus();
  };

  const onPaste = (e) => {
    if (!canAttach || !e.clipboardData.files.length) return;
    e.preventDefault();
    uploads.add(e.clipboardData.files);
  };

  const dropProps = canAttach && {
    onDragOver: (e) => {
      if (![...e.dataTransfer.types].includes("Files")) return;
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: (e) => !e.currentTarget.contains(e.relatedTarget) && setDragging(false),
    onDrop: (e) => {
      if (!e.dataTransfer.files.length) return;
      e.preventDefault();
      setDragging(false);
      uploads.add(e.dataTransfer.files);
    },
  };

  const onKeyDown = (e) => {
    if (open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setHighlight((active + step + suggestions.length) % suggestions.length);
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        pick(suggestions[active]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDismissedAt(mention.start);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) send(e);
  };

  return (
    <form onSubmit={send} className="relative flex flex-col gap-2" {...dropProps}>
      {open && (
        <ul id={listId} role="listbox" aria-label="Mention someone" className="absolute bottom-full left-0 z-20 mb-2 w-64 overflow-hidden rounded-2xl border border-line bg-card py-1 shadow-pop">
          {suggestions.map((user, i) => (
            <li
              key={user._id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // Keeps focus in the textarea so the caret position is kept.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(user)}
              onMouseEnter={() => setHighlight(i)}
              className={cx("flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px]", i === active ? "bg-hover text-strong" : "text-secondary")}
            >
              <Avatar user={user} size="sm" />
              <span className="truncate">{user.name}</span>
            </li>
          ))}
        </ul>
      )}
      <PendingFiles files={uploads.files} onRemove={uploads.remove} />
      <label
        className={cx(
          "flex items-end gap-2.5 bg-input outline-2 outline-offset-2 outline-transparent transition-[outline-color]",
          compact ? "rounded-[26px] p-1.5" : "rounded-[29px] p-1.5",
          canAttach ? "pl-1.5" : compact ? "pl-[18px]" : "pl-[22px]",
          dragging && "outline-dashed outline-accent"
        )}
      >
        <span className="sr-only">{label}</span>
        {canAttach && (
          <>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              aria-label="Add files"
              title="Add files or images"
              className={cx("grid shrink-0 place-items-center rounded-full text-secondary transition-colors hover:bg-hover hover:text-fg", compact ? "size-10" : "size-11")}
            >
              <Paperclip className="size-[18px]" aria-hidden />
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                uploads.add(e.target.files);
                e.target.value = "";
              }}
            />
          </>
        )}
        <textarea
          ref={ref}
          rows={1}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            trackCaret(e);
            setHighlight(0);
          }}
          onSelect={trackCaret}
          onBlur={() => mention && setDismissedAt(mention.start)}
          onFocus={() => setDismissedAt(null)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          className="min-w-0 flex-1 resize-none bg-transparent py-2.5 text-sm leading-normal text-fg outline-none placeholder:text-faint"
        />
        <Button variant="primary" size={compact ? "sm" : "md"} type="submit" loading={sending} disabled={!ready} className={compact ? "h-10 px-[18px]" : ""}>
          Send
        </Button>
      </label>
      {hint && <p className="ml-[22px] text-xs text-faint">{hint}</p>}
    </form>
  );
}

/** Sends a message to a conversation and reports success. */
export function useSendMessage(conversationId) {
  const { run } = useAction();
  return async (body, attachments) => Boolean(await run({ type: "message.create", id: conversationId, data: { body, attachments } }));
}
