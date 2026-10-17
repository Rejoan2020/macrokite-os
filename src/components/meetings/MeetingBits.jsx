"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { cx } from "@/components/ui/primitives";
import { OptionMenu } from "@/components/ui/Menus";
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

/** Live countdown to a meeting's start, down to the second: "2d 4h 10m 05s", then "Live now" for an hour, then "Ended". */
export function countdown(startsAt, now) {
  const ms = new Date(startsAt).getTime() - now;
  if (ms <= 0) return ms > -60 * 60_000 ? "Live now" : "Ended";
  const t = Math.floor(ms / 1000);
  const d = Math.floor(t / 86_400);
  const h = Math.floor((t % 86_400) / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (d) return `${d}d ${h}h ${pad(m)}m ${pad(s)}s`;
  if (h) return `${h}h ${pad(m)}m ${pad(s)}s`;
  return `${m}m ${pad(s)}s`;
}

export function Countdown({ startsAt, className }) {
  const now = useNow();
  const text = countdown(startsAt, now);
  return (
    <span
      className={cx("text-xs tabular-nums", text === "Live now" ? "font-semibold text-success-text" : text === "Ended" ? "font-medium text-faint" : "font-semibold text-accent-tint-text", className)}
      suppressHydrationWarning
    >
      {text}
    </span>
  );
}

/** "meet.google.com/abc-defg-hij" without the protocol. */
export const shortLink = (url) => url.replace(/^https?:\/\//, "");

const CopyIcon = () => (
  <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="12" height="12" rx="3" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);

/** Copies a call link, then says "Copied" for a moment. `compact` is a square icon button. */
export function CopyLinkButton({ url, compact, className }) {
  const [copied, setCopied] = useState(false);
  const copy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const area = document.createElement("textarea");
      area.value = url;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy link"
      aria-label={compact ? (copied ? "Copied" : "Copy link") : undefined}
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border text-[13px] font-medium transition-colors duration-150 active:translate-y-px",
        copied ? "border-transparent bg-success-tint text-success-text" : "border-line bg-card text-fg hover:bg-hover",
        compact ? "size-9" : "h-9 px-3",
        className
      )}
    >
      <CopyIcon />
      {!compact && <span>{copied ? "Copied" : "Copy"}</span>}
    </button>
  );
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
 * Shows your meeting reminders while the app is open: a toast with the meeting's title, its start
 * time and a Join button, and a browser notification when allowed. Each reminder fires once per
 * device, from its time until 15 minutes after the start.
 */
export function useMeetingReminders() {
  const { data, currentUserId } = useWorkspace();
  const toast = useToast();
  const now = useNow(30_000);

  useEffect(() => {
    if (!data) return;
    const fired = readFired();
    let changed = false;
    for (const m of data.meetings) {
      const minutes = m.reminders?.[currentUserId];
      if (!minutes || m.endedAt) continue;
      const start = new Date(m.startsAt).getTime();
      const key = `${m._id}:${m.startsAt}:${minutes}`;
      if (fired[key] || now < start - minutes * 60_000 || now >= start + 15 * 60_000) continue;
      fired[key] = now;
      changed = true;
      const body = `Starts at ${formatTime(m.startsAt)}`;
      toast.info(m.title, body, m.callUrl ? { href: m.callUrl, label: "Join" } : undefined);
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(m.title, { body });
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

const REMIND_OPTIONS = [{ value: 0, label: "Off" }, ...REMINDER_OPTIONS.map((m) => ({ value: m, label: `${reminderLabel(m)} before` }))];

const BellIcon = () => (
  <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

/** The bell on a meeting card ("Notify me"): pick when to be reminded, or turn it off. Your own setting only. */
export function ReminderMenu({ meeting }) {
  const { currentUserId } = useWorkspace();
  const { run } = useAction();
  const toast = useToast();
  const current = meeting.reminders?.[currentUserId] ?? 0;

  const pick = async (minutes) => {
    // Ask for browser notifications the first time someone turns a reminder on.
    if (minutes && typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    if (await run({ type: "meeting.reminder", id: meeting._id, data: { minutes: minutes || null } }, { silent: true })) {
      toast.success(minutes ? `You'll be notified ${reminderLabel(minutes)} before “${meeting.title}”` : `Reminder turned off for “${meeting.title}”`);
    }
  };

  return (
    <OptionMenu
      label="Notify me"
      title={current ? `Notify me: ${reminderLabel(current)} before` : "Notify me"}
      value={current}
      options={REMIND_OPTIONS}
      onChange={pick}
      buttonClassName={cx(
        "inline-flex size-[34px] items-center justify-center rounded-full border transition-colors",
        current ? "border-transparent bg-accent-tint text-accent-tint-text" : "border-row text-secondary hover:bg-input hover:text-fg"
      )}
      trigger={() => <BellIcon />}
    />
  );
}
