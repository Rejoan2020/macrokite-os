import { handleAuth } from "@workos-inc/authkit-nextjs";

// WorkOS redirects here after sign-in (NEXT_PUBLIC_WORKOS_REDIRECT_URI). Sets the session cookie,
// then returns the person to the page they started from.
export const GET = handleAuth();
