import { Suspense } from "react";
import { Inter } from "next/font/google";
import { WorkspaceProvider } from "@/components/providers/WorkspaceProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { AppShell, BootScreen } from "@/components/shell/AppShell";
import { THEME_SCRIPT } from "@/lib/theme";
import { requireIdentity } from "@/lib/server/auth";
import { isDatabaseConfigured } from "@/lib/server/db";
import { getWorkspace } from "@/lib/server/repository";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });

export const metadata = {
  title: { default: "Macrokite OS", template: "%s · Macrokite OS" },
  description: "The Macrokite team hub: clients, projects, tasks, meetings and conversation in one place.",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e1014" },
    { media: "(prefers-color-scheme: light)", color: "#e7e9ee" },
  ],
};

/**
 * The workspace, loaded on the server while the page renders, so the browser has it as soon as it
 * starts instead of asking for it then. Client navigations don't re-render this layout.
 */
async function Workspace({ children }) {
  return (
    <WorkspaceProvider initial={await initialWorkspace()}>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}

/** What GET /api/workspace would send, or null on any problem: the browser then asks for it and shows the error. */
async function initialWorkspace() {
  if (!isDatabaseConfigured()) return { mode: "demo" };
  try {
    // Plain JSON, exactly as the API sends it.
    return JSON.parse(JSON.stringify({ mode: "database", ...(await getWorkspace(await requireIdentity())) }));
  } catch {
    return null;
  }
}

export default function RootLayout({ children }) {
  return (
    // The theme script sets data-theme before React hydrates, so the attribute may differ.
    <html lang="en" data-theme="dark" className={`${inter.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <ToastProvider>
          <Suspense fallback={<BootScreen />}>
            <Workspace>{children}</Workspace>
          </Suspense>
        </ToastProvider>
      </body>
    </html>
  );
}
