"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckSquare,
  CircleAlert,
  FolderKanban,
  Inbox,
  ListChecks,
  MessageSquare,
  Plus,
} from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { Avatar, Button, Card, CardHeader, cx, EmptyState, ProgressBar, Stat, StatusBadge } from "@/components/ui/primitives";
import { ActivityFeed } from "@/components/shared/Activity";
import { TASK_STATUSES, TASK_STATUS_META } from "@/lib/constants";
import { conversationsSorted, dashboardMetrics, isUnread, projectProgress, todayISO } from "@/lib/selectors";
import { dueLabel, formatDate, formatRelative, pluralize } from "@/lib/format";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function OverviewView() {
  const { data, lookup, currentUser, currentUserId, preferences } = useWorkspace();
  const overlays = useOverlays();
  const today = todayISO();
  const m = dashboardMetrics(data, { today, dueSoonDays: preferences.dueSoonDays });
  const totalTasks = data.tasks.length;
  const unread = conversationsSorted(data.conversations).filter((c) => isUnread(c, currentUserId));

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs text-subtle">{formatDate(today, preferences.dateFormat)}</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-[22px]">
            {greeting()}, {currentUser?.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            {m.overdueTasks.length
              ? `${pluralize(m.overdueTasks.length, "task")} overdue and ${pluralize(m.upcoming.length, "deadline")} in the next ${preferences.dueSoonDays} days.`
              : `Nothing overdue. ${pluralize(m.upcoming.length, "deadline")} in the next ${preferences.dueSoonDays} days.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={Building2} onClick={overlays.newClient}>New client</Button>
          <Button icon={FolderKanban} onClick={() => overlays.newProject()}>New project</Button>
          <Button variant="primary" icon={Plus} onClick={() => overlays.newTask()}>Add task</Button>
        </div>
      </header>

      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active projects" value={m.activeProjects} icon={FolderKanban} hint={`${m.plannedProjects} in planning`} href="/projects?status=in_progress" />
        <Stat label="Total clients" value={m.totalClients} icon={Building2} tone="blue" hint={`${m.activeClients} active · ${pluralize(m.leads, "lead")}`} href="/clients" />
        <Stat label="Open tasks" value={m.openTasks} icon={CheckSquare} tone="violet" hint={`${totalTasks - m.openTasks} of ${totalTasks} completed`} href="/tasks?assignee=all" />
        <Stat
          label="Overdue tasks"
          value={m.overdueTasks.length}
          icon={CircleAlert}
          tone={m.overdueTasks.length ? "red" : "green"}
          hint={m.overdueTasks.length ? "Need a new date or owner" : "All on schedule"}
          href="/tasks?assignee=all&due=overdue"
        />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="Projects needing attention" icon={AlertTriangle} description="Past or near deadlines, overdue work and unassigned urgent tasks." />
            {m.attention.length ? (
              <ul className="divide-y divide-border">
                {m.attention.map(({ project, reasons }) => {
                  const progress = projectProgress(project._id, data.tasks);
                  return (
                    <li key={project._id}>
                      <Link href={`/projects/${project._id}`} className="flex flex-col gap-2 px-4 py-3 hover:bg-surface-2/60 sm:flex-row sm:items-center sm:gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-fg">{project.name}</p>
                          <p className="truncate text-xs text-subtle">{project.clientId ? lookup.clients[project.clientId]?.company : "Internal"}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {reasons.map((r) => (
                            <span key={r} className="tone-amber rounded px-1.5 py-0.5 text-[11px]">
                              {r}
                            </span>
                          ))}
                        </div>
                        <div className="flex w-full items-center gap-2 sm:w-32">
                          <ProgressBar value={progress.percent} label={`${project.name} progress`} />
                          <span className="w-8 text-right text-[11px] tabular-nums text-muted">{progress.percent}%</span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={FolderKanban} title="Everything is on track" description="No projects are at risk right now." compact />
            )}
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Tasks by status" icon={ListChecks} action={<Link href="/tasks?assignee=all" className="text-xs text-muted hover:text-fg">View all</Link>} />
              <div className="p-4">
                {totalTasks ? (
                  <>
                    <div className="flex h-2 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                      {TASK_STATUSES.map((s) =>
                        m.byStatus[s].length ? (
                          <div key={s} className={`dot-${TASK_STATUS_META[s].tone}`} style={{ width: `${(m.byStatus[s].length / totalTasks) * 100}%` }} />
                        ) : null
                      )}
                    </div>
                    <ul className="mt-4 flex flex-col gap-1">
                      {TASK_STATUSES.map((s) => (
                        <li key={s}>
                          <Link href={`/tasks?assignee=all&status=${s}`} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] hover:bg-surface-2">
                            <span className={cx(`dot-${TASK_STATUS_META[s].tone}`, "size-2 rounded-full")} aria-hidden />
                            <span className="text-muted">{TASK_STATUS_META[s].label}</span>
                            <span className="ml-auto font-medium tabular-nums text-fg">{m.byStatus[s].length}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <EmptyState icon={CheckSquare} title="No tasks yet" action={<Button size="sm" variant="primary" icon={Plus} onClick={() => overlays.newTask()}>Add task</Button>} compact />
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Upcoming deadlines" icon={CalendarClock} description={`Next ${preferences.dueSoonDays} days`} />
              {m.upcoming.length ? (
                <ul className="divide-y divide-border">
                  {m.upcoming.slice(0, 7).map(({ kind, item, date }) => (
                    <li key={`${kind}-${item._id}`}>
                      {kind === "task" ? (
                        <button type="button" onClick={() => overlays.openTask(item._id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2/60">
                          <CheckSquare className="size-3.5 shrink-0 text-subtle" aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{item.title}</span>
                          <Avatar user={lookup.users[item.assigneeId]} size="xs" />
                          <span className="w-20 shrink-0 text-right text-[11px] text-muted">{dueLabel(date, today).replace("Due ", "")}</span>
                        </button>
                      ) : (
                        <Link href={`/projects/${item._id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/60">
                          <FolderKanban className="size-3.5 shrink-0 text-accent" aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">{item.name} deadline</span>
                          <span className="w-20 shrink-0 text-right text-[11px] text-muted">{dueLabel(date, today).replace("Due ", "")}</span>
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={CalendarClock} title="No upcoming deadlines" description="Nothing is due in this window." compact />
              )}
            </Card>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader
              title="Unread conversations"
              icon={Inbox}
              action={<Link href="/inbox" className="text-xs text-muted hover:text-fg">Open inbox</Link>}
            />
            {unread.length ? (
              <ul className="divide-y divide-border">
                {unread.slice(0, 4).map((c) => (
                  <li key={c._id}>
                    <Link href={`/inbox?thread=${c._id}`} className="flex items-start gap-3 px-4 py-2.5 hover:bg-surface-2/60">
                      <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-fg">{c.subject}</p>
                        <p className="truncate text-[11px] text-subtle">
                          {c.clientId ? lookup.clients[c.clientId]?.company : "Team"} · {formatRelative(c.lastMessageAt)}
                        </p>
                      </div>
                      <StatusBadge kind="visibility" value={c.visibility} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={Inbox} title="You’re all caught up" compact />
            )}
          </Card>

          <Card>
            <CardHeader title="Recent activity" icon={Activity} />
            <div className="py-1">
              <ActivityFeed limit={9} />
            </div>
          </Card>

          <Link href="/projects" className="flex items-center justify-between rounded-xl border border-dashed border-border px-4 py-3 text-[13px] text-muted hover:border-border-strong hover:text-fg">
            Browse all projects
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </>
  );
}
