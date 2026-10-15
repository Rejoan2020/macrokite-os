import "server-only";
import { getWorkOS } from "@workos-inc/authkit-nextjs";

/**
 * Invite emails, sent by WorkOS. Membership itself never depends on them: an invite is accepted
 * when that verified email signs in (see repository.acceptInvites), so a failed email only means
 * the admin has to share the link. The email links to the "User invitation URL" set in the WorkOS
 * dashboard, which should be <app url>/auth/sign-in.
 */

/** Sends (or re-sends) the invite email. Returns { workosInvitationId } or { emailError }. */
export async function sendInviteEmail(invite, inviterAuthId) {
  const userManagement = getWorkOS().userManagement;
  try {
    if (invite.workosInvitationId) {
      try {
        const resent = await userManagement.resendInvitation(invite.workosInvitationId);
        return { workosInvitationId: resent.id };
      } catch {
        // Expired, revoked or accepted elsewhere: fall through and send a fresh one.
      }
    }
    try {
      const sent = await userManagement.sendInvitation({ email: invite.email, inviterUserId: inviterAuthId });
      return { workosInvitationId: sent.id };
    } catch (error) {
      // WorkOS allows one pending invitation per email, e.g. one sent before this record existed.
      const { data } = await userManagement.listInvitations({ email: invite.email });
      const pending = data.find((i) => i.state === "pending");
      if (!pending) throw error;
      const resent = await userManagement.resendInvitation(pending.id);
      return { workosInvitationId: resent.id };
    }
  } catch (error) {
    console.error("[invite email]", error);
    return { emailError: error?.message || "WorkOS could not send the email." };
  }
}

/** Revokes the emailed invitation so its link stops working. Best effort. */
export async function revokeInviteEmail(invite) {
  if (!invite?.workosInvitationId) return;
  try {
    await getWorkOS().userManagement.revokeInvitation(invite.workosInvitationId);
  } catch (error) {
    // Already accepted, expired or revoked: nothing left to stop.
    console.warn("[invite email] revoke failed", error?.message);
  }
}
