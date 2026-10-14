"use client";

import { useState, useTransition } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Button, cx } from "@/components/ui/primitives";
import { Field, Input } from "@/components/ui/form";
import { createWorkspace } from "@/lib/client/storage";
import { signOutAction } from "@/app/auth/actions";
import { Logo } from "./Logo";

export function SignOutButton({ className, compact }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => signOutAction())}
      disabled={pending}
      aria-label={compact ? "Sign out" : undefined}
      title="Sign out"
      className={cx("flex items-center gap-2 rounded-lg text-[13px] text-muted hover:text-fg disabled:opacity-60", className)}
    >
      <LogOut className="size-4" aria-hidden />
      {!compact && (pending ? "Signing out…" : "Sign out")}
    </button>
  );
}

/** Shown in database mode when the signed-in account isn't an active member of any workspace. */
export function OnboardingScreen() {
  const { account, onboarding, reload } = useWorkspace();
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col gap-5 rounded-xl border border-line bg-card p-6">
        <Logo />
        {onboarding.removed ? (
          <Message title="You no longer have access">An admin removed you from your workspace. Ask them to restore your access, then check again.</Message>
        ) : onboarding.canCreate ? (
          <CreateWorkspace onCreated={reload} />
        ) : (
          <Message title="You’re not on a team yet">
            Ask your workspace admin to invite <span className="text-fg">{account?.email}</span>. You’ll join as soon as you sign in after the invite.
          </Message>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-row pt-4">
          <span className="min-w-0 truncate text-xs text-faint">Signed in as {account?.email}</span>
          <div className="flex items-center gap-4">
            {!onboarding.canCreate && (
              <button type="button" onClick={reload} className="flex items-center gap-2 text-[13px] text-muted hover:text-fg">
                <RefreshCw className="size-4" aria-hidden />
                Check again
              </button>
            )}
            <SignOutButton />
          </div>
        </div>
      </div>
    </div>
  );
}

function Message({ title, children }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-base font-semibold text-strong">{title}</h1>
      <p className="text-secondary">{children}</p>
    </div>
  );
}

function CreateWorkspace({ onCreated }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createWorkspace(name);
      await onCreated();
    } catch (err) {
      setError(err.fieldErrors?.name ?? err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Message title="Create your workspace">Your team’s projects, meetings and chat live here. You’ll be its admin and can invite people next.</Message>
      <Field label="Workspace name" error={error}>
        {(p) => <Input {...p} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your company name" maxLength={80} />}
      </Field>
      <Button variant="primary" type="submit" loading={busy} disabled={!name.trim()}>
        Create workspace
      </Button>
    </form>
  );
}
