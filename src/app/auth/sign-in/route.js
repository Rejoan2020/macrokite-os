import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

// Starts the WorkOS AuthKit sign-in (Google or email + password). Also the "Initiate login URI"
// configured in the WorkOS dashboard.
export async function GET() {
  redirect(await getSignInUrl());
}
