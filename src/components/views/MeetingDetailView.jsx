"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { X } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useOpenTask } from "@/components/tasks/taskHooks";
import { Button, Checkbox, cx, EmptyNote, IconButton, Page, Pill, SectionLabel } from "@/components/ui/primitives";
import { useAction } from "@/lib/client/useAction";
import { firstName, formatDue, formatShortDate, formatWhen, joinNames, pluralize, todayISO } from "@/lib/format";
import { actionItems, isOverdue, previousMeeting, stillOpenFromLast } from "@/lib/selectors";
import { parseActionItem, parseDay } from "@/lib/text";

export function MeetingDetailView() {
  const { id } = useParams();
  const { data, lookup } = useWorkspace();
  const overlays = useOverlays();
  const toast = useToast();
  const { run, busy } = useAction();
  const meeting = lookup.meetings[id];

  if (!meeting) {
    return (
      <Page width="sm">
        <EmptyNote action={<Button href="/meetings" size="sm">Back to meetings</Button>}>This meeting doesn’t exist, or it was deleted.</EmptyNote>
      </Page>
    );
  }

  const project = lookup.projects[meeting.projectId];
  const attendees = meeting.attendeeIds.map((uid) => lookup.users[uid]).filter(Boolean);
  const stillOpen = stillOpenFromLast(meeting, data);
  const previous = previousMeeting(meeting, data.meetings);

  const end = async () => {
    const result = await run({ type: "meeting.end", id });
    if (result) toast.success("Meeting ended", result.notified ? `${pluralize(result.notified, "person", "people")} notified about their action items` : undefined);
  };

  return (
    <Page width="sm" className="gap-[22px]">
      <Link href="/meetings" className="self-start text-[13px] text-muted hover:text-fg">
        ← Meetings
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] text-strong">{meeting.title}</h1>
            {meeting.endedAt && <Pill tone="neutral">Ended</Pill>}
          </div>
          <p className="text-muted">
            {formatWhen(meeting.startsAt)} ·{" "}
            <Link href={`/projects/${project?._id}`} className="text-accent hover:text-accent-light">
              {project?.name}
            </Link>
            {attendees.length > 0 && ` · ${joinNames(attendees)}`}
            {meeting.callUrl && (
              <>
                {" · "}
                <a href={meeting.callUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-light">
                  Join call
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => overlays.editMeeting(id)}>Edit</Button>
          {!meeting.endedAt && (
            <Button variant="primary" loading={busy} onClick={end}>
              End meeting
            </Button>
          )}
        </div>
      </header>

      {stillOpen.length > 0 && (
        <section aria-label="Still open from last meeting" className="flex flex-col gap-1.5 rounded-[10px] border border-warning-line bg-warning-bg px-4 py-3 text-warning">
          {stillOpen.length > 1 && (
            <p>
              Still open from <LastMeetingLink meeting={previous} />:
            </p>
          )}
          {stillOpen.map((t) => (
            <OpenItem key={t._id} task={t} prefix={stillOpen.length === 1 && <>Still open from <LastMeetingLink meeting={previous} />: </>} />
          ))}
        </section>
      )}

      <Agenda meeting={meeting} />
      <Notes key={meeting._id} meeting={meeting} />
      <Decisions meeting={meeting} />
      <ActionItems meeting={meeting} project={project} />

      <p className="text-xs leading-relaxed text-faint">
        Decisions go straight to the {project?.name} decision log and action items are real tasks for each person.
        {meeting.endedAt ? " This meeting has ended; you can still add to it." : " When you end the meeting, each person gets one notification listing their action items."}
      </p>
    </Page>
  );
}

function LastMeetingLink({ meeting }) {
  return (
    <Link href={`/meetings/${meeting._id}`} className="underline-offset-2 hover:underline">
      last meeting
    </Link>
  );
}

function OpenItem({ task, prefix }) {
  const { lookup } = useWorkspace();
  const openTask = useOpenTask();
  const due = isOverdue(task) ? "overdue" : task.dueDate ? `due ${formatDue(task.dueDate).replace(/^(Today|Tomorrow)$/, (d) => d.toLowerCase())}` : null;
  return (
    <div className={cx("flex flex-wrap items-center justify-between gap-2.5", !prefix && "pl-3")}>
      <span>
        {prefix}
        <span className="text-strong">{task.title}</span> · {firstName(lookup.users[task.assigneeId]?.name)}
        {due && ` · ${due}`}
      </span>
      <button type="button" onClick={() => openTask(task)} className="text-[13px] text-warning-strong hover:text-warning">
        Review
      </button>
    </div>
  );
}

/** Inline "+ Add …" input that submits on Enter. */
function AddLine({ placeholder, label, onAdd, tone = "default" }) {
  const [value, setValue] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    const text = value.trim();
    if (text && (await onAdd(text))) setValue("");
  };
  return (
    <form onSubmit={submit} className="flex min-h-11 items-center gap-3">
      <span aria-hidden className={cx("w-[18px] text-center", tone === "decision" ? "text-[#4c8a7a]" : "text-faint")}>
        +
      </span>
      <label className="flex-1">
        <span className="sr-only">{label}</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className={cx("h-9 w-full min-w-0 bg-transparent outline-none placeholder:text-faint", tone === "decision" ? "text-accent-tint-text placeholder:text-decision-meta/70" : "text-fg")}
        />
      </label>
    </form>
  );
}

function Agenda({ meeting }) {
  const { run } = useAction();
  return (
    <section aria-labelledby="s-agenda" className="flex flex-col gap-2.5">
      <SectionLabel id="s-agenda">Agenda</SectionLabel>
      <div className="rounded-xl border border-line bg-card px-4 py-1.5">
        {meeting.agenda.map((item) => (
          <div key={item._id} className="group flex min-h-11 items-center gap-3 border-b border-row">
            <label className="flex flex-1 cursor-pointer items-center gap-3">
              <Checkbox checked={item.covered} onChange={() => run({ type: "agenda.toggle", id: meeting._id, data: { itemId: item._id } })} />
              <span className={cx(item.covered && "text-muted line-through")}>{item.title}</span>
            </label>
            <IconButton icon={X} label={`Remove topic: ${item.title}`} className="reveal" onClick={() => run({ type: "agenda.remove", id: meeting._id, data: { itemId: item._id } })} />
          </div>
        ))}
        <AddLine label="New agenda topic" placeholder="Add a topic" onAdd={(text) => run({ type: "agenda.add", id: meeting._id, data: { text } }, { silent: true })} />
      </div>
    </section>
  );
}

function Notes({ meeting }) {
  const { run } = useAction();
  const [notes, setNotes] = useState(meeting.notes);
  const [savedNotes, setSavedNotes] = useState(meeting.notes);
  const [status, setStatus] = useState(""); // "" | "Saving…" | "Saved"
  const dirty = notes !== savedNotes;

  const save = async () => {
    if (!dirty) return;
    const text = notes;
    setStatus("Saving…");
    const ok = await run({ type: "meeting.update", id: meeting._id, data: { notes: text } }, { silent: true });
    if (ok) setSavedNotes(text);
    setStatus(ok ? "Saved" : "");
  };

  // Autosave a moment after typing stops.
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(save, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, savedNotes]);

  return (
    <section aria-labelledby="s-notes" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <SectionLabel id="s-notes">Notes</SectionLabel>
        <span className="text-xs text-faint" aria-live="polite">
          {dirty && status === "Saved" ? "" : status}
        </span>
      </div>
      <label className="flex">
        <span className="sr-only">Meeting notes</span>
        <textarea
          rows={6}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={save}
          placeholder="Write anything…"
          className="flex-1 resize-y rounded-xl border border-line bg-card px-4 py-3.5 leading-[1.65] text-body outline-none placeholder:text-faint focus:border-accent/60"
        />
      </label>
    </section>
  );
}

function Decisions({ meeting }) {
  const { run } = useAction();
  return (
    <section aria-labelledby="s-decisions" className="flex flex-col gap-2.5">
      <SectionLabel id="s-decisions" className="!text-accent-light">
        Decisions
      </SectionLabel>
      <div className="rounded-xl border border-decision-line bg-decision px-4 py-1.5">
        {meeting.decisions.map((d) => (
          <div key={d._id} className="group flex min-h-11 items-center gap-3 border-b border-decision-divider text-accent-tint-text">
            <span aria-hidden className="w-[18px] text-center text-accent">
              ✓
            </span>
            <span className="flex-1 py-2">{d.text}</span>
            <IconButton icon={X} label="Remove decision" className="reveal hover:bg-accent-tint" onClick={() => run({ type: "decision.remove", id: meeting._id, data: { itemId: d._id } })} />
          </div>
        ))}
        <AddLine tone="decision" label="New decision" placeholder="Add a decision" onAdd={(text) => run({ type: "decision.add", id: meeting._id, data: { text } }, { silent: true })} />
      </div>
    </section>
  );
}

function ActionItems({ meeting, project }) {
  const { data, lookup, activeUsers } = useWorkspace();
  const openTask = useOpenTask();
  const { run } = useAction();
  const [draft, setDraft] = useState(null); // { raw, title, assigneeId, dueDate, problems }
  const items = actionItems(meeting, data.tasks);
  const today = todayISO();

  const memberIds = new Set([...(project?.memberIds ?? []), ...meeting.attendeeIds]);
  const members = activeUsers.filter((u) => memberIds.has(u._id));
  const candidates = members.length ? members : activeUsers;

  const create = async ({ title, assigneeId, dueDate }) => {
    const ok = await run(
      { type: "task.create", data: { projectId: meeting.projectId, meetingId: meeting._id, title, assigneeId, dueDate } },
      { silent: true }
    );
    if (ok) setDraft(null);
    return Boolean(ok);
  };

  const add = async (raw) => {
    const parsed = parseActionItem(raw, members.length ? members : activeUsers, today);
    // An @name that isn't a project member may still be someone on the team.
    if (parsed.problems.assignee?.startsWith("unknown:")) {
      const retry = parseActionItem(raw, activeUsers, today);
      if (retry.assigneeId) Object.assign(parsed, { assigneeId: retry.assigneeId, problems: { ...retry.problems } });
    }
    if (!Object.keys(parsed.problems).length) return create(parsed);
    setDraft({ raw, ...parsed });
    return true;
  };

  const resolve = (patch) => {
    const next = { ...draft, ...patch.values, problems: { ...draft.problems } };
    delete next.problems[patch.solved];
    if (!Object.keys(next.problems).length) create(next);
    else setDraft(next);
  };

  return (
    <section aria-labelledby="s-actions" className="flex flex-col gap-2.5">
      <SectionLabel id="s-actions">Action items</SectionLabel>
      <div className="rounded-xl border border-line bg-card px-4 py-1.5">
        {items.map((t) => (
          <div key={t._id} className="flex min-h-11 flex-wrap items-center gap-3 border-b border-row py-1.5">
            <button type="button" onClick={() => openTask(t)} className={cx("flex-[1_1_220px] text-left hover:text-strong", t.status === "done" && "text-muted line-through")}>
              {t.title}
            </button>
            <span className={cx("text-[13px]", isOverdue(t, today) ? "text-danger" : "text-secondary")}>
              {firstName(lookup.users[t.assigneeId]?.name)}
              {t.dueDate && ` · ${formatDue(t.dueDate, today)}`}
            </span>
          </div>
        ))}

        {draft && <DraftPrompt key={Object.keys(draft.problems).join()} draft={draft} candidates={candidates} onResolve={resolve} onCancel={() => setDraft(null)} />}

        {!draft && <AddLine label="New action item" placeholder="Task @name day, e.g. Update API docs @Tanvir mon" onAdd={add} />}
      </div>
    </section>
  );
}

/** Asks inline for whatever the one-line parser couldn't work out. */
function DraftPrompt({ draft, candidates, onResolve, onCancel }) {
  const [title, setTitle] = useState(draft.title);
  const [date, setDate] = useState("");
  const { problems } = draft;
  const prompt = problems.title ? "title" : problems.assignee ? "assignee" : "day";
  const unknown = problems.assignee?.startsWith("unknown:") ? problems.assignee.slice(8) : null;

  return (
    <div className="flex flex-col gap-2.5 border-b border-row py-3">
      <p className="text-[13px] text-secondary">
        <span className="text-fg">{draft.title || draft.raw}</span>
        {prompt === "title" && " — what’s the task? Type a title before the @name."}
        {prompt === "assignee" && (unknown ? ` — there’s no one called “${unknown}”. Who’s doing it?` : " — who’s doing it?")}
        {prompt === "day" && ` — couldn’t read “${problems.day}” as a day. When is it due?`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {prompt === "title" && (
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim()) onResolve({ solved: "title", values: { title: title.trim() } });
            }}
          >
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Task title"
              className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-input px-3 outline-none focus:border-accent/60"
            />
            <Button size="sm" variant="primary" type="submit">
              Add
            </Button>
          </form>
        )}
        {prompt === "assignee" &&
          candidates.map((u) => (
            <Button key={u._id} size="sm" variant="outline" onClick={() => onResolve({ solved: "assignee", values: { assigneeId: u._id } })}>
              {firstName(u.name)}
            </Button>
          ))}
        {prompt === "day" && (
          <>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Due date"
              className="h-9 rounded-lg border border-line bg-input px-3 outline-none focus:border-accent/60"
            />
            <Button size="sm" variant="primary" disabled={!date || !parseDay(date)} onClick={() => onResolve({ solved: "day", values: { dueDate: date } })}>
              Set date
            </Button>
            <Button size="sm" variant="quiet" onClick={() => onResolve({ solved: "day", values: { dueDate: "" } })}>
              No due date
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
