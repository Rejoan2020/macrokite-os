"use client";

import { useState } from "react";
import { Lock, Users } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useAction } from "@/lib/client/useAction";
import { Dialog } from "@/components/ui/Dialog";
import { Button, cx } from "@/components/ui/primitives";
import { Field, Input, Select, Textarea } from "@/components/ui/form";

export function ThreadDialog({ open, onClose, defaults, onSaved }) {
  return open ? <ThreadForm onClose={onClose} defaults={defaults} onSaved={onSaved} /> : null;
}

function ThreadForm({ onClose, defaults = {}, onSaved }) {
  const { data, lookup } = useWorkspace();
  const { run, busy, fieldErrors } = useAction();
  const [values, setValues] = useState({
    subject: "",
    visibility: defaults.visibility ?? (defaults.clientId ? "client" : "internal"),
    clientId: defaults.clientId ?? lookup.projects[defaults.projectId]?.clientId ?? "",
    projectId: defaults.projectId ?? "",
    body: "",
  });
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const projects = data.projects.filter((p) => !values.clientId || p.clientId === values.clientId);

  const submit = async (e) => {
    e.preventDefault();
    const result = await run(
      { type: "conversation.create", data: { ...values, clientId: values.clientId || null, projectId: values.projectId || null } },
      { success: "Thread started", silent: true }
    );
    if (result) {
      onSaved?.(result);
      onClose();
    }
  };

  const visibilityOption = (value, Icon, title, text) => (
    <button
      type="button"
      role="radio"
      aria-checked={values.visibility === value}
      onClick={() => setValues((v) => ({ ...v, visibility: value }))}
      className={cx(
        "flex flex-1 items-start gap-3 rounded-lg border p-3 text-left transition-colors",
        values.visibility === value ? "border-accent/60 bg-accent-soft" : "border-border bg-surface-2 hover:border-border-strong"
      )}
    >
      <Icon className={cx("mt-0.5 size-4 shrink-0", values.visibility === value ? "text-accent" : "text-subtle")} aria-hidden />
      <span>
        <span className="block text-[13px] font-medium text-fg">{title}</span>
        <span className="block text-xs text-muted">{text}</span>
      </span>
    </button>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="New conversation"
      description="Threads are stored in MacroKite OS. Nothing is emailed or sent outside the workspace."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="thread-form" loading={busy}>
            Start thread
          </Button>
        </>
      }
    >
      <form id="thread-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div role="radiogroup" aria-label="Thread type" className="flex flex-col gap-2 sm:flex-row">
          {visibilityOption("internal", Lock, "Internal discussion", "Only your team. Use for planning and decisions.")}
          {visibilityOption("client", Users, "Client communication", "Record of what was shared with or received from the client.")}
        </div>
        <Field label="Subject" required error={fieldErrors.subject}>
          {(p) => <Input {...p} data-autofocus value={values.subject} onChange={set("subject")} placeholder="e.g. Launch checklist" />}
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Client" required={values.visibility === "client"} error={fieldErrors.clientId}>
            {(p) => (
              <Select
                {...p}
                value={values.clientId}
                onChange={(e) => setValues((v) => ({ ...v, clientId: e.target.value, projectId: lookup.projects[v.projectId]?.clientId === e.target.value ? v.projectId : "" }))}
                options={[...data.clients].sort((a, b) => a.company.localeCompare(b.company)).map((c) => ({ value: c._id, label: c.company }))}
                placeholder="No client"
              />
            )}
          </Field>
          <Field label="Project" error={fieldErrors.projectId}>
            {(p) => <Select {...p} value={values.projectId} onChange={set("projectId")} options={projects.map((pr) => ({ value: pr._id, label: pr.name }))} placeholder="No project" />}
          </Field>
        </div>
        <Field label="First message" required error={fieldErrors.body}>
          {(p) => <Textarea {...p} rows={5} value={values.body} onChange={set("body")} placeholder="Write the opening message…" />}
        </Field>
      </form>
    </Dialog>
  );
}
