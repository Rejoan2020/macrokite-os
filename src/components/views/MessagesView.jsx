"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ListPlus, Plus } from "lucide-react";
import { useLiveUpdates, useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Composer, conversationMessages, LinkCards, MessageText, useMarkRead, useStickToBottom, useTaskFromMessage, withDayDividers } from "@/components/chat/Chat";
import { chatHeight } from "@/components/views/GeneralView";
import { Avatar, CountBadge, cx } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/Dialog";
import { useAction } from "@/lib/client/useAction";
import { ROLE_LABELS } from "@/lib/constants";
import { firstName, formatStamp, formatTime } from "@/lib/format";
import { matches } from "@/lib/selectors";

export function MessagesView() {
  const { userId } = useParams();
  const { data, chats, unread, lookup, currentUserId } = useWorkspace();
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(false);
  useLiveUpdates();

  const people = data.users.filter((u) => u._id !== currentUserId);
  const rows = people
    .map((user) => {
      const conversation = chats.dms[user._id];
      const last = conversation ? conversationMessages(data, conversation._id).at(-1) : null;
      return { user, conversation, last, unread: conversation ? unread[conversation._id]?.count ?? 0 : 0 };
    })
    .filter((r) => (query ? matches(query, r.user.name) && (r.user.active || r.last) : r.last))
    .sort((a, b) => (b.last?.createdAt ?? "").localeCompare(a.last?.createdAt ?? "") || a.user.name.localeCompare(b.user.name));
  const other = userId ? lookup.users[userId] : null;

  return (
    <div className={cx("flex", chatHeight)}>
      <section aria-labelledby="dm-list" className={cx("w-full flex-col border-r border-divider lg:flex lg:w-80 lg:shrink-0", other ? "hidden" : "flex")}>
        <div className="flex items-center justify-between gap-2.5 px-[18px] pt-5 pb-3.5">
          <h1 id="dm-list" className="text-xl font-semibold tracking-[-0.01em] text-strong">
            Messages
          </h1>
          <button
            type="button"
            aria-label="New message"
            onClick={() => setPicking(true)}
            className="flex size-11 items-center justify-center rounded-lg border border-line bg-card text-fg hover:bg-hover"
          >
            <Plus className="size-[18px]" aria-hidden />
          </button>
        </div>
        <label className="mx-[18px] mb-3 flex h-10 items-center rounded-lg border border-line bg-card px-3 focus-within:border-accent/60">
          <span className="sr-only">Find a person</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a person"
            className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-muted"
          />
        </label>
        <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 pb-4">
          {rows.map(({ user, last, unread: count }) => (
            <Link
              key={user._id}
              href={`/messages/${user._id}`}
              aria-current={user._id === userId ? "true" : undefined}
              className={cx("flex items-center gap-3 rounded-[10px] p-2.5", user._id === userId ? "bg-hover" : "hover:bg-hover/50")}
            >
              <Avatar user={user} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex justify-between gap-2">
                  <span className={cx(count ? "font-semibold" : "font-medium text-soft", user._id === userId && "font-semibold text-fg")}>{user.name}</span>
                  {count ? <CountBadge count={count} label={`${count} unread`} /> : last && <span className="font-mono text-[11px] text-muted">{formatStamp(last.createdAt)}</span>}
                </span>
                <span className={cx("truncate text-[13px]", count ? "text-fg" : "text-muted")}>{last ? last.body : user.active ? "Start a conversation" : "Deactivated"}</span>
              </span>
            </Link>
          ))}
          {!rows.length && <p className="px-2.5 py-2 text-[13px] text-muted">{query ? "No one by that name." : "No conversations yet. Press + to message someone."}</p>}
        </div>
      </section>

      {other ? (
        <Conversation key={other._id} other={other} />
      ) : (
        <div className="hidden flex-1 items-center justify-center text-muted lg:flex">{userId ? "That person isn’t on the team." : "Pick someone to message."}</div>
      )}

      <PeopleDialog open={picking} onClose={() => setPicking(false)} people={people.filter((u) => u.active)} />
    </div>
  );
}

function Conversation({ other }) {
  const { data, chats, currentUserId } = useWorkspace();
  const { run } = useAction();
  const conversation = chats.dms[other._id];
  const messages = conversation ? conversationMessages(data, conversation._id) : [];
  const listRef = useStickToBottom(messages.length);
  const createTask = useTaskFromMessage();
  const lastIncoming = messages.findLast((m) => m.authorId !== currentUserId);
  useMarkRead(conversation?._id);

  const send = async (body) => Boolean(await run({ type: "dm.send", data: { userId: other._id, body } }));

  return (
    <section aria-label={`Conversation with ${other.name}`} className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-divider px-4 py-5 sm:px-7">
        <Link href="/messages" aria-label="All messages" className="-ml-2 flex size-10 items-center justify-center rounded-lg text-secondary hover:bg-hover lg:hidden">
          <ArrowLeft className="size-4" />
        </Link>
        <Avatar user={other} />
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold">{other.name}</h2>
          <span className="text-xs text-muted">{other.active ? ROLE_LABELS[other.role] : "Deactivated"}</span>
        </div>
      </header>

      <div ref={listRef} className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-6 sm:px-7">
        {!messages.length && <p className="text-muted">This is the start of your conversation with {firstName(other.name)}.</p>}
        {withDayDividers(messages, (m) => {
          const mine = m.authorId === currentUserId;
          return (
            <>
              <div className={cx("group flex max-w-[85%] flex-col gap-1 sm:max-w-[70%]", mine ? "items-end self-end" : "self-start")}>
                <div
                  className={cx(
                    "rounded-[14px] px-3.5 py-2.5 leading-normal",
                    mine ? "rounded-br-[4px] bg-accent-tint text-accent-tint-text" : "rounded-bl-[4px] border border-line bg-bubble"
                  )}
                >
                  <MessageText body={m.body} />
                </div>
                <LinkCards body={m.body} />
                <span className="flex items-center gap-2 font-mono text-[11px] text-faint">
                  {formatTime(m.createdAt)}
                  {!mine && m !== lastIncoming && (
                    <button type="button" onClick={() => createTask(m)} className="reveal flex items-center gap-1 font-sans text-muted hover:text-fg">
                      <ListPlus className="size-3" aria-hidden /> Create task
                    </button>
                  )}
                </span>
              </div>
              {m === lastIncoming && (
                <button
                  type="button"
                  onClick={() => createTask(m)}
                  className="h-8 self-start rounded-lg border border-dashed border-dash px-3 text-xs font-medium text-muted hover:text-fg"
                >
                  Create task from message
                </button>
              )}
            </>
          );
        })}
      </div>

      <div className="border-t border-divider px-4 pt-4 pb-6 sm:px-7">
        {other.active ? (
          <Composer label={`Message ${other.name}`} placeholder={`Message ${firstName(other.name)}`} onSend={send} />
        ) : (
          <p className="text-[13px] text-muted">{other.name} has been removed from the team. History stays here.</p>
        )}
      </div>
    </section>
  );
}

function PeopleDialog({ open, onClose, people }) {
  const router = useRouter();
  return (
    <Dialog open={open} onClose={onClose} size="sm" title="New message">
      <div className="-mx-2 flex flex-col gap-0.5">
        {people.map((user) => (
          <button
            key={user._id}
            type="button"
            onClick={() => {
              onClose();
              router.push(`/messages/${user._id}`);
            }}
            className="flex items-center gap-3 rounded-[10px] p-2.5 text-left hover:bg-hover"
          >
            <Avatar user={user} />
            <span className="flex flex-col">
              <span className="font-medium">{user.name}</span>
              <span className="text-xs text-muted">{user.email}</span>
            </span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}
