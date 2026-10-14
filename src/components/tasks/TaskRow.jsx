"use client";

import Link from "next/link";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { useAction } from "@/lib/client/useAction";
import { Checkbox, cx, DoingPill } from "@/components/ui/primitives";
import { phaseLabel } from "@/lib/constants";
import { firstName, formatDue, formatShortDate, todayISO } from "@/lib/format";
import { isOverdue } from "@/lib/selectors";

/**
 * One task: checkbox · title (+ Doing) · meta · assignee · due.
 * `meta` picks the second line: "project" (Project · Phase), "source" (from meeting) or both.
 */
export function TaskRow({ task, meta = "full", showAssignee = false, overdueLabel = false, className }) {
  const { lookup } = useWorkspace();
  const overlays = useOverlays();
  const { run } = useAction();
  const today = todayISO();
  const done = task.status === "done";
  const overdue = isOverdue(task, today);
  const project = lookup.projects[task.projectId];
  const meeting = task.meetingId ? lookup.meetings[task.meetingId] : null;

  const toggle = (e) => run({ type: "task.toggle", id: task._id, data: { done: e.target.checked } }, { success: e.target.checked ? "Task done" : undefined });

  const metaParts = [];
  if (meta !== "source" && project) metaParts.push(`${project.name} · ${phaseLabel(task.phase)}`);
  const source = meeting && (
    <Link href={`/meetings/${meeting._id}`} className="text-accent hover:text-accent-light">
      from {meeting.title}, {formatShortDate(meeting.startsAt.slice(0, 10))}
    </Link>
  );

  return (
    <div className={cx("flex items-center gap-3.5 border-b border-row px-[18px] py-3.5 last:border-b-0", className)}>
      <Checkbox checked={done} onChange={toggle} aria-label={`${done ? "Mark not done" : "Mark done"}: ${task.title}`} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => overlays.editTask(task._id)}
            className={cx("min-w-0 text-left font-medium hover:text-strong", done && "text-muted line-through")}
          >
            {task.title}
          </button>
          {task.status === "doing" && <DoingPill />}
        </div>
        {(metaParts.length > 0 || (source && meta !== "project")) && (
          <div className="text-xs text-muted">
            {metaParts.join(" · ")}
            {source && meta !== "project" && (
              <>
                {metaParts.length > 0 && " · "}
                {source}
              </>
            )}
          </div>
        )}
      </div>
      {showAssignee && <span className="shrink-0 text-[13px] text-secondary">{firstName(lookup.users[task.assigneeId]?.name)}</span>}
      <span
        className={cx(
          "shrink-0 text-right text-[13px] whitespace-nowrap",
          overdueLabel && overdue ? "text-xs font-medium text-danger" : "w-16 font-mono",
          !overdueLabel && (overdue ? "text-danger" : task.dueDate === today ? "text-fg" : task.dueDate ? "text-secondary" : "text-muted")
        )}
      >
        {overdueLabel && overdue ? "Overdue" : task.dueDate ? (overdue ? formatShortDate(task.dueDate) : formatDue(task.dueDate, today)) : "—"}
      </span>
    </div>
  );
}
