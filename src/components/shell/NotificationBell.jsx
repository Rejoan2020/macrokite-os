"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Avatar, CountBadge, cx } from "@/components/ui/primitives";
import { formatStamp } from "@/lib/format";
import { myNotifications } from "@/lib/notifications";

const SHOWN = 30;

/** The current user's unread notifications that still point somewhere. */
export function useUnreadNotifications() {
  const { data, currentUserId } = useWorkspace();
  return data ? myNotifications(data, currentUserId).filter((n) => !n.readAt).length : 0;
}

/** Bell with an unread count; opens the list of the current user's notifications. */
export function NotificationBell({ align = "left" }) {
  const { data, currentUserId, lookup, dispatch } = useWorkspace();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const panelId = useId();

  const items = myNotifications(data, currentUserId);
  const unread = items.filter((n) => !n.readAt).length;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => wrapRef.current && !wrapRef.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Marking read is best effort: failing to save it shouldn't stop the navigation.
  const markRead = (action) => dispatch(action).catch(() => {});

  const openItem = (n) => {
    setOpen(false);
    if (!n.readAt) markRead({ type: "notification.read", id: n._id });
    router.push(n.view.href);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={cx("relative flex size-9 items-center justify-center rounded-lg text-secondary hover:bg-hover hover:text-fg", open && "bg-hover text-fg")}
      >
        <Bell className="size-[18px]" />
        <CountBadge count={unread > 99 ? "99+" : unread} className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]" />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          className={cx(
            "absolute top-full z-50 mt-2 flex max-h-[70vh] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-line bg-card shadow-lg",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-[13px] font-semibold text-strong">Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={() => markRead({ type: "notification.readAll" })} className="text-[12px] text-accent hover:text-accent-light">
                Mark all read
              </button>
            )}
          </div>
          {items.length ? (
            <ul className="overflow-y-auto py-1">
              {items.slice(0, SHOWN).map((n) => (
                <li key={n._id}>
                  <button type="button" onClick={() => openItem(n)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-hover">
                    <Avatar user={lookup.users[n.view.actorId]} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className={cx("block text-[13px]", n.readAt ? "text-secondary" : "font-medium text-strong")}>{n.view.text}</span>
                      {n.view.detail && <span className="mt-0.5 block truncate text-[12px] text-muted">{n.view.detail}</span>}
                      <span className="mt-0.5 block text-[11px] text-faint">{formatStamp(n.createdAt)}</span>
                    </span>
                    {!n.readAt && <span aria-label="Unread" className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-[13px] text-muted">No notifications yet. Mentions, messages, assignments and meeting invites show up here.</p>
          )}
        </div>
      )}
    </div>
  );
}
