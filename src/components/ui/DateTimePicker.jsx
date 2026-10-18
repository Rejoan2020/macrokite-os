"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "./primitives";

/**
 * A date and time field: a button that opens a month calendar next to a list of times.
 * `value` and `onChange` use the same "YYYY-MM-DDTHH:mm" local string as <input type="datetime-local">.
 *
 * The panel is position: fixed so the scrolling body of a dialog doesn't clip it, and it is rendered
 * inside the field so a dialog's focus trap and outside-click handling still treat it as its own.
 */

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
// Every 15 minutes through the day.
const SLOTS = Array.from({ length: 96 }, (_, i) => `${pad(Math.floor(i / 4))}:${pad((i % 4) * 15)}`);
const PANEL_WIDTH = 432;
const GAP = 6;
const EDGE = 12;

function split(value) {
  const [date = "", time = ""] = (value || "").split("T");
  return { date, time: time.slice(0, 5) };
}

function fromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function timeLabel(time) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
}

/** Always six weeks, so the panel never changes height between months. */
function monthGrid(year, month) {
  const offset = new Date(year, month, 1).getDay();
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i));
}

const addDays = (key, n) => {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};

export function DateTimePicker({ value, onChange, className, placeholder = "Pick a date and time", ...props }) {
  const { date, time } = split(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => (date ? fromKey(date) : new Date()));
  const [cursor, setCursor] = useState(date || dayKey(new Date()));
  const [pos, setPos] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const gridRef = useRef(null);
  const timesRef = useRef(null);
  const today = dayKey(new Date());

  const days = useMemo(() => monthGrid(view.getFullYear(), view.getMonth()), [view]);
  // An existing meeting at 10:07 keeps its time in the list.
  const slots = useMemo(() => (time && !SLOTS.includes(time) ? [...SLOTS, time].sort() : SLOTS), [time]);

  const close = useCallback((refocus) => {
    setOpen(false);
    setPos(null);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const show = () => {
    const start = date || today;
    setView(fromKey(start));
    setCursor(start);
    setOpen(true);
  };

  // Place the panel under the field, or above it when there isn't room, and keep it there while
  // the page or dialog scrolls.
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const r = trigger.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - EDGE * 2);
    const height = panel.offsetHeight;
    const below = window.innerHeight - r.bottom - GAP - EDGE >= height;
    const top = below || r.top < height + GAP + EDGE ? Math.min(r.bottom + GAP, window.innerHeight - height - EDGE) : r.top - GAP - height;
    const left = Math.max(EDGE, Math.min(r.left, window.innerWidth - width - EDGE));
    setPos({ top: Math.max(EDGE, top), left, width });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    // Start the time list on the chosen time without scrolling the dialog around it.
    const list = timesRef.current;
    const chosen = list?.querySelector("[aria-selected='true']");
    if (list && chosen) list.scrollTop = chosen.offsetTop - list.clientHeight / 2 + chosen.offsetHeight / 2;
    gridRef.current?.querySelector("[tabindex='0']")?.focus({ preventScroll: true });
    // Runs once per opening; later moves are handled by the scroll and resize listeners.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const onMove = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    const onPointer = (e) => rootRef.current && !rootRef.current.contains(e.target) && close(false);
    // Capture phase, so Escape closes the calendar before the dialog around it hears it.
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close(true);
    };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, place, close]);

  const pickDay = (key) => {
    setCursor(key);
    onChange(`${key}T${time || "10:00"}`);
  };
  const pickTime = (t) => {
    onChange(`${date || cursor}T${t}`);
    close(true);
  };
  const shiftMonth = (n) => setView((v) => new Date(v.getFullYear(), v.getMonth() + n, 1));

  // Arrow keys move through the days, Page Up/Down through months, Enter or Space picks.
  const onGridKey = (e) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next;
    if (e.key in moves) next = addDays(cursor, moves[e.key]);
    else if (e.key === "PageUp" || e.key === "PageDown") {
      const d = fromKey(cursor);
      next = dayKey(new Date(d.getFullYear(), d.getMonth() + (e.key === "PageUp" ? -1 : 1), Math.min(d.getDate(), 28)));
    } else if (e.key === "Home" || e.key === "End") next = addDays(cursor, e.key === "Home" ? -fromKey(cursor).getDay() : 6 - fromKey(cursor).getDay());
    else return;
    e.preventDefault();
    setCursor(next);
    const d = fromKey(next);
    if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()) setView(new Date(d.getFullYear(), d.getMonth(), 1));
    requestAnimationFrame(() => gridRef.current?.querySelector(`[data-day='${next}']`)?.focus({ preventScroll: true }));
  };

  const label = date
    ? `${fromKey(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: date.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric" })}${time ? ` · ${timeLabel(time)}` : ""}`
    : "";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close(false) : show())}
        className={cx(
          "flex h-[46px] w-full items-center justify-between gap-2 rounded-[14px] border bg-input px-4 text-left text-sm outline-none transition-[border-color,background-color,box-shadow] duration-150 focus-visible:border-line focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-ring",
          props["aria-invalid"] ? "border-danger" : open ? "border-line bg-card" : "border-transparent",
          label ? "text-fg" : "text-faint",
          className
        )}
        {...props}
      >
        <span className="truncate tabular-nums">{label || placeholder}</span>
        <CalendarDays className="size-4 shrink-0 text-muted" aria-hidden />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Choose date and time"
          className="animate-pop-in fixed z-[60] flex overflow-hidden rounded-[18px] border border-line bg-card shadow-[0_18px_50px_-12px_rgba(0,0,0,0.45)]"
          style={pos ? { top: pos.top, left: pos.left, width: pos.width } : { visibility: "hidden", top: 0, left: 0, width: PANEL_WIDTH }}
        >
          <div className="min-w-0 flex-1 p-3">
            <div className="mb-2 flex items-center justify-between pl-2">
              <span className="text-sm font-medium text-strong" aria-live="polite">
                {view.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
              <div className="flex">
                <NavButton label="Previous month" onClick={() => shiftMonth(-1)} icon={ChevronLeft} />
                <NavButton label="Next month" onClick={() => shiftMonth(1)} icon={ChevronRight} />
              </div>
            </div>
            <div className="grid grid-cols-7 text-center text-[11px] font-medium text-faint" aria-hidden>
              {WEEKDAYS.map((w) => (
                <span key={w} className="py-1.5">
                  {w}
                </span>
              ))}
            </div>
            <div ref={gridRef} role="grid" aria-label="Days" onKeyDown={onGridKey} className="grid grid-cols-7 gap-0.5">
              {days.map((d) => {
                const key = dayKey(d);
                const selected = key === date;
                const outside = d.getMonth() !== view.getMonth();
                return (
                  <button
                    key={key}
                    type="button"
                    role="gridcell"
                    data-day={key}
                    tabIndex={key === cursor ? 0 : -1}
                    aria-selected={selected}
                    aria-current={key === today ? "date" : undefined}
                    aria-label={d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                    onClick={() => pickDay(key)}
                    className={cx(
                      "flex aspect-square items-center justify-center rounded-[10px] text-[13px] tabular-nums outline-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-accent",
                      selected ? "bg-accent font-semibold text-accent-on" : cx("hover:bg-hover", outside ? "text-faint" : "text-fg", key === today && "font-semibold text-accent")
                    )}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between px-1">
              <button type="button" onClick={() => pickDay(today)} className="rounded-lg px-2 py-1 text-xs font-medium text-accent hover:bg-hover">
                Today
              </button>
              <button type="button" onClick={() => pickDay(addDays(today, 1))} className="rounded-lg px-2 py-1 text-xs font-medium text-secondary hover:bg-hover hover:text-fg">
                Tomorrow
              </button>
            </div>
          </div>

          {/* As tall as the calendar beside it; the times scroll inside. */}
          <div className="relative w-[108px] shrink-0 border-l border-row">
          <div ref={timesRef} role="listbox" aria-label="Time" className="absolute inset-0 overflow-y-auto overscroll-contain p-1.5 [scrollbar-width:thin]">
            {slots.map((t) => (
              <button
                key={t}
                type="button"
                role="option"
                aria-selected={t === time}
                onClick={() => pickTime(t)}
                className={cx(
                  "block w-full rounded-[10px] px-2.5 py-[7px] text-left text-[13px] whitespace-nowrap tabular-nums outline-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-accent",
                  t === time ? "bg-accent font-semibold text-accent-on" : "text-fg hover:bg-hover"
                )}
              >
                {timeLabel(t)}
              </button>
            ))}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavButton({ label, onClick, icon: Icon }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="inline-flex size-8 items-center justify-center rounded-full text-secondary transition-colors hover:bg-hover hover:text-fg">
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
