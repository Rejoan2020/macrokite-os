"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { TaskTable } from "@/components/tasks/TaskRow";
import { useTaskManagement } from "@/components/tasks/taskHooks";
import { FilterMenu } from "@/components/ui/FilterMenu";
import { Button, EmptyNote, Page, PageHeader, SearchField } from "@/components/ui/primitives";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, taskAssigneeIds, taskPriority } from "@/lib/constants";
import { isAssignedTo, isOpenTask, matches, projectOwner, sortForList } from "@/lib/selectors";

const PRIORITY_DOTS = { urgent: "bg-danger", high: "bg-warning-strong", medium: "bg-info", low: "bg-muted" };

/** Tasks assigned to you: open ones first (in progress, then to do, by due date), done ones after. */
export function MyTasksView() {
  const { data, lookup, currentUserId } = useWorkspace();
  const overlays = useOverlays();
  const { canCreate } = useTaskManagement();
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState("");

  const mine = data.tasks.filter((t) => isAssignedTo(t, currentUserId));
  const open = mine.filter(isOpenTask);
  const shown = sortForList(
    mine.filter((t) => {
      const project = lookup.projects[t.projectId];
      return (
        (!projectId || t.projectId === projectId) &&
        (!priority || taskPriority(t) === priority) &&
        matches(query, t.title, t.description, project?.name, projectOwner(project, lookup.clients).label, ...taskAssigneeIds(t).map((id) => lookup.users[id]?.name))
      );
    })
  );
  const filtersOn = Boolean(query || projectId || priority);

  const projectOptions = [...new Set(mine.map((t) => t.projectId))]
    .map((id) => lookup.projects[id])
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ value: p._id, label: p.name, count: open.filter((t) => t.projectId === p._id).length }));
  const priorityOptions = TASK_PRIORITIES.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p], dot: PRIORITY_DOTS[p], count: open.filter((t) => taskPriority(t) === p).length }));

  const clearFilters = () => {
    setQuery("");
    setProjectId("");
    setPriority("");
  };

  return (
    <Page>
      <PageHeader
        title="My tasks"
        actions={
          canCreate && (
            <Button variant="primary" icon={Plus} onClick={() => overlays.newTask()}>
              Add task
            </Button>
          )
        }
      />

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

      {shown.length ? <TaskTable tasks={shown} /> : <EmptyNote>{filtersOn ? "No tasks match these filters." : "Nothing assigned to you yet."}</EmptyNote>}
    </Page>
  );
}
