import { NextResponse } from "next/server";
import { authkit, handleAuthkitProxy } from "@workos-inc/authkit-nextjs";
import { isAuthConfigured } from "@/lib/server/auth-config";

/**
 * Keeps the WorkOS session fresh and sends signed-out visitors to sign-in. Runs only in database
 * mode with sign-in configured; browser demo mode has no accounts. This is the optimistic check:
 * the API routes verify the session again before touching data.
 */
const authRequired = () => Boolean(process.env.MONGODB_URI?.trim()) && isAuthConfigured();

export default async function proxy(request) {
  if (!authRequired()) return NextResponse.next();
  const { session, headers, authorizationUrl } = await authkit(request);
  const { pathname } = request.nextUrl;
  const isPage = !pathname.startsWith("/api/") && !pathname.startsWith("/auth/");
  if (isPage && !session.user && authorizationUrl) return handleAuthkitProxy(request, headers, { redirect: authorizationUrl });
  return handleAuthkitProxy(request, headers);
}

export const config = {
  // Everything except Next.js assets and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
