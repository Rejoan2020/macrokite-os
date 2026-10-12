"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckSquare, Columns3, List, Plus } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { FilterSelect, SearchInput, Segmented } from "@/components/ui/form";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { TaskList } from "@/components/tasks/TaskList";
import { PRIORITIES, PRIORITY_META, TASK_STATUSES, TASK_STATUS_META, toOptions } from "@/lib/constants";
import { addDaysISO, isOverdue, matches, sortTasks, todayISO } from "@/lib/selectors";

const DUE_FILTERS = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "week", label: "Next 7 days" },
  { value: "none", label: "No due date" },
];

// Remount when the query string changes so URL filters (e.g. dashboard links) always apply.
export function MyTasksView() {
  const params = useSearchParams();
  return <MyTasksInner key={params.toString()} />;
}

function MyTasksInner() {
  const { data, members, lookup, currentUserId } = useWorkspace();
  const overlays = useOverlays();
  const params = useSearchParams();
  const initialAssignee = params.get("assignee");
  const [assignee, setAssignee] = useState(initialAssignee === "all" ? "all" : lookup.users[initialAssignee] || initialAssignee === "none" ? initialAssignee : currentUserId);
  const [status, setStatus] = useState(TASK_STATUSES.includes(params.get("status")) ? params.get("status") : "");
  const [due, setDue] = useState(DUE_FILTERS.some((d) => d.value === params.get("due")) ? params.get("due") : "");
  const [priority, setPriority] = useState("");
  const [projectId, setProjectId] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("due");
  const [view, setView] = useState("list");
  const [showDone, setShowDone] = useState(false);
  const today = todayISO();
  const week = addDaysISO(today, 7);

  const matchesDue = (t) => {
    if (due === "overdue") return isOverdue(t, today);
    if (due === "today") return t.dueDate === today;
    if (due === "week") return !!t.dueDate && t.dueDate >= today && t.dueDate <= week;
    if (due === "none") return !t.dueDate;
    return true;
  };

  const filtered = data.tasks.filter(
    (t) =>
      (assignee === "all" || (assignee === "none" ? !t.assigneeId : t.assigneeId === assignee)) &&
      (!status || t.status === status) &&
      (!priority || t.priority === priority) &&
      (!projectId || (projectId === "none" ? !t.projectId : t.projectId === projectId)) &&
      matchesDue(t) &&
      matches(query, t.title, t.description, t.labels, lookup.projects[t.projectId]?.name)
  );

  const open = sortTasks(filtered.filter((t) => t.status !== "done"), sort);
  const done = sortTasks(filtered.filter((t) => t.status === "done"), "updated");
  const groups =
    sort === "due"
      ? [
          { key: "overdue", label: "Overdue", tasks: open.filter((t) => isOverdue(t, today)) },
          { key: "today", label: "Today", tasks: open.filter((t) => t.dueDate === today) },
          { key: "week", label: "Next 7 days", tasks: open.filter((t) => t.dueDate > today && t.dueDate <= week) },
          { key: "later", label: "Later", tasks: open.filter((t) => t.dueDate > week) },
          { key: "none", label: "No due date", tasks: open.filter((t) => !t.dueDate) },
        ]
      : [{ key: "all", label: "Open", tasks: open }];

  const isMine = assignee === currentUserId;
  const assigneeOptions = [
    ...members.map((m) => ({ value: m.user._id, label: m.user._id === currentUserId ? `${m.user.name} (me)` : m.user.name })),
    { value: "none", label: "Unassigned" },
  ];
  const projectOptions = [...data.projects.map((p) => ({ value: p._id, label: p.name })), { value: "none", label: "No project" }];
  const filtersActive = status || due || priority || projectId || query;

  return (
    <>
      <PageHeader
        title={isMine ? "My Tasks" : "Tasks"}
        description={isMine ? `${open.length} open tasks assigned to you` : `${open.length} open tasks match the current filters`}
        actions={<Button variant="primary" icon={Plus} onClick={() => overlays.newTask({ assigneeId: assignee !== "all" && assignee !== "none" ? assignee : undefined })}>Add task</Button>}
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder="Search tasks…" className="w-full sm:w-64" label="Search tasks" />
          <label className="flex items-center">
            <select
              aria-label="Assignee"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="h-8 cursor-pointer rounded-md border border-border bg-surface px-2.5 text-xs text-fg hover:border-border-strong focus:border-accent focus:outline-none"
            >
              <option value="all">Assignee: Everyone</option>
              {assigneeOptions.map((o) => (
                <option key={o.value} value={o.value}>{`Assignee: ${o.label}`}</option>
              ))}
            </select>
          </label>
          <FilterSelect label="Due" value={due} onChange={setDue} options={DUE_FILTERS} allLabel="Any" />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={toOptions(TASK_STATUSES, TASK_STATUS_META)} />
          <FilterSelect label="Priority" value={priority} onChange={setPriority} options={toOptions(PRIORITIES, PRIORITY_META)} />
          <FilterSelect label="Project" value={projectId} onChange={setProjectId} options={projectOptions} />
          {filtersActive && (
            <Button size="sm" variant="ghost" onClick={() => { setStatus(""); setDue(""); setPriority(""); setProjectId(""); setQuery(""); }}>
              Clear
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Task view"
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: "List", icon: List },
              { value: "board", label: "Board", icon: Columns3 },
            ]}
          />
          {view === "list" && (
            <FilterSelect
              label="Sort"
              value={sort === "due" ? "" : sort}
              onChange={(v) => setSort(v || "due")}
              allLabel="Due date"
              options={[
                { value: "priority", label: "Priority" },
                { value: "updated", label: "Recently updated" },
              ]}
            />
          )}
        </div>
      </div>

      {!filtered.length ? (
        <Card>
          <EmptyState
            icon={CheckSquare}
            title={filtersActive ? "No tasks match these filters" : isMine ? "Nothing assigned to you" : "No tasks"}
            description={filtersActive ? "Try clearing some filters." : "Create a task or pick one up from a project board."}
            action={<Button size="sm" variant="primary" icon={Plus} onClick={() => overlays.newTask()}>Add task</Button>}
          />
        </Card>
      ) : view === "board" ? (
        <TaskBoard tasks={filtered} defaults={{ assigneeId: assignee !== "all" && assignee !== "none" ? assignee : undefined }} />
      ) : (
        <div className="flex flex-col gap-4">
          {open.length > 0 && (
            <Card className="overflow-hidden">
              {groups
                .filter((g) => g.tasks.length)
                .map((g) => (
                  <section key={g.key} aria-label={g.label}>
                    <h2 className={`border-b border-border bg-surface-2/50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${g.key === "overdue" ? "text-danger" : "text-muted"}`}>
                      {g.label} <span className="text-subtle">{g.tasks.length}</span>
                    </h2>
                    <TaskList tasks={g.tasks} showAssignee={!isMine} />
                  </section>
                ))}
            </Card>
          )}
          {!open.length && <Card><EmptyState icon={CheckSquare} title="No open tasks" description="Everything here is done." compact /></Card>}
          {done.length > 0 && (
            <Card className="overflow-hidden">
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-medium text-muted hover:text-fg"
              >
                Completed ({done.length})
                <span className="text-subtle">{showDone ? "Hide" : "Show"}</span>
              </button>
              {showDone && (
                <div className="border-t border-border">
                  <TaskList tasks={done} showAssignee={!isMine} />
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </>
  );
}
