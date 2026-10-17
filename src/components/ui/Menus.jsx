"use client";

import { useEffect, useRef, useState } from "react";
import { Chevron, cx, PriorityPill } from "./primitives";
import { TASK_PRIORITIES } from "@/lib/constants";

/** Closes a popup on an outside click or Escape. */
export function useDismiss(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => ref.current && !ref.current.contains(e.target) && onClose();
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  return ref;
}

/** The floating list under a dropdown button. */
export const menuPanel = "animate-pop-in absolute z-30 flex flex-col gap-0.5 rounded-[14px] border border-line bg-card p-1.5";

/**
 * A button that opens a short list of choices; the chosen one shows a ✓ after its label.
 * `trigger({ open, label })` renders the button's contents and `buttonClassName` its look.
 */
export function OptionMenu({ value, options, onChange, label, buttonClassName, trigger, minWidth = 170, title }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" aria-label={label} title={title ?? label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={buttonClassName}>
        {trigger({ open, current })}
      </button>
      {open && (
        <div role="menu" aria-label={label} className={cx(menuPanel, "top-[calc(100%+6px)] right-0")} style={{ minWidth }}>
          {options.map((o) => (
            <button
              key={String(o.value)}
              type="button"
              role="menuitemradio"
              aria-checked={o.value === value}
              onClick={() => {
                setOpen(false);
                if (o.value !== value) onChange(o.value);
              }}
              className="rounded-[10px] px-3 py-[9px] text-left text-[13px] font-medium whitespace-nowrap text-fg outline-none hover:bg-input focus-visible:bg-input aria-checked:bg-input"
            >
              {o.label}
              {o.value === value && <span className="text-accent"> ✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Priority as its pill with a chevron, opening a list of the four pills. `field` draws it as a
 * form field (full width, grey, opening upward so it stays inside a dialog).
 */
export function PrioritySelect({ value, onChange, disabled, field, label = "Priority" }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  if (disabled) return <PriorityPill priority={value} />;
  return (
    <div ref={ref} className={cx("relative", field ? "block" : "inline-block")}>
      <button
        type="button"
        aria-label={`${label}: ${value}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          "inline-flex items-center gap-2 transition-colors",
          field ? "h-[46px] w-full justify-between rounded-[14px] bg-input pr-3.5 pl-3" : "h-[34px] rounded-[10px] pr-2.5 pl-1 hover:bg-input"
        )}
      >
        <PriorityPill priority={value} />
        <Chevron className="text-faint" />
      </button>
      {open && (
        <div role="listbox" aria-label={label} className={cx(menuPanel, "left-0 min-w-[170px]", field ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]")}>
          {TASK_PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              role="option"
              aria-selected={p === value}
              onClick={() => {
                setOpen(false);
                if (p !== value) onChange(p);
              }}
              className="flex items-center rounded-[10px] px-1.5 py-[5px] text-left outline-none hover:bg-input focus-visible:bg-input aria-selected:bg-input"
            >
              <PriorityPill priority={p} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
