import { getSignInUrl, getSignUpUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

// Starts the WorkOS AuthKit sign-in (Google or email + password). Also the "Initiate login URI" and
// the "User invitation URL" configured in the WorkOS dashboard. An invite email link arrives with
// ?invitation_token=…, which opens sign-up with the invited email already filled in.
export async function GET(request) {
  const token = request.nextUrl.searchParams.get("invitation_token");
  if (!token) redirect(await getSignInUrl());
  const url = new URL(await getSignUpUrl());
  url.searchParams.set("invitation_token", token);
  redirect(url.href);
}
