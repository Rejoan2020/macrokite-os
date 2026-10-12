"use client";

import { useId, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { cx, Avatar } from "./primitives";

const control =
  "w-full rounded-md border bg-surface-2 px-2.5 text-[13px] text-fg placeholder:text-subtle transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60";

export function Field({ label, error, hint, required, children, className }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-muted">
          {label}
          {required && <span className="text-accent"> *</span>}
        </label>
      )}
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, invalid, ...props }) {
  return <input className={cx(control, "h-9", props["aria-invalid"] || invalid ? "border-danger" : "border-border", className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }) {
  return <textarea rows={rows} className={cx(control, "py-2 leading-relaxed resize-y", props["aria-invalid"] ? "border-danger" : "border-border", className)} {...props} />;
}

export function Select({ options, className, placeholder, ...props }) {
  return (
    <select className={cx(control, "h-9 cursor-pointer pr-8", props["aria-invalid"] ? "border-danger" : "border-border", className)} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Compact select used in toolbars. */
export function FilterSelect({ label, value, onChange, options, allLabel = "All", className }) {
  return (
    <label className={cx("relative flex items-center", className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 cursor-pointer rounded-md border border-border bg-surface px-2.5 pr-7 text-xs text-fg hover:border-border-strong focus:border-accent focus:outline-none"
      >
        <option value="">{`${label}: ${allLabel}`}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {`${label}: ${o.label}`}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search…", className, label = "Search" }) {
  return (
    <div className={cx("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" aria-hidden />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-7 text-xs text-fg placeholder:text-subtle hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-subtle hover:text-fg">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-border bg-surface p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "inline-flex h-7 items-center gap-1.5 rounded-[5px] px-2.5 text-xs transition-colors",
              active ? "bg-surface-3 text-fg shadow-card" : "text-muted hover:text-fg"
            )}
          >
            {Icon && <Icon className="size-3.5" aria-hidden />}
            {o.label}
            {o.count !== undefined && <span className="tabular-nums text-subtle">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function MemberPicker({ members, value, onChange, ...aria }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <div className="flex flex-wrap gap-2" role="group" {...aria}>
      {members.map(({ user }) => {
        const selected = value.includes(user._id);
        return (
          <button
            key={user._id}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(user._id)}
            className={cx(
              "inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs transition-colors",
              selected ? "border-accent/60 bg-accent-soft text-fg" : "border-border bg-surface-2 text-muted hover:text-fg"
            )}
          >
            <Avatar user={user} size="xs" />
            {user.name}
            {selected && <Check className="size-3 text-accent" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

export function LabelsInput({ value, onChange, ...aria }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const label = draft.trim().toLowerCase().replace(/,/g, "");
    if (label && !value.includes(label)) onChange([...value, label]);
    setDraft("");
  };
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1.5 focus-within:border-accent">
      {value.map((label) => (
        <span key={label} className="tone-slate inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]">
          {label}
          <button type="button" aria-label={`Remove label ${label}`} onClick={() => onChange(value.filter((l) => l !== label))} className="hover:text-fg">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        {...aria}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={add}
        placeholder={value.length ? "" : "Type and press Enter"}
        className="min-w-24 flex-1 bg-transparent text-[13px] text-fg placeholder:text-subtle focus:outline-none"
      />
    </div>
  );
}
