"use client";

import Link from "next/link";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { useAction } from "@/lib/client/useAction";
import { Avatar, cx, PriorityIcon } from "@/components/ui/primitives";
import { TASK_STATUSES, TASK_STATUS_META } from "@/lib/constants";
import { isOverdue, todayISO } from "@/lib/selectors";
import { dueLabel, formatShortDate } from "@/lib/format";

/** Dense, keyboard-friendly task rows with inline status changes. */
export function TaskList({ tasks, showProject = true, showAssignee = true }) {
  const { lookup } = useWorkspace();
  const overlays = useOverlays();
  const { run } = useAction();
  const today = todayISO();

  return (
    <ul className="divide-y divide-border">
      {tasks.map((task) => {
        const project = task.projectId ? lookup.projects[task.projectId] : null;
        const overdue = isOverdue(task, today);
        const done = task.status === "done";
        return (
          <li key={task._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/60">
            <input
              type="checkbox"
              checked={done}
              onChange={() =>
                run({ type: "task.move", id: task._id, data: { status: done ? "todo" : "done" } }, { success: done ? "Task reopened" : "Task completed" })
              }
              aria-label={done ? `Reopen “${task.title}”` : `Complete “${task.title}”`}
              className="size-4 shrink-0 cursor-pointer rounded accent-[var(--accent)]"
            />
            <PriorityIcon priority={task.priority} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => overlays.openTask(task._id)}
                className={cx("block max-w-full truncate text-left text-[13px] hover:text-accent", done ? "text-muted line-through" : "text-fg")}
              >
                {task.title}
              </button>
              {showProject && (
                <p className="truncate text-[11px] text-subtle">
                  {project ? (
                    <Link href={`/projects/${project._id}`} className="hover:text-muted">
                      {project.name}
                    </Link>
                  ) : (
                    "No project"
                  )}
                  {task.labels?.length > 0 && <span className="hidden sm:inline"> · {task.labels.join(", ")}</span>}
                </p>
              )}
            </div>
            <span
              className={cx("hidden w-28 shrink-0 text-right text-xs sm:block", overdue ? "font-medium text-danger" : "text-muted")}
              title={task.dueDate ? dueLabel(task.dueDate, today) : undefined}
            >
              {task.dueDate ? (overdue ? dueLabel(task.dueDate, today) : formatShortDate(task.dueDate)) : "—"}
            </span>
            <select
              aria-label={`Status of “${task.title}”`}
              value={task.status}
              onChange={(e) => run({ type: "task.move", id: task._id, data: { status: e.target.value } }, { success: `Moved to ${TASK_STATUS_META[e.target.value].label}` })}
              className="h-7 w-[104px] shrink-0 cursor-pointer rounded-md border border-border bg-surface px-1.5 text-xs text-muted hover:border-border-strong focus:border-accent focus:outline-none"
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_META[s].label}
                </option>
              ))}
            </select>
            {showAssignee && <Avatar user={task.assigneeId ? lookup.users[task.assigneeId] : null} size="sm" />}
          </li>
        );
      })}
    </ul>
  );
}
