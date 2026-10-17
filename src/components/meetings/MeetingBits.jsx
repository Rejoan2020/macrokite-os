"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Bell, BellRing, Check, Copy } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Button, cx, IconButton } from "@/components/ui/primitives";
import { useAction } from "@/lib/client/useAction";
import { REMINDER_OPTIONS, reminderLabel } from "@/lib/constants";
import { formatTime } from "@/lib/format";

/** The current time, updated every `intervalMs`. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

const pad = (n) => String(n).padStart(2, "0");

/** "8h 38m 07s" until it starts, "2d 4h" when it's days away, "Now" once it has started. */
export function countdown(startsAt, now) {
  const ms = new Date(startsAt).getTime() - now;
  if (ms <= 0) return "Now";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s % 60)}s`;
  return `${m}m ${pad(s % 60)}s`;
}

/** Live time until a meeting starts, in the accent color. */
export function Countdown({ startsAt, className }) {
  const now = useNow();
  return (
    <span className={cx("font-semibold text-accent tabular-nums", className)} suppressHydrationWarning>
      {countdown(startsAt, now)}
    </span>
  );
}

/** "meet.google.com/abc-defg-hij" without the protocol. */
export const shortLink = (url) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");

/** Copies a call link and says so. `labelled` shows "Copy" next to the icon. */
export function CopyLinkButton({ url, labelled, className }) {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn’t copy the link", url);
    }
  };
  if (labelled) {
    return (
      <Button variant="outline" icon={Copy} onClick={copy} className={className}>
        Copy
      </Button>
    );
  }
  return <IconButton icon={Copy} label="Copy call link" outline onClick={copy} className={className} />;
}

const FIRED_KEY = "macrokite-os:reminders-fired";

function readFired() {
  try {
    return JSON.parse(window.localStorage.getItem(FIRED_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/**
 * Shows your meeting reminders while the app is open: a toast, and a browser notification when
 * allowed. Each reminder fires once per device (remembered in localStorage), and only inside its
 * window, so opening the app after a meeting has started doesn't fire it late.
 */
export function useMeetingReminders() {
  const { data, currentUserId } = useWorkspace();
  const toast = useToast();
  const now = useNow(15_000);

  useEffect(() => {
    if (!data) return;
    const fired = readFired();
    let changed = false;
    for (const m of data.meetings) {
      const minutes = m.reminders?.[currentUserId];
      if (!minutes || m.endedAt) continue;
      const start = new Date(m.startsAt).getTime();
      const key = `${m._id}:${m.startsAt}:${minutes}`;
      if (fired[key] || now < start - minutes * 60_000 || now >= start) continue;
      fired[key] = now;
      changed = true;
      const body = `Starts at ${formatTime(m.startsAt)}${m.callUrl ? ` · ${shortLink(m.callUrl)}` : ""}`;
      toast.info(`Reminder: ${m.title}`, body);
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(`Reminder: ${m.title}`, { body });
      } catch {
        // The toast is enough.
      }
    }
    if (changed) {
      // Drop entries for meetings that are long gone so the record stays small.
      const week = now - 7 * 86_400_000;
      const kept = Object.fromEntries(Object.entries(fired).filter(([, at]) => at > week));
      try {
        window.localStorage.setItem(FIRED_KEY, JSON.stringify(kept));
      } catch {
        // Worst case a reminder shows again after a reload.
      }
    }
  }, [data, currentUserId, now, toast]);
}

/** The bell on a meeting card: pick when to be reminded, or turn it off. Your own setting only. */
export function ReminderMenu({ meeting }) {
  const { currentUserId } = useWorkspace();
  const { run, busy } = useAction();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const menuId = useId();
  const current = meeting.reminders?.[currentUserId] ?? null;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => wrapRef.current && !wrapRef.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    wrapRef.current?.querySelector('[role="menuitemradio"][aria-checked="true"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (minutes) => {
    setOpen(false);
    if (minutes === current) return;
    // Ask for browser notifications the first time someone turns a reminder on.
    if (minutes && typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    run({ type: "meeting.reminder", id: meeting._id, data: { minutes } }, { success: minutes ? `Reminder set: ${reminderLabel(minutes)} before` : "Reminder off" });
  };

  const label = current ? `Reminder: ${reminderLabel(current)} before` : "Set a reminder";
  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={cx("inline-flex size-9 items-center justify-center rounded-full border transition-colors hover:bg-hover", current ? "border-accent/40 bg-accent-tint text-accent" : "border-line text-muted hover:text-fg")}
      >
        {current ? <BellRing className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />}
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label="Remind me" className="absolute top-full right-0 z-30 mt-1.5 w-52 rounded-2xl border border-line bg-card py-1.5 shadow-pop">
          <p className="px-4 pt-1.5 pb-1 text-xs text-muted">Remind me</p>
          {[null, ...REMINDER_OPTIONS].map((minutes) => (
            <button
              key={minutes ?? "off"}
              type="button"
              role="menuitemradio"
              aria-checked={minutes === current}
              onClick={() => pick(minutes)}
              className="mx-1.5 flex w-[calc(100%-12px)] items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] text-fg outline-none hover:bg-hover focus-visible:bg-hover"
            >
              <Check aria-hidden className={cx("size-4 shrink-0 text-accent", minutes !== current && "invisible")} />
              {minutes ? `${reminderLabel(minutes)} before` : "Off"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
