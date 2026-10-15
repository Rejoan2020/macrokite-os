"use client";

import Link from "next/link";
import { Check, MessageSquare } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useAction } from "@/lib/client/useAction";
import { Avatar, cx } from "@/components/ui/primitives";
import { FORMER_MEMBER, phaseLabel, TASK_PRIORITY_LABELS, taskPriority } from "@/lib/constants";
import { firstName, formatDue, formatShortDate, todayISO } from "@/lib/format";
import { isOverdue } from "@/lib/selectors";
import { useOpenTask, useTaskAccess, useTaskThreadSummary } from "./taskHooks";

/*
 * Task list rows: Due · Priority · What · Who · To do · In progress · Done.
 * Each row is its own size container, so in narrow places (an Overview panel, a phone) it switches
 * to a compact layout by itself: priority becomes a dot, and Who moves under the title.
 */

const COLUMNS = "@2xl:grid-cols-[84px_100px_minmax(0,1fr)_120px_repeat(3,88px)]";

const STATUS_BOXES = [
  { status: "todo", label: "To do", toast: "Moved to To do" },
  { status: "doing", label: "In progress", toast: "In progress" },
  { status: "done", label: "Done", toast: "Task done" },
];

export const PRIORITY_DOT = { high: "bg-danger", medium: "bg-warning-strong", low: "bg-accent" };

export function PriorityLabel({ priority, compact }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className={cx("size-2 shrink-0 rounded-full", PRIORITY_DOT[priority])} />
      <span className={cx("label-caps text-[11px] text-fg", compact && "sr-only")}>{TASK_PRIORITY_LABELS[priority]}</span>
    </span>
  );
}

/** Column headings, shown above a list of TaskRows where there is room. */
export function TaskListHead({ className }) {
  return (
    <div aria-hidden className={cx("@container", className)}>
      <div className={cx("label-caps hidden gap-3 px-3 text-[11px] text-faint @2xl:grid", COLUMNS)}>
        <span>Due</span>
        <span>Priority</span>
        <span>What</span>
        <span>Who</span>
        {STATUS_BOXES.map((box) => (
          <span key={box.status} className="text-center whitespace-nowrap">
            {box.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A square status box; the task's current status shows a tick. One per status, like radio buttons. */
function StatusBox({ checked, onClick, disabled, label }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Only the assignee, the person who created it or an admin can change this" : label}
      className={cx(
        "flex size-8 items-center justify-center rounded-lg border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40 @2xl:size-10",
        checked ? "border-accent bg-accent-tint text-accent" : "border-line text-transparent enabled:hover:border-secondary"
      )}
    >
      <Check className="size-4 @2xl:size-5" strokeWidth={3} aria-hidden />
    </button>
  );
}

function DueCell({ task, today }) {
  const done = task.status === "done";
  const overdue = isOverdue(task, today);
  const isToday = task.dueDate === today;
  const sub = !task.dueDate ? null : overdue ? "Overdue" : isToday ? "Today" : formatDue(task.dueDate, today) !== formatShortDate(task.dueDate) ? formatDue(task.dueDate, today) : null;
  return (
    <div
      className={cx(
        "flex w-[76px] shrink-0 flex-col items-center justify-center self-stretch rounded-lg px-1 py-2 text-center @2xl:w-auto",
        done ? "bg-selected text-muted" : overdue ? "bg-danger-outline text-danger" : isToday ? "bg-accent-tint text-accent-light" : "bg-selected text-strong"
      )}
    >
      <span className="text-[15px] leading-tight font-bold tabular-nums">{task.dueDate ? formatShortDate(task.dueDate) : "—"}</span>
      {sub && <span className="mt-0.5 text-[10px] font-semibold tracking-wide uppercase opacity-80">{sub}</span>}
      {!task.dueDate && <span className="mt-0.5 text-[10px] tracking-wide uppercase opacity-70">No date</span>}
    </div>
  );
}

/**
 * One task. `meta` picks the line under the title: "project" (Project · Phase), "source" (from a
 * meeting) or "full" (both). `who` picks the person in the Who column: "assignee" (who does it) or
 * "assigner" (who created it, for lists of your own tasks).
 */
export function TaskRow({ task, meta = "full", who: whoShown = "assignee", className }) {
  const { lookup, currentUserId } = useWorkspace();
  const { run, busy } = useAction();
  const openTask = useOpenTask();
  const { canSetStatus } = useTaskAccess(task);
  const thread = useTaskThreadSummary(task._id);
  const today = todayISO();
  const done = task.status === "done";
  const priority = taskPriority(task);
  const project = lookup.projects[task.projectId];
  const meeting = task.meetingId ? lookup.meetings[task.meetingId] : null;
  const personId = whoShown === "assigner" ? task.createdBy : task.assigneeId;
  const person = lookup.users[personId];
  const who = personId === currentUserId ? "You" : firstName(person?.name ?? FORMER_MEMBER);
  const whoLabel = whoShown === "assigner" ? `Assigned by ${who === "You" ? "you" : who}` : who;

  const setStatus = (box) => box.status !== task.status && run({ type: "task.update", id: task._id, data: { status: box.status } }, { success: box.toast });

  const metaParts = [];
  if (meta !== "source" && project) metaParts.push(`${project.name} · ${phaseLabel(task.phase)}`);
  const source = meeting && meta !== "project" && (
    <Link href={`/meetings/${meeting._id}`} className="text-accent hover:text-accent-light">
      from {meeting.title}, {formatShortDate(meeting.startsAt.slice(0, 10))}
    </Link>
  );

  return (
    <div className={cx("@container border-b border-row last:border-b-0", className)}>
      <div className={cx("flex items-center gap-3 px-3 py-2.5 @2xl:grid", COLUMNS)}>
        <DueCell task={task} today={today} />

        <div className="hidden @2xl:block">
          <PriorityLabel priority={priority} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="@2xl:hidden">
              <PriorityLabel priority={priority} compact />
            </span>
            <button type="button" onClick={() => openTask(task)} className={cx("min-w-0 truncate text-left font-medium hover:text-strong", done && "text-muted line-through")}>
              {task.title}
            </button>
            <Link
              href={`/tasks/${task._id}`}
              aria-label={`Open task and discussion: ${thread.count} comments${thread.unread ? `, ${thread.unread} new` : ""}`}
              className={cx(
                "flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-[12px] tabular-nums hover:bg-hover",
                thread.unread ? "font-semibold text-accent" : thread.count ? "text-secondary hover:text-fg" : "text-faint hover:text-fg"
              )}
            >
              <MessageSquare className="size-3.5" aria-hidden />
              {thread.count > 0 && thread.count}
            </Link>
          </div>
          {(metaParts.length > 0 || source) && (
            <div className="truncate text-xs text-muted">
              {metaParts.join(" · ")}
              {source && (
                <>
                  {metaParts.length > 0 && " · "}
                  {source}
                </>
              )}
            </div>
          )}
          <span className="text-xs text-secondary @2xl:hidden">
            {whoLabel} · {STATUS_BOXES.find((b) => b.status === task.status)?.label}
          </span>
        </div>

        <div className="hidden min-w-0 items-center gap-2 @2xl:flex" title={whoLabel}>
          <Avatar user={person} size="sm" />
          <span className="truncate text-[13px] text-secondary">{who}</span>
        </div>

        {/* "contents" lets the three boxes fill the last three grid columns on wide rows. */}
        <div role="radiogroup" aria-label={`Status of ${task.title}`} className="flex shrink-0 gap-1.5 @2xl:contents">
          {STATUS_BOXES.map((box) => (
            <div key={box.status} className="flex justify-center">
              <StatusBox checked={task.status === box.status} onClick={() => setStatus(box)} disabled={!canSetStatus || busy} label={box.label} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
