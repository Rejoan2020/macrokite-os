"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cx } from "./primitives";

/**
 * A filter dropdown: "Project  All projects ▾" that opens a styled list. The first entry clears the
 * filter. Options: [{ value, label, count?, dot? }] where `dot` is a background class for a
 * colored dot. Arrow keys move, Enter picks, Escape closes.
 */
export function FilterMenu({ label, value, onChange, options, allLabel }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const buttonRef = useRef(null);
  const listId = useId();
  const items = [{ value: "", label: allLabel }, ...options];
  const selected = items.find((o) => o.value === value) ?? items[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => wrapRef.current && !wrapRef.current.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    listRef.current?.focus();
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const toggle = () => {
    setActive(Math.max(0, items.indexOf(selected)));
    setOpen((o) => !o);
  };
  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };
  const pick = (option) => {
    onChange(option.value);
    close();
  };
  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + items.length) % items.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={cx(
          "flex h-11 items-center gap-2 rounded-full border bg-card pr-3.5 pl-4 transition-colors hover:border-dash",
          open ? "border-accent/60" : value ? "border-accent/40" : "border-card-line"
        )}
      >
        <span className="text-muted">{label}</span>
        {selected.dot && <span aria-hidden className={cx("size-2 rounded-full", selected.dot)} />}
        <span className={cx("max-w-48 truncate font-medium", value ? "text-accent-light" : "text-strong")}>{selected.label}</span>
        <ChevronDown aria-hidden className={cx("size-4 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onKeyDown}
          className="absolute top-full right-0 z-30 mt-1.5 max-h-80 w-64 overflow-y-auto rounded-2xl border border-line bg-card py-1.5 shadow-pop outline-none"
        >
          {items.map((option, i) => {
            const isSelected = option.value === selected.value;
            return (
              <li
                key={option.value || "all"}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => pick(option)}
                onMouseEnter={() => setActive(i)}
                className={cx(
                  "mx-1.5 flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px]",
                  i === active && "bg-hover",
                  isSelected ? "text-strong" : "text-secondary",
                  i === 0 && items.length > 1 && "mb-1"
                )}
              >
                <Check aria-hidden className={cx("size-4 shrink-0 text-accent", !isSelected && "invisible")} />
                {option.dot && <span aria-hidden className={cx("size-2 shrink-0 rounded-full", option.dot)} />}
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.count !== undefined && <span className="text-[12px] text-faint tabular-nums">{option.count}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
