"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cx } from "./primitives";

/**
 * A "⋯" button with a short list of actions. Items: [{ label, onClick, tone? }] where
 * tone="danger" colors the item. Closes on pick, outside click or Escape.
 */
export function ActionMenu({ label = "More actions", items }) {
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
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={cx("flex size-11 items-center justify-center rounded-lg border border-line bg-card text-secondary hover:border-dash hover:text-fg", open && "border-dash text-fg")}
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label={label} className="absolute top-full right-0 z-30 mt-1.5 w-52 rounded-xl border border-line bg-card py-1.5 shadow-lg">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={cx("mx-1.5 flex w-[calc(100%-12px)] items-center rounded-lg px-2.5 py-2 text-left text-[13px] outline-none hover:bg-hover focus-visible:bg-hover", item.tone === "danger" ? "text-danger" : "text-fg")}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
