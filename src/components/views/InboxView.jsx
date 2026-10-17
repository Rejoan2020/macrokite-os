"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { useLiveUpdates, useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { ChannelMessage, Composer, conversationMessages, useMarkRead, useSendMessage, useStickToBottom, useTaskFromMessage, withDayDividers } from "@/components/chat/Chat";
import { splitLayout } from "@/components/views/TaskDetailView";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { Avatar, AvatarStack, Button, cx, LogoTile } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/Dialog";
import { useAction } from "@/lib/client/useAction";
import { FORMER_MEMBER, TEAM_CHANNEL } from "@/lib/constants";
import { firstName, formatStamp, pluralize } from "@/lib/format";
import { conversationMemberIds, matches } from "@/lib/selectors";

/** A group's display name: the team chat is "Everyone". */
const groupName = (conversation) => (conversation.type === "general" ? TEAM_CHANNEL : conversation.name);

/**
 * Groups and direct messages in one list, with the open conversation beside it. `/inbox/<id>` is a
 * person's id for a DM, or a conversation id for a group.
 */
export function InboxView() {
  const { id } = useParams();
  const { data, chats, unread, lookup, currentUserId } = useWorkspace();
  const overlays = useOverlays();
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(false);
  useLiveUpdates();

  const lastOf = (conversation) => (conversation ? conversationMessages(data, conversation._id).at(-1) ?? null : null);
  const byRecent = (a, b) => (b.last?.createdAt ?? b.conversation?.createdAt ?? "").localeCompare(a.last?.createdAt ?? a.conversation?.createdAt ?? "");

  const groups = [chats.general, ...chats.groups]
    .filter(Boolean)
    .map((conversation) => ({ conversation, last: lastOf(conversation), unread: unread[conversation._id]?.count ?? 0 }))
    // The team chat only shows once someone has used it.
    .filter((r) => r.conversation.type === "group" || r.last)
    .filter((r) => matches(query, groupName(r.conversation)))
    .sort(byRecent);
  const people = data.users.filter((u) => u._id !== currentUserId);
  const dms = people
    .map((user) => {
      const conversation = chats.dms[user._id];
      return { user, conversation, last: lastOf(conversation), unread: conversation ? unread[conversation._id]?.count ?? 0 : 0 };
    })
    .filter((r) => (query ? matches(query, r.user.name) && (r.user.active || r.last) : r.last))
    .sort((a, b) => byRecent(a, b) || a.user.name.localeCompare(b.user.name));

  const other = id ? lookup.users[id] : null;
  const group = id && !other ? [chats.general, ...chats.groups].find((c) => c?._id === id) : null;
  const selected = other || group;

  return (
    <div className={splitLayout}>
      <section aria-labelledby="inbox-title" className={cx("min-h-0 flex-col overflow-auto rounded-[24px] border border-card-line bg-card px-4 py-[22px] lg:flex lg:w-[320px] lg:shrink-0", selected ? "hidden" : "flex min-h-[calc(100dvh-5.5rem)]")}>
        <div className="mb-4 flex items-center justify-between gap-2.5 px-1">
          <h1 id="inbox-title" className="text-[26px] font-normal tracking-[-0.03em] text-strong">
            Inbox
          </h1>
          <ActionMenu
            label="Start a conversation"
            icon={Plus}
            buttonClassName="flex size-[42px] items-center justify-center rounded-full bg-primary text-primary-on hover:bg-primary-hover"
            menuClassName="w-[200px]"
            items={[
              { label: "New message", icon: "person", onClick: () => setPicking(true) },
              { label: "New group", icon: "group", onClick: () => overlays.newGroup() },
            ]}
          />
        </div>
        <label className="mb-1.5 flex h-[42px] shrink-0 items-center gap-2.5 rounded-full bg-raised px-[18px] text-faint">
          <Search className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          <span className="sr-only">Search conversations</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversations" className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-faint" />
        </label>

        <div className="-mx-1.5 flex flex-1 flex-col overflow-auto px-1.5">
          {groups.length > 0 && <ListLabel>Groups</ListLabel>}
          {groups.map(({ conversation, last, unread: count }) => (
            <ConversationLink
              key={conversation._id}
              href={`/inbox/${conversation._id}`}
              selected={conversation._id === id}
              leading={<LogoTile name={groupName(conversation)} size="sm" />}
              name={groupName(conversation)}
              preview={last ? `${authorLabel(last, lookup, currentUserId)}: ${last.body}` : pluralize(conversation.memberIds.length, "member")}
              last={last}
              count={count}
            />
          ))}

          {dms.length > 0 && <ListLabel>Direct messages</ListLabel>}
          {dms.map(({ user, last, unread: count }) => (
            <ConversationLink
              key={user._id}
              href={`/inbox/${user._id}`}
              selected={user._id === id}
              leading={<Avatar user={user} size="row" />}
              name={user.name}
              preview={last ? `${authorLabel(last, lookup, currentUserId)}: ${last.body}` : "No messages yet"}
              last={last}
              count={count}
            />
          ))}
          {!groups.length && !dms.length && (
            <p className="mx-1.5 mt-[18px] text-[13px] leading-5 text-secondary">{query ? "No conversations match." : "No conversations yet. Press + to message someone or start a group."}</p>
          )}
        </div>
      </section>

      {other ? (
        <DirectConversation key={other._id} other={other} />
      ) : group ? (
        <GroupConversation key={group._id} conversation={group} />
      ) : (
        <div className="hidden min-w-0 flex-1 items-center justify-center rounded-[24px] border border-card-line bg-card lg:flex">
          <div className="max-w-[360px] p-5 text-center">
          <h2 className="text-[22px] font-medium tracking-[-0.03em] text-strong">{id ? "Conversation not found" : "Your inbox"}</h2>
          <p className="mt-2 mb-5 text-[13px] leading-5 text-secondary">{id ? "It may have been removed, or you’re not in it." : "Message someone directly, or start a group for a project or team."}</p>
          <div className="flex justify-center gap-2.5">
            <Button size="lg" onClick={() => setPicking(true)}>
              New message
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => overlays.newGroup()}>
              New group
            </Button>
          </div>
          </div>
        </div>
      )}

      <PeopleDialog open={picking} onClose={() => setPicking(false)} people={people.filter((u) => u.active)} />
    </div>
  );
}

const authorLabel = (message, lookup, currentUserId) => (message.authorId === currentUserId ? "You" : firstName(lookup.users[message.authorId]?.name ?? FORMER_MEMBER));

function ListLabel({ children }) {
  return <h2 className="mx-1.5 mt-4 mb-1.5 flex items-center gap-2 text-xs font-semibold text-faint">{children}</h2>;
}

function ConversationLink({ href, selected, leading, name, preview, last, count }) {
  return (
    <Link href={href} aria-current={selected ? "true" : undefined} className={cx("flex items-center gap-3 rounded-[14px] p-2.5 transition-colors duration-150", selected ? "bg-input" : "hover:bg-raised")}>
      {leading}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{name}</span>
          {last && <span className={cx("shrink-0 text-[11px]", count ? "font-semibold text-accent-tint-text" : "text-faint")}>{formatStamp(last.createdAt)}</span>}
        </span>
        <span className={cx("truncate text-xs", count ? "font-medium text-fg" : "text-secondary")}>
          {count > 0 && <span className="sr-only">{count} unread · </span>}
          {preview}
        </span>
      </span>
    </Link>
  );
}

function ConversationHeader({ leading, title, subtitle, action }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-row px-6 py-[18px]">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/inbox" aria-label="All conversations" className="-ml-2 flex size-10 items-center justify-center rounded-full text-secondary hover:bg-hover lg:hidden">
          <ArrowLeft className="size-4" />
        </Link>
        {leading}
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold tracking-[-0.01em] text-strong">{title}</h2>
          <div className="mt-0.5 truncate text-[13px] text-secondary">{subtitle}</div>
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-3">{action}</div>}
    </header>
  );
}

const conversationCard = "flex min-h-[calc(100dvh-5.5rem)] min-w-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-card-line bg-card lg:min-h-0";
const SHARE_HINT = "Paste a Facebook or Instagram link to share a post · @ to mention someone";

/** The feed and composer of a conversation: messages, or a line saying how to start. */
function Feed({ messages, emptyText, onCreateTask }) {
  const listRef = useStickToBottom(messages.length);
  return (
    <div ref={listRef} className="flex-1 overflow-x-hidden overflow-y-auto px-7 pt-5 pb-6">
      {messages.length ? (
        <div className="flex flex-col gap-5">{withDayDividers(messages, (m) => <ChannelMessage message={m} onCreateTask={onCreateTask} />)}</div>
      ) : (
        <p className="mt-10 text-center text-[13px] text-faint">{emptyText}</p>
      )}
    </div>
  );
}

function DirectConversation({ other }) {
  const { data, chats } = useWorkspace();
  const { run } = useAction();
  const conversation = chats.dms[other._id];
  const messages = conversation ? conversationMessages(data, conversation._id) : [];
  const createTask = useTaskFromMessage();
  useMarkRead(conversation?._id);

  const send = async (body) => Boolean(await run({ type: "dm.send", data: { userId: other._id, body } }));

  return (
    <section aria-label={`Conversation with ${other.name}`} className={conversationCard}>
      <ConversationHeader leading={<Avatar user={other} size="row" />} title={other.name} subtitle={other.active ? other.email : "Removed from the team"} />
      <Feed messages={messages} emptyText={`Start your conversation with ${firstName(other.name)}.`} onCreateTask={createTask} />
      <div className="border-t border-row px-7 pt-3.5 pb-4">
        {other.active ? (
          <Composer label={`Message ${other.name}`} placeholder={`Message ${firstName(other.name)}`} onSend={send} />
        ) : (
          <p className="text-[13px] text-faint">{other.name} has been removed from the team. History stays here.</p>
        )}
      </div>
    </section>
  );
}

function GroupConversation({ conversation }) {
  const { data, lookup, currentUserId } = useWorkspace();
  const overlays = useOverlays();
  const messages = conversationMessages(data, conversation._id);
  const send = useSendMessage(conversation._id);
  const createTask = useTaskFromMessage();
  useMarkRead(conversation._id);

  const memberIds = conversationMemberIds(conversation, data);
  const members = memberIds.map((uid) => lookup.users[uid]).filter((u) => u?.active);
  const name = groupName(conversation);

  return (
    <section aria-label={name} className={conversationCard}>
      <ConversationHeader
        leading={<LogoTile name={name} size="sm" />}
        title={name}
        subtitle={`${conversation.type === "general" ? "Whole team" : "Group"} · ${pluralize(members.length, "member")}`}
        action={
          <>
            <AvatarStack users={members} max={4} />
            {conversation.type === "group" && <Button onClick={() => overlays.editGroup(conversation._id)}>Edit</Button>}
          </>
        }
      />
      <Feed messages={messages} emptyText={`No messages in ${name} yet. Say hello.`} onCreateTask={createTask} />
      <div className="border-t border-row px-7 pt-3.5 pb-4">
        <Composer label={`Message ${name}`} placeholder={`Message ${name}`} onSend={send} people={members.filter((u) => u._id !== currentUserId)} hint={SHARE_HINT} />
      </div>
    </section>
  );
}

/** Pick one person to message directly: search, then a list of people. */
function PeopleDialog({ open, onClose, people }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const rows = people.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(query.trim().toLowerCase()));
  const pick = (user) => {
    onClose();
    setQuery("");
    router.push(`/inbox/${user._id}`);
  };
  return (
    <Dialog open={open} onClose={onClose} title="New message" footer={<Button size="lg" onClick={onClose}>Cancel</Button>}>
      <div className="flex flex-col gap-[18px]">
        <label className="flex h-[42px] items-center gap-2.5 rounded-[10px] bg-input px-3 text-faint">
          <Search className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          <span className="sr-only">Search people</span>
          <input
            data-autofocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && rows[0]) {
                e.preventDefault();
                pick(rows[0]);
              }
            }}
            placeholder="Search people"
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-faint"
          />
        </label>
        <div className="-mt-3 flex max-h-80 flex-col gap-0.5 overflow-auto">
          {rows.length ? (
            rows.map((user) => (
              <button key={user._id} type="button" onClick={() => pick(user)} className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left hover:bg-input">
                <Avatar user={user} />
                <span className="flex min-w-0 flex-1 flex-col gap-px leading-[1.3]">
                  <span className="text-sm font-medium text-fg">{user.name}</span>
                  <span className="truncate text-xs text-faint">{user.email}</span>
                </span>
              </button>
            ))
          ) : (
            <p className="px-2.5 py-3.5 text-[13px] text-faint">No one matches “{query}”</p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
