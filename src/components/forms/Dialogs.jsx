"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { announceInvite, useAction } from "@/lib/client/useAction";
import { useToast } from "@/components/providers/ToastProvider";
import { Button, PersonChip } from "@/components/ui/primitives";
import { PeopleMenu } from "@/components/ui/PeopleMenu";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Field, Input, PeoplePicker, Select, Textarea } from "@/components/ui/form";
import { COMPANY_LABEL, DEFAULT_TASK_PRIORITY, TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_STATUSES, TASK_STATUS_LABELS, taskAssigneeIds, taskPriority } from "@/lib/constants";
import { projectPhases } from "@/lib/phases";
import { firstName, pluralize, toLocalInput } from "@/lib/format";
import { canChooseLeads, projectLeadIds } from "@/lib/permissions";
import { MessageSquare } from "lucide-react";
import { useTaskManagement, useTaskThreadSummary } from "@/components/tasks/taskHooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { projectOwner } from "@/lib/selectors";

/** Projects as "Client · Project" options, company projects first. */
function useProjectOptions(includeId, allowed = () => true) {
  const { data, lookup } = useWorkspace();
  return data.projects
    .filter((p) => (!p.archived && allowed(p)) || p._id === includeId)
    .map((p) => ({ project: p, owner: projectOwner(p, lookup.clients) }))
    .sort((a, b) => Number(Boolean(a.owner.clientId)) - Number(Boolean(b.owner.clientId)) || a.owner.label.localeCompare(b.owner.label) || a.project.name.localeCompare(b.project.name))
    .map(({ project, owner }) => ({ value: project._id, label: `${owner.label} · ${project.name}` }));
}

function FormFooter({ formId, busy, label, onClose, onDelete, deleteLabel }) {
  return (
    <>
      {onDelete && (
        <button type="button" onClick={onDelete} className="mr-auto rounded-full px-2 py-2 font-medium text-accent hover:text-accent-light">
          {deleteLabel}
        </button>
      )}
      <Button variant="outline" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="primary" type="submit" form={formId} loading={busy}>
        {label}
      </Button>
    </>
  );
}

// ------------------------------------------------------------------ project

export function ProjectDialog({ open, project, defaults, onClose, onSaved }) {
  return open ? <ProjectForm key={project?._id ?? "new"} project={project} defaults={defaults} onClose={onClose} onSaved={onSaved} /> : null;
}

function ProjectForm({ project, defaults = {}, onClose, onSaved }) {
  const { data, activeUsers, currentUserId, currentUser } = useWorkspace();
  const chooseLeads = canChooseLeads(currentUser);
  const { run, busy, fieldErrors } = useAction();
  const [values, setValues] = useState({
    name: project?.name ?? "",
    description: project?.description ?? "",
    deadline: project?.deadline ?? "",
    memberIds: project?.memberIds ?? [currentUserId],
    leadIds: project ? projectLeadIds(project) : [currentUserId],
    clientId: project ? project.clientId ?? "" : defaults.clientId ?? "",
  });
  const clientOptions = [...data.clients].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c._id, label: c.name }));
  const memberUsers = activeUsers.filter((u) => values.memberIds.includes(u._id));
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    // Only admins send leads; for everyone else the server keeps them.
    const { leadIds, ...rest } = values;
    const payload = { ...rest, clientId: rest.clientId || null };
    if (chooseLeads) payload.leadIds = leadIds.filter((id) => values.memberIds.includes(id));
    const result = project
      ? await run({ type: "project.update", id: project._id, data: payload }, { success: "Project updated" })
      : await run({ type: "project.create", data: payload }, { success: "Project created" });
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
        {!project?.isInternal && (
          <Field label="For" hint="A client, or the company itself" error={fieldErrors.clientId}>
            {(p) => <Select {...p} value={values.clientId} onChange={set("clientId")} options={[{ value: "", label: COMPANY_LABEL }, ...clientOptions]} />}
          </Field>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Deadline" error={fieldErrors.deadline}>
            {(p) => <Input {...p} type="date" value={values.deadline} onChange={set("deadline")} />}
          </Field>
        </div>
        <Field label="Members" error={fieldErrors.memberIds}>
          {(p) => <PeoplePicker {...p} users={activeUsers} value={values.memberIds} onChange={(memberIds) => setValues((v) => ({ ...v, memberIds }))} />}
        </Field>
        {chooseLeads && (
          <Field label="Leads" hint="Leads create and assign this project’s tasks. Admins can always do this too." error={fieldErrors.leadIds}>
            {(p) => (
              <PeoplePicker
                {...p}
                users={memberUsers}
                value={values.leadIds.filter((id) => values.memberIds.includes(id))}
                onChange={(leadIds) => setValues((v) => ({ ...v, leadIds }))}
              />
            )}
          </Field>
        )}
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
  // Tasks can only be created in, or moved to, projects you lead (any project for admins).
  const { canManage, projects: manageable } = useTaskManagement();
  const projectOptions = useProjectOptions(task?.projectId, canManage);
  const internal = manageable.find((p) => p.isInternal);
  const preferred = manageable.find((p) => p._id === defaults.projectId);
  const initialProject = task?.projectId ?? preferred?._id ?? internal?._id ?? manageable[0]?._id ?? "";
  const [values, setValues] = useState({
    title: task?.title ?? defaults.title ?? "",
    description: task?.description ?? defaults.description ?? "",
    projectId: initialProject,
    phase: task?.phase ?? defaults.phase ?? lookup.projects[initialProject]?.phase ?? projectPhases(lookup.projects[initialProject])[0]._id,
    assigneeIds: task ? taskAssigneeIds(task) : defaults.assigneeIds ?? [currentUserId],
    dueDate: task?.dueDate ?? defaults.dueDate ?? "",
    priority: task ? taskPriority(task) : defaults.priority ?? DEFAULT_TASK_PRIORITY,
    status: task?.status ?? "todo",
  });
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const setProject = (e) => {
    const projectId = e.target.value;
    setValues((v) => ({ ...v, projectId, phase: lookup.projects[projectId]?.phase ?? v.phase }));
  };
  // Former assignees stay pickable so saving doesn't silently drop them.
  const people = [...activeUsers, ...values.assigneeIds.filter((id) => !activeUsers.some((u) => u._id === id)).map((id) => lookup.users[id]).filter(Boolean)];

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
          <Field label="Description" hint="Optional. What needs doing, links, acceptance criteria." error={fieldErrors.description}>
            {(p) => <Textarea {...p} rows={3} value={values.description} onChange={set("description")} maxLength={5000} />}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Project" error={fieldErrors.projectId}>
              {(p) => <Select {...p} value={values.projectId} onChange={setProject} options={projectOptions} placeholder="Choose a project" />}
            </Field>
            <Field label="Due date" error={fieldErrors.dueDate}>
              {(p) => <Input {...p} type="date" value={values.dueDate} onChange={set("dueDate")} />}
            </Field>
            <Field label="Priority" error={fieldErrors.priority}>
              {(p) => <Select {...p} value={values.priority} onChange={set("priority")} options={TASK_PRIORITIES.map((v) => ({ value: v, label: TASK_PRIORITY_LABELS[v] }))} />}
            </Field>
            {task && (
              <Field label="Status" error={fieldErrors.status}>
                {(p) => <Select {...p} value={values.status} onChange={set("status")} options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))} />}
              </Field>
            )}
          </div>
          <Field label="Assignees" hint="Pick one or more people, or leave it for later" error={fieldErrors.assigneeIds}>
            {(p) => <PeoplePicker {...p} users={people} value={values.assigneeIds} onChange={(assigneeIds) => setValues((v) => ({ ...v, assigneeIds }))} />}
          </Field>
          {task && <DiscussionLink taskId={task._id} onClick={onClose} />}
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

/** Link to the task's page, where its discussion is. Closes the dialog on the way. */
function DiscussionLink({ taskId, onClick }) {
  const { count, unread } = useTaskThreadSummary(taskId);
  return (
    <Link href={`/tasks/${taskId}`} onClick={onClick} className="flex items-center gap-2 self-start text-[13px] text-accent hover:text-accent-light">
      <MessageSquare className="size-4" aria-hidden />
      {count ? `Open the task · ${pluralize(count, "comment")}${unread ? ` (${unread} new)` : ""}` : "Open the task page to comment on it"}
    </Link>
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
  const { data, lookup, activeUsers, currentUserId } = useWorkspace();
  const { run, busy, fieldErrors } = useAction();
  const [confirming, setConfirming] = useState(false);
  // Meetings still belong to a project; new ones go to the company project unless opened from one.
  const internal = data.projects.find((p) => p.isInternal) ?? data.projects.find((p) => !p.archived);
  const projectId = meeting?.projectId ?? defaults.projectId ?? internal?._id ?? "";
  const [values, setValues] = useState({
    title: meeting?.title ?? "",
    startsAt: meeting ? toLocalInput(meeting.startsAt) : defaultStart(),
    agenda: meeting ? meeting.agenda.map((a, i) => `${i + 1}. ${a.title}`).join("\n") : "",
    callUrl: meeting?.callUrl ?? "",
    attendeeIds: meeting?.attendeeIds ?? defaults.attendeeIds ?? [currentUserId],
  });
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const attendees = values.attendeeIds.map((id) => lookup.users[id]).filter(Boolean);
  const candidates = activeUsers.filter((u) => !values.attendeeIds.includes(u._id));
  const agendaError = fieldErrors.agenda ?? Object.entries(fieldErrors).find(([key]) => key.startsWith("agenda."))?.[1];

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      ...values,
      projectId,
      startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : "",
      // "1. Topic" and "- Topic" are list markers, not part of the topic.
      agenda: values.agenda.split("\n").map((line) => line.trim().replace(/^(\d+[.)]|[-*•])\s+/, "")),
    };
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
            label={meeting ? "Save changes" : "Schedule"}
            onClose={onClose}
            onDelete={meeting ? () => setConfirming(true) : null}
            deleteLabel="Delete meeting"
          />
        }
      >
        <form id="meeting-form" onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Title" error={fieldErrors.title}>
              {(p) => <Input {...p} value={values.title} onChange={set("title")} placeholder="Weekly sync" data-autofocus autoComplete="off" />}
            </Field>
            <Field label="Starts" error={fieldErrors.startsAt}>
              {(p) => <Input {...p} type="datetime-local" value={values.startsAt} onChange={set("startsAt")} />}
            </Field>
          </div>
          <Field label="Agenda" error={agendaError}>
            {(p) => <Textarea {...p} rows={4} value={values.agenda} onChange={set("agenda")} placeholder="What will you cover? One point per line works well." />}
          </Field>
          <Field label="Call link" hint="Optional: Google Meet, Zoom or any link" error={fieldErrors.callUrl}>
            {(p) => <Input {...p} type="url" inputMode="url" placeholder="https://meet.google.com/…" value={values.callUrl} onChange={set("callUrl")} />}
          </Field>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] text-secondary">Attendees</span>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Attendees">
              {attendees.map((u) => (
                <PersonChip
                  key={u._id}
                  user={u}
                  label={u._id === currentUserId ? `${firstName(u.name)} (you)` : u.name}
                  onRemove={() => setValues((v) => ({ ...v, attendeeIds: v.attendeeIds.filter((id) => id !== u._id) }))}
                  removeLabel={`Remove ${u.name}`}
                />
              ))}
              <PeopleMenu label="Add attendee" people={candidates} onPick={(u) => setValues((v) => ({ ...v, attendeeIds: [...v.attendeeIds, u._id] }))} />
            </div>
            {fieldErrors.attendeeIds && (
              <p className="text-xs text-danger" role="alert">
                {fieldErrors.attendeeIds}
              </p>
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
  const toast = useToast();
  const [email, setEmail] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    const invite = await run({ type: "member.invite", data: { email } });
    if (!invite) return;
    announceInvite(toast, invite, "Invite sent");
    onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title="Invite member"
      description="We email them an invite link. They join as a member the first time they sign up or sign in with this email."
      footer={<FormFooter formId="invite-form" busy={busy} label="Send invite" onClose={onClose} />}
    >
      <form id="invite-form" onSubmit={submit} noValidate>
        <Field label="Email" error={fieldErrors.email}>
          {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" data-autofocus />}
        </Field>
      </form>
    </Dialog>
  );
}

// ------------------------------------------------------------------- client

export function ClientDialog({ open, client, onClose, onSaved }) {
  return open ? <ClientForm key={client?._id ?? "new"} client={client} onClose={onClose} onSaved={onSaved} /> : null;
}

function ClientForm({ client, onClose, onSaved }) {
  const { data } = useWorkspace();
  const { run, busy, fieldErrors } = useAction();
  const [confirming, setConfirming] = useState(false);
  const [values, setValues] = useState({ name: client?.name ?? "", description: client?.description ?? "" });
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const projects = client ? data.projects.filter((p) => p.clientId === client._id).length : 0;

  const submit = async (e) => {
    e.preventDefault();
    const result = client
      ? await run({ type: "client.update", id: client._id, data: values }, { success: "Client updated" })
      : await run({ type: "client.create", data: values }, { success: "Client added" });
    if (result) {
      onClose();
      onSaved?.(result);
    }
  };
  const remove = async () => {
    if (await run({ type: "client.delete", id: client._id }, { success: "Client removed" })) {
      onClose();
      onSaved?.(null);
    }
  };

  return (
    <>
      <Dialog
        open={!confirming}
        onClose={onClose}
        size="sm"
        title={client ? "Edit client" : "New client"}
        footer={
          <FormFooter
            formId="client-form"
            busy={busy}
            label={client ? "Save" : "Add client"}
            onClose={onClose}
            onDelete={client && !projects ? () => setConfirming(true) : null}
            deleteLabel="Remove"
          />
        }
      >
        <form id="client-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="Name" error={fieldErrors.name}>
            {(p) => <Input {...p} value={values.name} onChange={set("name")} data-autofocus autoComplete="off" placeholder="Company name" />}
          </Field>
          <Field label="Description" hint="One line about who they are" error={fieldErrors.description}>
            {(p) => <Input {...p} value={values.description} onChange={set("description")} />}
          </Field>
          {client && projects > 0 && <p className="text-xs text-faint">To remove this client, move its {pluralize(projects, "project")} to another client or to the company first.</p>}
        </form>
      </Dialog>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={remove}
        busy={busy}
        tone="danger"
        title={`Remove ${client?.name}?`}
        description="The client is removed for everyone. It has no projects, so nothing else changes."
        confirmLabel="Remove client"
      />
    </>
  );
}

// -------------------------------------------------------------------- group

export function GroupDialog({ open, group, onClose }) {
  return open ? <GroupForm key={group?._id ?? "new"} group={group} onClose={onClose} /> : null;
}

function GroupForm({ group, onClose }) {
  const { activeUsers, currentUserId } = useWorkspace();
  const router = useRouter();
  const { run, busy, fieldErrors } = useAction();
  const [values, setValues] = useState({ name: group?.name ?? "", memberIds: group?.memberIds ?? [] });
  // You're always in a group you start, so you aren't offered when creating one.
  const people = group ? activeUsers : activeUsers.filter((u) => u._id !== currentUserId);

  const submit = async (e) => {
    e.preventDefault();
    const result = group
      ? await run({ type: "group.update", id: group._id, data: values }, { success: "Group updated" })
      : await run({ type: "group.create", data: values }, { success: "Group created" });
    if (!result) return;
    onClose();
    if (!group) router.push(`/inbox/${result._id}`);
    else if (!result.memberIds.includes(currentUserId)) router.push("/inbox");
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={group ? "Edit group" : "New group"}
      description={group ? undefined : "A chat for a project, a team or anything else. Everyone in it can rename it and add people."}
      footer={<FormFooter formId="group-form" busy={busy} label={group ? "Save" : "Create group"} onClose={onClose} />}
    >
      <form id="group-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Name" error={fieldErrors.name}>
          {(p) => <Input {...p} value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} data-autofocus autoComplete="off" placeholder="Design crew" />}
        </Field>
        <Field label="People" hint={group ? "Unpick yourself to leave the group" : undefined} error={fieldErrors.memberIds}>
          {(p) => <PeoplePicker {...p} users={people} value={values.memberIds} onChange={(memberIds) => setValues((v) => ({ ...v, memberIds }))} />}
        </Field>
      </form>
    </Dialog>
  );
}
