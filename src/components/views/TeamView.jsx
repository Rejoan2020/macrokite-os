"use client";

import Link from "next/link";
import { Clock, Info, Mail } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { Avatar, Badge, Button, Card, PageHeader } from "@/components/ui/primitives";
import { ROLE_META } from "@/lib/constants";
import { isOverdue, todayISO } from "@/lib/selectors";
import { formatDate, pluralize } from "@/lib/format";

export function TeamView() {
  const { data, members, currentUserId, preferences } = useWorkspace();
  const overlays = useOverlays();
  const today = todayISO();

  return (
    <>
      <PageHeader title="Team" description={`${pluralize(members.length, "member")} in ${data.org.name}`} />

      <div className="mb-6 flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-xs text-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
        <p>
          This MVP uses a seeded team directory and a fixed demo identity — there is no sign-in or invitation flow yet. Members can be assigned to
          projects and tasks.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {members.map(({ user, role, joinedAt }) => {
          const tasks = data.tasks.filter((t) => t.assigneeId === user._id);
          const open = tasks.filter((t) => t.status !== "done");
          const overdue = open.filter((t) => isOverdue(t, today)).length;
          const projects = data.projects.filter((p) => p.memberIds.includes(user._id) && p.status !== "completed");
          return (
            <Card key={user._id} className="p-5">
              <div className="flex items-start gap-4">
                <Avatar user={user} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[15px] font-semibold">{user.name}</h2>
                    <Badge tone={role === "owner" ? "teal" : "slate"}>{ROLE_META[role]?.label ?? role}</Badge>
                    {user._id === currentUserId && <Badge tone="blue">You</Badge>}
                  </div>
                  <p className="text-[13px] text-muted">{user.title || "No title"}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-subtle">
                    <a href={`mailto:${user.email}`} className="inline-flex items-center gap-1 hover:text-fg">
                      <Mail className="size-3" aria-hidden /> {user.email}
                    </a>
                    {user.timezone && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" aria-hidden /> {user.timezone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {user.bio && <p className="mt-4 text-[13px] leading-relaxed text-muted">{user.bio}</p>}

              <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
                <div>
                  <dt className="text-[11px] text-subtle">Open tasks</dt>
                  <dd className="text-lg font-semibold tabular-nums">{open.length}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-subtle">Overdue</dt>
                  <dd className={`text-lg font-semibold tabular-nums ${overdue ? "text-danger" : ""}`}>{overdue}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-subtle">Completed</dt>
                  <dd className="text-lg font-semibold tabular-nums">{tasks.length - open.length}</dd>
                </div>
              </dl>

              <div className="mt-4">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-subtle">Active projects</p>
                {projects.length ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {projects.map((p) => (
                      <li key={p._id}>
                        <Link href={`/projects/${p._id}`} className="inline-block rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-muted hover:border-border-strong hover:text-fg">
                          {p.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-subtle">Not on any active project.</p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <Button size="sm" href={`/tasks?assignee=${user._id}`}>View tasks</Button>
                <Button size="sm" variant="ghost" onClick={() => overlays.newTask({ assigneeId: user._id })}>Assign a task</Button>
                <span className="ml-auto text-[11px] text-subtle">Joined {formatDate(joinedAt, preferences.dateFormat)}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
