"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Building2, FolderKanban, Inbox, Info, Lock, MessageSquarePlus, Send, Trash2, Users } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { useAction } from "@/lib/client/useAction";
import { Avatar, Badge, Button, Card, cx, EmptyState, IconButton, StatusBadge } from "@/components/ui/primitives";
import { SearchInput, Segmented } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { ConversationSummary, useMessageAuthor } from "@/components/inbox/ConversationSummary";
import { conversationsSorted, isUnread, matches, todayISO } from "@/lib/selectors";
import { formatDate, formatTime } from "@/lib/format";

export function InboxView() {
  const { data, lookup, currentUserId } = useWorkspace();
  const overlays = useOverlays();
  const params = useSearchParams();
  const selectedId = params.get("thread");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const all = conversationsSorted(data.conversations);
  const messageText = useMemo(() => {
    const map = {};
    for (const m of data.messages) map[m.conversationId] = `${map[m.conversationId] ?? ""} ${m.body}`;
    return map;
  }, [data.messages]);

  const filtered = all.filter((c) => {
    if (filter === "unread" && !isUnread(c, currentUserId)) return false;
    if ((filter === "internal" || filter === "client") && c.visibility !== filter) return false;
    return matches(query, c.subject, lookup.clients[c.clientId]?.company, lookup.projects[c.projectId]?.name, messageText[c._id]);
  });

  const selected = selectedId ? lookup.conversations[selectedId] : null;
  const unreadCount = all.filter((c) => isUnread(c, currentUserId)).length;

  return (
    <div className="flex flex-col">
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-[22px]">Inbox</h1>
          <p className="mt-1 text-[13px] text-muted">Client and internal discussions in one place. {unreadCount ? `${unreadCount} unread.` : "All caught up."}</p>
        </div>
        <Button variant="primary" icon={MessageSquarePlus} onClick={() => overlays.newThread()}>
          New conversation
        </Button>
      </header>

      <Card className="grid h-[calc(100dvh-220px)] min-h-[520px] grid-cols-1 overflow-hidden lg:grid-cols-[340px_1fr]">
        <div className={cx("flex min-h-0 flex-col border-border lg:border-r", selected && "hidden lg:flex")}>
          <div className="flex flex-col gap-2 border-b border-border p-3">
            <SearchInput value={query} onChange={setQuery} placeholder="Search subjects, clients, messages…" label="Search conversations" />
            <div className="overflow-x-auto">
              <Segmented
                label="Filter conversations"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "unread", label: "Unread", count: unreadCount },
                  { value: "client", label: "Client" },
                  { value: "internal", label: "Internal" },
                ]}
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {filtered.length ? (
              <ul className="divide-y divide-border">
                {filtered.map((c) => (
                  <li key={c._id}>
                    <ConversationSummary conversation={c} active={c._id === selectedId} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Inbox}
                title={all.length ? "No conversations match" : "No conversations yet"}
                description={all.length ? "Try another search or filter." : "Start a thread with your team or record a client conversation."}
                action={!all.length && <Button size="sm" variant="primary" onClick={() => overlays.newThread()}>New conversation</Button>}
                compact
              />
            )}
          </div>
        </div>

        <div className={cx("min-h-0 flex-col", selected ? "flex" : "hidden lg:flex")}>
          {selected ? (
            <Thread key={selected._id} conversation={selected} />
          ) : (
            <EmptyState
              icon={selectedId ? Info : MessageSquarePlus}
              title={selectedId ? "Conversation not found" : "Select a conversation"}
              description={selectedId ? "It may have been deleted." : "Pick a thread on the left, or start a new one."}
              className="h-full"
            />
          )}
        </div>
      </Card>
    </div>
  );
}

function Thread({ conversation }) {
  const { data, lookup, currentUserId, dispatch, preferences } = useWorkspace();
  const router = useRouter();
  const authorOf = useMessageAuthor();
  const send = useAction();
  const del = useAction();
  const [body, setBody] = useState("");
  const [authorType, setAuthorType] = useState("member");
  const [confirm, setConfirm] = useState(false);
  const endRef = useRef(null);

  const messages = data.messages.filter((m) => m.conversationId === conversation._id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const client = conversation.clientId ? lookup.clients[conversation.clientId] : null;
  const project = conversation.projectId ? lookup.projects[conversation.projectId] : null;
  const isClientThread = conversation.visibility === "client";
  const unread = isUnread(conversation, currentUserId);

  // Opening a thread marks it as read for the current user.
  useEffect(() => {
    if (unread) dispatch({ type: "conversation.read", id: conversation._id }).catch(() => {});
  }, [unread, conversation._id, dispatch]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const submit = async (e) => {
    e?.preventDefault();
    if (!body.trim()) return;
    const result = await send.run(
      { type: "message.create", conversationId: conversation._id, data: { body, authorType } },
      { silent: true }
    );
    if (result) {
      setBody("");
      setAuthorType("member");
    }
  };

  const remove = async () => {
    const result = await del.run({ type: "conversation.delete", id: conversation._id }, { success: "Conversation deleted" });
    if (result) {
      setConfirm(false);
      router.push("/inbox");
    }
  };

  return (
    <>
      <div className="flex items-start gap-3 border-b border-border px-4 py-3">
        <Link href="/inbox" className="-ml-1 mt-0.5 rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg lg:hidden" aria-label="Back to conversations">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-[15px] font-semibold">{conversation.subject}</h2>
            <StatusBadge kind="visibility" value={conversation.visibility} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {client ? (
              <Link href={`/clients/${client._id}`} className="inline-flex items-center gap-1 hover:text-fg">
                <Building2 className="size-3" aria-hidden /> {client.company}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1"><Users className="size-3" aria-hidden /> Team only</span>
            )}
            {project && (
              <Link href={`/projects/${project._id}`} className="inline-flex items-center gap-1 hover:text-fg">
                <FolderKanban className="size-3" aria-hidden /> {project.name}
              </Link>
            )}
          </div>
        </div>
        <IconButton icon={Trash2} label="Delete conversation" onClick={() => setConfirm(true)} className="hover:text-danger" />
      </div>

      <div className={cx("flex items-center gap-2 px-4 py-2 text-[11px]", isClientThread ? "tone-teal" : "tone-slate")}>
        {isClientThread ? <Users className="size-3.5 shrink-0" aria-hidden /> : <Lock className="size-3.5 shrink-0" aria-hidden />}
        {isClientThread
          ? "Client communication record. Messages are stored here only — nothing is emailed or delivered to the client."
          : "Internal discussion — visible to your team only."}
      </div>

      <ol className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-label="Messages">
        {messages.map((m, i) => {
          const author = authorOf(m, conversation);
          // Group by the viewer's local calendar day (timestamps are stored in UTC).
          const day = todayISO(new Date(m.createdAt));
          const showDay = i === 0 || todayISO(new Date(messages[i - 1].createdAt)) !== day;
          const mine = !author.isClient && m.authorId === currentUserId;
          return (
            <li key={m._id}>
              {showDay && (
                <div className="my-3 flex items-center gap-3 text-[11px] text-subtle" role="separator">
                  <span className="h-px flex-1 bg-border" />
                  {formatDate(day, preferences.dateFormat)}
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
              <div className="group flex gap-3 rounded-lg px-2 py-2 hover:bg-surface-2/40">
                <Avatar user={author.user} name={author.isClient ? author.name : undefined} tone={author.isClient ? "amber" : undefined} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[13px] font-medium text-fg">{author.name}</span>
                    {author.isClient && <Badge tone="amber">Client{author.client ? ` · ${author.client.company}` : ""}</Badge>}
                    {mine && <span className="text-[11px] text-subtle">You</span>}
                    <time dateTime={m.createdAt} className="text-[11px] text-subtle">{formatTime(m.createdAt)}</time>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-fg/90">{m.body}</p>
                  {author.isClient && author.loggedBy && <p className="mt-1 text-[11px] text-subtle">Logged by {author.loggedBy.name}</p>}
                </div>
              </div>
            </li>
          );
        })}
        <li ref={endRef} aria-hidden />
      </ol>

      <form onSubmit={submit} className="border-t border-border p-3">
        {isClientThread && (
          <div className="mb-2">
            <Segmented
              label="Message type"
              value={authorType}
              onChange={setAuthorType}
              options={[
                { value: "member", label: "Team reply" },
                { value: "client", label: `Log message from ${client?.name.split(" ")[0] ?? "client"}` },
              ]}
            />
          </div>
        )}
        <div className={cx("rounded-lg border bg-surface-2 focus-within:border-accent", send.fieldErrors.body ? "border-danger" : "border-border")}>
          <label htmlFor="composer" className="sr-only">Message</label>
          <textarea
            id="composer"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
            }}
            rows={3}
            placeholder={authorType === "client" ? "Paste or summarise what the client said…" : isClientThread ? "Write a reply to record in this thread…" : "Message your team…"}
            className="block w-full resize-none bg-transparent px-3 py-2.5 text-[13px] text-fg placeholder:text-subtle focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <p className="text-[11px] text-subtle">
              {send.fieldErrors.body ? <span className="text-danger">{send.fieldErrors.body}</span> : "Ctrl/⌘ + Enter to send"}
            </p>
            <Button type="submit" variant="primary" size="sm" icon={Send} loading={send.busy} disabled={!body.trim()}>
              {authorType === "client" ? "Log message" : "Send"}
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={remove}
        busy={del.busy}
        title="Delete conversation?"
        description={`“${conversation.subject}” and its ${messages.length} messages will be permanently deleted.`}
      />
    </>
  );
}
