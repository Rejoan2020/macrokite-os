"use client";

import Link from "next/link";
import { Lock, Users } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { cx } from "@/components/ui/primitives";
import { isUnread } from "@/lib/selectors";
import { formatRelative } from "@/lib/format";

export function useMessageAuthor() {
  const { lookup } = useWorkspace();
  return (message, conversation) => {
    if (message.authorType === "client") {
      const client = conversation?.clientId ? lookup.clients[conversation.clientId] : null;
      return { name: client ? client.name : "Client", isClient: true, client, loggedBy: lookup.users[message.authorId] };
    }
    const user = lookup.users[message.authorId];
    return { name: user?.name ?? "Former member", user, isClient: false };
  };
}

export function ConversationSummary({ conversation, active, onSelect }) {
  const { data, lookup, currentUserId } = useWorkspace();
  const authorOf = useMessageAuthor();
  const unread = isUnread(conversation, currentUserId);
  const last = data.messages
    .filter((m) => m.conversationId === conversation._id)
    .reduce((latest, m) => (!latest || m.createdAt > latest.createdAt ? m : latest), null);
  const client = conversation.clientId ? lookup.clients[conversation.clientId] : null;
  const project = conversation.projectId ? lookup.projects[conversation.projectId] : null;
  const Icon = conversation.visibility === "client" ? Users : Lock;

  return (
    <Link
      href={`/inbox?thread=${conversation._id}`}
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={cx(
        "relative flex gap-3 px-4 py-3 transition-colors",
        active ? "bg-surface-3" : "hover:bg-surface-2/60"
      )}
    >
      {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-accent" aria-hidden />}
      <span
        className={cx("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg", conversation.visibility === "client" ? "tone-teal" : "tone-slate")}
        title={conversation.visibility === "client" ? "Client-facing" : "Internal"}
      >
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cx("min-w-0 flex-1 truncate text-[13px]", unread ? "font-semibold text-fg" : "text-fg")}>{conversation.subject}</p>
          <time dateTime={conversation.lastMessageAt} className="shrink-0 text-[11px] text-subtle">
            {formatRelative(conversation.lastMessageAt)}
          </time>
        </div>
        <p className="truncate text-[11px] text-subtle">
          {client ? client.company : "Team"}
          {project ? ` · ${project.name}` : ""}
        </p>
        {last && (
          <p className={cx("mt-1 line-clamp-1 text-xs", unread ? "text-muted" : "text-subtle")}>
            <span className="text-muted">{authorOf(last, conversation).name.split(" ")[0]}:</span> {last.body}
          </p>
        )}
      </div>
      {unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
    </Link>
  );
}
