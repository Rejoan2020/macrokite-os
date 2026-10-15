"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { useLiveUpdates, useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { TaskListHead, TaskRow } from "@/components/tasks/TaskRow";
import { useTaskManagement } from "@/components/tasks/taskHooks";
import { canManageProject, projectLeadIds } from "@/lib/permissions";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { ChannelMessage, Composer, conversationMessages, MessageText, useMarkRead, useSendMessage, useStickToBottom, useTaskFromMessage, withDayDividers } from "@/components/chat/Chat";
import { MeetingRow } from "@/components/views/MeetingsView";
import { Avatar, AvatarStack, Button, Card, cx, EmptyNote, OnHoldPill, Page, Pill, TabGroup } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/form";
import { useAction } from "@/lib/client/useAction";
import { nextPhaseIn, phaseIndexIn, phaseName, projectPhases } from "@/lib/phases";
import { formatShortDate, joinNames, parseDate, pluralize, todayISO } from "@/lib/format";
import { decisionLog, isOpenTask, isPastDeadline, meetingBuckets } from "@/lib/selectors";

const TABS = ["tasks", "chat", "meetings", "decisions", "notes"];

/** "in 9 days", "today", "3 days late". */
function deadlineHint(deadline, today) {
  const days = Math.round((parseDate(deadline) - parseDate(today)) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return days > 0 ? `in ${days} days` : `${pluralize(-days, "day")} late`;
}

/** One labelled fact in the project header: DEADLINE / Nov 4 · in 9 days. */
function Fact({ label, children }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <dt className="label-caps text-[11px] text-faint">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 text-[13px] text-fg">{children}</dd>
    </div>
  );
}

export function ProjectDetailView() {
  const { id } = useParams();
  const { data, lookup, unread, chats, currentUser, currentUserId } = useWorkspace();
  const overlays = useOverlays();
  const { canManage } = useTaskManagement();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { run, busy } = useAction();
  const [confirm, setConfirm] = useState(null);
  const project = lookup.projects[id];

  if (!project) {
    return (
      <Page width="md">
        <EmptyNote action={<Button href="/projects" size="sm">Back to projects</Button>}>This project doesn’t exist, or the link is wrong.</EmptyNote>
      </Page>
    );
  }

  const tab = TABS.includes(searchParams.get("tab")) ? searchParams.get("tab") : "tasks";
  const setTab = (value) => router.replace(`${pathname}${value === "tasks" ? "" : `?tab=${value}`}`, { scroll: false });

  const today = todayISO();
  const tasks = data.tasks.filter((t) => t.projectId === id);
  const meetings = data.meetings.filter((m) => m.projectId === id);
  const decisions = decisionLog(meetings);
  const conversation = chats.projects[id];
  const chatUnread = project.memberIds.includes(currentUserId) ? unread[conversation?._id]?.count ?? 0 : 0;
  const members = project.memberIds.map((uid) => lookup.users[uid]).filter(Boolean);
  const leads = projectLeadIds(project).map((uid) => lookup.users[uid]).filter(Boolean);
  const manageProject = canManageProject(project, currentUser);
  const late = isPastDeadline(project, today) && !project.archived;

  const phases = projectPhases(project);
  const step = phaseIndexIn(project, project.phase);
  const next = nextPhaseIn(project, project.phase)?._id;
  const phaseLabel = (id) => phaseName(project, id);
  const phaseTasks = tasks.filter((t) => t.phase === project.phase);
  const phaseOpen = phaseTasks.filter(isOpenTask).length;

  const advance = () => run({ type: "project.advance", id }, { success: `Moved to ${phaseLabel(next)}` }).then(() => setConfirm(null));
  const confirmations = {
    advance: {
      title: `Move to ${phaseLabel(next)}?`,
      description: `${phaseLabel(project.phase)} still has ${pluralize(phaseOpen, "open task")}. They stay in ${phaseLabel(project.phase)} and remain open.`,
      confirmLabel: `Move to ${phaseLabel(next)}`,
      onConfirm: advance,
    },
    archive: {
      title: "Archive this project?",
      description: "It disappears from All and from people’s lists. Tasks, chat and decisions are kept, and you can unarchive it any time.",
      confirmLabel: "Archive",
      onConfirm: () => run({ type: "project.archive", id, data: { archived: true } }, { success: "Project archived" }).then(() => setConfirm(null)),
    },
  };

  return (
    <Page className="gap-6">
      <nav aria-label="Breadcrumb" className="text-[13px] text-muted">
        <Link href="/projects" className="hover:text-fg">
          Projects
        </Link>{" "}
        <span aria-hidden>/</span> <span className="text-soft">{project.name}</span>
      </nav>

      <header className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] text-strong">{project.name}</h1>
              {project.onHold && <OnHoldPill />}
              {project.archived && <Pill tone="neutral">Archived</Pill>}
            </div>
            {project.description && <p className="max-w-[640px] text-secondary">{project.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            {manageProject && (
              <ActionMenu
                label="Project actions"
                items={[
                  {
                    label: project.onHold ? "Resume project" : "Put on hold",
                    onClick: () => run({ type: "project.hold", id, data: { onHold: !project.onHold } }, { success: project.onHold ? "Project resumed" : "Project put on hold" }),
                  },
                  !project.isInternal && {
                    label: project.archived ? "Unarchive" : "Archive",
                    tone: project.archived ? undefined : "danger",
                    onClick: () => (project.archived ? run({ type: "project.archive", id, data: { archived: false } }, { success: "Project unarchived" }) : setConfirm("archive")),
                  },
                ].filter(Boolean)}
              />
            )}
            {manageProject && <Button onClick={() => overlays.editProject(id)}>Edit</Button>}
            {canManage(project) && (
              <Button variant="primary" icon={Plus} onClick={() => overlays.newTask({ projectId: id })}>
                Add task
              </Button>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 border-y border-row py-4 sm:flex sm:flex-wrap">
          <Fact label="Deadline">
            {project.deadline ? (
              <>
                <span className={cx(late && "font-medium text-danger")}>{formatShortDate(project.deadline)}</span>
                {!project.archived && <span className={cx(late ? "text-danger" : "text-muted")}>· {deadlineHint(project.deadline, today)}</span>}
              </>
            ) : (
              <span className="text-muted">No deadline</span>
            )}
          </Fact>
          <Fact label={leads.length > 1 ? "Leads" : "Lead"}>
            {leads.length ? (
              <>
                {leads.length === 1 ? <Avatar user={leads[0]} size="sm" /> : <AvatarStack users={leads} max={3} />}
                <span className="truncate">{joinNames(leads)}</span>
              </>
            ) : (
              <span className="text-muted">Admins</span>
            )}
          </Fact>
          <Fact label="Team">
            <AvatarStack users={members} max={5} />
            <span className="truncate text-secondary" title={members.map((u) => u.name).join(", ")}>
              {pluralize(members.length, "member")}
            </span>
          </Fact>
        </dl>
      </header>

      <section aria-labelledby="p-phase" className="flex flex-col gap-4 rounded-xl border border-line bg-card px-5 py-[18px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="label-caps text-[11px] text-faint">
              Phase {step + 1} of {phases.length}
            </span>
            <h2 id="p-phase" className={cx("text-base font-semibold", project.onHold ? "text-muted" : "text-strong")}>
              {phaseLabel(project.phase)}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {phaseTasks.length > 0 && (
              <span className="text-[13px] text-muted">
                {phaseTasks.length - phaseOpen} of {pluralize(phaseTasks.length, "task")} done
              </span>
            )}
            {next && manageProject && (
              <Button variant="outline" size="sm" loading={busy && !confirm} onClick={() => (phaseOpen ? setConfirm("advance") : advance())}>
                Move to {phaseLabel(next)} →
              </Button>
            )}
          </div>
        </div>
        <ol className="grid gap-1" style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))` }}>
          {phases.map((p, i) => (
            <li key={p._id} className="flex min-w-0 flex-col gap-2" aria-current={i === step ? "step" : undefined}>
              <span
                aria-hidden
                className="block h-2 rounded"
                style={{
                  background:
                    i < step ? (project.onHold ? "var(--phase-done-hold)" : "var(--phase-done)") : i === step ? (project.onHold ? "var(--phase-current-hold)" : "var(--phase-current)") : "var(--phase-todo)",
                }}
              />
              <span title={p.name} className={cx("truncate text-[11px] sm:text-xs", i === step ? "font-semibold text-accent-light" : i < step ? "text-secondary" : "text-faint")}>
                {p.name}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <TabGroup
        label="Project sections"
        value={tab}
        onChange={setTab}
        items={[
          { value: "tasks", label: "Tasks", count: tasks.filter(isOpenTask).length },
          { value: "chat", label: "Chat", badge: chatUnread },
          { value: "meetings", label: "Meetings", count: meetings.length || undefined },
          { value: "decisions", label: "Decisions", count: decisions.length || undefined },
          { value: "notes", label: "Notes" },
        ]}
      />

      {tab === "tasks" && <TasksTab project={project} tasks={tasks} />}
      {tab === "chat" && conversation && <ChatTab project={project} conversation={conversation} />}
      {tab === "meetings" && <MeetingsTab project={project} meetings={meetings} />}
      {tab === "decisions" && <DecisionsTab decisions={decisions} />}
      {tab === "notes" && <NotesTab key={project.notes} project={project} />}

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} busy={busy} {...(confirm ? confirmations[confirm] : {})} />
    </Page>
  );
}

// ---------------------------------------------------------------- tasks tab

function TasksTab({ project, tasks }) {
  const overlays = useOverlays();
  const { canManage } = useTaskManagement();
  const [showDone, setShowDone] = useState(false);
  const [expanded, setExpanded] = useState({});
  const phases = projectPhases(project).map((p) => p._id);
  const current = phaseIndexIn(project, project.phase);
  const phaseLabel = (id) => phaseName(project, id);
  const byPhase = (phase) => {
    const list = tasks.filter((t) => t.phase === phase);
    return { open: list.filter(isOpenTask), done: list.filter((t) => !isOpenTask(t)) };
  };
  const now = byPhase(project.phase);
  // Later phases first (the next one leads), then earlier phases from most recent back.
  const others = [...phases.slice(current + 1), ...phases.slice(0, current).reverse()]
    .map((phase) => ({ phase, ...byPhase(phase), later: phaseIndexIn(project, phase) > current }))
    .filter((g) => g.open.length + g.done.length > 0);

  if (!tasks.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-dash px-6 py-12 text-center">
        <p className="font-medium text-fg">No tasks yet</p>
        <p className="max-w-[420px] text-[13px] text-muted">
          {canManage(project) ? "Add the first task for this project. Tasks are grouped by phase, starting with the current one." : "This project’s leads add tasks here. They’re grouped by phase, starting with the current one."}
        </p>
        {canManage(project) && (
          <Button variant="primary" size="sm" icon={Plus} onClick={() => overlays.newTask({ projectId: project._id })}>
            Add task
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <TaskListHead className="px-px" />
      <section aria-labelledby="t-current" className="overflow-hidden rounded-xl border border-decision-line bg-card">
        <div className="flex items-center justify-between gap-2.5 border-b border-line px-[18px] py-3">
          <h3 id="t-current" className="text-[13px] font-semibold text-accent-light">
            {phaseLabel(project.phase)} · current phase
          </h3>
          <span className="text-xs text-muted">
            {now.open.length} open · {now.done.length} done
          </span>
        </div>
        {now.open.map((t) => (
          <TaskRow key={t._id} task={t} meta="source" />
        ))}
        {showDone && now.done.map((t) => <TaskRow key={t._id} task={t} meta="source" />)}
        {now.open.length === 0 && !showDone && <p className="px-[18px] py-3.5 text-[13px] text-muted">Nothing open in {phaseLabel(project.phase)}.</p>}
        {now.done.length > 0 && (
          <button type="button" onClick={() => setShowDone((v) => !v)} className="block w-full border-t border-row px-[18px] py-3 text-left text-[13px] font-medium text-muted hover:text-fg">
            {showDone ? "Hide done" : `Show ${now.done.length} done`}
          </button>
        )}
      </section>

      {others.length > 0 && (
        <section aria-label="Other phases" className="overflow-hidden rounded-xl border border-line bg-card">
          {others.map((g, i) => {
            const open = expanded[g.phase];
            const isNext = phaseIndexIn(project, g.phase) === current + 1;
            const summary = g.later ? `${g.open.length + g.done.length} planned` : [g.open.length && `${g.open.length} open`, g.done.length && `${g.done.length} done`].filter(Boolean).join(" · ");
            return (
              <div key={g.phase} className={cx(i > 0 && "border-t border-row")}>
                <button
                  type="button"
                  aria-expanded={!!open}
                  onClick={() => setExpanded((e) => ({ ...e, [g.phase]: !open }))}
                  className={cx("flex min-h-11 w-full items-center justify-between gap-2.5 px-[18px] text-[13px] font-medium", g.later ? "text-fg" : "text-secondary", "hover:bg-hover/40")}
                >
                  <span>
                    <span aria-hidden className={cx("mr-1.5 inline-block transition-transform", open && "rotate-90")}>
                      ▸
                    </span>
                    {phaseLabel(g.phase)}
                    {isNext && " · next"}
                  </span>
                  <span className={g.later ? "text-muted" : "text-faint"}>{summary}</span>
                </button>
                {open && (
                  <div className="border-t border-row">
                    {[...g.open, ...g.done].map((t) => (
                      <TaskRow key={t._id} task={t} meta="source" />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- chat tab

function ChatTab({ project, conversation }) {
  const { data, activeUsers, currentUserId } = useWorkspace();
  const people = activeUsers.filter((u) => u._id !== currentUserId && project.memberIds.includes(u._id));
  const messages = conversationMessages(data, conversation._id);
  const send = useSendMessage(conversation._id);
  const createTask = useTaskFromMessage(project._id);
  const listRef = useStickToBottom(messages.length);
  useMarkRead(conversation._id);
  useLiveUpdates();

  return (
    <section aria-label="Project chat" className="flex flex-col gap-3.5 rounded-xl border border-line bg-card px-5 py-[18px]">
      {messages.length > 0 ? (
        <div ref={listRef} className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pt-1 pr-1">
          {withDayDividers(messages, (m) => (
            <ChannelMessage message={m} onCreateTask={createTask} />
          ))}
        </div>
      ) : (
        <p className="text-muted">No messages yet. Everything said here stays with {project.name}.</p>
      )}
      <Composer compact label={`Message ${project.name}`} placeholder={`Message # ${project.name}`} onSend={send} people={people} />
    </section>
  );
}

// ------------------------------------------------------------- meetings tab

function MeetingsTab({ project, meetings }) {
  const overlays = useOverlays();
  const { upcoming, past } = meetingBuckets(meetings);
  const add = (
    <Button variant="outline" size="sm" icon={Plus} onClick={() => overlays.newMeeting({ projectId: project._id })}>
      New meeting
    </Button>
  );
  if (!meetings.length) return <EmptyNote action={add}>No meetings for {project.name} yet.</EmptyNote>;
  return (
    <div className="flex flex-col gap-3">
      <Card className="overflow-hidden">
        {[...upcoming, ...past].map((m) => (
          <MeetingRow key={m._id} meeting={m} />
        ))}
      </Card>
      <div>{add}</div>
    </div>
  );
}

// ------------------------------------------------------------ decisions tab

export function DecisionList({ decisions, showProject }) {
  const { lookup } = useWorkspace();
  return (
    <section aria-label="Decision log" className="overflow-hidden rounded-xl border border-decision-line bg-decision">
      {decisions.map((d) => (
        <Link key={d._id} href={`/meetings/${d.meeting._id}`} className="flex gap-3 border-b border-decision-divider px-[18px] py-3.5 last:border-b-0 hover:bg-accent-tint/30">
          <span aria-hidden className="text-accent">
            ✓
          </span>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-accent-tint-text">{d.text}</span>
            <span className="text-xs text-decision-meta">
              {formatShortDate(d.createdAt.slice(0, 10))} · {showProject ? `${lookup.projects[d.meeting.projectId]?.name} · ` : ""}
              {d.meeting.title}
            </span>
          </span>
        </Link>
      ))}
    </section>
  );
}

function DecisionsTab({ decisions }) {
  if (!decisions.length) return <EmptyNote>No decisions yet. Decisions typed in this project’s meetings land here automatically.</EmptyNote>;
  return <DecisionList decisions={decisions} />;
}

// ---------------------------------------------------------------- notes tab

function NotesTab({ project }) {
  const { run, busy } = useAction();
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(project.notes);

  const save = async () => {
    if (await run({ type: "project.update", id: project._id, data: { notes } }, { success: "Notes saved" })) setEditing(false);
  };

  if (editing) {
    return (
      <section aria-label="Project notes" className="flex flex-col gap-3">
        <Textarea
          rows={10}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          aria-label="Project notes"
          placeholder="Links, setup info, where credentials live…"
          className="rounded-xl bg-card px-4 py-3.5 leading-[1.65] text-body"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button variant="quiet" size="sm" onClick={() => (setNotes(project.notes), setEditing(false))}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" loading={busy} onClick={save}>
            Save notes
          </Button>
        </div>
      </section>
    );
  }

  if (!project.notes) {
    return (
      <EmptyNote action={<Button variant="outline" size="sm" onClick={() => setEditing(true)}>Write notes</Button>}>
        Keep links, setup info and where credentials live here.
      </EmptyNote>
    );
  }

  return (
    <section aria-label="Project notes" className="group relative rounded-xl border border-line bg-card px-5 py-[18px]">
      <MessageText body={project.notes} className="leading-[1.65] text-body" />
      <Button variant="ghost" size="xs" onClick={() => setEditing(true)} className="reveal absolute top-3 right-3">
        Edit
      </Button>
    </section>
  );
}
