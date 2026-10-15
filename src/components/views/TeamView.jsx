"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { Avatar, Button, Page, PageHeader, Pill, Summary, TextLink } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { announceInvite, useAction } from "@/lib/client/useAction";
import { useToast } from "@/components/providers/ToastProvider";
import { ROLES, ROLE_LABELS } from "@/lib/constants";
import { formatDaysAgo, pluralize } from "@/lib/format";

const GRID = "grid grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.4fr)_150px] items-center gap-4 px-[18px]";

export function TeamView() {
  const { data, currentUserId, isAdmin } = useWorkspace();
  const overlays = useOverlays();
  const { run, busy } = useAction();
  const toast = useToast();
  const [removing, setRemoving] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const active = data.users.filter((u) => u.active).sort((a, b) => Number(b._id === currentUserId) - Number(a._id === currentUserId) || a.name.localeCompare(b.name));
  const inactive = data.users.filter((u) => !u.active && !u.deletedAt);
  const pending = data.invites.filter((i) => !i.acceptedAt);
  const workingOn = (userId) =>
    data.projects
      .filter((p) => !p.archived && p.memberIds.includes(userId))
      .sort((a, b) => Number(a.isInternal) - Number(b.isInternal) || a.name.localeCompare(b.name))
      .map((p) => p.name)
      .join(", ");

  const remove = async () => {
    if (await run({ type: "member.active", id: removing._id, data: { active: false } }, { success: `${removing.name} removed`, successDescription: "Their history stays in place." })) setRemoving(null);
  };

  const deleteMember = async () => {
    if (await run({ type: "member.delete", id: deleting._id }, { success: `${deleting.name} deleted`, successDescription: "Their history now shows “Former member”." })) setDeleting(null);
  };

  return (
    <Page width="md">
      <PageHeader
        title="Team"
        summary={<Summary parts={[pluralize(active.length, "member"), pending.length > 0 && pluralize(pending.length, "pending invite")]} />}
        actions={
          isAdmin && (
            <Button variant="primary" icon={Plus} onClick={overlays.invite}>
              Invite member
            </Button>
          )
        }
      />

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <div className="min-w-[640px]">
          <div className={`${GRID} label-caps border-b border-line py-3 text-muted`}>
            <span>Member</span>
            <span>Role</span>
            <span>Working on</span>
            <span />
          </div>

          {active.map((user) => {
            const me = user._id === currentUserId;
            return (
              <div key={user._id} className={`${GRID} border-b border-row py-3.5 last:border-b-0`}>
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar user={user} />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-medium">
                      {user.name} {me && <span className="font-normal text-muted">(you)</span>}
                    </span>
                    <span className="truncate text-xs text-muted">{user.email}</span>
                  </div>
                </div>
                {isAdmin && !me ? (
                  <label className="flex">
                    <span className="sr-only">Role for {user.name}</span>
                    <select
                      value={user.role}
                      onChange={(e) => run({ type: "member.role", id: user._id, data: { role: e.target.value } }, { success: `${user.name} is now ${ROLE_LABELS[e.target.value].toLowerCase()}` })}
                      className="h-9 cursor-pointer rounded-lg border border-line bg-input px-2 text-[13px] text-fg outline-none focus:border-accent/60"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <Pill tone={user.role === "admin" ? "accent" : "neutral"} className="justify-self-start px-2.5 py-[3px] text-xs">
                    {ROLE_LABELS[user.role]}
                  </Pill>
                )}
                <span className="truncate text-secondary">{workingOn(user._id) || "—"}</span>
                <span className="flex items-center justify-end gap-3">
                  {!me && <TextLink href={`/messages/${user._id}`}>Message</TextLink>}
                  {isAdmin && !me && (
                    <button type="button" onClick={() => setRemoving(user)} className="text-[13px] text-muted hover:text-danger">
                      Remove
                    </button>
                  )}
                </span>
              </div>
            );
          })}

          {pending.map((invite) => (
            <div key={invite._id} className={`${GRID} border-t border-row py-3.5`}>
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-[#3a3e44] text-sm text-muted">
                  @
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium text-secondary">{invite.email}</span>
                  <span className="text-xs text-muted">Invited {formatDaysAgo(invite.sentAt)}</span>
                </div>
              </div>
              <Pill tone="warning" className="justify-self-start px-2.5 py-[3px] text-xs">
                Pending
              </Pill>
              <span className="text-faint">—</span>
              <span className="flex items-center justify-end gap-2">
                {isAdmin && (
                  <>
                    <button type="button" onClick={() => run({ type: "invite.cancel", id: invite._id }, { success: "Invite cancelled" })} className="text-[13px] text-muted hover:text-danger">
                      Cancel
                    </button>
                    <Button variant="quiet" size="sm" onClick={async () => {
                        const resent = await run({ type: "invite.resend", id: invite._id });
                        if (resent) announceInvite(toast, resent, "Invite resent");
                      }}>
                      Resend
                    </Button>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {inactive.length > 0 && (
        <details className="group text-[13px] text-muted">
          <summary className="cursor-pointer list-none hover:text-fg">
            <span aria-hidden className="mr-1.5 inline-block transition-transform group-open:rotate-90">
              ▸
            </span>
            {pluralize(inactive.length, "removed member")}
          </summary>
          <ul className="mt-2 flex flex-col gap-1 pl-5">
            {inactive.map((user) => (
              <li key={user._id} className="flex items-center gap-3">
                <span>{user.name}</span>
                <Link href={`/messages/${user._id}`} className="text-faint hover:text-fg">
                  History
                </Link>
                {isAdmin && (
                  <>
                    <button type="button" onClick={() => run({ type: "member.active", id: user._id, data: { active: true } }, { success: `${user.name} restored` })} className="text-accent hover:text-accent-light">
                      Restore
                    </button>
                    <button type="button" onClick={() => setDeleting(user)} className="text-faint hover:text-danger">
                      Delete
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-[13px] text-muted">Admins invite people and change roles. Removing someone deactivates their account, so their tasks, messages and decisions stay in history. Deleting a removed member erases their profile and shows them as “Former member”.</p>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
        busy={busy}
        tone="danger"
        title={`Remove ${removing?.name}?`}
        description="Their account is deactivated. Their tasks, messages and decisions stay in history, and an admin can restore them later."
        confirmLabel="Remove"
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={deleteMember}
        busy={busy}
        tone="danger"
        title={`Delete ${deleting?.name} permanently?`}
        description="Their name and profile are erased, and their tasks, messages and decisions show “Former member”. If you invite the same email again, their history comes back with their name."
        confirmLabel="Delete"
      />
    </Page>
  );
}
