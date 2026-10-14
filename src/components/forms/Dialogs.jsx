"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useAction } from "@/lib/client/useAction";
import { Button } from "@/components/ui/primitives";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Field, Input, PeoplePicker, Select } from "@/components/ui/form";
import { PHASES, phaseLabel, TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/constants";
import { toLocalInput } from "@/lib/format";

const phaseOptions = PHASES.map((p) => ({ value: p, label: phaseLabel(p) }));

function useProjectOptions(includeId) {
  const { data } = useWorkspace();
  return data.projects
    .filter((p) => !p.archived || p._id === includeId)
    .sort((a, b) => Number(a.isInternal) - Number(b.isInternal) || a.name.localeCompare(b.name))
    .map((p) => ({ value: p._id, label: p.name }));
}

function FormFooter({ formId, busy, label, onClose, onDelete, deleteLabel }) {
  return (
    <>
      {onDelete && (
        <Button variant="danger" size="sm" onClick={onDelete} className="mr-auto">
          {deleteLabel}
        </Button>
      )}
      <Button variant="quiet" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="primary" type="submit" form={formId} loading={busy}>
        {label}
      </Button>
    </>
  );
}

// ------------------------------------------------------------------ project

export function ProjectDialog({ open, project, onClose, onSaved }) {
  return open ? <ProjectForm key={project?._id ?? "new"} project={project} onClose={onClose} onSaved={onSaved} /> : null;
}

function ProjectForm({ project, onClose, onSaved }) {
  const { activeUsers, currentUserId } = useWorkspace();
  const { run, busy, fieldErrors } = useAction();
  const [values, setValues] = useState({
    name: project?.name ?? "",
    description: project?.description ?? "",
    phase: project?.phase ?? "idea",
    deadline: project?.deadline ?? "",
    memberIds: project?.memberIds ?? [currentUserId],
  });
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const result = project
      ? await run({ type: "project.update", id: project._id, data: values }, { success: "Project updated" })
      : await run({ type: "project.create", data: values }, { success: "Project created" });
    if (result) {
      onClose();
      onSaved?.(result);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={project ? "Edit project" : "New project"}
      footer={<FormFooter formId="project-form" busy={busy} label={project ? "Save" : "Create project"} onClose={onClose} />}
    >
      <form id="project-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Name" error={fieldErrors.name}>
          {(p) => <Input {...p} value={values.name} onChange={set("name")} data-autofocus autoComplete="off" />}
        </Field>
        <Field label="Description" hint="One line, shown under the name everywhere" error={fieldErrors.description}>
          {(p) => <Input {...p} value={values.description} onChange={set("description")} />}
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Phase" error={fieldErrors.phase}>
            {(p) => <Select {...p} value={values.phase} onChange={set("phase")} options={phaseOptions} />}
          </Field>
          <Field label="Deadline" error={fieldErrors.deadline}>
            {(p) => <Input {...p} type="date" value={values.deadline} onChange={set("deadline")} />}
          </Field>
        </div>
        <Field label="Members" error={fieldErrors.memberIds}>
          {(p) => <PeoplePicker {...p} users={activeUsers} value={values.memberIds} onChange={(memberIds) => setValues((v) => ({ ...v, memberIds }))} />}
        </Field>
      </form>
    </Dialog>
  );
}

// --------------------------------------------------------------------- task

export function TaskDialog({ open, task, defaults, onClose }) {
  return open ? <TaskForm key={task?._id ?? "new"} task={task} defaults={defaults} onClose={onClose} /> : null;
}

function TaskForm({ task, defaults = {}, onClose }) {
  const { data, lookup, activeUsers, currentUserId } = useWorkspace();
  const { run, busy, fieldErrors } = useAction();
  const [confirming, setConfirming] = useState(false);
  const projectOptions = useProjectOptions(task?.projectId);
  const internal = data.projects.find((p) => p.isInternal);
  const initialProject = task?.projectId ?? defaults.projectId ?? internal?._id ?? "";
  const [values, setValues] = useState({
    title: task?.title ?? defaults.title ?? "",
    projectId: initialProject,
    phase: task?.phase ?? defaults.phase ?? lookup.projects[initialProject]?.phase ?? "idea",
    assigneeId: task?.assigneeId ?? defaults.assigneeId ?? currentUserId,
    dueDate: task?.dueDate ?? defaults.dueDate ?? "",
    status: task?.status ?? "todo",
  });
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const setProject = (e) => {
    const projectId = e.target.value;
    setValues((v) => ({ ...v, projectId, phase: lookup.projects[projectId]?.phase ?? v.phase }));
  };
  const people = activeUsers.some((u) => u._id === values.assigneeId) ? activeUsers : [...activeUsers, lookup.users[values.assigneeId]].filter(Boolean);

  const submit = async (e) => {
    e.preventDefault();
    const result = task
      ? await run({ type: "task.update", id: task._id, data: values }, { success: "Task updated" })
      : await run({ type: "task.create", data: { ...values, messageId: defaults.messageId, meetingId: defaults.meetingId } }, { success: "Task added" });
    if (result) onClose();
  };
  const remove = async () => {
    if (await run({ type: "task.delete", id: task._id }, { success: "Task deleted" })) onClose();
  };

  return (
    <>
      <Dialog
        open={!confirming}
        onClose={onClose}
        title={task ? "Edit task" : "Add task"}
        footer={
          <FormFooter
            formId="task-form"
            busy={busy}
            label={task ? "Save" : "Add task"}
            onClose={onClose}
            onDelete={task ? () => setConfirming(true) : null}
            deleteLabel="Delete"
          />
        }
      >
        <form id="task-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="Title" error={fieldErrors.title}>
            {(p) => <Input {...p} value={values.title} onChange={set("title")} data-autofocus autoComplete="off" />}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Project" error={fieldErrors.projectId}>
              {(p) => <Select {...p} value={values.projectId} onChange={setProject} options={projectOptions} placeholder="Choose a project" />}
            </Field>
            <Field label="Phase" error={fieldErrors.phase}>
              {(p) => <Select {...p} value={values.phase} onChange={set("phase")} options={phaseOptions} />}
            </Field>
            <Field label="Assignee" error={fieldErrors.assigneeId}>
              {(p) => <Select {...p} value={values.assigneeId} onChange={set("assigneeId")} options={people.map((u) => ({ value: u._id, label: u._id === currentUserId ? `${u.name} (me)` : u.name }))} />}
            </Field>
            <Field label="Due date" error={fieldErrors.dueDate}>
              {(p) => <Input {...p} type="date" value={values.dueDate} onChange={set("dueDate")} />}
            </Field>
            {task && (
              <Field label="Status" error={fieldErrors.status}>
                {(p) => <Select {...p} value={values.status} onChange={set("status")} options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))} />}
              </Field>
            )}
          </div>
        </form>
      </Dialog>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={remove}
        busy={busy}
        tone="danger"
        title="Delete this task?"
        description={`“${task?.title}” will be removed for everyone.`}
        confirmLabel="Delete task"
      />
    </>
  );
}

// ------------------------------------------------------------------ meeting

export function MeetingDialog({ open, meeting, defaults, onClose, onSaved }) {
  return open ? <MeetingForm key={meeting?._id ?? "new"} meeting={meeting} defaults={defaults} onClose={onClose} onSaved={onSaved} /> : null;
}

function defaultStart() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return toLocalInput(d.toISOString());
}

function MeetingForm({ meeting, defaults = {}, onClose, onSaved }) {
  const { data, lookup, activeUsers } = useWorkspace();
  const { run, busy, fieldErrors } = useAction();
  const [confirming, setConfirming] = useState(false);
  const projectOptions = useProjectOptions(meeting?.projectId);
  const internal = data.projects.find((p) => p.isInternal);
  const projectId = meeting?.projectId ?? defaults.projectId ?? internal?._id ?? "";
  const [values, setValues] = useState({
    projectId,
    title: meeting?.title ?? "",
    startsAt: meeting ? toLocalInput(meeting.startsAt) : defaultStart(),
    callUrl: meeting?.callUrl ?? "",
    attendeeIds: meeting?.attendeeIds ?? lookup.projects[projectId]?.memberIds ?? [],
  });
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const setProject = (e) => {
    const id = e.target.value;
    setValues((v) => ({ ...v, projectId: id, attendeeIds: meeting ? v.attendeeIds : lookup.projects[id]?.memberIds ?? v.attendeeIds }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const payload = { ...values, startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : "" };
    const result = meeting
      ? await run({ type: "meeting.update", id: meeting._id, data: payload }, { success: "Meeting updated" })
      : await run({ type: "meeting.create", data: payload }, { success: "Meeting scheduled" });
    if (result) {
      onClose();
      onSaved?.(result);
    }
  };
  const remove = async () => {
    if (await run({ type: "meeting.delete", id: meeting._id }, { success: "Meeting deleted" })) {
      onClose();
      onSaved?.(null);
    }
  };

  return (
    <>
      <Dialog
        open={!confirming}
        onClose={onClose}
        title={meeting ? "Edit meeting" : "New meeting"}
        footer={
          <FormFooter
            formId="meeting-form"
            busy={busy}
            label={meeting ? "Save" : "Schedule"}
            onClose={onClose}
            onDelete={meeting ? () => setConfirming(true) : null}
            deleteLabel="Delete"
          />
        }
      >
        <form id="meeting-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="Title" error={fieldErrors.title}>
            {(p) => <Input {...p} value={values.title} onChange={set("title")} placeholder="Weekly sync" data-autofocus autoComplete="off" />}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Project" error={fieldErrors.projectId}>
              {(p) => <Select {...p} value={values.projectId} onChange={setProject} options={projectOptions} placeholder="Choose a project" />}
            </Field>
            <Field label="Starts" error={fieldErrors.startsAt}>
              {(p) => <Input {...p} type="datetime-local" value={values.startsAt} onChange={set("startsAt")} />}
            </Field>
          </div>
          <Field label="Call link" hint="Optional: Google Meet, Zoom or any link" error={fieldErrors.callUrl}>
            {(p) => <Input {...p} type="url" inputMode="url" placeholder="https://meet.google.com/…" value={values.callUrl} onChange={set("callUrl")} />}
          </Field>
          <Field label="Attendees" error={fieldErrors.attendeeIds}>
            {(p) => <PeoplePicker {...p} users={activeUsers} value={values.attendeeIds} onChange={(attendeeIds) => setValues((v) => ({ ...v, attendeeIds }))} />}
          </Field>
        </form>
      </Dialog>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={remove}
        busy={busy}
        tone="danger"
        title="Delete this meeting?"
        description="Its agenda, notes and decisions are removed. Action items stay as tasks."
        confirmLabel="Delete meeting"
      />
    </>
  );
}

// ------------------------------------------------------------------- invite

export function InviteDialog({ open, onClose }) {
  return open ? <InviteForm onClose={onClose} /> : null;
}

function InviteForm({ onClose }) {
  const { run, busy, fieldErrors } = useAction();
  const [email, setEmail] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    if (await run({ type: "member.invite", data: { email } }, { success: "Invite sent", successDescription: email })) onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title="Invite member"
      description="They join as a member. You can change their role later."
      footer={<FormFooter formId="invite-form" busy={busy} label="Send invite" onClose={onClose} />}
    >
      <form id="invite-form" onSubmit={submit} noValidate>
        <Field label="Email" error={fieldErrors.email}>
          {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@macrokite.dev" data-autofocus />}
        </Field>
      </form>
    </Dialog>
  );
}
