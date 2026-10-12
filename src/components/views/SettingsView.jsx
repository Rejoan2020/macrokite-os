"use client";

import { useEffect, useState } from "react";
import { Building, Database, Download, HardDrive, Monitor, Moon, Palette, RotateCcw, ShieldAlert, Sun, User } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useAction } from "@/lib/client/useAction";
import { Avatar, Badge, Button, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { Field, Input, Segmented, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { DATE_FORMATS, PRIORITIES, PRIORITY_META, toOptions } from "@/lib/constants";
import { formatDate } from "@/lib/format";

const THEME_KEY = "macrokite-os:theme";

function applyTheme(theme) {
  const light = theme === "light" || (theme === "system" && window.matchMedia("(prefers-color-scheme: light)").matches);
  if (light) document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
}

export function SettingsView() {
  const { data, currentUser } = useWorkspace();
  return (
    <>
      <PageHeader title="Settings" description="Workspace details, preferences and your profile." />
      <div className="flex max-w-3xl flex-col gap-6">
        <WorkspaceSettings key={data.org.updatedAt} />
        <ProfileSettings key={`${currentUser._id}-${currentUser.updatedAt}`} />
        <AppearanceSettings />
        <StorageSettings />
      </div>
    </>
  );
}

function WorkspaceSettings() {
  const { data, preferences } = useWorkspace();
  const { run, busy, fieldErrors } = useAction();
  const [values, setValues] = useState({ name: data.org.name, description: data.org.description ?? "", preferences: { ...preferences } });
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const setPref = (key) => (e) => setValues((v) => ({ ...v, preferences: { ...v.preferences, [key]: e.target.value } }));
  const dirty = JSON.stringify(values) !== JSON.stringify({ name: data.org.name, description: data.org.description ?? "", preferences });

  const submit = (e) => {
    e.preventDefault();
    run({ type: "workspace.update", data: { ...values, preferences: { ...values.preferences, dueSoonDays: Number(values.preferences.dueSoonDays) } } }, { success: "Workspace saved", silent: true });
  };

  return (
    <Card as="section" id="workspace" aria-labelledby="workspace-heading">
      <CardHeader title={<span id="workspace-heading">Workspace</span>} icon={Building} description="Shown in the sidebar and used across the workspace." />
      <form onSubmit={submit} noValidate className="flex flex-col gap-4 p-4">
        <Field label="Workspace name" required error={fieldErrors.name}>
          {(p) => <Input {...p} value={values.name} onChange={set("name")} />}
        </Field>
        <Field label="Description" error={fieldErrors.description}>
          {(p) => <Textarea {...p} rows={2} value={values.description} onChange={set("description")} />}
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Default task priority" error={fieldErrors["preferences.defaultTaskPriority"]}>
            {(p) => <Select {...p} value={values.preferences.defaultTaskPriority} onChange={setPref("defaultTaskPriority")} options={toOptions(PRIORITIES, PRIORITY_META)} />}
          </Field>
          <Field label="“Due soon” window (days)" error={fieldErrors["preferences.dueSoonDays"]} hint="Used for upcoming deadlines and attention flags.">
            {(p) => <Input {...p} type="number" min={1} max={60} value={values.preferences.dueSoonDays} onChange={setPref("dueSoonDays")} />}
          </Field>
          <Field label="Date format" error={fieldErrors["preferences.dateFormat"]}>
            {(p) => (
              <Select
                {...p}
                value={values.preferences.dateFormat}
                onChange={setPref("dateFormat")}
                options={DATE_FORMATS.map((f) => ({ value: f, label: formatDate(new Date().toISOString(), f) }))}
              />
            )}
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={busy} disabled={!dirty}>
            Save workspace
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ProfileSettings() {
  const { currentUser, members, currentUserId } = useWorkspace();
  const { run, busy, fieldErrors } = useAction();
  const initial = { name: currentUser.name, title: currentUser.title ?? "", bio: currentUser.bio ?? "", timezone: currentUser.timezone ?? "" };
  const [values, setValues] = useState(initial);
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const role = members.find((m) => m.userId === currentUserId)?.role;
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  return (
    <Card as="section" id="profile" aria-labelledby="profile-heading">
      <CardHeader title={<span id="profile-heading">Your profile</span>} icon={User} description="How you appear to teammates on tasks, threads and activity." />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run({ type: "profile.update", data: values }, { success: "Profile saved", silent: true });
        }}
        noValidate
        className="flex flex-col gap-4 p-4"
      >
        <div className="flex items-center gap-3">
          <Avatar user={{ ...currentUser, name: values.name || currentUser.name }} size="lg" />
          <div className="text-xs text-muted">
            <p className="text-[13px] text-fg">{currentUser.email}</p>
            <p className="mt-0.5 flex items-center gap-2">
              <Badge tone="teal">{role}</Badge> Demo identity — email can’t be changed without authentication.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" required error={fieldErrors.name}>
            {(p) => <Input {...p} value={values.name} onChange={set("name")} />}
          </Field>
          <Field label="Title" error={fieldErrors.title}>
            {(p) => <Input {...p} value={values.title} onChange={set("title")} placeholder="e.g. Lead Engineer" />}
          </Field>
          <Field label="Time zone" error={fieldErrors.timezone} className="sm:col-span-2">
            {(p) => <Input {...p} value={values.timezone} onChange={set("timezone")} placeholder="e.g. Europe/London" />}
          </Field>
          <Field label="Bio" error={fieldErrors.bio} className="sm:col-span-2">
            {(p) => <Textarea {...p} rows={2} value={values.bio} onChange={set("bio")} />}
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={busy} disabled={!dirty}>
            Save profile
          </Button>
        </div>
      </form>
    </Card>
  );
}

function AppearanceSettings() {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    try {
      // Reading device-local storage after mount keeps server and client markup identical.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(localStorage.getItem(THEME_KEY) || "dark");
    } catch {}
  }, []);

  const change = (value) => {
    setTheme(value);
    try {
      localStorage.setItem(THEME_KEY, value);
    } catch {}
    applyTheme(value);
  };

  return (
    <Card as="section" aria-labelledby="appearance-heading">
      <CardHeader title={<span id="appearance-heading">Appearance</span>} icon={Palette} description="Saved on this device only." />
      <div className="p-4">
        <Segmented
          label="Theme"
          value={theme}
          onChange={change}
          options={[
            { value: "dark", label: "Dark", icon: Moon },
            { value: "light", label: "Light", icon: Sun },
            { value: "system", label: "System", icon: Monitor },
          ]}
        />
      </div>
    </Card>
  );
}

function StorageSettings() {
  const { mode, data, resetDemo } = useWorkspace();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const counts = ["clients", "projects", "tasks", "conversations", "messages"].map((k) => `${data[k].length} ${k}`).join(" · ");

  const download = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `macrokite-os-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card as="section" id="storage" aria-labelledby="storage-heading">
      <CardHeader title={<span id="storage-heading">Data storage & security</span>} icon={mode === "database" ? Database : HardDrive} />
      <div className="flex flex-col gap-4 p-4 text-[13px]">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 p-3">
          {mode === "database" ? <Database className="mt-0.5 size-4 text-accent" aria-hidden /> : <HardDrive className="mt-0.5 size-4 text-accent" aria-hidden />}
          <div>
            <p className="font-medium text-fg">
              {mode === "database" ? "Database mode — MongoDB" : "Demo mode — browser storage"}
              <Badge tone={mode === "database" ? "green" : "amber"} className="ml-2">{mode === "database" ? "Connected" : "Local only"}</Badge>
            </p>
            <p className="mt-1 text-xs text-muted">
              {mode === "database"
                ? "Records are stored server-side in MongoDB, scoped to this workspace. The connection string stays on the server."
                : "Records live in this browser’s localStorage. They survive refreshes but are not synced to other devices or backed up. Set MONGODB_URI on the server to enable database mode."}
            </p>
            <p className="mt-2 text-xs text-subtle">{counts}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-[var(--tone-amber-fg)]/25 bg-[var(--tone-amber-bg)] p-3 text-xs text-[var(--tone-amber-fg)]">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Authentication is not implemented. Everyone who can reach this app acts as the demo identity. Run it locally or on a private network
            only — do not expose it publicly.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={Download} onClick={download}>Download data (JSON)</Button>
          {mode === "demo" && (
            <Button variant="danger" icon={RotateCcw} onClick={() => setConfirm(true)}>
              Reset demo data
            </Button>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          resetDemo();
          setConfirm(false);
          toast.success("Demo data reset", "The seeded workspace has been restored.");
        }}
        title="Reset demo data?"
        confirmLabel="Reset"
        description="All changes made in this browser will be replaced with the original sample workspace."
      />
    </Card>
  );
}
