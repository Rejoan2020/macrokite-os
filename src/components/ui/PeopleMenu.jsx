"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AddChip, Avatar, cx } from "./primitives";

/**
 * A dashed "+ Add …" chip that opens a list of people to pick from, one at a time. Closes on pick,
 * outside click or Escape; arrow keys move through the list.
 */
export function PeopleMenu({ label, people, onPick, disabled }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const buttonRef = useRef(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => wrapRef.current && !wrapRef.current.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    listRef.current?.focus();
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };
  const pick = (user) => {
    close();
    onPick(user);
  };
  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + people.length) % people.length);
    } else if ((e.key === "Enter" || e.key === " ") && people[active]) {
      e.preventDefault();
      pick(people[active]);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  if (!people.length) return null;

  return (
    <div ref={wrapRef} className="relative">
      <AddChip
        ref={buttonRef}
        disabled={disabled}
        onClick={() => {
          setActive(0);
          setOpen((o) => !o);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
      >
        {label}
      </AddChip>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onKeyDown}
          className="absolute top-full left-0 z-30 mt-1.5 max-h-72 w-64 overflow-y-auto rounded-2xl border border-line bg-card py-1.5 shadow-pop outline-none"
        >
          {people.map((user, i) => (
            <li
              key={user._id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onClick={() => pick(user)}
              onMouseEnter={() => setActive(i)}
              className={cx("mx-1.5 flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px]", i === active ? "bg-hover text-strong" : "text-secondary")}
            >
              <Avatar user={user} size="xs" />
              <span className="min-w-0 flex-1 truncate">{user.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
