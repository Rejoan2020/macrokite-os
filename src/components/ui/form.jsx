"use client";

import { useId } from "react";
import { Chevron, cx } from "./primitives";

const control =
  "w-full rounded-[14px] border bg-input px-4 text-sm text-fg outline-none placeholder:text-faint transition-[border-color,background-color,box-shadow] duration-150 focus:border-line focus:bg-card focus:ring-4 focus:ring-ring disabled:opacity-60 [&[readonly]]:text-faint";

/** A labelled field: 12px label 8px above, hint or error 7px below. */
export function Field({ label, error, hint, children, className }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cx("flex flex-col", className)}>
      {label && (
        <label htmlFor={id} className="mb-2 block text-xs font-medium text-secondary">
          {label}
        </label>
      )}
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="mt-[7px] text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-[7px] text-xs text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const border = (props) => (props["aria-invalid"] ? "border-danger" : "border-transparent");

export function Input({ className, ...props }) {
  return <input className={cx(control, "h-[46px]", border(props), className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }) {
  return <textarea rows={rows} className={cx(control, "min-h-[92px] resize-y py-[13px] leading-5", border(props), className)} {...props} />;
}

export function Select({ options, className, placeholder, ...props }) {
  return (
    <span className="relative block">
      <select className={cx(control, "h-[46px] cursor-pointer appearance-none pr-9", border(props), className)} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Chevron size={12} strokeWidth={2.5} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[#5f6575]" />
    </span>
  );
}
