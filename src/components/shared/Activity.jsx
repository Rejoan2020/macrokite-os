"use client";

import Link from "next/link";
import { Activity as ActivityIcon } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Avatar, EmptyState } from "@/components/ui/primitives";
import { formatRelative } from "@/lib/format";

const hrefFor = (a) => {
  if (a.entityType === "task" && a.projectId) return `/projects/${a.projectId}`;
  if (a.entityType === "project" && a.entityId) return `/projects/${a.entityId}`;
  if (a.entityType === "client" && a.entityId) return `/clients/${a.entityId}`;
  if (a.entityType === "conversation" && a.entityId) return `/inbox?thread=${a.entityId}`;
  if (a.entityType === "workspace") return "/settings";
  return null;
};

export function ActivityFeed({ filter, limit = 10, emptyText = "Activity from your team will appear here." }) {
  const { data, lookup } = useWorkspace();
  const items = data.activities
    .filter((a) => !filter || filter(a))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);

  if (!items.length) return <EmptyState icon={ActivityIcon} title="No activity yet" description={emptyText} compact />;

  return (
    <ol className="flex flex-col">
      {items.map((a, i) => {
        const actor = lookup.users[a.actorId];
        const href = hrefFor(a);
        // Links only point at records that still exist.
        const live =
          href &&
          (a.entityType === "workspace" ||
            (a.entityType === "task" ? lookup.projects[a.projectId] : (lookup[`${a.entityType}s`] ?? {})[a.entityId]));
        const text = (
          <>
            <span className="font-medium text-fg">{actor?.name ?? "Someone"}</span> <span className="text-muted">{a.summary}</span>
          </>
        );
        return (
          <li key={a._id} className="relative flex gap-3 px-4 py-2.5">
            {i < items.length - 1 && <span className="absolute bottom-0 left-[27px] top-9 w-px bg-border" aria-hidden />}
            <Avatar user={actor} size="sm" className="mt-0.5" />
            <div className="min-w-0 flex-1 text-[13px] leading-snug">
              {live ? (
                <Link href={href} className="hover:underline decoration-border-strong underline-offset-2">
                  {text}
                </Link>
              ) : (
                text
              )}
              <p className="mt-0.5 text-[11px] text-subtle">
                <time dateTime={a.createdAt}>{formatRelative(a.createdAt)}</time>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
