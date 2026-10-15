"use client";

import { cx } from "./primitives";

/**
 * A count with a label that doubles as a filter toggle (aria-pressed). `tone="danger"` turns it red
 * while the count is above zero.
 */
export function StatTile({ label, count, active, tone, onClick }) {
  const alert = tone === "danger" && count > 0;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "flex min-w-0 flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-colors",
        active ? "border-accent bg-accent-tint" : alert ? "border-danger-outline bg-card hover:border-danger-line" : "border-line bg-card hover:border-dash hover:bg-hover/40"
      )}
    >
      <span className={cx("text-2xl leading-none font-semibold tabular-nums", alert ? "text-danger" : active ? "text-accent-light" : "text-strong")}>{count}</span>
      <span className={cx("text-[12px]", active ? "text-accent-light" : "text-muted")}>{label}</span>
    </button>
  );
}
