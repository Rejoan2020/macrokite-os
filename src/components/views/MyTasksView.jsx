"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { TaskTable } from "@/components/tasks/TaskRow";
import { FilterMenu } from "@/components/ui/FilterMenu";
import { Page, SearchField } from "@/components/ui/primitives";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, taskAssigneeIds, taskPriority } from "@/lib/constants";
import { isAssignedTo, matches, projectOwner, sortByPriority } from "@/lib/selectors";

/** Tasks assigned to you: open ones first, most urgent first; done ones last. */
export function MyTasksView() {
  const { data, lookup, currentUserId } = useWorkspace();
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState("");

  const mine = data.tasks.filter((t) => isAssignedTo(t, currentUserId));
  const shown = sortByPriority(
    mine.filter((t) => {
      const project = lookup.projects[t.projectId];
      return (
        (!projectId || t.projectId === projectId) &&
        (!priority || taskPriority(t) === priority) &&
        matches(query, t.title, project?.name, projectOwner(project, lookup.clients).label, ...taskAssigneeIds(t).map((id) => lookup.users[id]?.name))
      );
    })
  );
  const projectOptions = data.projects
    .filter((p) => !p.archived)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ value: p._id, label: p.name }));
  const priorityOptions = TASK_PRIORITIES.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p] }));

  return (
    <Page>
      <h1 className="text-[32px] leading-[1.1] font-normal tracking-[-0.035em] text-strong sm:text-[38px]">My tasks</h1>

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchField value={query} onChange={setQuery} placeholder="Search tasks, projects or people" className="flex-[1_1_260px]" />
        <FilterMenu label="Project" value={projectId} onChange={setProjectId} options={projectOptions} allLabel="All projects" />
        <FilterMenu label="Priority" value={priority} onChange={setPriority} options={priorityOptions} allLabel="Any" />
      </div>

      {shown.length ? (
        <TaskTable tasks={shown} />
      ) : (
        <div className="rounded-[18px] border-[1.5px] border-dashed border-dash bg-[var(--ghost)] px-[18px] py-[22px] text-[13px] text-secondary">
          {mine.length ? "No tasks match these filters." : "Nothing assigned to you yet."}
        </div>
      )}
    </Page>
  );
}
