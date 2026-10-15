"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { PRIORITY_DOT, TaskListHead, TaskRow } from "@/components/tasks/TaskRow";
import { FilterMenu } from "@/components/ui/FilterMenu";
import { Button, cx, EmptyNote, Page, PageHeader, SearchField, Summary } from "@/components/ui/primitives";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, taskPriority } from "@/lib/constants";
import { pluralize, todayISO } from "@/lib/format";
import { completedThisWeek, groupMyTasks, isOpenTask, isOverdue, matches } from "@/lib/selectors";

const GROUPS = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "later", label: "Later" },
  { key: "none", label: "No due date" },
];

/** Summary tiles. Each counts your open tasks and, clicked, narrows the list to them. */
const TILES = [
  { key: "overdue", label: "Overdue", test: (t, today) => isOverdue(t, today), tone: "danger" },
  { key: "todo", label: "To do", test: (t) => t.status === "todo" },
  { key: "doing", label: "In progress", test: (t) => t.status === "doing" },
];

function Tile({ label, count, active, tone, onClick }) {
  const alert = tone === "danger" && count > 0;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "flex min-w-0 flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-colors",
        active ? "border-accent bg-accent-tint" : alert ? "border-danger-outline bg-card hover:border-danger-line" : "border-line bg-card hover:border-dash hover:bg-hover/40"
      )}
    >
      <span className={cx("text-2xl leading-none font-semibold tabular-nums", alert ? "text-danger" : active ? "text-accent-light" : "text-strong")}>{count}</span>
      <span className={cx("text-[12px]", active ? "text-accent-light" : "text-muted")}>{label}</span>
    </button>
  );
}

/** Tasks assigned to you. The Who column shows who assigned each one. */
export function MyTasksView() {
  const { data, lookup, currentUserId } = useWorkspace();
  const overlays = useOverlays();
  const [focus, setFocus] = useState(null); // a TILES key, or null for everything open
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const today = todayISO();

  const mine = data.tasks.filter((t) => t.assigneeId === currentUserId);
  const open = mine.filter(isOpenTask);
  const counts = Object.fromEntries(TILES.map((tile) => [tile.key, open.filter((t) => tile.test(t, today)).length]));

  const filtered = (tasks) =>
    tasks.filter(
      (t) =>
        (!projectId || t.projectId === projectId) &&
        (!priority || taskPriority(t) === priority) &&
        matches(query, t.title, t.description, lookup.projects[t.projectId]?.name, lookup.users[t.createdBy]?.name)
    );
  const tile = TILES.find((x) => x.key === focus);
  const visibleOpen = filtered(tile ? open.filter((t) => tile.test(t, today)) : open);
  const groups = groupMyTasks(visibleOpen, today);
  const completed = filtered(completedThisWeek(mine, today));
  const filtersOn = Boolean(focus || query || projectId || priority);

  const projectOptions = [...new Set(mine.map((t) => t.projectId))]
    .map((id) => lookup.projects[id])
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ value: p._id, label: p.name, count: open.filter((t) => t.projectId === p._id).length }));
  const priorityOptions = TASK_PRIORITIES.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p], dot: PRIORITY_DOT[p], count: open.filter((t) => taskPriority(t) === p).length }));

  const clearFilters = () => {
    setFocus(null);
    setQuery("");
    setProjectId("");
    setPriority("");
  };

  const emptyText = filtersOn ? "No open tasks match these filters." : open.length ? "" : mine.length ? "Nothing open. Nice work." : "Nothing assigned to you yet.";

  return (
    <Page width="lg" className="gap-6">
      <PageHeader
        title="My tasks"
        summary={
          <Summary
            parts={[
              `${open.length} open`,
              counts.overdue > 0 && <span className="text-danger">{counts.overdue} overdue</span>,
              counts.doing > 0 && `${counts.doing} in progress`,
            ]}
          />
        }
        actions={
          <Button variant="primary" icon={Plus} onClick={() => overlays.newTask()}>
            Add task
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-2.5" aria-label="Filter by">
        {TILES.map((t) => (
          <Tile key={t.key} label={t.label} count={counts[t.key]} tone={t.tone} active={focus === t.key} onClick={() => setFocus(focus === t.key ? null : t.key)} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchField value={query} onChange={setQuery} placeholder="Search tasks, projects or people" className="flex-[1_1_260px]" />
        <FilterMenu label="Project" value={projectId} onChange={setProjectId} options={projectOptions} allLabel="All projects" />
        <FilterMenu label="Priority" value={priority} onChange={setPriority} options={priorityOptions} allLabel="Any" />
        {filtersOn && (
          <button type="button" onClick={clearFilters} className="h-11 px-2 text-[13px] text-accent hover:text-accent-light">
            Clear filters
          </button>
        )}
      </div>

      {visibleOpen.length ? (
        // px-px lines the headings up with rows inside the 1px-bordered cards below.
        <TaskListHead className="-mb-3 px-px" />
      ) : (
        emptyText && <EmptyNote>{emptyText}</EmptyNote>
      )}

      {GROUPS.filter((g) => groups[g.key].length).map((g) => (
        <section
          key={g.key}
          aria-labelledby={`g-${g.key}`}
          className={cx("flex flex-col overflow-hidden rounded-xl border bg-card", g.key === "overdue" ? "border-danger-outline" : "border-line")}
        >
          <h2 id={`g-${g.key}`} className={cx("label-caps border-b border-line px-[18px] py-3", g.key === "overdue" ? "text-danger" : "text-secondary")}>
            {g.label} · {groups[g.key].length}
          </h2>
          {groups[g.key].map((t) => (
            <TaskRow key={t._id} task={t} who="assigner" />
          ))}
        </section>
      ))}

      {completed.length > 0 && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            aria-expanded={showCompleted}
            onClick={() => setShowCompleted((v) => !v)}
            className="flex h-12 items-center justify-between rounded-xl border border-dashed border-dash px-[18px] font-medium text-muted hover:text-fg"
          >
            {pluralize(completed.length, "task")} done this week
            <span className="text-accent">{showCompleted ? "Hide" : "Show"}</span>
          </button>
          {showCompleted && (
            <div className="overflow-hidden rounded-xl border border-line bg-card">
              {completed.map((t) => (
                <TaskRow key={t._id} task={t} who="assigner" />
              ))}
            </div>
          )}
        </div>
      )}
    </Page>
  );
}
