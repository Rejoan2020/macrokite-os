"use client";

import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ListPlus } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { useAction } from "@/lib/client/useAction";
import { Avatar, Button, cx, DayDivider } from "@/components/ui/primitives";
import { formatDay, formatTime, todayISO } from "@/lib/format";
import { mentionHandle, mentionSuggestions, socialLinks, tokenize } from "@/lib/text";
import { canManageTasks } from "@/lib/permissions";

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
          <a key={i} href={part.value} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:text-accent-light hover:underline">
            {part.value}
          </a>
        ) : part.type === "mention" ? (
          <span key={i} className="rounded bg-accent-tint px-1 text-accent-light">
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
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" />
    </svg>
  ),
  Facebook: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h-3a4 4 0 0 0-4 4v3H6v4h2v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  ),
};

function postTitle(url) {
  try {
    const { pathname } = new URL(url);
    if (/\/(p|reel|reels)\//.test(pathname)) return pathname.includes("/reel") ? "Instagram reel" : "Instagram post";
    if (/\/(videos|watch)/.test(pathname)) return "Facebook video";
    return "Facebook post";
  } catch {
    return "Post";
  }
}

/** Facebook / Instagram links as cards. No embeds: the card always works. */
export function LinkCards({ body }) {
  const links = socialLinks(body);
  if (!links.length) return null;
  return links.map((link) => (
    <a
      key={link.url}
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex max-w-[460px] gap-3.5 rounded-[10px] border border-line bg-card p-3 hover:border-dash"
    >
      <span aria-hidden className="flex size-[72px] shrink-0 items-center justify-center rounded-lg bg-hover text-faint">
        {PLATFORM_ICONS[link.platform]}
      </span>
      <span className="flex min-w-0 flex-col justify-center gap-1">
        <span className="text-[11px] font-medium tracking-[0.04em] text-muted uppercase">{link.platform}</span>
        <span className="truncate font-medium">{postTitle(link.url)}</span>
        <span className="text-xs text-accent">Open post</span>
      </span>
    </a>
  ));
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
      title: message.body.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 200),
      messageId: message._id,
      projectId,
    });
}

/** Channel-style messages (General, project chat): avatar, name, time, body. */
export function ChannelMessage({ message, onCreateTask }) {
  const { lookup } = useWorkspace();
  const author = lookup.users[message.authorId];
  return (
    <article className="group relative flex gap-3">
      <Avatar user={author} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold">{author?.name ?? "Former member"}</span>
          <time dateTime={message.createdAt} className="font-mono text-[11px] text-faint">
            {formatTime(message.createdAt)}
          </time>
        </div>
        <MessageText body={message.body} className="text-body" />
        <LinkCards body={message.body} />
      </div>
      {onCreateTask && (
        <button
          type="button"
          onClick={() => onCreateTask(message)}
          className="reveal absolute -top-1 right-0 flex h-8 items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 text-xs text-secondary transition-opacity hover:text-fg"
        >
          <ListPlus className="size-3.5" aria-hidden />
          Create task
        </button>
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
 * can be mentioned here); arrows move, Enter or Tab picks, Escape closes.
 */
export function Composer({ placeholder, label, onSend, hint, compact, people = [] }) {
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

  const send = async (e) => {
    e?.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    const ok = await onSend(text);
    setSending(false);
    if (ok) {
      setBody("");
      setCaret(0);
    }
    ref.current?.focus();
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
    <form onSubmit={send} className="relative flex flex-col gap-2">
      {open && (
        <ul id={listId} role="listbox" aria-label="Mention someone" className="absolute bottom-full left-0 z-20 mb-2 w-64 overflow-hidden rounded-xl border border-line bg-card py-1 shadow-lg">
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
      <label className={cx("flex items-end gap-2.5 border border-dash bg-card", compact ? "rounded-[10px] p-2 pl-3.5" : "rounded-xl p-2.5 pl-4")}>
        <span className="sr-only">{label}</span>
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
          placeholder={placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          className="min-w-0 flex-1 resize-none bg-transparent py-2.5 leading-normal text-fg outline-none placeholder:text-muted"
        />
        <Button variant="primary" size={compact ? "sm" : "md"} type="submit" loading={sending} disabled={!body.trim()} className={compact ? "h-10" : ""}>
          Send
        </Button>
      </label>
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </form>
  );
}

/** Sends a message to a conversation and reports success. */
export function useSendMessage(conversationId) {
  const { run } = useAction();
  return async (body) => Boolean(await run({ type: "message.create", id: conversationId, data: { body } }));
}
