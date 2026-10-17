"use client";

import { useRef, useState } from "react";
import { Search } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { AddChip, Avatar, cx, PersonChip } from "./primitives";
import { firstName } from "@/lib/format";

/**
 * The people picker used for members, team, assignees and attendees. Who's picked shows as
 * removable chips, plus an "Add …" button that opens a searchable list right below; picking in the
 * list toggles a person. `people` is who can be picked (in order); `onChange(nextIds, id, on)`
 * runs on every add or remove.
 */
export function PeoplePicker({ people, value, onChange, label = "Add member", disabled, id }) {
  const { lookup, currentUserId } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const picked = value.map((uid) => lookup.users[uid]).filter(Boolean);
  const q = query.trim().toLowerCase();
  const rows = people.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q));
  const you = (u) => (u._id === currentUserId ? " (you)" : "");

  const toggle = (uid) => {
    const on = !value.includes(uid);
    onChange(on ? [...value, uid] : value.filter((x) => x !== uid), uid, on);
  };
  const setOpenState = (next) => {
    setOpen(next);
    if (next) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  return (
    <div id={id}>
      <div className="flex flex-wrap items-center gap-2">
        {picked.map((u) => (
          <PersonChip key={u._id} user={u} label={`${firstName(u.name)}${you(u)}`} onRemove={disabled ? undefined : () => toggle(u._id)} removeLabel={`Remove ${u.name}`} />
        ))}
        {!picked.length && <span className="mr-1 text-[13px] text-faint">No one added yet</span>}
        {!disabled && (
          <AddChip aria-expanded={open} onClick={() => setOpenState(!open)}>
            {label}
          </AddChip>
        )}
      </div>

      {open && (
        <div className="animate-pop-in mt-2.5 rounded-2xl border border-line bg-card p-2">
          <div className="flex items-center gap-2">
            <label className="flex h-[42px] min-w-0 flex-1 items-center gap-2.5 rounded-[10px] bg-input px-3 text-faint">
              <Search className="size-4 shrink-0" strokeWidth={2} aria-hidden />
              <span className="sr-only">Search people</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Enter adds the top match instead of submitting the form; Escape closes the list only.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (rows[0]) toggle(rows[0]._id);
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen(false);
                  }
                }}
                placeholder="Search people"
                autoComplete="off"
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-faint"
              />
            </label>
            <button type="button" onClick={() => setOpen(false)} className="h-[42px] shrink-0 rounded-[10px] bg-accent px-[18px] text-[13px] font-medium text-white hover:brightness-[1.08]">
              Done
            </button>
          </div>
          <div className="mt-1.5 flex max-h-[220px] flex-col gap-0.5 overflow-auto">
            {rows.length ? (
              rows.map((u) => {
                const on = value.includes(u._id);
                return (
                  <button
                    key={u._id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      toggle(u._id);
                      inputRef.current?.focus();
                    }}
                    className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left hover:bg-input"
                  >
                    <Avatar user={u} />
                    <span className="flex min-w-0 flex-1 flex-col gap-px leading-[1.3]">
                      <span className="text-sm font-medium text-fg">
                        {u.name}
                        {you(u)}
                      </span>
                      <span className="truncate text-xs text-faint">{u.email}</span>
                    </span>
                    <span className={cx("grid size-[22px] shrink-0 place-items-center rounded-full border-[1.5px]", on ? "border-primary bg-primary text-primary-on" : "border-line text-transparent")}>
                      <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="px-2.5 py-3.5 text-[13px] text-faint">No one matches “{query}”</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Everyone else first, then you, as the prototype lists people. */
export function peopleOrder(users, currentUserId) {
  return [...users.filter((u) => u._id !== currentUserId), ...users.filter((u) => u._id === currentUserId)];
}
