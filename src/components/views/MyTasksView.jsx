"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { TaskRow } from "@/components/tasks/TaskRow";
import { Button, cx, EmptyNote, Page, PageHeader, SearchField, Summary } from "@/components/ui/primitives";
import { completedThisWeek, groupMyTasks, isOpenTask, matches } from "@/lib/selectors";
import { todayISO } from "@/lib/format";

const GROUPS = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "later", label: "Later" },
  { key: "none", label: "No due date" },
];

export function MyTasksView() {
  const { data, lookup, currentUserId } = useWorkspace();
  const overlays = useOverlays();
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const today = todayISO();

  const mine = data.tasks.filter((t) => t.assigneeId === currentUserId);
  const open = mine.filter(isOpenTask);
  const all = groupMyTasks(mine, today);
  const visible = mine.filter((t) => (!projectId || t.projectId === projectId) && matches(query, t.title, lookup.projects[t.projectId]?.name));
  const groups = groupMyTasks(visible, today);
  const completed = completedThisWeek(visible, today);
  const projectOptions = [...new Set(open.map((t) => t.projectId))].map((id) => lookup.projects[id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  const nothingShown = GROUPS.every((g) => !groups[g.key].length);

  return (
    <Page width="md" className="gap-7">
      <PageHeader
        title="My tasks"
        summary={
          <Summary
            parts={[
              `${open.length} open`,
              all.overdue.length > 0 && <span className="text-danger">{all.overdue.length} overdue</span>,
              all.today.length > 0 && `${all.today.length} due today`,
            ]}
          />
        }
        actions={
          <Button variant="primary" icon={Plus} onClick={() => overlays.newTask()}>
            Add task
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2.5">
        <SearchField value={query} onChange={setQuery} placeholder="Search tasks" className="flex-[1_1_260px]" />
        <label className="flex h-11 items-center gap-2 rounded-lg border border-line bg-card px-3 text-muted">
          Project
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="max-w-56 cursor-pointer bg-transparent font-medium text-fg outline-none">
            <option value="">All projects</option>
            {projectOptions.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {nothingShown && <EmptyNote>{open.length ? "No open tasks match." : "You’re all caught up."}</EmptyNote>}

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
            <TaskRow key={t._id} task={t} />
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
            Completed this week · {completed.length}
            <span className="text-accent">{showCompleted ? "Hide" : "Show"}</span>
          </button>
          {showCompleted && (
            <div className="overflow-hidden rounded-xl border border-line bg-card">
              {completed.map((t) => (
                <TaskRow key={t._id} task={t} />
              ))}
            </div>
          )}
        </div>
      )}
    </Page>
  );
}
