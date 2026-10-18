"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { announceInvite, useAction } from "@/lib/client/useAction";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/primitives";
import { PrioritySelect } from "@/components/ui/Menus";
import { PeoplePicker, peopleOrder } from "@/components/ui/PeoplePicker";
import { Dialog } from "@/components/ui/Dialog";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { COMPANY_LABEL, DEFAULT_TASK_PRIORITY, TASK_STATUSES, TASK_STATUS_LABELS, taskAssigneeIds, taskPriority } from "@/lib/constants";
import { projectPhases } from "@/lib/phases";
import { toLocalInput } from "@/lib/format";
import { canChooseLeads, projectLeadIds } from "@/lib/permissions";
import { useTaskManagement } from "@/components/tasks/taskHooks";
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

/** Active people from a list of ids, plus anyone already picked (so saving never silently drops them). */
function usePool(ids, keep = []) {
  const { lookup, currentUserId } = useWorkspace();
  const users = [...new Set([...ids, ...keep])].map((id) => lookup.users[id]).filter((u) => u && (u.active || keep.includes(u._id)));
  return peopleOrder(users, currentUserId);
}

/** Delete needs a second click: the button turns solid and asks again. */
function DeleteButton({ label, onConfirm, busy }) {
  const [armed, setArmed] = useState(false);
  return (
    <Button size="lg" variant={armed ? "danger-solid" : "danger"} loading={busy && armed} onClick={() => (armed ? onConfirm() : setArmed(true))} className="mr-auto">
      {armed ? "Click again to delete" : label}
    </Button>
  );
}

function FormFooter({ formId, busy, label, onClose, onDelete, deleteLabel }) {
  return (
    <>
      {onDelete && <DeleteButton label={deleteLabel} onConfirm={onDelete} busy={busy} />}
      <Button size="lg" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="primary" type="submit" form={formId} loading={busy}>
        {label}
      </Button>
    </>
  );
}

const formClass = "flex flex-col gap-[18px]";

// ------------------------------------------------------------------ project

export function ProjectDialog({ open, project, defaults, onClose, onSaved }) {
  return open ? <ProjectForm key={project?._id ?? "new"} project={project} defaults={defaults} onClose={onClose} onSaved={onSaved} /> : null;
}

function ProjectForm({ project, defaults = {}, onClose, onSaved }) {
  const { data, lookup, activeUsers, currentUserId, currentUser } = useWorkspace();
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
  const client = values.clientId ? lookup.clients[values.clientId] : null;
  const ownerName = client ? client.name : data.org.name;
  // A client's projects are staffed from the client's members; the company's from everyone.
  const pool = usePool(client?.memberIds?.length ? client.memberIds : activeUsers.map((u) => u._id), project?.memberIds ?? []);
  const leadPool = pool.filter((u) => values.memberIds.includes(u._id));
  const clientOptions = [...data.clients].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c._id, label: c.name }));
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
      title={project ? "Edit project" : `New project in ${ownerName}`}
      footer={<FormFooter formId="project-form" busy={busy} label={project ? "Save changes" : "Create project"} onClose={onClose} />}
    >
      <form id="project-form" onSubmit={submit} className={formClass} noValidate>
        <Field label="Name" error={fieldErrors.name}>
          {(p) => <Input {...p} value={values.name} onChange={set("name")} placeholder="Website redesign" data-autofocus autoComplete="off" />}
        </Field>
        <Field label="Description" error={fieldErrors.description}>
          {(p) => <Textarea {...p} value={values.description} onChange={set("description")} placeholder="What is this project about?" maxLength={240} />}
        </Field>
        {project && !project.isInternal && (
          <Field label="For" hint="A client, or the company itself" error={fieldErrors.clientId}>
            {(p) => <Select {...p} value={values.clientId} onChange={set("clientId")} options={[{ value: "", label: COMPANY_LABEL }, ...clientOptions]} />}
          </Field>
        )}
        <Field label="Deadline" error={fieldErrors.deadline}>
          {(p) => <Input {...p} type="date" value={values.deadline} onChange={set("deadline")} />}
        </Field>
        <Field label="Team" hint={`Pick from the members of ${ownerName}`} error={fieldErrors.memberIds}>
          {(p) => <PeoplePicker id={p.id} people={pool} value={values.memberIds} onChange={(memberIds) => setValues((v) => ({ ...v, memberIds }))} />}
        </Field>
        {chooseLeads && (
          <Field label="Leads" hint="Leads create and assign this project’s tasks. Admins can always do this too." error={fieldErrors.leadIds}>
            {(p) => (
              <PeoplePicker
                id={p.id}
                label="Add lead"
                people={leadPool}
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
  const { lookup } = useWorkspace();
  const { run, busy, fieldErrors } = useAction();
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
    assigneeIds: task ? taskAssigneeIds(task) : defaults.assigneeIds ?? [],
    dueDate: task?.dueDate ?? defaults.dueDate ?? "",
    priority: task ? taskPriority(task) : defaults.priority ?? DEFAULT_TASK_PRIORITY,
    status: task?.status ?? "todo",
  });
  const project = lookup.projects[values.projectId];
  const fixedProject = !task && preferred;
  const pool = usePool(project?.memberIds ?? [], values.assigneeIds);
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const setProject = (e) => {
    const projectId = e.target.value;
    setValues((v) => ({ ...v, projectId, phase: lookup.projects[projectId]?.phase ?? v.phase }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const result = task
      ? await run({ type: "task.update", id: task._id, data: values }, { success: "Task updated" })
      : await run({ type: "task.create", data: { ...values, messageId: defaults.messageId, meetingId: defaults.meetingId } }, { success: "Task created" });
    if (result) onClose();
  };
  const remove = async () => {
    if (await run({ type: "task.delete", id: task._id }, { success: "Task deleted" })) onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={task ? "Edit task" : fixedProject ? `New task in ${project.name}` : "New task"}
      footer={<FormFooter formId="task-form" busy={busy} label={task ? "Save changes" : "Create task"} onClose={onClose} onDelete={task ? remove : null} deleteLabel="Delete task" />}
    >
      <form id="task-form" onSubmit={submit} className={formClass} noValidate>
        <Field label="Title" error={fieldErrors.title}>
          {(p) => <Input {...p} value={values.title} onChange={set("title")} placeholder="Draft the homepage copy" data-autofocus autoComplete="off" />}
        </Field>
        <Field label="Description" error={fieldErrors.description}>
          {(p) => <Textarea {...p} value={values.description} onChange={set("description")} placeholder="Add details, links or acceptance criteria" maxLength={5000} />}
        </Field>
        {!fixedProject && (
          <Field label="Project" error={fieldErrors.projectId}>
            {(p) => <Select {...p} value={values.projectId} onChange={setProject} options={projectOptions} placeholder="Choose a project" />}
          </Field>
        )}
        <Field label="Assignees" hint={project ? `Pick from the ${project.name} team` : undefined} error={fieldErrors.assigneeIds}>
          {(p) => <PeoplePicker id={p.id} label="Add assignee" people={pool} value={values.assigneeIds} onChange={(assigneeIds) => setValues((v) => ({ ...v, assigneeIds }))} />}
        </Field>
        <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-3">
          <Field label="Priority" error={fieldErrors.priority}>
            {() => <PrioritySelect field value={values.priority} onChange={(priority) => setValues((v) => ({ ...v, priority }))} />}
          </Field>
          <Field label="Due date" error={fieldErrors.dueDate}>
            {(p) => <Input {...p} type="date" value={values.dueDate} onChange={set("dueDate")} />}
          </Field>
          <Field label="Status" error={fieldErrors.status}>
            {(p) => <Select {...p} value={values.status} onChange={set("status")} options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))} />}
          </Field>
        </div>
      </form>
    </Dialog>
  );
}

// ------------------------------------------------------------------ meeting

export function MeetingDialog({ open, meeting, defaults, onClose, onSaved }) {
  return open ? <MeetingForm key={meeting?._id ?? "new"} meeting={meeting} defaults={defaults} onClose={onClose} onSaved={onSaved} /> : null;
}

/** New meetings start tomorrow at 10 AM. */
function defaultStart() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return toLocalInput(d.toISOString());
}

function MeetingForm({ meeting, defaults = {}, onClose, onSaved }) {
  const { data, activeUsers, currentUserId } = useWorkspace();
  const { run, busy, fieldErrors } = useAction();
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
  const pool = usePool(activeUsers.map((u) => u._id), values.attendeeIds);
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
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
    <Dialog
      open
      onClose={onClose}
      title={meeting ? "Edit meeting" : "New meeting"}
      footer={<FormFooter formId="meeting-form" busy={busy} label={meeting ? "Save changes" : "Schedule"} onClose={onClose} onDelete={meeting ? remove : null} deleteLabel="Delete meeting" />}
    >
      <form id="meeting-form" onSubmit={submit} className={formClass} noValidate>
        <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
          <Field label="Title" error={fieldErrors.title}>
            {(p) => <Input {...p} value={values.title} onChange={set("title")} placeholder="Weekly sync" data-autofocus autoComplete="off" />}
          </Field>
          <Field label="Starts" error={fieldErrors.startsAt}>
            {(p) => <DateTimePicker {...p} value={values.startsAt} onChange={(startsAt) => setValues((v) => ({ ...v, startsAt }))} />}
          </Field>
        </div>
        <Field label="Agenda" error={agendaError}>
          {(p) => <Textarea {...p} value={values.agenda} onChange={set("agenda")} placeholder="What will you cover? One point per line works well." />}
        </Field>
        <Field label="Call link" hint="Optional: Google Meet, Zoom or any link" error={fieldErrors.callUrl}>
          {(p) => <Input {...p} type="url" inputMode="url" placeholder="https://meet.google.com/..." value={values.callUrl} onChange={set("callUrl")} />}
        </Field>
        <Field label="Attendees" error={fieldErrors.attendeeIds}>
          {(p) => <PeoplePicker id={p.id} label="Add attendee" people={pool} value={values.attendeeIds} onChange={(attendeeIds) => setValues((v) => ({ ...v, attendeeIds }))} />}
        </Field>
      </form>
    </Dialog>
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
    <Dialog open onClose={onClose} title="Invite member" footer={<FormFooter formId="invite-form" busy={busy} label="Send invite" onClose={onClose} />}>
      <form id="invite-form" onSubmit={submit} className={formClass} noValidate>
        <Field label="Email" hint="We email them an invite link. They join as a member the first time they sign in with this email." error={fieldErrors.email}>
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
  const { data, activeUsers, currentUserId } = useWorkspace();
  const { run, busy, fieldErrors } = useAction();
  const [values, setValues] = useState({ name: client?.name ?? "", description: client?.description ?? "", memberIds: client?.memberIds ?? [currentUserId] });
  const pool = usePool(activeUsers.map((u) => u._id), values.memberIds);
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const projects = client ? data.projects.filter((p) => p.clientId === client._id).length : 0;

  const submit = async (e) => {
    e.preventDefault();
    const result = client
      ? await run({ type: "client.update", id: client._id, data: values }, { success: "Client updated" })
      : await run({ type: "client.create", data: values }, { success: "Client created" });
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
    <Dialog
      open
      onClose={onClose}
      title={client ? "Edit client" : "New client"}
      footer={
        <FormFooter
          formId="client-form"
          busy={busy}
          label={client ? "Save changes" : "Create client"}
          onClose={onClose}
          // A client can only go once its projects have moved elsewhere.
          onDelete={client && !projects ? remove : null}
          deleteLabel="Delete client"
        />
      }
    >
      <form id="client-form" onSubmit={submit} className={formClass} noValidate>
        <Field label="Name" error={fieldErrors.name}>
          {(p) => <Input {...p} value={values.name} onChange={set("name")} placeholder="Acme Inc." data-autofocus autoComplete="off" />}
        </Field>
        <Field label="Description" error={fieldErrors.description}>
          {(p) => <Textarea {...p} value={values.description} onChange={set("description")} placeholder="Who they are and what you're doing for them" maxLength={2000} />}
        </Field>
        <Field label="Members" hint="You're always a member of your clients" error={fieldErrors.memberIds}>
          {(p) => <PeoplePicker id={p.id} people={pool} value={values.memberIds} onChange={(memberIds) => setValues((v) => ({ ...v, memberIds }))} />}
        </Field>
      </form>
    </Dialog>
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
  const [values, setValues] = useState({ name: group?.name ?? "", memberIds: group?.memberIds ?? [currentUserId] });
  const pool = usePool(activeUsers.map((u) => u._id), values.memberIds);

  const submit = async (e) => {
    e.preventDefault();
    // You're always in groups you create.
    const data = { ...values, memberIds: group ? values.memberIds : [...new Set([currentUserId, ...values.memberIds])] };
    const result = group
      ? await run({ type: "group.update", id: group._id, data }, { success: "Group updated" })
      : await run({ type: "group.create", data }, { success: "Group created" });
    if (!result) return;
    onClose();
    if (!group) router.push(`/inbox/${result._id}`);
    else if (!result.memberIds.includes(currentUserId)) router.push("/inbox");
  };
  const remove = async () => {
    if (await run({ type: "group.delete", id: group._id }, { success: "Group deleted" })) {
      onClose();
      router.push("/inbox");
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={group ? "Edit group" : "New group"}
      footer={<FormFooter formId="group-form" busy={busy} label={group ? "Save changes" : "Create group"} onClose={onClose} onDelete={group ? remove : null} deleteLabel="Delete group" />}
    >
      <form id="group-form" onSubmit={submit} className={formClass} noValidate>
        <Field label="Group name" error={fieldErrors.name}>
          {(p) => <Input {...p} value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} placeholder="Design team, Tesla launch…" data-autofocus autoComplete="off" />}
        </Field>
        <Field label="Members" hint="You're always in groups you create" error={fieldErrors.memberIds}>
          {(p) => <PeoplePicker id={p.id} people={pool} value={values.memberIds} onChange={(memberIds) => setValues((v) => ({ ...v, memberIds }))} />}
        </Field>
      </form>
    </Dialog>
  );
}
