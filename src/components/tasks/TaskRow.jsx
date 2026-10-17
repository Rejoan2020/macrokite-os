"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useAction } from "@/lib/client/useAction";
import { Avatar, AvatarStack, cx, Pill, PillSelect, PriorityPill, STATUS_TONES, StatusIcon } from "@/components/ui/primitives";
import { FORMER_MEMBER, TASK_STATUS_LABELS, TASK_STATUSES, taskAssigneeIds, taskPriority } from "@/lib/constants";
import { phaseName } from "@/lib/phases";
import { firstName, formatShortDate, todayISO } from "@/lib/format";
import { isOverdue, projectOwner } from "@/lib/selectors";
import { useTaskAccess } from "./taskHooks";

/*
 * Task table: Task · Assignees · Priority · Due · Status. Each row is its own size container, so in
 * narrow places (a phone) it drops to a compact layout by itself.
 */

const COLUMNS = "@3xl:grid @3xl:grid-cols-[minmax(0,1fr)_150px_100px_80px_140px] @3xl:gap-[14px]";

/** Status as a tinted dropdown pill, or a plain pill for people who can't change it. Changes are logged in the task's activity. */
export function TaskStatusSelect({ task, className }) {
  const { run, busy } = useAction();
  const { canSetStatus } = useTaskAccess(task);
  if (!canSetStatus) return <Pill tone={STATUS_TONES[task.status]} className={cx("h-8 px-3.5 font-semibold", className)}>{TASK_STATUS_LABELS[task.status]}</Pill>;
  return (
    <PillSelect
      label={`Status of ${task.title}`}
      value={task.status}
      tone={STATUS_TONES[task.status]}
      disabled={busy}
      onChange={(e) => run({ type: "task.update", id: task._id, data: { status: e.target.value } }, { silent: true })}
      options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))}
      className={className}
    />
  );
}

/** One person: avatar and first name. Several: their avatars and "3 people". Nobody: "Unassigned". */
export function Assignees({ task }) {
  const { lookup } = useWorkspace();
  const people = taskAssigneeIds(task).map((id) => lookup.users[id] ?? { _id: id, name: FORMER_MEMBER });
  if (!people.length) return <span className="text-[13px] text-faint">Unassigned</span>;
  return (
    <span className="flex min-w-0 items-center gap-2 text-[13px] text-secondary" title={people.map((u) => u.name).join(", ")}>
      {people.length === 1 ? (
        <>
          <Avatar user={people[0]} size="cell" />
          <span className="truncate">{firstName(people[0].name)}</span>
        </>
      ) : (
        <>
          <AvatarStack users={people} max={4} size="xs" />
          <span className="truncate">{people.length} people</span>
        </>
      )}
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

/** Column headings for a TaskTable. */
function TaskTableHead() {
  return (
    <div aria-hidden className="@container px-6">
      <div className={cx("hidden h-11 items-center text-xs font-medium text-faint", COLUMNS)}>
        <span>Task</span>
        <span>Assignees</span>
        <span>Priority</span>
        <span>Due</span>
        <span>Status</span>
      </div>
    </div>
  );
}

/**
 * One task row; the whole row opens the task (controls inside it keep working). `meta` picks the
 * line under the title: "path" (client · project), "phase" or "none".
 */
export function TaskRow({ task, meta = "path" }) {
  const router = useRouter();
  const today = todayISO();
  const overdue = isOverdue(task, today);
  const subtitle = useTaskMeta(task, meta);
  const href = `/tasks/${task._id}`;

  return (
    <div
      onClick={(e) => !e.target.closest("select, a, button, input") && router.push(href)}
      className="@container relative cursor-pointer px-6 transition-colors duration-150 before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-row hover:bg-row-hover"
    >
      <div className={cx("flex min-h-20 items-center gap-3 py-4", COLUMNS)}>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2.5 text-sm font-medium text-strong">
            <StatusIcon status={task.status} />
            <Link href={href} className="truncate">
              {task.title}
            </Link>
          </div>
          {subtitle && <div className="mt-1 truncate pl-[26px] text-xs text-faint">{subtitle}</div>}
          <div className="flex flex-wrap items-center gap-2 pt-1.5 pl-[26px] @3xl:hidden">
            <PriorityPill priority={taskPriority(task)} />
            {task.dueDate && <span className={cx("text-xs", overdue ? "font-medium text-danger" : "text-faint")}>Due {formatShortDate(task.dueDate)}</span>}
          </div>
        </div>
        <div className="hidden min-w-0 @3xl:block">
          <Assignees task={task} />
        </div>
        <div className="hidden @3xl:block">
          <PriorityPill priority={taskPriority(task)} />
        </div>
        <span className={cx("hidden text-[13px] @3xl:block", overdue ? "font-medium text-danger" : "text-secondary")}>{task.dueDate ? formatShortDate(task.dueDate) : "—"}</span>
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
    <div className={cx("overflow-hidden rounded-[24px] border border-card-line bg-card py-1.5", className)}>
      <TaskTableHead />
      {tasks.map((t) => (
        <TaskRow key={t._id} task={t} meta={meta} />
      ))}
    </div>
  );
}

/** Compact task on a raised tile, for the Overview: status, title, where and when, priority. */
export function TaskTile({ task }) {
  const subtitle = useTaskMeta(task, "path");
  return (
    <Link href={`/tasks/${task._id}`} className="flex items-center gap-3.5 rounded-2xl bg-raised py-3.5 pr-3.5 pl-4 transition-colors duration-150 hover:bg-selected">
      <StatusIcon status={task.status} />
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="truncate text-sm font-medium text-strong">{task.title}</span>
        <span className="truncate text-xs text-faint">
          {subtitle}
          {task.dueDate && ` · due ${formatShortDate(task.dueDate)}`}
        </span>
      </span>
      <PriorityPill priority={taskPriority(task)} />
    </Link>
  );
}
