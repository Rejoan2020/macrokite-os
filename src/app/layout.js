import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { WorkspaceProvider } from "@/components/providers/WorkspaceProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { AppShell } from "@/components/shell/AppShell";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata = {
  title: { default: "Macrokite OS", template: "%s · Macrokite OS" },
  description: "The Macrokite team hub: clients, projects, tasks, meetings and conversation in one place.",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e0f11" },
    { media: "(prefers-color-scheme: light)", color: "#f2f2f3" },
  ],
};

export default function RootLayout({ children }) {
  return (
    // The theme script sets data-theme before React hydrates, so the attribute may differ.
    <html lang="en" data-theme="dark" className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <ToastProvider>
          <WorkspaceProvider>
            <Suspense fallback={null}>
              <AppShell>{children}</AppShell>
            </Suspense>
          </WorkspaceProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
