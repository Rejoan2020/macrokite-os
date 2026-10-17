"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cx } from "./primitives";

/** Icons for menu items, as drawn in the prototype's menus. */
const ITEM_ICONS = {
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  group: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0" />
      <path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3" />
    </>
  ),
};

/**
 * A "⋯" button (or another icon) with a short list of actions. Items: [{ label, onClick, tone?, icon? }]
 * where tone="danger" colors the item. Closes on pick, outside click or Escape.
 */
export function ActionMenu({ label = "More actions", items, icon: Icon = MoreHorizontal, buttonClassName, menuClassName }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => wrapRef.current && !wrapRef.current.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    wrapRef.current?.querySelector('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!items.length) return null;

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={buttonClassName ?? cx("flex size-[34px] items-center justify-center rounded-full border border-row text-secondary hover:bg-input hover:text-fg", open && "bg-input text-fg")}
      >
        <Icon className="size-4" aria-hidden />
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label={label} className={cx("animate-pop-in absolute top-[calc(100%+8px)] right-0 z-30 flex w-52 flex-col gap-0.5 rounded-2xl border border-line bg-card p-1.5", menuClassName)}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={cx(
                "flex h-10 items-center gap-2.5 rounded-[10px] px-3 text-left text-sm font-medium outline-none hover:bg-input focus-visible:bg-input",
                item.tone === "danger" ? "text-accent-tint-text" : "text-fg"
              )}
            >
              {item.icon && (
                <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={item.tone === "danger" ? undefined : "text-secondary"}>
                  {ITEM_ICONS[item.icon]}
                </svg>
              )}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
