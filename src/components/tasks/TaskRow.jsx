"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useAction } from "@/lib/client/useAction";
import { Avatar, AvatarStack, cx, Pill, PillSelect, PriorityPill, STATUS_TONES, StatusIcon } from "@/components/ui/primitives";
import { FORMER_MEMBER, TASK_STATUS_LABELS, TASK_STATUSES, taskAssigneeIds, taskPriority } from "@/lib/constants";
import { phaseName } from "@/lib/phases";
import { firstName, formatShortDate, todayISO } from "@/lib/format";
import { isOverdue, projectOwner } from "@/lib/selectors";
import { useTaskAccess, useTaskThreadSummary } from "./taskHooks";

/*
 * Task table: Task · Assignees · Priority · Due · Status. Each row is its own size container, so in
 * narrow places (a phone, a project tab) it drops to a compact layout by itself.
 */

const COLUMNS = "@3xl:grid @3xl:grid-cols-[minmax(0,1fr)_170px_110px_90px_150px] @3xl:gap-4";

const STATUS_TOASTS = { todo: "Moved to To do", doing: "In progress", done: "Task done" };

/** Status as a tinted dropdown pill, or a plain pill for people who can't change it. */
export function TaskStatusSelect({ task, className }) {
  const { run, busy } = useAction();
  const { canSetStatus } = useTaskAccess(task);
  if (!canSetStatus) return <Pill tone={STATUS_TONES[task.status]} className={cx("h-8 px-3.5 text-[13px]", className)}>{TASK_STATUS_LABELS[task.status]}</Pill>;
  return (
    <PillSelect
      label={`Status of ${task.title}`}
      value={task.status}
      tone={STATUS_TONES[task.status]}
      disabled={busy}
      onChange={(e) => run({ type: "task.update", id: task._id, data: { status: e.target.value } }, { success: STATUS_TOASTS[e.target.value] })}
      options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))}
      className={cx("min-w-[118px]", className)}
    />
  );
}

/** "AA Abdullah", or a stack of avatars with "Abdullah +2". */
export function Assignees({ task, size = "xs" }) {
  const { lookup, currentUserId } = useWorkspace();
  const people = taskAssigneeIds(task).map((id) => lookup.users[id] ?? { _id: id, name: FORMER_MEMBER });
  if (!people.length) return <span className="text-[13px] text-faint">Unassigned</span>;
  const name = (u) => (u._id === currentUserId ? "You" : firstName(u.name));
  return (
    <span className="flex min-w-0 items-center gap-2" title={people.map((u) => u.name).join(", ")}>
      {people.length === 1 ? <Avatar user={people[0]} size={size} /> : <AvatarStack users={people} max={3} size={size} />}
      <span className="truncate text-[13px] text-soft">
        {name(people[0])}
        {people.length > 1 && <span className="text-muted"> +{people.length - 1}</span>}
      </span>
    </span>
  );
}

/** "Company · Operations", the phase, or nothing ("none") where the list already says both. */
function useTaskMeta(task, meta) {
  const { lookup } = useWorkspace();
  const project = lookup.projects[task.projectId];
  if (meta === "none") return null;
  if (meta === "phase") return phaseName(project, task.phase);
  return [projectOwner(project, lookup.clients).label, project?.name].filter(Boolean).join(" · ");
}

function CommentCount({ task }) {
  const thread = useTaskThreadSummary(task._id);
  if (!thread.count) return null;
  return (
    <span
      aria-label={`${thread.count} comments${thread.unread ? `, ${thread.unread} new` : ""}`}
      className={cx("flex shrink-0 items-center gap-1 text-[12px] tabular-nums", thread.unread ? "font-semibold text-accent" : "text-muted")}
    >
      <MessageSquare className="size-3.5" aria-hidden />
      {thread.count}
    </span>
  );
}

/** Column headings for a TaskTable. */
function TaskTableHead() {
  return (
    <div aria-hidden className="@container">
      <div className={cx("hidden border-b border-row pb-3 text-[13px] text-muted", COLUMNS)}>
        <span>Task</span>
        <span>Assignees</span>
        <span>Priority</span>
        <span>Due</span>
        <span>Status</span>
      </div>
    </div>
  );
}

/** One task row. `meta` picks the line under the title: "path" (client · project), "phase" or "none". */
export function TaskRow({ task, meta = "path" }) {
  const today = todayISO();
  const done = task.status === "done";
  const overdue = isOverdue(task, today);
  const subtitle = useTaskMeta(task, meta);

  return (
    <div className="@container border-b border-row last:border-b-0">
      <div className={cx("relative flex items-center gap-3 py-4 @3xl:items-center", COLUMNS)}>
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <StatusIcon status={task.status} className="mt-0.5" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex min-w-0 items-center gap-2">
              <Link href={`/tasks/${task._id}`} className={cx("truncate text-[15px] font-medium hover:underline hover:underline-offset-4", done ? "text-secondary" : "text-strong")}>
                {task.title}
              </Link>
              <CommentCount task={task} />
            </span>
            {subtitle && <span className="truncate text-[13px] text-muted">{subtitle}</span>}
            <span className="flex flex-wrap items-center gap-2 pt-1 @3xl:hidden">
              <PriorityPill priority={taskPriority(task)} />
              {task.dueDate && <span className={cx("text-xs", overdue ? "font-medium text-danger" : "text-muted")}>Due {formatShortDate(task.dueDate)}</span>}
            </span>
          </div>
        </div>
        <div className="hidden min-w-0 @3xl:block">
          <Assignees task={task} />
        </div>
        <div className="hidden @3xl:block">
          <PriorityPill priority={taskPriority(task)} />
        </div>
        <span className={cx("hidden text-[13px] @3xl:block", overdue ? "font-medium text-danger" : task.dueDate ? "text-soft" : "text-faint")}>
          {task.dueDate ? formatShortDate(task.dueDate) : "—"}
        </span>
        <div className="shrink-0">
          <TaskStatusSelect task={task} />
        </div>
      </div>
    </div>
  );
}

/** A card holding a task table. */
export function TaskTable({ tasks, meta, className }) {
  return (
    <div className={cx("rounded-[22px] border border-card-line bg-card px-6 pt-5 pb-2", className)}>
      <TaskTableHead />
      {tasks.map((t) => (
        <TaskRow key={t._id} task={t} meta={meta} />
      ))}
    </div>
  );
}

/** Compact task on a raised tile, for the Overview: status, title, where and when, priority. */
export function TaskTile({ task }) {
  const today = todayISO();
  const subtitle = useTaskMeta(task, "path");
  const overdue = isOverdue(task, today);
  return (
    <Link href={`/tasks/${task._id}`} className="flex items-center gap-3.5 rounded-2xl bg-raised px-4 py-3 transition-colors hover:bg-hover">
      <StatusIcon status={task.status} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-medium text-strong">{task.title}</span>
        <span className="truncate text-[13px] text-muted">
          {subtitle}
          {task.dueDate && <span className={cx(overdue && "font-medium text-danger")}> · {overdue ? "overdue since" : "due"} {formatShortDate(task.dueDate)}</span>}
        </span>
      </span>
      <PriorityPill priority={taskPriority(task)} />
    </Link>
  );
}
