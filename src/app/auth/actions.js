"use server";

import { signOut } from "@workos-inc/authkit-nextjs";

// Server action, so Next.js checks the request's origin before the session is cleared.
export async function signOutAction() {
  await signOut();
}
