"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { BriefcaseBusiness, Building2, CalendarDays, Inbox, LayoutGrid, Menu, Moon, RefreshCw, SquareCheckBig, Sun, X } from "lucide-react";
import { useBackgroundRefresh, useWorkspace } from "@/components/providers/WorkspaceProvider";
import { OverlayProvider } from "@/components/providers/OverlayProvider";
import { Avatar, Button, CountBadge, cx, Spinner } from "@/components/ui/primitives";
import { useTheme } from "@/lib/client/theme";
import { Logo } from "./Logo";
import { OnboardingScreen } from "./AccountScreens";
import { NotificationBell, useUnreadNotifications } from "./NotificationBell";
import { useMeetingReminders } from "@/components/meetings/MeetingBits";

const COUNT_PREFIX = /^\(\d+\+?\) /;

/**
 * Shows the unread notification count in the browser tab, e.g. "(3) Inbox · Macrokite OS".
 * Next.js sets the title on navigation, so the prefix is re-applied whenever the title changes.
 */
function useTitleCount(count) {
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(COUNT_PREFIX, "");
      const next = count ? `(${count > 99 ? "99+" : count}) ${base}` : base;
      if (document.title !== next) document.title = next;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => {
      observer.disconnect();
      document.title = document.title.replace(COUNT_PREFIX, "");
    };
  }, [count]);
}

const NAV = [
  [
    { key: "overview", href: "/", label: "Overview", icon: LayoutGrid },
    { key: "tasks", href: "/tasks", label: "My tasks", icon: SquareCheckBig },
    { key: "meetings", href: "/meetings", label: "Meetings", icon: CalendarDays },
    { key: "inbox", href: "/inbox", label: "Inbox", icon: Inbox, badge: "inbox" },
  ],
  [
    { key: "clients", href: "/clients", label: "Clients", icon: BriefcaseBusiness },
    { key: "company", href: "/company", label: "Company", icon: Building2 },
  ],
];

export function AppShell({ children }) {
  const { status, error, reload } = useWorkspace();

  if (status === "loading") return <BootScreen />;
  if (status === "onboarding") return <OnboardingScreen />;
  if (status === "error") {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="w-full max-w-md rounded-[22px] border border-card-line bg-card p-7 text-center">
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
  useBackgroundRefresh();
  useTitleCount(useUnreadNotifications());
  useMeetingReminders();
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
    <div className="flex min-h-dvh bg-page">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-on">
        Skip to content
      </a>
      <div className="sticky top-0 hidden h-dvh w-[262px] shrink-0 py-4 pl-4 lg:block">
        <aside className="h-full rounded-[22px] border border-card-line bg-sidebar">
          <Sidebar />
        </aside>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-[var(--overlay)]" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="animate-slide-in absolute inset-y-3 left-3 w-64 max-w-[85vw] rounded-[22px] border border-card-line bg-sidebar" aria-label="Navigation">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
              className="absolute top-[18px] right-3 rounded-full p-2 text-muted hover:bg-hover hover:text-fg"
            >
              <X className="size-4" />
            </button>
            <Sidebar mobile />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-divider bg-page/90 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            className="-ml-1 flex size-11 items-center justify-center rounded-full text-secondary hover:bg-hover hover:text-fg"
          >
            <Menu className="size-5" />
          </button>
          <MobileTitle />
          <div className="ml-auto">
            <NotificationBell align="right" />
          </div>
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
    <Link href="/" className="flex items-center gap-2.5 font-semibold text-strong">
      <Logo className="size-7 text-[13px]" />
      {data.org.name}
    </Link>
  );
}

function useNavCounts() {
  const { unread, chats } = useWorkspace();
  const sum = (convs) => convs.reduce((n, c) => n + (c ? unread[c._id]?.count ?? 0 : 0), 0);
  return { inbox: sum([chats.general, ...chats.groups, ...Object.values(chats.dms)]) };
}

/** Which menu item a path belongs to. Project and task pages count as Clients or Company, by the project's client. */
function useSection(pathname) {
  const { lookup } = useWorkspace();
  const [, first, id] = pathname.split("/");
  if (!first) return "overview";
  if (first === "messages") return "inbox";
  if ((first === "projects" || first === "tasks") && id) {
    const project = first === "projects" ? lookup.projects[id] : lookup.projects[lookup.tasks[id]?.projectId];
    return project?.clientId ? "clients" : "company";
  }
  return first === "settings" ? null : first;
}

function NavLink({ item, active, counts }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "relative flex h-11 items-center gap-3 rounded-[14px] px-3 text-[15px] font-medium transition-colors",
        active ? "bg-hover text-strong" : "text-secondary hover:bg-hover/60 hover:text-fg"
      )}
    >
      {active && <span aria-hidden className="absolute top-1/2 -left-[13px] h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />}
      <Icon className={cx("size-[18px] shrink-0", active ? "text-accent" : "text-muted")} strokeWidth={1.75} aria-hidden />
      <span className="flex-1">{item.label}</span>
      {item.badge && <CountBadge count={counts[item.badge]} label={`${counts[item.badge]} unread`} className="h-5 min-w-5" />}
    </Link>
  );
}

function ThemeButton() {
  const { resolved, setPreference } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";
  const Icon = resolved === "dark" ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-raised text-secondary hover:bg-hover hover:text-fg"
    >
      <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
    </button>
  );
}

function Sidebar({ mobile }) {
  const pathname = usePathname();
  const { data, mode, currentUser } = useWorkspace();
  const counts = useNavCounts();
  const section = useSection(pathname);

  return (
    <div className="flex h-full flex-col px-3 py-4">
      <div className="flex items-center gap-2 px-2 pt-1 pb-5">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5">
          <Logo />
          <span className="truncate text-base font-semibold text-strong">{data.org.name}</span>
        </Link>
        {!mobile && <NotificationBell />}
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {NAV.map((group, i) => (
          <Fragment key={i}>
            {i > 0 && <div className="mx-2 my-3 h-px bg-divider" />}
            {group.map((item) => (
              <NavLink key={item.key} item={item} active={section === item.key} counts={counts} />
            ))}
          </Fragment>
        ))}
      </nav>

      <div className="mt-4 flex items-center gap-2">
        <Link
          href="/settings"
          aria-current={pathname === "/settings" ? "page" : undefined}
          className={cx("flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-2.5 hover:bg-hover", pathname === "/settings" ? "bg-hover" : "bg-raised")}
        >
          <Avatar user={currentUser} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-strong">{currentUser?.name}</span>
            <span className="block truncate text-[11px] text-faint">{mode === "demo" ? "Demo data in this browser" : currentUser?.email}</span>
          </span>
        </Link>
        <ThemeButton />
      </div>
    </div>
  );
}
