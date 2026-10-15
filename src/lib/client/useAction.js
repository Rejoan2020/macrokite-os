"use client";

import { useCallback, useState } from "react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useToast } from "@/components/providers/ToastProvider";

/**
 * Runs a domain action with busy state, field-level validation errors and toast feedback.
 * Returns the action's result, or null when it failed.
 */
export function useAction() {
  const { dispatch } = useWorkspace();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const run = useCallback(
    async (action, { success, successDescription, silent } = {}) => {
      setBusy(true);
      setFieldErrors({});
      try {
        const result = await dispatch(action);
        if (success) toast.success(success, successDescription);
        return result ?? {};
      } catch (error) {
        if (error.fieldErrors) setFieldErrors(error.fieldErrors);
        if (!silent || !error.fieldErrors) toast.error(error.fieldErrors ? "Please check the form" : "Couldn’t save changes", error.message);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [dispatch, toast]
  );

  return { run, busy, fieldErrors, setFieldErrors };
}

/** Toast for an invite that was added or resent: whether the email went out (demo mode sends none). */
export function announceInvite(toast, invite, title) {
  if (invite.emailSent) toast.success(title, `Email sent to ${invite.email}`);
  else if (invite.emailError) toast.error("Invite saved, but the email didn’t send", `${invite.emailError} Share the app link with ${invite.email} yourself.`);
  else toast.success(title, `${invite.email} joins when they sign in. Demo mode sends no email.`);
}
