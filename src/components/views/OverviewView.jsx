"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { TaskRow } from "@/components/tasks/TaskRow";
import { useTaskManagement } from "@/components/tasks/taskHooks";
import { canCreateProject } from "@/lib/permissions";
import { conversationMessages } from "@/components/chat/Chat";
import { Button, CountBadge, cx, OnHoldPill, Page, PageHeader, Panel, PhaseBar, Summary, TextLink } from "@/components/ui/primitives";
import { usePersistentState } from "@/lib/client/usePersistentState";
import { FORMER_MEMBER, TEAM_CHANNEL } from "@/lib/constants";
import { phaseName, phaseStep } from "@/lib/phases";
import { firstName, formatLongDate, formatShortDate, formatTime, greeting, pluralize, todayISO } from "@/lib/format";
import { decisionLog, isOpenTask, isOverdue, isPastDeadline, sortByDue, stillOpenFromLast } from "@/lib/selectors";

/** Shown inside a panel that has nothing yet, so every section stays visible and explains itself. */
function PanelEmpty({ children, action }) {
  return (
    <div className="flex flex-1 flex-col items-start justify-center gap-3 px-[18px] py-6">
      <p className="text-[13px] text-muted">{children}</p>
      {action}
    </div>
  );
}

export function OverviewView() {
  const { data, currentUser, currentUserId, unread, chats, lookup } = useWorkspace();
  const overlays = useOverlays();
  const { canCreate } = useTaskManagement();
  const today = todayISO();

  const myOpen = sortByDue(data.tasks.filter((t) => t.assigneeId === currentUserId && isOpenTask(t)));
  const overdue = myOpen.filter((t) => isOverdue(t, today)).length;
  const myProjects = data.projects
    .filter((p) => !p.archived && p.memberIds.includes(currentUserId))
    .sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999") || a.name.localeCompare(b.name));
  const myProjectIds = new Set(myProjects.map((p) => p._id));
  const meetingsToday = data.meetings
    .filter((m) => todayISO(new Date(m.startsAt)) === today && (m.attendeeIds.includes(currentUserId) || myProjectIds.has(m.projectId)))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const decisions = decisionLog(data.meetings.filter((m) => myProjectIds.has(m.projectId))).slice(0, 3);

  const unreadGroups = {
    projects: myProjects
      .map((p) => ({ key: p._id, href: `/projects/${p._id}?tab=chat`, label: `# ${p.name}`, ...unread[chats.projects[p._id]?._id] }))
      .filter((g) => g.count),
    general: chats.general && unread[chats.general._id] ? [{ key: "general", href: "/general", label: TEAM_CHANNEL, ...unread[chats.general._id] }] : [],
    messages: Object.entries(chats.dms)
      .filter(([, c]) => unread[c._id])
      .map(([userId, c]) => ({
        key: c._id,
        href: `/messages/${userId}`,
        label: lookup.users[userId]?.name ?? FORMER_MEMBER,
        preview: conversationMessages(data, c._id).at(-1)?.body,
        ...unread[c._id],
      })),
  };
  const unreadTotal = Object.values(unreadGroups).flat().reduce((n, g) => n + g.count, 0);

  return (
    <Page>
      <PageHeader
        eyebrow={formatLongDate(today)}
        title={`${greeting()}, ${firstName(currentUser.name)}`}
        summary={
          <Summary
            parts={[
              overdue > 0 && <span className="text-danger">{pluralize(overdue, "task")} overdue</span>,
              meetingsToday.length > 0 && `${pluralize(meetingsToday.length, "meeting")} today`,
              unreadTotal > 0 && `${unreadTotal} unread`,
              !overdue && !meetingsToday.length && !unreadTotal && "Nothing urgent. Enjoy the quiet.",
            ]}
          />
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] gap-4">
        <Panel id="o-tasks" title="My tasks" action={<TextLink href="/tasks">{myOpen.length ? `All ${myOpen.length}` : "Open"}</TextLink>}>
          {myOpen.length ? (
            myOpen.slice(0, 3).map((task) => <TaskRow key={task._id} task={task} who="assigner" />)
          ) : (
            <PanelEmpty
              action={
                canCreate && (
                  <Button size="sm" icon={Plus} onClick={() => overlays.newTask()}>
                    Add task
                  </Button>
                )
              }
            >
              Nothing assigned to you right now. Tasks assigned to you show up here, most urgent first.
            </PanelEmpty>
          )}
        </Panel>

        <UnreadPanel groups={unreadGroups} total={unreadTotal} userId={currentUserId} />

        <Panel id="o-meet" title="Meetings today" action={<TextLink href="/meetings">This week</TextLink>}>
          {meetingsToday.length === 0 && (
            <PanelEmpty
              action={
                <Button size="sm" icon={Plus} onClick={() => overlays.newMeeting()}>
                  Schedule a meeting
                </Button>
              }
            >
              No meetings today.
            </PanelEmpty>
          )}
          {meetingsToday.slice(0, 5).map((m, i) => {
              const open = stillOpenFromLast(m, data).length;
              const next = meetingsToday.find((x) => !x.endedAt);
              const detail = [m.agenda.length ? pluralize(m.agenda.length, "agenda topic") : "No agenda yet", open && `${pluralize(open, "open item")} from last time`, m.endedAt && "ended"];
              return (
                <Link key={m._id} href={`/meetings/${m._id}`} className={cx("flex items-center gap-3.5 px-[18px] py-3 hover:bg-hover/50", i < meetingsToday.length - 1 && "border-b border-row")}>
                  <span className={cx("w-16 shrink-0 font-mono text-[13px]", m === next ? "text-accent" : "text-secondary")}>{formatTime(m.startsAt)}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span>{m.title}</span>
                    <span className="text-xs text-muted">{detail.filter(Boolean).join(" · ")}</span>
                  </span>
                </Link>
              );
            })}
        </Panel>

        <Panel id="o-dec" title="Recent decisions" action={<TextLink href="/meetings">Meetings</TextLink>}>
          {decisions.length === 0 && <PanelEmpty>No decisions yet. Decisions recorded in your projects’ meetings show up here.</PanelEmpty>}
          {decisions.map((d, i) => (
              <Link key={d._id} href={`/meetings/${d.meeting._id}`} className={cx("flex gap-3 px-[18px] py-3 hover:bg-hover/50", i < decisions.length - 1 && "border-b border-row")}>
                <span aria-hidden className="text-accent">
                  ✓
                </span>
                <span className="flex flex-1 flex-col gap-0.5">
                  <span>{d.text}</span>
                  <span className="text-xs text-muted">
                    {lookup.projects[d.meeting.projectId]?.name} · {formatShortDate(d.createdAt.slice(0, 10))}
                  </span>
                </span>
              </Link>
            ))}
        </Panel>
      </div>

      <Panel id="o-proj" title="My projects" action={<TextLink href="/projects">All projects</TextLink>}>
        {myProjects.length === 0 && (
          <PanelEmpty
            action={
              canCreateProject(currentUser) && (
                <Button size="sm" icon={Plus} onClick={() => overlays.newProject()}>
                  New project
                </Button>
              )
            }
          >
            You’re not on any projects yet. Projects you’re a member of show up here with their phase and deadline.
          </PanelEmpty>
        )}
        {myProjects.slice(0, 5).map((p) => {
            const late = isPastDeadline(p, today);
            return (
              <Link
                key={p._id}
                href={`/projects/${p._id}`}
                className="grid grid-cols-[minmax(0,1fr)_80px] items-center gap-x-[18px] gap-y-2 border-b border-row px-[18px] py-3.5 last:border-b-0 hover:bg-hover/50 sm:grid-cols-[minmax(150px,1fr)_minmax(0,2fr)_90px]"
              >
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  {p.onHold && <OnHoldPill />}
                </span>
                <span className="col-span-2 row-start-2 flex min-w-0 flex-col gap-1.5 sm:col-span-1 sm:row-start-auto">
                  <span className="text-xs text-secondary">
                    {phaseName(p, p.phase)} · <span className="font-mono">{phaseStep(p).index + 1}/{phaseStep(p).count}</span>
                  </span>
                  <PhaseBar project={p} />
                </span>
                <span className={cx("justify-self-end text-[13px]", late ? "font-medium text-danger" : "text-secondary")}>{p.deadline ? formatShortDate(p.deadline) : "—"}</span>
              </Link>
            );
          })}
      </Panel>
    </Page>
  );
}

const GROUPS = [
  { key: "projects", label: "Projects" },
  { key: "general", label: TEAM_CHANNEL },
  { key: "messages", label: "Messages" },
];

function UnreadPanel({ groups, total, userId }) {
  const [collapsed, setCollapsed] = usePersistentState(`overview-unread:${userId}`, {});
  const shown = GROUPS.filter((g) => groups[g.key].length);
  return (
    <Panel id="o-unread" title="Unread" action={total > 0 && <span className="text-[13px] text-muted">{pluralize(total, "message")}</span>}>
      {total === 0 && <PanelEmpty>You’re all caught up. Unread messages from your projects, {TEAM_CHANNEL} and direct messages show up here.</PanelEmpty>}
      <div className={cx(total > 0 && "pb-1.5")}>
        {shown.map((group, i) => {
          const open = !collapsed[group.key];
          const items = groups[group.key];
          const count = items.reduce((n, g) => n + g.count, 0);
          return (
            <div key={group.key}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setCollapsed((c) => ({ ...c, [group.key]: open }))}
                className={cx("flex min-h-10 w-full items-center gap-2 px-[18px] py-2 text-left text-[11px] font-semibold tracking-[0.06em] text-muted uppercase", i > 0 && "border-t border-row")}
              >
                <span aria-hidden className={cx("inline-block w-2.5 transition-transform", !open && "-rotate-90")}>
                  ▾
                </span>
                <span className="flex-1">{group.label}</span>
                <span className="font-medium tracking-normal text-faint normal-case">{count}</span>
              </button>
              {open &&
                items.map((item) => (
                  <Link key={item.key} href={item.href} className="flex items-center justify-between gap-2.5 py-2 pr-[18px] pl-9 hover:bg-hover/50">
                    <span className="min-w-0 truncate">
                      {item.label}
                      {item.mentioned ? <span className="text-muted"> · you were mentioned</span> : item.preview ? <span className="text-muted"> · {item.preview}</span> : null}
                    </span>
                    <CountBadge count={item.count} label={`${item.count} unread`} />
                  </Link>
                ))}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
