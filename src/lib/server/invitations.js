import "server-only";
import { getWorkOS } from "@workos-inc/authkit-nextjs";
import { appUrl, escapeHtml, isEmailConfigured, sendEmail } from "./email";

/**
 * Invite emails. WorkOS sends them first; when it can't (it won't email someone who already has an
 * account), the app sends its own over SMTP if that is configured. Membership never depends on
 * either: an invite is accepted when that verified email signs in (see repository.acceptInvites),
 * so a missing email only means the admin shares the link. The WorkOS email links to the "User
 * invitation URL" set in the WorkOS dashboard, which should be <app url>/auth/sign-in.
 */

/**
 * Sends (or re-sends) the invite email.
 * Returns { emailSent: true, workosInvitationId? } or { emailSent: false, emailError, hasAccount? }.
 */
export async function sendInviteEmail(invite, { inviterAuthId, inviterName, orgName }) {
  let workosError;
  try {
    return { emailSent: true, workosInvitationId: await sendWithWorkOS(invite, inviterAuthId) };
  } catch (error) {
    workosError = error;
  }
  const hasAccount = /already exists/i.test(`${workosError?.code} ${workosError?.message}`);
  if (!hasAccount) console.error("[invite email] WorkOS", workosError);

  if (isEmailConfigured()) {
    try {
      await sendOwnInvite(invite, { inviterName, orgName });
      return { emailSent: true };
    } catch (error) {
      console.error("[invite email] SMTP", error);
      return { emailSent: false, emailError: `The email couldn’t be sent (${error?.message || "SMTP error"}).` };
    }
  }
  if (hasAccount) return { emailSent: false, hasAccount: true, emailError: "They already have an account, so WorkOS won’t email them." };
  return { emailSent: false, emailError: workosError?.message || "WorkOS could not send the email." };
}

async function sendWithWorkOS(invite, inviterAuthId) {
  const userManagement = getWorkOS().userManagement;
  if (invite.workosInvitationId) {
    try {
      return (await userManagement.resendInvitation(invite.workosInvitationId)).id;
    } catch {
      // Expired, revoked or accepted elsewhere: fall through and send a fresh one.
    }
  }
  try {
    return (await userManagement.sendInvitation({ email: invite.email, inviterUserId: inviterAuthId })).id;
  } catch (error) {
    // WorkOS allows one pending invitation per email, e.g. one sent before this record existed.
    const { data } = await userManagement.listInvitations({ email: invite.email });
    const pending = data.find((i) => i.state === "pending");
    if (!pending) throw error;
    return (await userManagement.resendInvitation(pending.id)).id;
  }
}

async function sendOwnInvite(invite, { inviterName, orgName }) {
  const link = appUrl("/auth/sign-in");
  if (!link) throw new Error("NEXT_PUBLIC_WORKOS_REDIRECT_URI is not set, so there is no app link to send");
  const who = inviterName || "A teammate";
  const workspace = orgName || "their workspace";
  await sendEmail({
    to: invite.email,
    subject: `${who} invited you to ${workspace} on MacroKite OS`,
    text: `${who} invited you to join ${workspace} on MacroKite OS.\n\nSign in with ${invite.email} to join:\n${link}\n\nIf you weren’t expecting this, you can ignore this email.`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;max-width:480px">
  <p><strong>${escapeHtml(who)}</strong> invited you to join <strong>${escapeHtml(workspace)}</strong> on MacroKite OS.</p>
  <p><a href="${escapeHtml(link)}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">Join ${escapeHtml(workspace)}</a></p>
  <p style="color:#555">Sign in with <strong>${escapeHtml(invite.email)}</strong>, the address this invite was sent to.</p>
  <p style="color:#888;font-size:13px">If you weren’t expecting this, you can ignore this email.</p>
</div>`,
  });
}

/** Revokes the emailed WorkOS invitation so its link stops working. Best effort. */
export async function revokeInviteEmail(invite) {
  if (!invite?.workosInvitationId) return;
  try {
    await getWorkOS().userManagement.revokeInvitation(invite.workosInvitationId);
  } catch (error) {
    // Already accepted, expired or revoked: nothing left to stop.
    console.warn("[invite email] revoke failed", error?.message);
  }
}
