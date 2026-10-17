"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BriefcaseBusiness, Building2, CalendarDays, Clock3, Flag, FolderKanban, Pencil, UserRound, Users } from "lucide-react";
import { useLiveUpdates, useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { ChannelMessage, Composer, conversationMessages, MessageText, useMarkRead, useStickToBottom, withDayDividers } from "@/components/chat/Chat";
import { TaskStatusSelect } from "@/components/tasks/TaskRow";
import { useTaskAccess } from "@/components/tasks/taskHooks";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { PeopleMenu } from "@/components/ui/PeopleMenu";
import { Breadcrumbs, Button, cx, EmptyNote, Page, PersonChip, PillSelect, PRIORITY_TONES, PriorityPill, StatusIcon } from "@/components/ui/primitives";
import { Textarea } from "@/components/ui/form";
import { useAction } from "@/lib/client/useAction";
import { FORMER_MEMBER, TASK_PRIORITIES, TASK_PRIORITY_LABELS, taskAssigneeIds, taskPriority } from "@/lib/constants";
import { formatDaysAgo, formatShortDate, todayISO } from "@/lib/format";
import { conversationMemberIds, isOverdue, projectOwner, projectTrail } from "@/lib/selectors";

/** Full-height two-card layout shared by the task page and the Inbox. */
export const splitLayout = "flex flex-col gap-4 px-4 py-4 sm:px-8 lg:h-dvh lg:flex-row";

/**
 * A task's own page: its details on the left (edited in place by people who may), and its
 * activity on the right, where questions, blockers and updates stay with the task.
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
  return (
    <div className={splitLayout}>
      <TaskMain task={task} />
      <Activity task={task} />
    </div>
  );
}

function TaskMain({ task }) {
  const { lookup } = useWorkspace();
  const overlays = useOverlays();
  const router = useRouter();
  const { run, busy } = useAction();
  const [deleting, setDeleting] = useState(false);
  const { canEdit } = useTaskAccess(task);
  const project = lookup.projects[task.projectId];

  const remove = async () => {
    if (await run({ type: "task.delete", id: task._id }, { success: "Task deleted" })) router.push(project ? `/projects/${project._id}` : "/tasks");
  };

  return (
    <section aria-label="Task" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto rounded-[22px] border border-card-line bg-card px-5 py-6 sm:px-8">
      <div className="flex items-start justify-between gap-3">
        <Breadcrumbs items={[...projectTrail(project, lookup.clients), { label: task.title }]} />
        {canEdit && (
          <ActionMenu
            label="Task actions"
            items={[
              { label: "Edit all details", onClick: () => overlays.editTask(task._id) },
              { label: "Delete task", tone: "danger", onClick: () => setDeleting(true) },
            ]}
          />
        )}
      </div>
      <h1 className="mt-1 flex items-start gap-3 text-[26px] leading-tight font-medium tracking-[-0.02em] text-strong sm:text-[30px]">
        <StatusIcon status={task.status} className="mt-2 size-[22px]" />
        <span className="min-w-0 break-words">{task.title}</span>
      </h1>

      <Properties task={task} />

      <div className="my-6 h-px bg-line" />
      <Description key={task.description} task={task} />

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={remove}
        busy={busy}
        tone="danger"
        title="Delete this task?"
        description={`“${task.title}” and its comments will be removed for everyone.`}
        confirmLabel="Delete task"
      />
    </section>
  );
}

function Property({ icon: Icon, label, children }) {
  return (
    <div className="grid grid-cols-[130px_minmax(0,1fr)] items-start gap-3">
      <dt className="flex h-11 items-center gap-2.5 text-[14px] text-muted">
        <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
        {label}
      </dt>
      <dd className="flex min-h-11 min-w-0 flex-wrap items-center gap-2 py-1 text-[15px] font-medium text-strong">{children}</dd>
    </div>
  );
}

function Properties({ task }) {
  const { lookup, activeUsers, currentUserId } = useWorkspace();
  const { run, busy } = useAction();
  const { canEdit } = useTaskAccess(task);
  const today = todayISO();
  const project = lookup.projects[task.projectId];
  const owner = projectOwner(project, lookup.clients);
  const meeting = task.meetingId ? lookup.meetings[task.meetingId] : null;
  const creator = lookup.users[task.createdBy];
  const assigneeIds = taskAssigneeIds(task);
  const overdue = isOverdue(task, today);
  // Project members first, as they're the likely picks; then everyone else on the team.
  const candidates = activeUsers
    .filter((u) => !assigneeIds.includes(u._id))
    .sort((a, b) => Number(!project?.memberIds.includes(a._id)) - Number(!project?.memberIds.includes(b._id)) || a.name.localeCompare(b.name));

  const update = (data, success) => run({ type: "task.update", id: task._id, data }, { success });
  const nameOf = (u) => (u._id === currentUserId ? `${u.name.split(/\s+/)[0]} (you)` : u.name);

  return (
    <dl className="mt-6 grid gap-x-10 gap-y-2 xl:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Property icon={Clock3} label="Status">
          <TaskStatusSelect task={task} />
        </Property>
        <Property icon={Flag} label="Priority">
          {canEdit ? (
            <PillSelect
              label="Priority"
              value={taskPriority(task)}
              tone={PRIORITY_TONES[taskPriority(task)]}
              disabled={busy}
              onChange={(e) => update({ priority: e.target.value }, "Priority updated")}
              options={TASK_PRIORITIES.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p] }))}
            />
          ) : (
            <PriorityPill priority={taskPriority(task)} />
          )}
        </Property>
        <Property icon={owner.clientId ? BriefcaseBusiness : Building2} label={owner.clientId ? "Client" : "Company"}>
          <Link href={owner.href} className="hover:underline hover:underline-offset-4">
            {owner.label}
          </Link>
        </Property>
        <Property icon={Users} label="Assignees">
          {assigneeIds.map((id) => {
            const user = lookup.users[id];
            return (
              <PersonChip
                key={id}
                user={user}
                label={user ? nameOf(user) : FORMER_MEMBER}
                onRemove={canEdit ? () => update({ assigneeIds: assigneeIds.filter((x) => x !== id) }, "Assignee removed") : undefined}
                removeLabel={`Remove ${user?.name ?? FORMER_MEMBER}`}
              />
            );
          })}
          {!assigneeIds.length && <span className="text-[14px] font-normal text-muted">No one added yet</span>}
          {canEdit && <PeopleMenu label="Add assignee" people={candidates} disabled={busy} onPick={(user) => update({ assigneeIds: [...assigneeIds, user._id] }, `${user.name} added`)} />}
        </Property>
      </div>

      <div className="flex flex-col gap-2">
        <Property icon={CalendarDays} label="Due date">
          {canEdit ? (
            <input
              type="date"
              aria-label="Due date"
              value={task.dueDate}
              disabled={busy}
              onChange={(e) => update({ dueDate: e.target.value }, e.target.value ? "Due date updated" : "Due date cleared")}
              className={cx("h-9 rounded-full bg-transparent px-1 font-medium outline-none hover:bg-hover focus:bg-hover", overdue ? "text-danger" : "text-strong")}
            />
          ) : (
            <span className={cx(overdue && "text-danger")}>{task.dueDate ? formatShortDate(task.dueDate) : <span className="font-normal text-muted">No due date</span>}</span>
          )}
          {overdue && <span className="text-[13px] font-normal text-danger">Overdue</span>}
        </Property>
        <Property icon={FolderKanban} label="Project">
          {project ? (
            <Link href={`/projects/${project._id}`} className="hover:underline hover:underline-offset-4">
              {project.name}
            </Link>
          ) : (
            "—"
          )}
        </Property>
        <Property icon={UserRound} label="Created">
          <span className="font-normal text-secondary">
            {creator?.name ?? FORMER_MEMBER}, {formatDaysAgo(task.createdAt)}
            {meeting && (
              <>
                {" · from "}
                <Link href={`/meetings/${meeting._id}`} className="text-accent hover:text-accent-light">
                  {meeting.title}
                </Link>
              </>
            )}
          </span>
        </Property>
      </div>
    </dl>
  );
}

function Description({ task }) {
  const { run, busy } = useAction();
  const { canEdit } = useTaskAccess(task);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(task.description ?? "");

  const save = async () => {
    if (await run({ type: "task.update", id: task._id, data: { description: text } }, { success: "Description saved" })) setEditing(false);
  };

  return (
    <section aria-labelledby="t-desc" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="t-desc" className="text-[17px] font-medium text-strong">
          Description
        </h2>
        {canEdit && !editing && (
          <Button size="sm" variant="outline" icon={Pencil} onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-3">
          <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} aria-label="Description" placeholder="What needs doing, links, acceptance criteria…" maxLength={5000} autoFocus />
          <div className="flex justify-end gap-2">
            <Button variant="quiet" size="sm" onClick={() => (setText(task.description ?? ""), setEditing(false))}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={busy} onClick={save}>
              Save
            </Button>
          </div>
        </div>
      ) : task.description ? (
        <MessageText body={task.description} className="text-[15px] text-body" />
      ) : (
        <p className="text-[14px] text-muted">{canEdit ? "No description yet. Add what needs doing, links or acceptance criteria." : "No description yet."}</p>
      )}
    </section>
  );
}

function Activity({ task }) {
  const { data, lookup, chats, currentUserId } = useWorkspace();
  const { run } = useAction();
  const thread = chats.tasks[task._id];
  const messages = thread ? conversationMessages(data, thread._id) : [];
  const listRef = useStickToBottom(messages.length);
  useMarkRead(thread?._id);
  useLiveUpdates();

  const memberIds = conversationMemberIds(thread ?? { type: "task", taskId: task._id }, data);
  const people = memberIds.map((uid) => lookup.users[uid]).filter((u) => u?.active && u._id !== currentUserId);
  const send = async (body) => Boolean(await run({ type: "task.comment", id: task._id, data: { body } }));

  return (
    <section aria-labelledby="t-activity" className="flex min-h-[420px] min-w-0 flex-col rounded-[22px] border border-card-line bg-card lg:min-h-0 lg:w-[420px] lg:shrink-0">
      <h2 id="t-activity" className="border-b border-line px-6 pt-5 pb-4 text-xl font-medium text-strong">
        Activity
      </h2>
      <div ref={listRef} className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        {messages.length ? (
          withDayDividers(messages, (m) => <ChannelMessage message={m} />)
        ) : (
          <p className="px-4 py-6 text-center text-[13px] text-muted">No activity yet. Comments on this task show up here, and the assignees and the person who created it get notified.</p>
        )}
      </div>
      <div className="border-t border-line px-4 py-4">
        <Composer compact label={`Comment on ${task.title}`} placeholder="Write a comment…" onSend={send} people={people} />
      </div>
    </section>
  );
}
