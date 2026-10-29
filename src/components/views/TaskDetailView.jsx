"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLiveUpdates, useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { ChannelMessage, Composer, conversationMessages, EarlierMessages, useMarkRead, useStickToBottom, withDayDividers } from "@/components/chat/Chat";
import { TaskStatusSelect } from "@/components/tasks/TaskRow";
import { useTaskAccess } from "@/components/tasks/taskHooks";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { PrioritySelect } from "@/components/ui/Menus";
import { PeoplePicker, peopleOrder } from "@/components/ui/PeoplePicker";
import { Breadcrumbs, Button, cx, EmptyNote, Page, StatusIcon } from "@/components/ui/primitives";
import { useAction } from "@/lib/client/useAction";
import { taskAssigneeIds, taskPriority } from "@/lib/constants";
import { formatShortDate } from "@/lib/format";
import { conversationMemberIds, projectOwner, projectTrail } from "@/lib/selectors";

/** Full-height two-card layout shared by the task page and the Inbox. */
export const splitLayout = "flex flex-col gap-[14px] px-4 py-[14px] sm:px-8 lg:h-dvh lg:flex-row";

/**
 * A task's own page: a document on the left (its properties and description, edited in place),
 * and its activity on the right: comments, and every change made to it.
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
    <section aria-label="Task" className="@container flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto rounded-[24px] border border-card-line bg-card px-5 pt-[26px] pb-9 sm:px-9">
      <div className="relative pr-12">
        <Breadcrumbs items={[...projectTrail(project, lookup.clients), { label: task.title }]} className="mb-2" />
        {canEdit && (
          <div className="absolute -top-1.5 right-0">
          <ActionMenu
            label="Task actions"
            items={[
              { label: "Edit all details", onClick: () => overlays.editTask(task._id) },
              { label: "Delete task", tone: "danger", onClick: () => setDeleting(true) },
            ]}
          />
          </div>
        )}
      </div>
      <h1 className="mt-1.5 mb-[22px] flex items-center gap-3 text-[28px] leading-[1.2] font-medium tracking-[-0.03em] text-strong">
        <StatusIcon status={task.status} className="mt-0.5 size-[22px]" />
        <span className="min-w-0 break-words">{task.title}</span>
      </h1>

      <Properties task={task} />
      <Description key={task.description} task={task} />

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={remove}
        busy={busy}
        tone="danger"
        title="Delete this task?"
        description={`“${task.title}” and its activity will be removed for everyone.`}
        confirmLabel="Delete task"
      />
    </section>
  );
}

/** The 15px line icons beside each property, as drawn in the prototype. */
const PROP_ICONS = {
  status: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  due: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="4" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </>
  ),
  priority: <path d="M5 21V4h12l-2 4 2 4H5" />,
  project: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  company: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
      <path d="M16 9h3a2 2 0 0 1 2 2v10" />
    </>
  ),
  client: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="3" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  meeting: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="4" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0" />
      <path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3" />
    </>
  ),
};

function Property({ icon, label, children, wide }) {
  return (
    <div className={cx("flex gap-3", wide ? "items-start py-1.5 @min-[620px]:col-span-2" : "min-h-[42px] items-center")}>
      <dt className={cx("flex w-28 shrink-0 items-center gap-[9px] text-[13px] text-faint", wide && "h-10")}>
        <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {PROP_ICONS[icon]}
        </svg>
        {label}
      </dt>
      <dd className={cx("min-w-0 flex-1", !wide && "flex items-center")}>{children}</dd>
    </div>
  );
}

/** A property that links somewhere: plain text with a soft hover. */
const PropLink = ({ href, children }) => (
  <Link href={href} className="inline-flex h-[34px] items-center rounded-[10px] px-2.5 text-sm font-medium text-fg hover:bg-input">
    {children}
  </Link>
);

function Properties({ task }) {
  const { lookup, currentUserId } = useWorkspace();
  const { run, busy } = useAction();
  const { canEdit } = useTaskAccess(task);
  const project = lookup.projects[task.projectId];
  const owner = projectOwner(project, lookup.clients);
  const meeting = task.meetingId ? lookup.meetings[task.meetingId] : null;
  const assigneeIds = taskAssigneeIds(task);
  // The project's team, plus anyone already assigned who has since left it.
  const pool = peopleOrder(
    [...new Set([...(project?.memberIds ?? []), ...assigneeIds])].map((id) => lookup.users[id]).filter((u) => u && (u.active || assigneeIds.includes(u._id))),
    currentUserId
  );
  // Each change is saved and logged in the activity, so there's no toast.
  const update = (data) => run({ type: "task.update", id: task._id, data }, { silent: true });

  return (
    // The document's own width decides: two columns of properties, or one when it's narrow.
    <dl className="grid grid-cols-1 gap-x-8 gap-y-0.5 border-b border-row pb-[22px] @min-[620px]:grid-cols-2">
      <Property icon="status" label="Status">
        <TaskStatusSelect task={task} />
      </Property>
      <Property icon="due" label="Due date">
        {canEdit ? (
          <input
            type="date"
            aria-label="Due date"
            value={task.dueDate}
            disabled={busy}
            onChange={(e) => update({ dueDate: e.target.value })}
            className="h-[34px] max-w-full cursor-pointer appearance-none rounded-[10px] bg-transparent px-3 text-sm font-medium text-fg outline-none transition-colors hover:bg-input focus:bg-input"
          />
        ) : (
          <span className="px-3 text-sm font-medium text-fg">{task.dueDate ? formatShortDate(task.dueDate) : "—"}</span>
        )}
      </Property>
      <Property icon="priority" label="Priority">
        <PrioritySelect value={taskPriority(task)} disabled={!canEdit} onChange={(priority) => update({ priority })} />
      </Property>
      <Property icon="project" label="Project">
        {project ? <PropLink href={`/projects/${project._id}`}>{project.name}</PropLink> : "—"}
      </Property>
      <Property icon={owner.clientId ? "client" : "company"} label={owner.clientId ? "Client" : "Company"}>
        <PropLink href={owner.href}>{owner.label}</PropLink>
      </Property>
      {meeting && (
        <Property icon="meeting" label="Meeting">
          <PropLink href={`/meetings/${meeting._id}`}>{meeting.title}</PropLink>
        </Property>
      )}
      <Property icon="people" label="Assignees" wide>
        <PeoplePicker label="Add assignee" people={pool} value={assigneeIds} disabled={!canEdit} onChange={(assigneeIds) => update({ assigneeIds })} />
      </Property>
    </dl>
  );
}

const PencilIcon = () => (
  <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
);

/** Read-only until you press Edit; Save keeps it, Cancel (or Escape) discards, Ctrl+Enter saves. */
function Description({ task }) {
  const { run, busy } = useAction();
  const { canEdit } = useTaskAccess(task);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(task.description ?? "");

  const save = async () => {
    const next = text.trim();
    if (next === (task.description ?? "")) return setEditing(false);
    if (await run({ type: "task.update", id: task._id, data: { description: next } }, { silent: true })) setEditing(false);
  };
  const cancel = () => {
    setText(task.description ?? "");
    setEditing(false);
  };

  return (
    <section aria-labelledby="t-desc" className="flex flex-1 flex-col pt-[22px]">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 id="t-desc" className="text-[15px] font-medium text-strong">
          Description
        </h2>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-xs font-medium text-fg transition-colors hover:bg-hover active:translate-y-px"
          >
            <PencilIcon />
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-1 flex-col gap-3">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                cancel();
              }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
            }}
            aria-label="Description"
            placeholder="Add details for this task: what it covers, links, acceptance criteria, notes…"
            maxLength={5000}
            className="min-h-[220px] w-full flex-1 resize-y rounded-[14px] border border-line bg-card px-4 py-3.5 text-[15px] leading-[1.7] text-fg outline-none placeholder:text-faint focus:border-secondary focus:ring-4 focus:ring-ring"
          />
          <div className="flex justify-end gap-2">
            <Button size="lg" onClick={cancel}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={save}>
              Save
            </Button>
          </div>
        </div>
      ) : task.description ? (
        <p className="text-[15px] leading-[1.7] break-words whitespace-pre-wrap text-fg">{task.description}</p>
      ) : (
        <p className="text-sm leading-[1.7] text-faint">{canEdit ? "No description yet. Click Edit to add details, links or acceptance criteria." : "No description yet."}</p>
      )}
    </section>
  );
}

function Activity({ task }) {
  const { data, lookup, chats, currentUserId } = useWorkspace();
  const { run } = useAction();
  const thread = chats.tasks[task._id];
  const messages = thread ? conversationMessages(data, thread._id) : [];
  const listRef = useStickToBottom(messages.at(-1)?._id);
  useMarkRead(thread?._id);
  useLiveUpdates();

  const memberIds = conversationMemberIds(thread ?? { type: "task", taskId: task._id }, data);
  const people = memberIds.map((uid) => lookup.users[uid]).filter((u) => u?.active && u._id !== currentUserId);
  const send = async (body, attachments) => Boolean(await run({ type: "task.comment", id: task._id, data: { body, attachments } }));

  return (
    <section aria-labelledby="t-activity" className="flex min-h-[480px] min-w-0 flex-col overflow-hidden rounded-[24px] border border-card-line bg-card lg:min-h-0 lg:w-[clamp(320px,34%,440px)] lg:shrink-0">
      <div className="flex items-center gap-2.5 border-b border-row px-6 pt-[22px] pb-3.5">
        <h2 id="t-activity" className="text-lg font-medium tracking-[-0.02em] text-strong">
          Activity
        </h2>
      </div>
      <div ref={listRef} className="flex-1 overflow-x-hidden overflow-y-auto px-[22px] py-[18px]">
        <EarlierMessages conversationId={thread?._id} scrollRef={listRef} count={messages.length} />
        {messages.length ? (
          <div className="flex flex-col gap-5">{withDayDividers(messages, (m) => <ChannelMessage message={m} />)}</div>
        ) : (
          <p className="mt-10 text-center text-[13px] text-faint">No activity yet. Comments and changes to this task show up here.</p>
        )}
      </div>
      <div className="border-t border-row px-4 pt-3 pb-4">
        <Composer compact label={`Comment on ${task.title}`} placeholder="Write a comment…" onSend={send} people={people} />
      </div>
    </section>
  );
}
