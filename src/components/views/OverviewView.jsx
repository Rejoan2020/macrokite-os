"use client";

import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { TaskTile } from "@/components/tasks/TaskRow";
import { useTaskManagement } from "@/components/tasks/taskHooks";
import { Countdown, CopyLinkButton, shortLink } from "@/components/meetings/MeetingBits";
import { Button, cx, Page, PageHeader, Panel, PillSelect } from "@/components/ui/primitives";
import { usePersistentState } from "@/lib/client/usePersistentState";
import { addDaysISO, firstName, formatLongDate, formatTime, greeting, parseDate, pluralize, todayISO } from "@/lib/format";
import { isAssignedTo, isOpenTask, isThisWeek, sortForList } from "@/lib/selectors";

/** Shown inside a panel that has nothing yet, so every section stays visible and explains itself. */
function PanelEmpty({ children, action }) {
  return (
    <div className="flex flex-1 flex-col items-start justify-center gap-3 rounded-2xl border border-dashed border-dash px-5 py-6">
      <p className="text-[13px] text-muted">{children}</p>
      {action}
    </div>
  );
}

export function OverviewView() {
  const { data, currentUser, currentUserId } = useWorkspace();
  const today = todayISO();

  // "Across the company and your clients": every live project you're on.
  const myProjectIds = new Set(data.projects.filter((p) => !p.archived && p.memberIds.includes(currentUserId)).map((p) => p._id));
  const scope = data.tasks.filter((t) => myProjectIds.has(t.projectId));

  return (
    <Page>
      <PageHeader eyebrow={formatLongDate(today)} title={`${greeting()}, ${firstName(currentUser.name)}`} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <WeeklyProgress tasks={scope} today={today} />
        <TaskStatus tasks={scope} today={today} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MyTasksPanel />
        <MeetingsPanel projectIds={myProjectIds} />
      </div>
    </Page>
  );
}

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Sunday to Saturday of the week containing `iso`. */
function weekDays(iso) {
  const start = addDaysISO(iso, -parseDate(iso).getDay());
  return Array.from({ length: 7 }, (_, i) => addDaysISO(start, i));
}

const doneOn = (tasks, days) => {
  const set = new Set(days);
  return tasks.filter((t) => t.status === "done" && t.completedAt && set.has(todayISO(new Date(t.completedAt))));
};

/** The two headline cards: roomier than the lists below them. */
function BigCard({ id, title, action, children }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col rounded-[24px] border border-card-line bg-card px-7 pt-8 pb-7">
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-[21px] font-medium tracking-[-0.01em] text-strong">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const Chip = ({ children }) => <span className="flex h-9 shrink-0 items-center gap-2 rounded-full border border-line px-4 text-[13px] text-fg">{children}</span>;

/** Tasks finished each day this week, against last week's total. */
function WeeklyProgress({ tasks, today }) {
  const days = weekDays(today);
  const lastWeek = weekDays(addDaysISO(today, -7));
  const perDay = days.map((d) => doneOn(tasks, [d]).length);
  const total = perDay.reduce((a, b) => a + b, 0);
  const before = doneOn(tasks, lastWeek).length;
  const max = Math.max(1, ...perDay);
  const change = before ? Math.round(((total - before) / before) * 100) : null;
  const headline = change === null ? String(total) : `${change > 0 ? "+" : ""}${change}%`;
  const caption =
    change === null
      ? total ? `${pluralize(total, "task")} done this week, none last week.` : "No tasks done yet this week."
      : `${pluralize(total, "task")} done this week, ${total >= before ? "up" : "down"} from ${before} last week.`;
  // Stems never start at zero height, so a quiet day still reads as a day.
  const height = (count) => `${12 + (count / max) * 78}%`;

  return (
    <BigCard id="o-week" title="Weekly progress" action={<Chip>This week</Chip>}>
      <p className="mt-5 max-w-[340px] text-[13px] leading-relaxed text-secondary">Tasks completed across the company and your clients, day by day.</p>
      <div className="mt-6 flex flex-1 flex-col gap-6 sm:flex-row sm:items-end">
        <div className="flex shrink-0 flex-col gap-2 pb-1 sm:w-[200px]">
          <span className="text-[44px] leading-none font-medium tracking-[-0.03em] text-strong sm:text-[50px]">{headline}</span>
          <span className="max-w-[170px] text-[13px] leading-snug text-secondary">{caption}</span>
        </div>
        <ol aria-label="Tasks done per day" className="grid h-[280px] w-full grid-cols-7 gap-2 sm:h-[330px] sm:flex-1">
          {days.map((d, i) => {
            const isToday = d === today;
            const future = d > today;
            const count = perDay[i];
            const label = `${DAY_NAMES[i]}: ${future ? "still to come" : pluralize(count, "task") + " done"}`;
            return (
              <li key={d} tabIndex={0} aria-label={label} className={cx("group relative flex flex-col items-center justify-end rounded-full pb-2 outline-none", isToday && "bg-raised")}>
                {!future && (
                  <div className="relative flex w-full flex-1 flex-col items-center justify-end">
                    <span className="flex w-full flex-col items-center" style={{ height: height(count) }}>
                      <span
                        className={cx(
                          "mb-3 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-primary-on transition-opacity",
                          !isToday && "pointer-events-none absolute -translate-y-full opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                        )}
                      >
                        {count} done
                      </span>
                      <span className={cx("size-[10px] shrink-0 rounded-full", isToday ? "bg-strong ring-4 ring-strong/15" : "bg-[var(--chart-dot)] ring-4 ring-[var(--chart-dot)]/15")} />
                      <span className={cx("w-[2px] flex-1", isToday ? "bg-strong" : "bg-[var(--chart-line)]")} />
                    </span>
                  </div>
                )}
                <span
                  aria-hidden
                  className={cx(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    isToday ? "bg-primary text-primary-on" : future ? "bg-input text-faint" : "bg-input text-secondary"
                  )}
                >
                  {DAY_LETTERS[i]}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </BigCard>
  );
}

const TICKS = 15;
const STATUS_COLUMNS = [
  { status: "todo", label: "To do", fill: "bg-soft" },
  { status: "doing", label: "In progress", fill: "bg-accent" },
  { status: "done", label: "Done", fill: "bg-strong" },
];

/** To do / in progress / done counts as tick bars, and how much is done overall. */
function TaskStatus({ tasks, today }) {
  const counts = Object.fromEntries(STATUS_COLUMNS.map((c) => [c.status, tasks.filter((t) => t.status === c.status).length]));
  const total = tasks.length;
  const pct = total ? Math.round((counts.done / total) * 100) : 0;
  const projects = new Set(tasks.map((t) => t.projectId)).size;
  const date = parseDate(today).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <BigCard
      id="o-status"
      title="Task status"
      action={
        <Chip>
          <CalendarDays className="size-3.5 text-muted" aria-hidden />
          {date}
        </Chip>
      }
    >
      <dl className="mt-10 grid min-h-[280px] flex-1 grid-cols-3">
        {STATUS_COLUMNS.map((c) => {
          // Each column's ticks share the column's part of all tasks; anything at all shows at least one.
          const filled = counts[c.status] ? Math.max(1, Math.round((counts[c.status] / Math.max(total, 1)) * TICKS)) : 0;
          return (
            <div key={c.status} className="relative flex flex-col pl-3">
              {/* The column's left edge is its first tick, running the full height. */}
              <span aria-hidden className={cx("absolute inset-y-0 left-0 w-[2px] rounded-full", filled ? c.fill : "bg-dash")} />
              <dt className="text-[13px] text-secondary">{c.label}</dt>
              <dd className="mt-1 text-[32px] leading-tight font-normal text-strong tabular-nums">{counts[c.status]}</dd>
              <div aria-hidden className="mt-4 flex flex-1 justify-between pr-3">
                {Array.from({ length: TICKS - 1 }, (_, i) => (
                  <span key={i} className={cx("w-[2px] rounded-full", i + 1 < filled ? c.fill : "bg-dash")} />
                ))}
              </div>
            </div>
          );
        })}
      </dl>
      <div className="mt-8 flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[14px] text-secondary">Overall completion</span>
          <span className="text-[22px] font-medium text-strong tabular-nums">{pct}%</span>
        </div>
        <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Overall completion" className="h-2.5 overflow-hidden rounded-full bg-input">
          <div className="bar-stripes h-full rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[13px] text-muted">
          {counts.done} of {pluralize(total, "task")} done across {pluralize(projects, "project")}
        </span>
      </div>
    </BigCard>
  );
}

function MyTasksPanel() {
  const { data, currentUserId } = useWorkspace();
  const overlays = useOverlays();
  const { canCreate } = useTaskManagement();
  const mine = sortForList(data.tasks.filter((t) => isAssignedTo(t, currentUserId) && isOpenTask(t)));

  return (
    <Panel id="o-tasks" title="My tasks" action={<Button size="sm" variant="outline" href="/tasks">See all</Button>} bodyClassName="gap-2.5">
      {mine.length ? (
        mine.slice(0, 4).map((task) => <TaskTile key={task._id} task={task} />)
      ) : (
        <PanelEmpty
          action={
            canCreate && (
              <Button size="sm" variant="outline" icon={Plus} onClick={() => overlays.newTask()}>
                Add task
              </Button>
            )
          }
        >
          Nothing assigned to you right now. Tasks assigned to you show up here, most urgent first.
        </PanelEmpty>
      )}
    </Panel>
  );
}

const MEETING_RANGES = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "all", label: "All time" },
];

function MeetingsPanel({ projectIds }) {
  const { data, currentUserId, mode } = useWorkspace();
  const overlays = useOverlays();
  const [range, setRange] = usePersistentState(`overview-meetings:${currentUserId}:${mode}`, "all");
  const today = todayISO();
  const dayOf = (m) => todayISO(new Date(m.startsAt));
  const inRange = (m) => (range === "today" ? dayOf(m) === today : range === "week" ? isThisWeek(dayOf(m), today) : true);
  const meetings = data.meetings
    .filter((m) => !m.endedAt && dayOf(m) >= today && (m.attendeeIds.includes(currentUserId) || projectIds.has(m.projectId)) && inRange(m))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    <Panel
      id="o-meet"
      title="Meetings"
      action={
        <>
          <PillSelect label="Meetings to show" tone="outline" value={range} onChange={(e) => setRange(e.target.value)} options={MEETING_RANGES} className="h-9" />
          <Button size="sm" variant="outline" href="/meetings">
            See all
          </Button>
        </>
      }
      bodyClassName="gap-2.5"
    >
      {meetings.length === 0 && <p className="py-2 text-[13px] text-muted">{range === "today" ? "No meetings today." : range === "week" ? "No more meetings this week." : "No upcoming meetings."}</p>}
      {meetings.slice(0, 3).map((m) => (
        <div key={m._id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-raised px-4 py-3">
          <Link href={`/meetings/${m._id}`} className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
            <span className="truncate text-[15px] font-medium text-strong">{m.title}</span>
            <span className="truncate text-[13px] text-muted">
              <Countdown startsAt={m.startsAt} /> · {dayOf(m) === today ? "" : `${formatLongDate(dayOf(m))}, `}
              {formatTime(m.startsAt)}
              {m.callUrl && <span className="text-secondary"> · {shortLink(m.callUrl)}</span>}
            </span>
          </Link>
          {m.callUrl ? (
            <span className="flex items-center gap-2">
              <CopyLinkButton url={m.callUrl} />
              <Button size="sm" variant="primary" href={m.callUrl} target="_blank" rel="noopener noreferrer">
                Join
              </Button>
            </span>
          ) : (
            <Button size="sm" variant="outline" href={`/meetings/${m._id}`}>
              Open
            </Button>
          )}
        </div>
      ))}
      <Button variant="outline" icon={Plus} onClick={() => overlays.newMeeting()} className="mt-1 self-start">
        Schedule a meeting
      </Button>
    </Panel>
  );
}
