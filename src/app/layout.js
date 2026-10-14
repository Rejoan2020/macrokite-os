import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { WorkspaceProvider } from "@/components/providers/WorkspaceProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata = {
  title: { default: "Macrokite OS", template: "%s · Macrokite OS" },
  description: "The Macrokite team hub: projects, meetings, decisions and conversation in one place.",
};

export const viewport = {
  themeColor: "#0b0c0e",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
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
