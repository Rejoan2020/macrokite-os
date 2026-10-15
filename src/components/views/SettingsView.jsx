"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Avatar, Button, Card, Checkbox, Page, Pill } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/form";
import { useAction } from "@/lib/client/useAction";
import { DEFAULT_NOTIFICATION_PREFS, NOTIFICATION_PREFS, PHASES, phaseLabel } from "@/lib/constants";

function SectionHead({ id, title, hint, children }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {hint && <p className="text-[13px] text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function SettingsView() {
  const { data, currentUser, isAdmin, mode } = useWorkspace();
  const toast = useToast();
  const { run, busy, fieldErrors } = useAction();
  const initial = {
    name: currentUser.name,
    avatarUrl: currentUser.avatarUrl ?? "",
    notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS, ...currentUser.notificationPrefs },
    workspaceName: data.org.name,
  };
  const [values, setValues] = useState(initial);
  const [editingPhoto, setEditingPhoto] = useState(false);
  const [failed, setFailed] = useState(null); // which save produced fieldErrors
  const errors = (step) => (failed === step ? fieldErrors : {});
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  const save = async (e) => {
    e.preventDefault();
    const profile = { name: values.name, avatarUrl: values.avatarUrl, notificationPrefs: values.notificationPrefs };
    setFailed("profile");
    if (!(await run({ type: "profile.update", data: profile }, { silent: true }))) return;
    if (isAdmin && values.workspaceName !== data.org.name) {
      setFailed("workspace");
      if (!(await run({ type: "workspace.update", data: { name: values.workspaceName } }, { silent: true }))) return;
    }
    setFailed(null);
    setEditingPhoto(false);
    toast.success("Changes saved");
  };

  return (
    <Page width="sm">
      <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] text-strong">Settings</h1>

      <form onSubmit={save} className="flex flex-col gap-6" noValidate>
        <Card as="section" aria-labelledby="s-profile" className="flex flex-col gap-[18px] p-[22px]">
          <SectionHead id="s-profile" title="Profile" hint="How you appear to the team" />
          <div className="flex flex-wrap items-center gap-3.5">
            <Avatar user={{ ...currentUser, avatarUrl: values.avatarUrl }} size="lg" />
            {editingPhoto ? (
              <Field error={errors("profile").avatarUrl} className="min-w-60 flex-1">
                {(p) => (
                  <Input
                    {...p}
                    type="url"
                    autoFocus
                    aria-label="Photo link"
                    placeholder="Paste a link to an image"
                    value={values.avatarUrl}
                    onChange={(e) => setValues((v) => ({ ...v, avatarUrl: e.target.value }))}
                  />
                )}
              </Field>
            ) : (
              <Button variant="outline" size="sm" className="h-10" onClick={() => setEditingPhoto(true)}>
                Change photo
              </Button>
            )}
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5">
            <Field label="Name" error={errors("profile").name}>
              {(p) => <Input {...p} value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} autoComplete="name" />}
            </Field>
            <Field label="Email" hint="Tied to how you sign in">
              {(p) => <Input {...p} type="email" value={currentUser.email} readOnly />}
            </Field>
          </div>
        </Card>

        <Card as="section" aria-labelledby="s-notify" className="flex flex-col gap-3.5 p-[22px]">
          <SectionHead id="s-notify" title="Email notifications" hint="In-app notifications are always on" />
          {NOTIFICATION_PREFS.map((pref) => (
            <label key={pref.key} className="flex min-h-11 cursor-pointer items-center justify-between gap-4 border-t border-row pt-3">
              <span className="flex flex-col gap-0.5">
                <span>{pref.label}</span>
                <span className="text-xs text-muted">{pref.hint}</span>
              </span>
              <Checkbox
                checked={values.notificationPrefs[pref.key]}
                onChange={(e) => setValues((v) => ({ ...v, notificationPrefs: { ...v.notificationPrefs, [pref.key]: e.target.checked } }))}
              />
            </label>
          ))}
        </Card>

        {isAdmin && (
          <Card as="section" aria-labelledby="s-workspace" className="flex flex-col gap-4 p-[22px]">
            <SectionHead id="s-workspace" title="Workspace">
              <Pill>Admins only</Pill>
            </SectionHead>
            <Field label="Workspace name" error={errors("workspace").name}>
              {(p) => <Input {...p} value={values.workspaceName} onChange={(e) => setValues((v) => ({ ...v, workspaceName: e.target.value }))} />}
            </Field>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] text-secondary">Standard phases</span>
              <div className="flex flex-wrap gap-1.5">
                {PHASES.map((p) => (
                  <span key={p} className="rounded-md border border-line px-2.5 py-[5px] text-xs text-soft">
                    {phaseLabel(p)}
                  </span>
                ))}
              </div>
              <span className="text-xs text-faint">New projects start with these. Admins can rename, add, remove and reorder phases for each project.</span>
            </div>
          </Card>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button variant="primary" type="submit" loading={busy} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      </form>

      {mode === "demo" && <DemoData />}
    </Page>
  );
}

function DemoData() {
  const { resetDemo } = useWorkspace();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  return (
    <section aria-label="Demo data" className="flex flex-wrap items-center justify-between gap-3 border-t border-row pt-5 text-[13px] text-muted">
      <p className="max-w-md">
        Demo mode: there’s no sign-in and everything is saved in this browser only. Set <code className="font-mono text-secondary">MONGODB_URI</code> to use a database.
      </p>
      <Button variant="quiet" size="sm" onClick={() => setConfirming(true)}>
        Reset demo data
      </Button>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          resetDemo();
          setConfirming(false);
          toast.success("Demo data reset");
        }}
        tone="danger"
        title="Reset demo data?"
        description="Everything you’ve changed in this browser is replaced with the sample workspace."
        confirmLabel="Reset"
      />
    </section>
  );
}
