"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useAction } from "@/lib/client/useAction";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { Button, StatusBadge } from "@/components/ui/primitives";
import { Field, Input, LabelsInput, MemberPicker, Select, Textarea } from "@/components/ui/form";
import {
  CLIENT_STATUSES,
  CLIENT_STATUS_META,
  PRIORITIES,
  PRIORITY_META,
  PROJECT_STATUSES,
  PROJECT_STATUS_META,
  TASK_STATUSES,
  TASK_STATUS_META,
  toOptions,
} from "@/lib/constants";
import { formatDate, formatRelative } from "@/lib/format";
import { todayISO } from "@/lib/selectors";

function useFormState(initial) {
  const [values, setValues] = useState(initial);
  const set = (key) => (eventOrValue) =>
    setValues((v) => ({ ...v, [key]: eventOrValue?.target ? eventOrValue.target.value : eventOrValue }));
  return [values, set, setValues];
}

function FormGrid({ children, onSubmit, id }) {
  return (
    <form id={id} onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {children}
    </form>
  );
}

const full = "sm:col-span-2";

// ------------------------------------------------------------------ client

export function ClientFormDialog({ open, onClose, client, onSaved }) {
  return open ? <ClientForm onClose={onClose} client={client} onSaved={onSaved} /> : null;
}

function ClientForm({ onClose, client, onSaved }) {
  const { run, busy, fieldErrors } = useAction();
  const [values, set] = useFormState({
    name: client?.name ?? "",
    company: client?.company ?? "",
    email: client?.email ?? "",
    phone: client?.phone ?? "",
    status: client?.status ?? "lead",
    service: client?.service ?? "",
    notes: client?.notes ?? "",
  });

  const submit = async (e) => {
    e.preventDefault();
    const result = client
      ? await run({ type: "client.update", id: client._id, data: values }, { success: "Client updated", silent: true })
      : await run({ type: "client.create", data: values }, { success: "Client created", successDescription: values.company, silent: true });
    if (result) {
      onSaved?.(result);
      onClose();
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={client ? "Edit client" : "New client"}
      description={client ? client.company : "Add a lead or customer to your workspace."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="client-form" loading={busy}>
            {client ? "Save changes" : "Create client"}
          </Button>
        </>
      }
    >
      <FormGrid id="client-form" onSubmit={submit}>
        <Field label="Company" required error={fieldErrors.company}>
          {(p) => <Input {...p} data-autofocus value={values.company} onChange={set("company")} placeholder="Acme Inc." />}
        </Field>
        <Field label="Contact name" required error={fieldErrors.name}>
          {(p) => <Input {...p} value={values.name} onChange={set("name")} placeholder="Jordan Lee" />}
        </Field>
        <Field label="Email" required error={fieldErrors.email}>
          {(p) => <Input {...p} type="email" value={values.email} onChange={set("email")} placeholder="jordan@acme.com" />}
        </Field>
        <Field label="Phone" error={fieldErrors.phone}>
          {(p) => <Input {...p} type="tel" value={values.phone} onChange={set("phone")} placeholder="Optional" />}
        </Field>
        <Field label="Status" required error={fieldErrors.status}>
          {(p) => <Select {...p} value={values.status} onChange={set("status")} options={toOptions(CLIENT_STATUSES, CLIENT_STATUS_META)} />}
        </Field>
        <div className="hidden sm:block" />
        <Field label="Services / engagement" error={fieldErrors.service} className={full}>
          {(p) => <Input {...p} value={values.service} onChange={set("service")} placeholder="e.g. Website rebuild and monthly maintenance" />}
        </Field>
        <Field label="Notes" error={fieldErrors.notes} className={full} hint="Internal only — never shared with the client.">
          {(p) => <Textarea {...p} rows={3} value={values.notes} onChange={set("notes")} />}
        </Field>
      </FormGrid>
    </Dialog>
  );
}

// ----------------------------------------------------------------- project

export function ProjectFormDialog({ open, onClose, project, defaults, onSaved }) {
  return open ? <ProjectForm onClose={onClose} project={project} defaults={defaults} onSaved={onSaved} /> : null;
}

function ProjectForm({ onClose, project, defaults = {}, onSaved }) {
  const { data, members, currentUserId } = useWorkspace();
  const { run, busy, fieldErrors } = useAction();
  const [values, set] = useFormState({
    name: project?.name ?? "",
    description: project?.description ?? "",
    clientId: project?.clientId ?? defaults.clientId ?? "",
    status: project?.status ?? "planning",
    priority: project?.priority ?? "medium",
    startDate: project?.startDate ?? todayISO(),
    deadline: project?.deadline ?? "",
    memberIds: project?.memberIds ?? [currentUserId],
  });

  const clientOptions = [...data.clients]
    .sort((a, b) => a.company.localeCompare(b.company))
    .map((c) => ({ value: c._id, label: c.company }));

  const submit = async (e) => {
    e.preventDefault();
    const payload = { ...values, clientId: values.clientId || null };
    const result = project
      ? await run({ type: "project.update", id: project._id, data: payload }, { success: "Project updated", silent: true })
      : await run({ type: "project.create", data: payload }, { success: "Project created", successDescription: values.name, silent: true });
    if (result) {
      onSaved?.(result);
      onClose();
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={project ? "Edit project" : "New project"}
      description={project ? project.name : "Projects group tasks and discussions for a client engagement."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="project-form" loading={busy}>
            {project ? "Save changes" : "Create project"}
          </Button>
        </>
      }
    >
      <FormGrid id="project-form" onSubmit={submit}>
        <Field label="Project name" required error={fieldErrors.name} className={full}>
          {(p) => <Input {...p} data-autofocus value={values.name} onChange={set("name")} placeholder="Website redesign" />}
        </Field>
        <Field label="Client" error={fieldErrors.clientId} hint={clientOptions.length ? undefined : "No clients yet — this will be an internal project."}>
          {(p) => <Select {...p} value={values.clientId ?? ""} onChange={set("clientId")} options={clientOptions} placeholder="Internal project (no client)" />}
        </Field>
        <Field label="Status" required error={fieldErrors.status}>
          {(p) => <Select {...p} value={values.status} onChange={set("status")} options={toOptions(PROJECT_STATUSES, PROJECT_STATUS_META)} />}
        </Field>
        <Field label="Priority" required error={fieldErrors.priority}>
          {(p) => <Select {...p} value={values.priority} onChange={set("priority")} options={toOptions(PRIORITIES, PRIORITY_META)} />}
        </Field>
        <div className="hidden sm:block" />
        <Field label="Start date" error={fieldErrors.startDate}>
          {(p) => <Input {...p} type="date" value={values.startDate} onChange={set("startDate")} />}
        </Field>
        <Field label="Deadline" error={fieldErrors.deadline}>
          {(p) => <Input {...p} type="date" value={values.deadline} onChange={set("deadline")} />}
        </Field>
        <Field label="Team" error={fieldErrors.memberIds} className={full}>
          {(p) => <MemberPicker {...p} members={members} value={values.memberIds} onChange={set("memberIds")} />}
        </Field>
        <Field label="Description" error={fieldErrors.description} className={full}>
          {(p) => <Textarea {...p} rows={4} value={values.description} onChange={set("description")} placeholder="Goals, scope and key deliverables" />}
        </Field>
      </FormGrid>
    </Dialog>
  );
}

// -------------------------------------------------------------------- task

export function TaskDialog({ open, onClose, task, defaults, onSaved }) {
  return open ? <TaskForm key={task?._id ?? "new"} onClose={onClose} task={task} defaults={defaults} onSaved={onSaved} /> : null;
}

function TaskForm({ onClose, task, defaults = {}, onSaved }) {
  const { data, members, preferences, lookup, currentUserId } = useWorkspace();
  const { run, busy, fieldErrors } = useAction();
  const del = useAction();
  const [confirm, setConfirm] = useState(false);
  const [values, set] = useFormState({
    title: task?.title ?? "",
    description: task?.description ?? "",
    projectId: task?.projectId ?? defaults.projectId ?? "",
    status: task?.status ?? defaults.status ?? "todo",
    priority: task?.priority ?? preferences.defaultTaskPriority,
    assigneeId: task?.assigneeId ?? defaults.assigneeId ?? currentUserId,
    dueDate: task?.dueDate ?? "",
    labels: task?.labels ?? [],
  });

  const projectOptions = [...data.projects]
    .sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed") || a.name.localeCompare(b.name))
    .map((p) => ({ value: p._id, label: p.clientId && lookup.clients[p.clientId] ? `${p.name} · ${lookup.clients[p.clientId].company}` : p.name }));
  const memberOptions = members.map((m) => ({ value: m.user._id, label: m.user._id === currentUserId ? `${m.user.name} (you)` : m.user.name }));

  const submit = async (e) => {
    e.preventDefault();
    const payload = { ...values, projectId: values.projectId || null, assigneeId: values.assigneeId || null };
    const result = task
      ? await run({ type: "task.update", id: task._id, data: payload }, { success: "Task saved", silent: true })
      : await run({ type: "task.create", data: payload }, { success: "Task created", successDescription: values.title, silent: true });
    if (result) {
      onSaved?.(result);
      onClose();
    }
  };

  const remove = async () => {
    const result = await del.run({ type: "task.delete", id: task._id }, { success: "Task deleted" });
    if (result) {
      setConfirm(false);
      onClose();
    }
  };

  const creator = task && lookup.users[task.createdBy];

  return (
    <Dialog
      open
      onClose={onClose}
      variant="drawer"
      title={task ? "Task details" : "New task"}
      description={task ? `Created ${formatRelative(task.createdAt)}${creator ? ` by ${creator.name}` : ""}` : "Capture work, assign an owner and set a due date."}
      footer={
        <>
          {task && (
            <Button variant="danger" icon={Trash2} onClick={() => setConfirm(true)} className="mr-auto">
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="task-form" loading={busy}>
            {task ? "Save task" : "Create task"}
          </Button>
        </>
      }
    >
      {task && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted">
          <StatusBadge kind="task" value={task.status} />
          <StatusBadge kind="priority" value={task.priority} />
          {task.completedAt && <span>Completed {formatDate(task.completedAt, preferences.dateFormat)}</span>}
        </div>
      )}
      <FormGrid id="task-form" onSubmit={submit}>
        <Field label="Title" required error={fieldErrors.title} className={full}>
          {(p) => <Input {...p} data-autofocus={!task || undefined} value={values.title} onChange={set("title")} placeholder="What needs to be done?" />}
        </Field>
        <Field label="Project" error={fieldErrors.projectId} className={full}>
          {(p) => <Select {...p} value={values.projectId ?? ""} onChange={set("projectId")} options={projectOptions} placeholder="No project" />}
        </Field>
        <Field label="Status" required error={fieldErrors.status}>
          {(p) => <Select {...p} value={values.status} onChange={set("status")} options={toOptions(TASK_STATUSES, TASK_STATUS_META)} />}
        </Field>
        <Field label="Priority" required error={fieldErrors.priority}>
          {(p) => <Select {...p} value={values.priority} onChange={set("priority")} options={toOptions(PRIORITIES, PRIORITY_META)} />}
        </Field>
        <Field label="Assignee" error={fieldErrors.assigneeId}>
          {(p) => <Select {...p} value={values.assigneeId ?? ""} onChange={set("assigneeId")} options={memberOptions} placeholder="Unassigned" />}
        </Field>
        <Field label="Due date" error={fieldErrors.dueDate}>
          {(p) => <Input {...p} type="date" value={values.dueDate} onChange={set("dueDate")} />}
        </Field>
        <Field label="Labels" error={fieldErrors.labels} className={full}>
          {(p) => <LabelsInput {...p} value={values.labels} onChange={set("labels")} />}
        </Field>
        <Field label="Description" error={fieldErrors.description} className={full}>
          {(p) => <Textarea {...p} rows={6} value={values.description} onChange={set("description")} placeholder="Context, acceptance criteria, links…" />}
        </Field>
      </FormGrid>
      {task && (
        <ConfirmDialog
          open={confirm}
          onClose={() => setConfirm(false)}
          onConfirm={remove}
          busy={del.busy}
          title="Delete task?"
          description={`“${task.title}” will be permanently removed.`}
        />
      )}
    </Dialog>
  );
}
