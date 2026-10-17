"use client";

import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { TaskTile } from "@/components/tasks/TaskRow";
import { useTaskManagement } from "@/components/tasks/taskHooks";
import { Countdown, CopyLinkButton, shortLink } from "@/components/meetings/MeetingBits";
import { Button, Chevron, cx } from "@/components/ui/primitives";
import { OptionMenu } from "@/components/ui/Menus";
import { usePersistentState } from "@/lib/client/usePersistentState";
import { addDaysISO, firstName, formatLongDate, formatTime, greeting, parseDate, pluralize, todayISO } from "@/lib/format";
import { isAssignedTo, isOpenTask, isThisWeek, sortByPriority } from "@/lib/selectors";

/**
 * The Overview fills the screen height: the two headline cards take the spare space, the lists
 * below take the rest, and the page ends level with the sidebar.
 */
export function OverviewView() {
  const { data, currentUser, currentUserId } = useWorkspace();
  const today = todayISO();

  // "Across the company and your clients": every live project you're on.
  const myProjectIds = new Set(data.projects.filter((p) => !p.archived && p.memberIds.includes(currentUserId)).map((p) => p._id));
  const scope = data.tasks.filter((t) => myProjectIds.has(t.projectId));

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col px-4 pt-6 pb-4 sm:px-8 lg:min-h-dvh lg:pt-9 lg:pb-[14px]">
      <div className="mb-2.5 text-[13px] font-medium text-faint">{formatLongDate(today)}</div>
      <h1 className="text-[32px] leading-[1.1] font-medium tracking-[-0.045em] text-strong">
        {greeting()}, {firstName(currentUser.name)}
      </h1>

      <div className="mt-8 mb-[14px] grid flex-[1.5_0_auto] grid-cols-1 gap-[14px] xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <WeeklyProgress tasks={scope} today={today} />
        <TaskStatus tasks={scope} />
      </div>

      <div className="grid flex-[1_0_auto] grid-cols-1 items-stretch gap-[14px] lg:grid-cols-2">
        <MyTasksPanel />
        <MeetingsPanel projectIds={myProjectIds} />
      </div>
    </div>
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

/** A static outlined pill, like "This week" or today's date in a card header. */
const PillStatic = ({ children }) => (
  <span className="inline-flex h-[34px] shrink-0 items-center gap-[7px] rounded-full border border-line px-3.5 text-xs font-medium whitespace-nowrap text-secondary">{children}</span>
);

// The two headline cards keep the browser's default heading margin (0.83em), as the prototype does.
const CardTitle = ({ id, children, headline }) => (
  <h2 id={id} className={cx("text-xl font-medium tracking-[-0.02em] whitespace-nowrap text-strong", headline && "my-[0.83em]")}>
    {children}
  </h2>
);

/** Tasks finished each day this week, against last week's total. */
function WeeklyProgress({ tasks, today }) {
  const days = weekDays(today);
  const lastWeek = weekDays(addDaysISO(today, -7));
  const perDay = days.map((d) => doneOn(tasks, [d]).length);
  const total = perDay.reduce((a, b) => a + b, 0);
  const before = doneOn(tasks, lastWeek).length;
  const max = Math.max(1, ...perDay);
  const change = before ? Math.round(((total - before) / before) * 100) : null;
  const headline = change === null ? String(total) : `${change >= 0 ? "+" : ""}${change}%`;
  const caption =
    change === null
      ? "Tasks completed this week across the company and clients."
      : `${pluralize(total, "task")} done this week, ${change >= 0 ? "up" : "down"} from ${before} last week.`;

  return (
    <section aria-labelledby="o-week" className="flex min-w-0 flex-col rounded-[24px] border border-card-line bg-card px-7 py-[26px]">
      <div className="flex items-center justify-between gap-3">
        <CardTitle id="o-week" headline>
          Weekly progress
        </CardTitle>
        <PillStatic>This week</PillStatic>
      </div>
      <p className="mt-2 max-w-[360px] text-[13px] leading-[19px] text-secondary">Tasks completed across the company and your clients, day by day.</p>
      <div className="mt-2 grid min-h-[230px] flex-1 grid-cols-1 items-end gap-5 sm:grid-cols-[170px_minmax(0,1fr)]">
        <div>
          <div className="text-[46px] leading-none font-normal tracking-[-0.05em] text-strong">{headline}</div>
          <div className="mt-3 text-xs leading-[18px] text-secondary">{caption}</div>
        </div>
        <ol aria-label="Tasks done per day" className="grid h-full min-h-[230px] grid-cols-7 gap-1.5">
          {days.map((d, i) => {
            const isToday = d === today;
            const future = d > today;
            const count = perDay[i];
            return (
              <li
                key={d}
                tabIndex={0}
                aria-label={`${DAY_NAMES[i]}: ${future ? "still to come" : pluralize(count, "task") + " done"}`}
                className={cx("group relative flex flex-col items-center rounded-full pt-3 pb-2 outline-none", isToday && "lolli-today")}
              >
                <div className="flex w-full flex-1 items-end justify-center pb-2">
                  {!future && (
                    // Stems never start at zero height, so a quiet day still reads as a day.
                    <div className="lolli-stem relative w-[1.5px] rounded-sm" style={{ height: `${12 + 78 * (count / max)}%`, animationDelay: `${i * 0.04}s` }}>
                      <span
                        className={cx(
                          "absolute -top-[5px] left-1/2 -ml-[5px] size-2.5 rounded-full",
                          isToday ? "bg-primary shadow-[0_0_0_4px_var(--ring)]" : "bg-[var(--chart-dot)] shadow-[0_0_0_4px_var(--chart-halo)]"
                        )}
                      />
                      <span
                        className={cx(
                          "pointer-events-none absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-[5px] text-[11px] font-semibold whitespace-nowrap text-primary-on transition-opacity",
                          isToday ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                        )}
                      >
                        {count} done
                      </span>
                    </div>
                  )}
                </div>
                <span
                  aria-hidden
                  className={cx(
                    "grid aspect-square w-[min(32px,100%)] shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                    isToday ? "bg-primary text-primary-on" : future ? "border border-dashed border-line text-faint" : "bg-selected text-secondary"
                  )}
                >
                  {DAY_LETTERS[i]}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

const TICKS = 14;
const STATUS_COLUMNS = [
  { status: "todo", label: "To do", edge: "border-todo", on: "bg-todo" },
  { status: "doing", label: "In progress", edge: "border-accent", on: "bg-accent" },
  { status: "done", label: "Done", edge: "border-primary", on: "bg-primary" },
];

/** To do / in progress / done counts as tick bars, and how much is done overall. */
function TaskStatus({ tasks }) {
  const counts = Object.fromEntries(STATUS_COLUMNS.map((c) => [c.status, tasks.filter((t) => t.status === c.status).length]));
  const total = tasks.length;
  const pct = total ? Math.round((counts.done / total) * 100) : 0;
  const projects = new Set(tasks.map((t) => t.projectId)).size;
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <section aria-labelledby="o-status" className="flex min-w-0 flex-col rounded-[24px] border border-card-line bg-card px-[26px] pt-[26px] pb-6">
      <div className="flex items-center justify-between gap-3">
        <CardTitle id="o-status" headline>
          Task status
        </CardTitle>
        <PillStatic>
          <CalendarDays className="size-[13px]" strokeWidth={2} aria-hidden />
          {date}
        </PillStatic>
      </div>
      <dl className="mt-[26px] grid flex-1 grid-cols-3 gap-[14px]">
        {STATUS_COLUMNS.map((c) => {
          // Each column's ticks show that status's share of all tasks.
          const on = total ? Math.round((counts[c.status] / total) * TICKS) : 0;
          return (
            <div key={c.status} className={cx("flex flex-col border-l-[1.5px] pl-3", c.edge)}>
              <dt className="text-xs text-secondary">{c.label}</dt>
              <dd className="mt-1.5 mb-[14px] text-[30px] leading-none font-normal tracking-[-0.04em] text-strong tabular-nums">{counts[c.status]}</dd>
              <div aria-hidden className="flex max-h-[220px] min-h-9 flex-1 justify-between">
                {Array.from({ length: TICKS }, (_, i) => (
                  <i key={i} className={cx("w-[2px] rounded-sm", i < on ? c.on : "bg-selected")} />
                ))}
              </div>
            </div>
          );
        })}
      </dl>
      <div className="mt-auto pt-[22px]">
        <div className="mb-2.5 flex items-baseline justify-between text-[13px] text-secondary">
          <span>Overall completion</span>
          <b className="text-xl font-medium tracking-[-0.02em] text-strong">{pct}%</b>
        </div>
        <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Overall completion" className="h-2.5 overflow-hidden rounded-full bg-selected">
          <span className="bar-stripes block h-full rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2.5 text-xs text-faint">
          {counts.done} of {pluralize(total, "task")} done across {pluralize(projects, "project")}
        </div>
      </div>
    </section>
  );
}

/** A list card under the headline cards: My tasks and Meetings. */
function ListCard({ id, title, action, children }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col rounded-[24px] border border-card-line bg-card px-6 pt-[22px] pb-6">
      <div className="mb-[18px] flex items-center justify-between gap-3">
        <CardTitle id={id}>{title}</CardTitle>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

/** A dashed placeholder row in a list card. */
const EmptyItem = ({ title, children }) => (
  <div className="flex flex-col gap-[3px] rounded-2xl border-[1.5px] border-dashed border-dash px-4 py-3.5">
    <span className="text-sm font-medium text-strong">{title}</span>
    <span className="text-xs text-faint">{children}</span>
  </div>
);

const smallButton = "h-[34px] px-3.5";

function MyTasksPanel() {
  const { data, currentUserId } = useWorkspace();
  const overlays = useOverlays();
  const { canCreate } = useTaskManagement();
  // Open tasks assigned to you, most urgent first.
  const mine = sortByPriority(data.tasks.filter((t) => isAssignedTo(t, currentUserId) && isOpenTask(t)));

  return (
    <ListCard id="o-tasks" title="My tasks" action={<Button href="/tasks" className={smallButton}>See all</Button>}>
      {mine.length ? (
        mine.slice(0, 4).map((task) => <TaskTile key={task._id} task={task} />)
      ) : (
        <>
          <EmptyItem title="Nothing assigned to you">Tasks assigned to you show up here, most urgent first.</EmptyItem>
          {canCreate && (
            <Button icon={Plus} onClick={() => overlays.newTask()} className="mt-1.5 self-start">
              Add task
            </Button>
          )}
        </>
      )}
    </ListCard>
  );
}

const MEETING_RANGES = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
];

function MeetingsPanel({ projectIds }) {
  const { data, currentUserId } = useWorkspace();
  const overlays = useOverlays();
  const [saved, setRange] = usePersistentState(`overview-meetings:${currentUserId}`, "today");
  const range = MEETING_RANGES.some((r) => r.value === saved) ? saved : "today";
  const today = todayISO();
  const dayOf = (m) => todayISO(new Date(m.startsAt));
  const inRange = (m) => {
    const day = dayOf(m);
    if (range === "today") return day === today;
    if (range === "week") return isThisWeek(day, today);
    if (range === "month") return day.slice(0, 7) === today.slice(0, 7);
    if (range === "year") return day.slice(0, 4) === today.slice(0, 4);
    return true;
  };
  const meetings = data.meetings
    .filter((m) => !m.endedAt && dayOf(m) >= today && (m.attendeeIds.includes(currentUserId) || projectIds.has(m.projectId)) && inRange(m))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const label = MEETING_RANGES.find((r) => r.value === range).label;

  return (
    <ListCard
      id="o-meet"
      title="Meetings"
      action={
        <>
          <OptionMenu
            label="Meetings to show"
            value={range}
            options={MEETING_RANGES}
            onChange={setRange}
            minWidth={150}
            buttonClassName="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-line bg-card pr-3 pl-3.5 text-[13px] font-medium text-fg transition-colors hover:bg-hover"
            trigger={({ current }) => (
              <>
                {current.label}
                <Chevron />
              </>
            )}
          />
          <Button href="/meetings" className={smallButton}>
            See all
          </Button>
        </>
      }
    >
      {meetings.length === 0 && <EmptyItem title={range === "all" ? "No meetings yet" : `No meetings ${label.toLowerCase()}`}>Your calendar is clear.</EmptyItem>}
      {meetings.slice(0, 4).map((m) => (
        <div key={m._id} className="flex items-center gap-3.5 rounded-2xl bg-raised py-3.5 pr-3.5 pl-4">
          <Link href={`/meetings/${m._id}`} className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="truncate text-sm font-medium text-strong">{m.title}</span>
            <span className="truncate text-xs text-faint">
              <Countdown startsAt={m.startsAt} className="text-xs" /> · {dayOf(m) === today ? "" : `${formatLongDate(dayOf(m))} · `}
              {formatTime(m.startsAt)}
              {m.callUrl && <span className="text-secondary"> · {shortLink(m.callUrl)}</span>}
            </span>
          </Link>
          {m.callUrl && (
            <span className="flex shrink-0 items-center gap-2">
              <CopyLinkButton url={m.callUrl} compact />
              <Button variant="primary" size="sm" href={m.callUrl} target="_blank" rel="noopener noreferrer" className="h-9 px-4 text-[13px]">
                Join
              </Button>
            </span>
          )}
        </div>
      ))}
      <Button icon={Plus} onClick={() => overlays.newMeeting()} className="mt-1.5 self-start">
        Schedule a meeting
      </Button>
    </ListCard>
  );
}
