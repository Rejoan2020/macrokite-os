"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageCircle, Plus } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { ProjectsPanel } from "@/components/projects/ProjectsPanel";
import { Avatar, Button, cx, fullHeightPage, PageHeader } from "@/components/ui/primitives";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { announceInvite, useAction } from "@/lib/client/useAction";
import { ROLES, ROLE_LABELS } from "@/lib/constants";
import { firstName, formatDaysAgo } from "@/lib/format";
import { isAssignedTo, isOpenTask, projectOwner } from "@/lib/selectors";

/** The company's own projects (those without a client), with the team beside them. */
export function CompanyView() {
  const { data } = useWorkspace();
  const projects = data.projects.filter((p) => !p.clientId);
  return (
    <div className={fullHeightPage}>
      <PageHeader title="Company" />
      <div className="mt-[18px] flex min-h-0 flex-1 flex-col gap-[14px] lg:flex-row">
        <ProjectsPanel projects={projects} ownerLabel="the company" showCount={false} className="flex-1 lg:overflow-y-auto" />
        <TeamPanel />
      </div>
    </div>
  );
}

function TeamPanel() {
  const { data, currentUserId, isAdmin } = useWorkspace();
  const overlays = useOverlays();
  const { run } = useAction();
  const toast = useToast();
  const [openId, setOpenId] = useState(null);

  const active = data.users.filter((u) => u.active).sort((a, b) => Number(b._id === currentUserId) - Number(a._id === currentUserId) || a.name.localeCompare(b.name));
  const removed = data.users.filter((u) => !u.active && !u.deletedAt);
  const pending = data.invites.filter((i) => !i.acceptedAt);

  return (
    <aside aria-labelledby="team-title" className="flex w-full shrink-0 flex-col rounded-[24px] border border-card-line bg-card px-5 py-[22px] lg:w-[clamp(300px,30%,380px)] lg:overflow-y-auto">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 id="team-title" className="text-lg font-medium tracking-[-0.02em] text-strong">
          Team
        </h2>
        {isAdmin && (
          <Button size="sm" icon={Plus} onClick={overlays.invite}>
            Invite
          </Button>
        )}
      </div>

      <ul className="flex flex-col gap-1">
        {active.map((user) => (
          <li key={user._id} className="flex items-center gap-2 rounded-[14px] p-1 hover:bg-raised">
            <button type="button" onClick={() => setOpenId(user._id)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5 text-left">
              <Avatar user={user} size="row" />
              <span className="min-w-0 truncate text-sm font-semibold text-strong">
                {user.name}
                {user._id === currentUserId && <em className="font-normal text-faint not-italic"> (you)</em>}
              </span>
            </button>
            {user._id !== currentUserId && (
              <Link
                href={`/inbox/${user._id}`}
                aria-label={`Message ${firstName(user.name)}`}
                title={`Message ${firstName(user.name)}`}
                className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-full border border-row text-secondary hover:bg-input hover:text-fg"
              >
                <MessageCircle className="size-[15px]" strokeWidth={1.8} aria-hidden />
              </Link>
            )}
          </li>
        ))}
      </ul>

      {pending.length > 0 && (
        <div className="mt-4 flex flex-col gap-1 border-t border-row pt-3">
          <p className="px-1.5 pb-1 text-xs font-medium text-faint">Invited</p>
          {pending.map((invite) => (
            <div key={invite._id} className="flex items-center gap-3 rounded-[14px] px-2.5 py-2">
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-dash text-sm text-faint">
                @
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] font-medium text-secondary">{invite.email}</span>
                <span className="text-[11px] text-faint">Invited {formatDaysAgo(invite.sentAt)}</span>
              </span>
              {isAdmin && (
                <span className="flex shrink-0 flex-col items-end gap-0.5 text-xs font-medium">
                  <button
                    type="button"
                    onClick={async () => {
                      const resent = await run({ type: "invite.resend", id: invite._id });
                      if (resent) announceInvite(toast, resent, "Invite resent");
                    }}
                    className="text-secondary hover:text-fg"
                  >
                    Resend
                  </button>
                  <button type="button" onClick={() => run({ type: "invite.cancel", id: invite._id }, { success: "Invite cancelled" })} className="text-faint hover:text-danger">
                    Cancel
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {removed.length > 0 && (
        <div className="mt-4 flex flex-col gap-1 border-t border-row pt-3">
          <p className="px-1.5 pb-1 text-xs font-medium text-faint">Removed</p>
          {removed.map((user) => (
            <button key={user._id} type="button" onClick={() => setOpenId(user._id)} className="flex items-center gap-3 rounded-[14px] px-2.5 py-2 text-left hover:bg-raised">
              <Avatar user={user} size="sm" />
              <span className="truncate text-[13px] text-secondary">{user.name}</span>
            </button>
          ))}
        </div>
      )}

      <MemberDialog userId={openId} onClose={() => setOpenId(null)} />
    </aside>
  );
}

/** A team member's card: who they are, what they're on, and (for admins) their role and access. */
function MemberDialog({ userId, onClose }) {
  const { data, lookup, currentUserId, isAdmin } = useWorkspace();
  const { run, busy } = useAction();
  const [confirm, setConfirm] = useState(null); // "remove" | "delete"
  const user = userId ? lookup.users[userId] : null;
  if (!user) return null;

  const me = user._id === currentUserId;
  const projects = data.projects.filter((p) => !p.archived && p.memberIds.includes(user._id)).sort((a, b) => a.name.localeCompare(b.name));
  const openTasks = data.tasks.filter((t) => isAssignedTo(t, user._id) && isOpenTask(t)).length;

  const act = async (action, success, description) => {
    if (await run(action, { success, successDescription: description })) {
      setConfirm(null);
      onClose();
    }
  };
  const quiet = "mr-auto";

  return (
    <>
      <Dialog
        open={!confirm}
        onClose={onClose}
        title="Team member"
        footer={
          <>
            {isAdmin && !me && user.active && (
              <Button size="lg" variant="danger" onClick={() => setConfirm("remove")} className={quiet}>
                Remove from team
              </Button>
            )}
            {isAdmin && !user.active && (
              <>
                <Button size="lg" variant="danger" onClick={() => setConfirm("delete")} className={quiet}>
                  Delete permanently
                </Button>
                <Button size="lg" onClick={() => act({ type: "member.active", id: user._id, data: { active: true } }, `${user.name} restored`)} loading={busy}>
                  Restore
                </Button>
              </>
            )}
            <Button size="lg" onClick={onClose}>
              Close
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-[18px]">
          <div className="flex items-center gap-4">
            <Avatar user={user} size="lg" />
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold tracking-[-0.01em] text-strong">
                {user.name}
                {me && <em className="text-sm font-normal text-faint not-italic"> (you)</em>}
              </div>
              <div className="mt-0.5 truncate text-[13px] text-secondary">{user.active ? user.email : "Removed from the team"}</div>
              {isAdmin && user.active && !me ? (
                <select
                  aria-label={`Role for ${user.name}`}
                  value={user.role}
                  disabled={busy}
                  onChange={(e) => run({ type: "member.role", id: user._id, data: { role: e.target.value } }, { success: `${user.name} is now ${ROLE_LABELS[e.target.value].toLowerCase()}` })}
                  className={cx(
                    "mt-2 h-[22px] cursor-pointer appearance-none rounded-full px-2.5 text-[11px] font-semibold outline-none",
                    user.role === "admin" ? "bg-accent text-white" : "bg-selected text-secondary"
                  )}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r} className="bg-card text-fg">
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className={cx("mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] leading-none font-semibold", user.role === "admin" ? "bg-accent text-white" : "bg-selected text-secondary")}>
                  {ROLE_LABELS[user.role]}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-0.5 rounded-[14px] bg-raised px-3.5 py-3">
              <b className="text-[22px] font-medium tracking-[-0.03em] text-strong">{projects.length}</b>
              <span className="text-xs text-secondary">{projects.length === 1 ? "Project" : "Projects"}</span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-[14px] bg-raised px-3.5 py-3">
              <b className="text-[22px] font-medium tracking-[-0.03em] text-strong">{openTasks}</b>
              <span className="text-xs text-secondary">{openTasks === 1 ? "Open task" : "Open tasks"}</span>
            </div>
          </div>

          <div>
            <span className="mb-2 block text-xs font-medium text-secondary">Projects</span>
            {projects.length ? (
              <div className="flex flex-col gap-1">
                {projects.map((p) => (
                  <Link key={p._id} href={`/projects/${p._id}`} onClick={onClose} className="flex justify-between gap-2.5 rounded-xl bg-raised px-3 py-2.5 text-sm font-medium text-fg hover:bg-input">
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 text-xs font-normal text-faint">{p.clientId ? projectOwner(p, lookup.clients).label : data.org.name}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-[7px] text-xs text-faint">Not on any projects yet.</p>
            )}
          </div>

          {!me && user.active && (
            <Button variant="primary" href={`/inbox/${user._id}`} onClick={onClose} className="w-full">
              <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
              </svg>
              Message {firstName(user.name)}
            </Button>
          )}
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirm === "remove"}
        onClose={() => setConfirm(null)}
        onConfirm={() => act({ type: "member.active", id: user._id, data: { active: false } }, `${user.name} removed`, "Their history stays in place.")}
        busy={busy}
        tone="danger"
        title={`Remove ${user.name}?`}
        description="Their account is deactivated. Their tasks, messages and decisions stay in history, and an admin can restore them later."
        confirmLabel="Remove"
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        onConfirm={() => act({ type: "member.delete", id: user._id }, `${user.name} deleted`, "Their history now shows “Former member”.")}
        busy={busy}
        tone="danger"
        title={`Delete ${user.name} permanently?`}
        description="Their name and profile are erased, and their tasks, messages and decisions show “Former member”. If you invite the same email again, their history comes back with their name."
        confirmLabel="Delete"
      />
    </>
  );
}
