"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ListPlus, Pencil, Plus, Search } from "lucide-react";
import { useLiveUpdates, useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { ChannelMessage, Composer, conversationMessages, LinkCards, MessageText, useMarkRead, useSendMessage, useStickToBottom, useTaskFromMessage, withDayDividers } from "@/components/chat/Chat";
import { splitLayout } from "@/components/views/TaskDetailView";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { Avatar, Button, CountBadge, cx, IconButton, LogoTile } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/Dialog";
import { useAction } from "@/lib/client/useAction";
import { FORMER_MEMBER, ROLE_LABELS, TEAM_CHANNEL } from "@/lib/constants";
import { firstName, formatStamp, formatTime, pluralize } from "@/lib/format";
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
      <section aria-labelledby="inbox-title" className={cx("min-h-0 flex-col rounded-[22px] border border-card-line bg-card lg:flex lg:w-[320px] lg:shrink-0", selected ? "hidden" : "flex min-h-[calc(100dvh-5.5rem)]")}>
        <div className="flex items-center justify-between gap-2.5 px-5 pt-5 pb-4">
          <h1 id="inbox-title" className="text-[28px] font-medium tracking-[-0.02em] text-strong">
            Inbox
          </h1>
          <ActionMenu
            label="Start a conversation"
            icon={Plus}
            buttonClassName="flex size-11 items-center justify-center rounded-full bg-primary text-primary-on hover:bg-primary-hover"
            items={[
              { label: "New message", onClick: () => setPicking(true) },
              { label: "New group", onClick: () => overlays.newGroup() },
            ]}
          />
        </div>
        <label className="mx-4 mb-3 flex h-11 items-center gap-2.5 rounded-full bg-input px-4 text-muted focus-within:ring-1 focus-within:ring-accent/50">
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="sr-only">Search conversations</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversations" className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-muted" />
        </label>

        <div className="flex flex-1 flex-col overflow-y-auto px-2.5 pb-4">
          {groups.length > 0 && <ListLabel>Groups</ListLabel>}
          {groups.map(({ conversation, last, unread: count }) => (
            <ConversationLink
              key={conversation._id}
              href={`/inbox/${conversation._id}`}
              selected={conversation._id === id}
              leading={<LogoTile name={groupName(conversation)} size="md" className="rounded-xl" />}
              name={groupName(conversation)}
              preview={last ? `${authorLabel(last, lookup, currentUserId)}: ${last.body}` : `${pluralize(conversation.memberIds.length, "member")} · say hello`}
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
              leading={<Avatar user={user} size="md" className="size-11" />}
              name={user.name}
              preview={last ? `${authorLabel(last, lookup, currentUserId)}: ${last.body}` : user.active ? "Start a conversation" : "Deactivated"}
              last={last}
              count={count}
            />
          ))}
          {!groups.length && !dms.length && (
            <p className="px-3 py-2 text-[13px] text-muted">{query ? "No conversations match." : "No conversations yet. Press + to message someone or start a group."}</p>
          )}
        </div>
      </section>

      {other ? (
        <DirectConversation key={other._id} other={other} />
      ) : group ? (
        <GroupConversation key={group._id} conversation={group} />
      ) : (
        <div className="hidden flex-1 flex-col items-center justify-center gap-2 rounded-[22px] border border-card-line bg-card px-6 text-center lg:flex">
          <h2 className="text-[22px] font-medium text-strong">{id ? "Conversation not found" : "Your inbox"}</h2>
          <p className="max-w-[300px] text-[14px] text-secondary">{id ? "It may have been removed, or you’re not in it." : "Message someone directly, or start a group for a project or team."}</p>
          <div className="mt-4 flex gap-2.5">
            <Button variant="outline" onClick={() => setPicking(true)}>
              New message
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => overlays.newGroup()}>
              New group
            </Button>
          </div>
        </div>
      )}

      <PeopleDialog open={picking} onClose={() => setPicking(false)} people={people.filter((u) => u.active)} />
    </div>
  );
}

const authorLabel = (message, lookup, currentUserId) => (message.authorId === currentUserId ? "You" : firstName(lookup.users[message.authorId]?.name ?? FORMER_MEMBER));

function ListLabel({ children }) {
  return <h2 className="px-3 pt-3 pb-1.5 text-[13px] font-medium text-muted">{children}</h2>;
}

function ConversationLink({ href, selected, leading, name, preview, last, count }) {
  return (
    <Link href={href} aria-current={selected ? "true" : undefined} className={cx("flex items-center gap-3 rounded-2xl p-2.5", selected ? "bg-hover" : "hover:bg-hover/60")}>
      {leading}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-semibold text-strong">{name}</span>
          {last && <span className={cx("shrink-0 text-[11px]", count ? "font-semibold text-accent" : "text-muted")}>{formatStamp(last.createdAt)}</span>}
        </span>
        <span className="flex items-center gap-2">
          <span className={cx("min-w-0 flex-1 truncate text-[13px]", count ? "font-medium text-fg" : "text-muted")}>{preview}</span>
          <CountBadge count={count} label={`${count} unread`} />
        </span>
      </span>
    </Link>
  );
}

function ConversationHeader({ leading, title, subtitle, action }) {
  return (
    <header className="flex items-center gap-3 border-b border-line px-4 py-4 sm:px-6">
      <Link href="/inbox" aria-label="All conversations" className="-ml-1 flex size-10 items-center justify-center rounded-full text-secondary hover:bg-hover lg:hidden">
        <ArrowLeft className="size-4" />
      </Link>
      {leading}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 className="truncate text-[17px] font-semibold text-strong">{title}</h2>
        <span className="truncate text-xs text-muted">{subtitle}</span>
      </div>
      {action}
    </header>
  );
}

const conversationCard = "flex min-h-[calc(100dvh-5.5rem)] min-w-0 flex-1 flex-col rounded-[22px] border border-card-line bg-card lg:min-h-0";

function DirectConversation({ other }) {
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
    <section aria-label={`Conversation with ${other.name}`} className={conversationCard}>
      <ConversationHeader leading={<Avatar user={other} />} title={other.name} subtitle={other.active ? ROLE_LABELS[other.role] : "Deactivated"} />

      <div ref={listRef} className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-6 sm:px-6">
        {!messages.length && <p className="text-muted">This is the start of your conversation with {firstName(other.name)}.</p>}
        {withDayDividers(messages, (m) => {
          const mine = m.authorId === currentUserId;
          return (
            <>
              <div className={cx("group flex max-w-[85%] flex-col gap-1 sm:max-w-[70%]", mine ? "items-end self-end" : "self-start")}>
                <div className={cx("rounded-[20px] px-4 py-2.5 leading-normal", mine ? "rounded-br-md bg-accent text-accent-on [&_a]:text-accent-on [&_a]:underline" : "rounded-bl-md bg-bubble text-fg")}>
                  <MessageText body={m.body} />
                </div>
                <LinkCards body={m.body} />
                <span className="flex items-center gap-2 text-[11px] text-faint">
                  {formatTime(m.createdAt)}
                  {createTask && !mine && m !== lastIncoming && (
                    <button type="button" onClick={() => createTask(m)} className="reveal flex items-center gap-1 text-muted hover:text-fg">
                      <ListPlus className="size-3" aria-hidden /> Create task
                    </button>
                  )}
                </span>
              </div>
              {createTask && m === lastIncoming && (
                <button type="button" onClick={() => createTask(m)} className="h-8 self-start rounded-full border border-dashed border-dash px-3.5 text-xs font-medium text-muted hover:text-fg">
                  Create task from message
                </button>
              )}
            </>
          );
        })}
      </div>

      <div className="border-t border-line px-4 py-4 sm:px-6">
        {other.active ? (
          <Composer compact label={`Message ${other.name}`} placeholder={`Message ${firstName(other.name)}`} onSend={send} />
        ) : (
          <p className="text-[13px] text-muted">{other.name} has been removed from the team. History stays here.</p>
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
  const listRef = useStickToBottom(messages.length);
  useMarkRead(conversation._id);

  const memberIds = conversationMemberIds(conversation, data);
  const members = memberIds.map((uid) => lookup.users[uid]).filter((u) => u?.active);
  const name = groupName(conversation);
  const subtitle = conversation.type === "general" ? `Whole team · ${pluralize(members.length, "member")}` : members.map((u) => (u._id === currentUserId ? "You" : firstName(u.name))).join(", ");

  return (
    <section aria-label={name} className={conversationCard}>
      <ConversationHeader
        leading={<LogoTile name={name} />}
        title={name}
        subtitle={subtitle}
        action={conversation.type === "group" && <IconButton icon={Pencil} outline label="Edit group" onClick={() => overlays.editGroup(conversation._id)} />}
      />

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-[22px]">
          {messages.length ? withDayDividers(messages, (m) => <ChannelMessage message={m} onCreateTask={createTask} />) : <p className="text-muted">This is the start of {name}. Say hello.</p>}
        </div>
      </div>

      <div className="border-t border-line px-4 py-4 sm:px-6">
        <Composer compact label={`Message ${name}`} placeholder={`Message ${name}`} onSend={send} people={members.filter((u) => u._id !== currentUserId)} hint="@ to mention someone · Facebook and Instagram links show as cards" />
      </div>
    </section>
  );
}

function PeopleDialog({ open, onClose, people }) {
  const router = useRouter();
  return (
    <Dialog open={open} onClose={onClose} size="sm" title="New message">
      <div className="-mx-2 flex flex-col gap-0.5 pb-2">
        {people.map((user) => (
          <button
            key={user._id}
            type="button"
            onClick={() => {
              onClose();
              router.push(`/inbox/${user._id}`);
            }}
            className="flex items-center gap-3 rounded-2xl p-2.5 text-left hover:bg-hover"
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
