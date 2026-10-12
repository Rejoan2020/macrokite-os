"use client";

import { useState } from "react";
import { ArrowRightLeft, CalendarDays, Plus } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { useAction } from "@/lib/client/useAction";
import { Avatar, cx, PriorityIcon } from "@/components/ui/primitives";
import { TASK_STATUSES, TASK_STATUS_META } from "@/lib/constants";
import { groupTasksByStatus, isOverdue, todayISO } from "@/lib/selectors";
import { formatShortDate } from "@/lib/format";

export function TaskBoard({ tasks, showProject = true, defaults = {} }) {
  const overlays = useOverlays();
  const { run } = useAction();
  const groups = groupTasksByStatus(tasks);
  const [dragId, setDragId] = useState(null);
  const [target, setTarget] = useState(null); // { status, beforeId }

  const move = (id, status, beforeId = null) => {
    const task = tasks.find((t) => t._id === id);
    if (!task || (task.status === status && !beforeId)) return;
    run({ type: "task.move", id, data: { status, beforeId } }, task.status !== status ? { success: `Moved to ${TASK_STATUS_META[status].label}` } : {});
  };

  const onDrop = (status) => (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/task-id") || dragId;
    const beforeId = target?.status === status ? target.beforeId : null;
    setDragId(null);
    setTarget(null);
    if (id && id !== beforeId) move(id, status, beforeId);
  };

  return (
    <div>
      <p className="mb-3 text-xs text-subtle">
        Drag cards between columns, or use the <ArrowRightLeft className="inline size-3 align-[-2px]" aria-label="move" /> selector on a card.
      </p>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {TASK_STATUSES.map((status) => {
          const column = groups[status];
          const isTarget = dragId && target?.status === status;
          return (
            <section
              key={status}
              aria-label={`${TASK_STATUS_META[status].label} column`}
              onDragOver={(e) => {
                e.preventDefault();
                if (target?.status !== status) setTarget({ status, beforeId: null });
              }}
              onDrop={onDrop(status)}
              className={cx(
                "flex w-[264px] shrink-0 snap-start flex-col rounded-xl border bg-surface/50 transition-colors xl:w-auto xl:min-w-[200px] xl:flex-1 xl:shrink",
                isTarget ? "border-accent/50 bg-accent-soft" : "border-border"
              )}
            >
              <header className="flex items-center gap-2 px-3 py-2.5">
                <span className={cx(`dot-${TASK_STATUS_META[status].tone}`, "size-2 rounded-full")} aria-hidden />
                <h3 className="text-xs font-semibold text-fg">{TASK_STATUS_META[status].label}</h3>
                <span className="text-xs tabular-nums text-subtle">{column.length}</span>
                <button
                  type="button"
                  onClick={() => overlays.newTask({ ...defaults, status })}
                  aria-label={`Add task to ${TASK_STATUS_META[status].label}`}
                  className="ml-auto rounded p-1 text-subtle hover:bg-surface-3 hover:text-fg"
                >
                  <Plus className="size-3.5" />
                </button>
              </header>
              <ol className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
                {column.map((task) => (
                  <li
                    key={task._id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/task-id", task._id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragId(task._id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setTarget(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (target?.beforeId !== task._id) setTarget({ status, beforeId: task._id });
                    }}
                    className={cx(
                      "relative",
                      dragId === task._id && "opacity-40",
                      dragId && target?.beforeId === task._id && "before:absolute before:-top-1.5 before:inset-x-1 before:h-0.5 before:rounded before:bg-accent"
                    )}
                  >
                    <TaskCard task={task} showProject={showProject} onMove={(s) => move(task._id, s)} />
                  </li>
                ))}
                {!column.length && (
                  <li className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-subtle">
                    {dragId ? "Drop here" : "No tasks"}
                  </li>
                )}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function TaskCard({ task, showProject, onMove }) {
  const { lookup } = useWorkspace();
  const overlays = useOverlays();
  const project = task.projectId ? lookup.projects[task.projectId] : null;
  const assignee = task.assigneeId ? lookup.users[task.assigneeId] : null;
  const overdue = isOverdue(task, todayISO());

  return (
    <article className="group rounded-lg border border-border bg-surface p-3 shadow-card transition-colors hover:border-border-strong">
      <button
        type="button"
        onClick={() => overlays.openTask(task._id)}
        className="block w-full text-left text-[13px] font-medium leading-snug text-fg hover:text-accent focus-visible:text-accent"
      >
        <span className={cx(task.status === "done" && "text-muted line-through decoration-subtle")}>{task.title}</span>
      </button>
      {showProject && project && <p className="mt-1 truncate text-[11px] text-subtle">{project.name}</p>}
      {task.labels?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.slice(0, 3).map((label) => (
            <span key={label} className="tone-slate rounded px-1.5 py-px text-[10px]">
              {label}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2">
        <PriorityIcon priority={task.priority} />
        {task.dueDate && (
          <span className={cx("inline-flex items-center gap-1 text-[11px]", overdue ? "text-danger font-medium" : "text-muted")}>
            <CalendarDays className="size-3" aria-hidden />
            {formatShortDate(task.dueDate)}
            {overdue && <span className="sr-only">(overdue)</span>}
          </span>
        )}
        <label className="relative ml-auto inline-flex items-center text-subtle hover:text-fg" title="Move to status">
          <ArrowRightLeft className="pointer-events-none absolute left-1.5 size-3" aria-hidden />
          <select
            aria-label={`Move “${task.title}” to status`}
            value={task.status}
            onChange={(e) => onMove(e.target.value)}
            className="h-6 w-6 cursor-pointer appearance-none rounded border border-transparent bg-transparent text-transparent hover:border-border focus:border-accent focus:outline-none"
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s} className="bg-surface text-fg">
                {TASK_STATUS_META[s].label}
              </option>
            ))}
          </select>
        </label>
        <Avatar user={assignee} size="xs" />
      </div>
    </article>
  );
}
