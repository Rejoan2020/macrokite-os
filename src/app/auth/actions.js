"use server";

import { signOut } from "@workos-inc/authkit-nextjs";

// Server action, so Next.js checks the request's origin before the session is cleared.
// returnTo comes from the configured callback URL, so each deployment returns to its own
// home page instead of the default sign-out URI in WorkOS. It must be listed there too.
export async function signOutAction() {
  const redirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
  await signOut(redirectUri ? { returnTo: new URL("/", redirectUri).href } : undefined);
}
