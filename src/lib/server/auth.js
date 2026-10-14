import "server-only";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { DomainError } from "../engine";
import { normalizeEmail } from "../membership";
import { missingAuthConfig } from "./auth-config";

// Sign-in is handled by WorkOS AuthKit (Google and email + password are enabled in the WorkOS
// dashboard). The session lives in an encrypted cookie that the proxy refreshes on each request.

/**
 * The signed-in account, or a DomainError. Database mode never runs without sign-in: missing
 * WorkOS configuration is a server error, not an open door.
 */
export async function requireIdentity() {
  const missing = missingAuthConfig();
  if (missing.length) {
    throw new DomainError(`Sign-in is not configured. Set ${missing.join(", ")} on the server.`, { status: 500 });
  }
  const { user } = await withAuth();
  if (!user) throw new DomainError("Your session has ended. Sign in again.", { status: 401 });
  return {
    id: user.id,
    email: normalizeEmail(user.email),
    emailVerified: Boolean(user.emailVerified),
    name: user.name || [user.firstName, user.lastName].filter(Boolean).join(" "),
    avatarUrl: user.profilePictureUrl ?? "",
  };
}
