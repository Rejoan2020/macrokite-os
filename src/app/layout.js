import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { WorkspaceProvider } from "@/components/providers/WorkspaceProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata = {
  title: { default: "MacroKite OS", template: "%s · MacroKite OS" },
  description: "Unified workspace for agencies: clients, projects, tasks and conversations in one place.",
};

export const viewport = {
  themeColor: "#090B0D",
};

// Applies the saved theme before first paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem("macrokite-os:theme");if(t==="light"||(t==="system"&&matchMedia("(prefers-color-scheme: light)").matches))document.documentElement.dataset.theme="light"}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
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
