"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { Menu, RefreshCw, X } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { OverlayProvider } from "@/components/providers/OverlayProvider";
import { Avatar, Button, CountBadge, cx, Spinner } from "@/components/ui/primitives";
import { isOpenTask } from "@/lib/selectors";
import { Logo } from "./Logo";

const NAV = [
  [
    { href: "/", label: "Overview" },
    { href: "/projects", label: "Projects", badge: "projects" },
    { href: "/meetings", label: "Meetings" },
    { href: "/tasks", label: "My tasks", count: "tasks" },
  ],
  [
    { href: "/general", label: "# General", badge: "general" },
    { href: "/messages", label: "Messages", badge: "messages" },
  ],
  [
    { href: "/team", label: "Team" },
    { href: "/settings", label: "Settings" },
  ],
];

export function AppShell({ children }) {
  const { status, error, reload } = useWorkspace();

  if (status === "loading") return <BootScreen />;
  if (status === "error") {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-line bg-card p-6 text-center">
          <h1 className="text-base font-semibold text-strong">Couldn’t load the workspace</h1>
          <p className="mt-2 text-secondary">{error}</p>
          <p className="mt-2 text-xs text-faint">
            Database mode is on because <code className="font-mono">MONGODB_URI</code> is set. Fix the connection, or remove the variable to use browser demo mode.
          </p>
          <Button variant="primary" icon={RefreshCw} onClick={reload} className="mt-5">
            Try again
          </Button>
        </div>
      </div>
    );
  }
  return (
    <OverlayProvider>
      <Shell>{children}</Shell>
    </OverlayProvider>
  );
}

function BootScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Loading workspace">
      <div className="flex flex-col items-center gap-4">
        <Logo />
        <Spinner />
      </div>
    </div>
  );
}

function Shell({ children }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMobileOpen(false);
  }

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-on">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-divider bg-sidebar lg:block">
        <Sidebar />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-[var(--overlay)]" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="animate-slide-in absolute inset-y-0 left-0 w-64 max-w-[85vw] border-r border-divider bg-sidebar" aria-label="Navigation">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
              className="absolute top-4 right-2 rounded-lg p-2 text-muted hover:bg-hover hover:text-fg"
            >
              <X className="size-4" />
            </button>
            <Sidebar />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-divider bg-sidebar px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            className="-ml-1 flex size-11 items-center justify-center rounded-lg text-secondary hover:bg-hover hover:text-fg"
          >
            <Menu className="size-5" />
          </button>
          <MobileTitle />
        </header>
        <main id="main" className="flex min-w-0 flex-1 flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}

function MobileTitle() {
  const { data } = useWorkspace();
  return (
    <Link href="/" className="flex items-center gap-2.5 font-semibold">
      <Logo />
      {data.org.name}
    </Link>
  );
}

function useNavCounts() {
  const { data, unread, chats, currentUserId } = useWorkspace();
  const sum = (convs) => convs.reduce((n, c) => n + (c ? unread[c._id]?.count ?? 0 : 0), 0);
  const myProjects = data.projects.filter((p) => !p.archived && p.memberIds.includes(currentUserId));
  return {
    projects: sum(myProjects.map((p) => chats.projects[p._id])),
    general: sum([chats.general]),
    messages: sum(Object.values(chats.dms)),
    tasks: data.tasks.filter((t) => t.assigneeId === currentUserId && isOpenTask(t)).length,
  };
}

function Sidebar() {
  const pathname = usePathname();
  const { data, mode, currentUser } = useWorkspace();
  const counts = useNavCounts();

  return (
    <div className="flex h-full flex-col px-3.5 py-5">
      <Link href="/" className="flex items-center gap-2.5 px-2 pt-1 pb-5">
        <Logo />
        <span className="truncate text-[15px] font-semibold">{data.org.name}</span>
      </Link>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {NAV.map((group, i) => (
          <Fragment key={i}>
            {i > 0 && <div className="mx-1 my-2.5 h-px bg-divider" />}
            {group.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 transition-colors",
                    active ? "bg-hover text-strong" : "text-secondary hover:bg-hover/60 hover:text-fg"
                  )}
                >
                  {item.label}
                  {item.badge && <CountBadge count={counts[item.badge]} label={`${counts[item.badge]} unread`} />}
                  {item.count && counts[item.count] > 0 && (
                    <span className="text-[11px] text-muted tabular-nums" aria-label={`${counts[item.count]} open`}>
                      {counts[item.count]}
                    </span>
                  )}
                </Link>
              );
            })}
          </Fragment>
        ))}
      </nav>

      <Link href="/settings" className="mt-4 flex items-center gap-2.5 rounded-lg p-2 hover:bg-hover">
        <Avatar user={currentUser} size="sm" />
        <span className="min-w-0">
          <span className="block truncate text-[13px] text-fg">{currentUser?.name}</span>
          <span className="block truncate text-[11px] text-faint">{mode === "demo" ? "Demo data in this browser" : "Signed in via server config"}</span>
        </span>
      </Link>
    </div>
  );
}
