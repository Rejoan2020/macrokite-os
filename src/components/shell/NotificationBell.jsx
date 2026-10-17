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
        className={cx("relative flex size-[34px] items-center justify-center rounded-full border border-row text-secondary hover:bg-input hover:text-fg", open && "bg-input text-fg")}
      >
        <Bell className="size-4" strokeWidth={1.8} />
        <CountBadge count={unread > 99 ? "99+" : unread} className="absolute -top-[5px] -right-1.5 h-[18px] min-w-[18px] border-2 border-sidebar px-[5px] text-[10px] font-bold" />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          className={cx(
            "animate-pop-in absolute top-full z-50 mt-2 flex max-h-[70vh] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[20px] border border-line bg-card",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <div className="flex items-center justify-between border-b border-row px-[18px] pt-4 pb-3">
            <span className="text-[15px] font-semibold text-strong">Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={() => markRead({ type: "notification.readAll" })} className="text-[13px] font-medium text-secondary underline decoration-line underline-offset-4 hover:text-fg hover:decoration-current">
                Mark all as read
              </button>
            )}
          </div>
          {items.length ? (
            <ul className="max-h-[440px] overflow-y-auto p-1.5">
              {items.slice(0, SHOWN).map((n) => (
                <li key={n._id}>
                  <button type="button" onClick={() => openItem(n)} className="relative flex w-full items-start gap-3 rounded-[14px] p-3 text-left hover:bg-raised">
                    <Avatar user={lookup.users[n.view.actorId]} size="notif" />
                    <span className="flex min-w-0 flex-1 flex-col gap-[3px] text-[13px] leading-[19px] text-secondary">
                      <span className={n.readAt ? undefined : "text-fg"}>
                        <NotificationLine text={n.view.text} name={lookup.users[n.view.actorId]?.name} />
                      </span>
                      {n.view.detail && <span className="line-clamp-2 rounded-[4px_10px_10px_10px] bg-input px-2.5 py-1.5 text-xs text-secondary">{n.view.detail}</span>}
                      <span className="text-[11px] text-faint">{formatStamp(n.createdAt)}</span>
                    </span>
                    {!n.readAt && <span aria-label="Unread" className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-[26px] text-center text-[13px] text-faint">You’re all caught up.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** The notification's sentence with the person's name and anything in quotes in bold. */
function NotificationLine({ text, name }) {
  const parts = text.split(/(“[^”]+”)/g);
  return parts.map((part, i) => {
    if (/^“.+”$/.test(part)) return <b key={i} className="font-semibold text-fg">{part.slice(1, -1)}</b>;
    if (i === 0 && name && part.startsWith(name)) {
      return (
        <span key={i}>
          <b className="font-semibold text-fg">{name}</b>
          {part.slice(name.length)}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
