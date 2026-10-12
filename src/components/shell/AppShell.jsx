"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckSquare,
  ChevronDown,
  Database,
  FolderKanban,
  HardDrive,
  Inbox,
  LayoutDashboard,
  Menu,
  MessageSquarePlus,
  Plus,
  RefreshCw,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { OverlayProvider, useOverlays } from "@/components/providers/OverlayProvider";
import { Avatar, Button, cx, Spinner } from "@/components/ui/primitives";
import { isUnread } from "@/lib/selectors";
import { Logo } from "./Logo";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox, badge: "unread" },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "My Tasks", icon: CheckSquare, badge: "myTasks" },
  { href: "/team", label: "Team", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }) {
  const { status, error, reload } = useWorkspace();

  if (status === "loading") return <BootScreen />;
  if (status === "error") {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 text-center shadow-card">
          <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-xl bg-danger-soft text-danger">
            <AlertTriangle className="size-5" aria-hidden />
          </div>
          <h1 className="text-base font-semibold">Couldn’t load the workspace</h1>
          <p className="mt-2 text-[13px] text-muted">{error}</p>
          <p className="mt-2 text-xs text-subtle">
            Database mode is enabled because <code className="font-mono">MONGODB_URI</code> is set. Fix the connection, or remove the variable to use browser demo mode.
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
        <Logo className="size-9" />
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
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-border bg-surface/60 lg:block">
        <Sidebar />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-[var(--overlay)]" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="animate-slide-in absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-border bg-surface shadow-pop" aria-label="Navigation">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
              className="absolute right-2 top-3.5 rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg"
            >
              <X className="size-4" />
            </button>
            <Sidebar />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg"
          >
            <Menu className="size-5" />
          </button>
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Logo className="size-6" />
            MacroKite OS
          </Link>
          <div className="ml-auto">
            <QuickCreate compact />
          </div>
        </header>
        <ModeBanner />
        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function ModeBanner() {
  const { mode } = useWorkspace();
  const [dismissed, setDismissed] = useState(false);
  if (mode !== "demo" || dismissed) return null;
  return (
    <div className="flex items-center gap-2 border-b border-border bg-surface/70 px-4 py-2 text-xs text-muted sm:px-6 lg:px-8">
      <HardDrive className="size-3.5 shrink-0 text-accent" aria-hidden />
      <p className="min-w-0 flex-1">
        <span className="font-medium text-fg">Demo mode.</span> Data is saved in this browser’s local storage only — not in a database. No sign-in is
        required and this build is not secured for public use.{" "}
        <Link href="/settings#storage" className="text-accent hover:underline">
          Learn more
        </Link>
      </p>
      <button type="button" onClick={() => setDismissed(true)} aria-label="Hide demo mode notice" className="rounded p-1 text-subtle hover:text-fg">
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const { data, mode, currentUser, currentUserId } = useWorkspace();
  const counts = {
    unread: data.conversations.filter((c) => isUnread(c, currentUserId)).length,
    myTasks: data.tasks.filter((t) => t.assigneeId === currentUserId && t.status !== "done").length,
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <Logo className="size-8" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight text-fg">{data.org.name}</p>
          <p className="flex items-center gap-1 text-[11px] text-subtle">
            {mode === "database" ? <Database className="size-3" aria-hidden /> : <HardDrive className="size-3" aria-hidden />}
            {mode === "database" ? "MongoDB workspace" : "Demo workspace"}
          </p>
        </div>
      </div>

      <div className="px-3 pb-2">
        <QuickCreate />
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const count = item.badge ? counts[item.badge] : 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors",
                    active ? "bg-surface-3 font-medium text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"
                  )}
                >
                  <item.icon className={cx("size-4", active ? "text-accent" : "text-subtle group-hover:text-muted")} aria-hidden />
                  {item.label}
                  {count > 0 && (
                    <span
                      className={cx(
                        "ml-auto rounded-full px-1.5 text-[10px] font-semibold tabular-nums leading-4",
                        item.badge === "unread" ? "bg-accent text-accent-fg" : "bg-surface-3 text-muted"
                      )}
                      aria-label={item.badge === "unread" ? `${count} unread` : `${count} open`}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border p-3">
        <Link href="/settings#profile" className="flex items-center gap-2.5 rounded-md p-1.5 hover:bg-surface-2">
          <Avatar user={currentUser} size="md" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-fg">{currentUser?.name}</p>
            <p className="truncate text-[11px] text-subtle">Demo identity · not signed in</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

function QuickCreate({ compact }) {
  const overlays = useOverlays();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = [
    { label: "New task", icon: CheckSquare, run: () => overlays.newTask() },
    { label: "New project", icon: FolderKanban, run: () => overlays.newProject() },
    { label: "New client", icon: Building2, run: () => overlays.newClient() },
    { label: "New conversation", icon: MessageSquarePlus, run: () => overlays.newThread() },
  ];

  return (
    <div ref={ref} className="relative">
      <Button
        variant={compact ? "primary" : "secondary"}
        icon={Plus}
        className={compact ? "" : "w-full justify-start"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {compact ? "New" : "Create"}
        {!compact && <ChevronDown className="ml-auto size-3.5 text-subtle" aria-hidden />}
      </Button>
      {open && (
        <div role="menu" className={cx("animate-pop-in absolute z-50 mt-1 w-52 rounded-lg border border-border bg-surface-2 p-1 shadow-pop", compact ? "right-0" : "left-0")}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.run();
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] text-muted hover:bg-surface-3 hover:text-fg focus:bg-surface-3 focus:text-fg focus:outline-none"
            >
              <item.icon className="size-4 text-subtle" aria-hidden />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
