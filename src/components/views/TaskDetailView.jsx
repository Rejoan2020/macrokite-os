"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveUpdates, useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { useState } from "react";
import { ChannelMessage, Composer, conversationMessages, MessageText, useMarkRead, useStickToBottom, withDayDividers } from "@/components/chat/Chat";
import { chatHeight } from "@/components/views/GeneralView";
import { Avatar, Button, Checkbox, cx, EmptyNote, Page, Pill } from "@/components/ui/primitives";
import { Select } from "@/components/ui/form";
import { useAction } from "@/lib/client/useAction";
import { FORMER_MEMBER, TASK_STATUS_LABELS, TASK_STATUSES, taskPriority } from "@/lib/constants";
import { phaseName } from "@/lib/phases";
import { PriorityLabel } from "@/components/tasks/TaskRow";
import { formatDaysAgo, formatDue, formatShortDate, todayISO } from "@/lib/format";
import { conversationMemberIds, isOverdue } from "@/lib/selectors";
import { useTaskAccess } from "@/components/tasks/taskHooks";

/**
 * A task's own page: its discussion on the left, its details on the right. Questions, blockers and
 * updates stay with the task instead of getting lost in project chat.
 */
export function TaskDetailView() {
  const { id } = useParams();
  const { lookup } = useWorkspace();
  const task = lookup.tasks[id];

  if (!task) {
    return (
      <Page width="sm">
        <EmptyNote action={<Button href="/tasks" size="sm">Back to my tasks</Button>}>This task doesn’t exist, or it was deleted.</EmptyNote>
      </Page>
    );
  }
  return <TaskDetail task={task} />;
}

function TaskDetail({ task }) {
  const { data, lookup, chats, currentUserId } = useWorkspace();
  const { run } = useAction();
  const thread = chats.tasks[task._id];
  const messages = thread ? conversationMessages(data, thread._id) : [];
  const listRef = useStickToBottom(messages.length);
  useMarkRead(thread?._id);
  useLiveUpdates();

  const done = task.status === "done";
  const { canSetStatus } = useTaskAccess(task);
  const memberIds = conversationMemberIds(thread ?? { type: "task", taskId: task._id }, data);
  const people = memberIds.map((uid) => lookup.users[uid]).filter((u) => u?.active && u._id !== currentUserId);

  const send = async (body) => Boolean(await run({ type: "task.comment", id: task._id, data: { body } }));
  const toggle = (e) => run({ type: "task.toggle", id: task._id, data: { done: e.target.checked } }, { success: e.target.checked ? "Task done" : undefined });

  return (
    <div className={cx("flex flex-col", chatHeight)}>
      <header className="flex flex-col gap-3 border-b border-divider px-4 py-5 sm:px-8">
        <Link href="/tasks" className="self-start text-[13px] text-muted hover:text-fg">
          ← My tasks
        </Link>
        <div className="flex items-start gap-3">
          <Checkbox checked={done} onChange={toggle} disabled={!canSetStatus} aria-label={done ? "Mark not done" : "Mark done"} className="mt-1.5 disabled:cursor-not-allowed disabled:opacity-40" />
          <h1 className={cx("min-w-0 flex-1 text-xl leading-snug font-semibold tracking-[-0.01em] break-words", done ? "text-muted line-through" : "text-strong")}>{task.title}</h1>
          <Pill tone={done ? "neutral" : "accent"} className="mt-1">
            {TASK_STATUS_LABELS[task.status]}
          </Pill>
        </div>
        {task.description && <TaskDescription key={task.description} text={task.description} />}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* On small screens the details come first, then the discussion. */}
        <aside aria-label="Task details" className="order-first border-b border-divider px-4 py-4 sm:px-8 lg:order-last lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-l lg:px-6 lg:py-6">
          <TaskDetails task={task} />
        </aside>

        <section aria-label="Discussion" className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <div className="mx-auto flex max-w-[720px] flex-col gap-[22px]">
              {messages.length ? (
                withDayDividers(messages, (m) => <ChannelMessage message={m} />)
              ) : (
                <div className="flex flex-col gap-1.5 py-6">
                  <p className="font-medium text-fg">No discussion yet</p>
                  <p className="text-[13px] text-muted">
                    Explain progress, ask a question or flag a blocker here so it stays with the task. The assignee, the person who created the task and anyone who
                    comments get notified.
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="border-t border-divider px-4 pt-4 pb-6 sm:px-8">
            <div className="mx-auto max-w-[720px]">
              <Composer label={`Comment on ${task.title}`} placeholder="Ask a question or flag a blocker…" onSend={send} people={people} hint="@ to mention someone" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

const LONG_DESCRIPTION = 280;

/** The task's description under its title, folded when long so the discussion keeps its room. */
function TaskDescription({ text }) {
  const long = text.length > LONG_DESCRIPTION || text.split("\n").length > 4;
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex flex-col items-start gap-1 sm:pl-[30px]">
      <MessageText body={text} className={cx("text-[14px] text-body", long && !expanded && "line-clamp-3")} />
      {long && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="text-[13px] text-accent hover:text-accent-light">
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function Detail({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="label-caps text-faint">{label}</dt>
      <dd className="text-[13px] text-fg">{children}</dd>
    </div>
  );
}

function TaskDetails({ task }) {
  const { lookup } = useWorkspace();
  const overlays = useOverlays();
  const { run, busy } = useAction();
  const today = todayISO();
  const project = lookup.projects[task.projectId];
  const assignee = lookup.users[task.assigneeId];
  const creator = lookup.users[task.createdBy];
  const meeting = task.meetingId ? lookup.meetings[task.meetingId] : null;
  const overdue = isOverdue(task, today);
  const { canEdit, canSetStatus } = useTaskAccess(task);

  const setStatus = (e) => run({ type: "task.update", id: task._id, data: { status: e.target.value } }, { success: "Status updated" });

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-1">
        <Detail label="Status">
          {canSetStatus ? (
            <Select
            aria-label="Status"
            value={task.status}
            onChange={setStatus}
            disabled={busy}
            options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))}
            className="h-9 w-full text-[13px]"
            />
          ) : (
            TASK_STATUS_LABELS[task.status]
          )}
        </Detail>
        <Detail label="Priority">
          <PriorityLabel priority={taskPriority(task)} />
        </Detail>
        <Detail label="Assignee">
          <span className="flex items-center gap-2">
            <Avatar user={assignee} size="sm" />
            {assignee?.name ?? FORMER_MEMBER}
          </span>
        </Detail>
        <Detail label="Due">
          <span className={cx(overdue && "font-medium text-danger")}>{task.dueDate ? `${formatDue(task.dueDate, today)}${overdue ? " · overdue" : ""}` : "No due date"}</span>
        </Detail>
        <Detail label="Project">
          {project ? (
            <Link href={`/projects/${project._id}`} className="text-accent hover:text-accent-light">
              {project.name}
            </Link>
          ) : (
            "—"
          )}
          <span className="text-muted"> · {phaseName(project, task.phase)}</span>
        </Detail>
        {meeting && (
          <Detail label="From meeting">
            <Link href={`/meetings/${meeting._id}`} className="text-accent hover:text-accent-light">
              {meeting.title}, {formatShortDate(meeting.startsAt.slice(0, 10))}
            </Link>
          </Detail>
        )}
        <Detail label="Created">
          {creator?.name ?? FORMER_MEMBER}, {formatDaysAgo(task.createdAt)}
        </Detail>
      </dl>
      {canEdit ? (
        <Button size="sm" onClick={() => overlays.editTask(task._id)} className="self-start">
          Edit task
        </Button>
      ) : (
        <p className="text-[12px] text-faint">
          {canSetStatus ? "You can update the status and comment. " : "You can comment. "}Only this project’s leads or an admin can edit this task.
        </p>
      )}
    </div>
  );
}
