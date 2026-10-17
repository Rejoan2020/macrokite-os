"use client";

import { Chevron } from "./primitives";

/**
 * A filter pill: "Project  All projects ▾". The choice is a native select laid invisibly over the
 * pill, so it opens the system list. The first option clears the filter.
 */
export function FilterMenu({ label, value, onChange, options, allLabel }) {
  const items = [{ value: "", label: allLabel }, ...options];
  const selected = items.find((o) => o.value === value) ?? items[0];
  return (
    <label className="relative flex h-[46px] shrink-0 items-center gap-2 rounded-full bg-card px-[18px] text-[13px] whitespace-nowrap text-faint">
      {label}
      <b className="font-medium text-fg">{selected.label}</b>
      <Chevron size={14} strokeWidth={2} />
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
        {items.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
