"use client";

import { useId } from "react";
import { Check } from "lucide-react";
import { cx, Avatar } from "./primitives";
import { firstName } from "@/lib/format";

const control =
  "w-full rounded-lg border bg-input px-3 text-sm text-fg placeholder:text-faint transition-colors focus:border-accent/60 focus:outline-none disabled:opacity-60 read-only:text-muted read-only:border-divider";

export function Field({ label, error, hint, children, className }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="text-[13px] text-secondary">
          {label}
        </label>
      )}
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const border = (props) => (props["aria-invalid"] ? "border-danger" : "border-line");

export function Input({ className, ...props }) {
  return <input className={cx(control, "h-11", border(props), className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }) {
  return <textarea rows={rows} className={cx(control, "resize-y py-2.5 leading-relaxed", border(props), className)} {...props} />;
}

export function Select({ options, className, placeholder, ...props }) {
  return (
    <select className={cx(control, "h-11 cursor-pointer pr-8", border(props), className)} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Toggle chips for picking people. */
export function PeoplePicker({ users, value, onChange, ...aria }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <div className="flex flex-wrap gap-2" role="group" {...aria}>
      {users.map((user) => {
        const selected = value.includes(user._id);
        return (
          <button
            key={user._id}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(user._id)}
            className={cx(
              "inline-flex h-9 items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-[13px] transition-colors",
              selected ? "border-decision-line bg-accent-tint text-accent-tint-text" : "border-line bg-input text-secondary hover:text-fg"
            )}
          >
            <Avatar user={user} size="sm" />
            {firstName(user.name)}
            {selected && <Check className="size-3.5 text-accent" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
