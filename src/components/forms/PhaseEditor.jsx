"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/form";
import { cx } from "@/components/ui/primitives";
import { MAX_PHASES } from "@/lib/phases";

let nextKey = 0;
export const newPhaseRow = (phase = {}) => ({ key: phase._id ?? `new-${++nextKey}`, _id: phase._id, name: phase.name ?? "" });

/**
 * Edits a project's phases in order: rename, add, remove, move up and down. Rows are
 * { key, _id?, name }; new rows have no _id until saved. `lockedReason(row)` says why a row can't be
 * removed (the current phase, or it still has tasks), or returns null.
 */
export function PhaseEditor({ rows, onChange, lockedReason, error, rowErrors = {} }) {
  const update = (i, change) => onChange(rows.map((row, j) => (j === i ? { ...row, ...change } : row)));
  const move = (i, step) => {
    const next = [...rows];
    [next[i], next[i + step]] = [next[i + step], next[i]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-1.5">
        {rows.map((row, i) => {
          const locked = lockedReason(row);
          return (
            <li key={row.key} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-right font-mono text-[12px] text-faint">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <Input
                  value={row.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="Phase name"
                  maxLength={40}
                  aria-label={`Phase ${i + 1} name`}
                  aria-invalid={rowErrors[i] ? true : undefined}
                  className="h-9"
                />
                {rowErrors[i] && <p className="mt-1 text-xs text-danger">{rowErrors[i]}</p>}
              </div>
              <RowButton icon={ArrowUp} label={`Move ${row.name || "phase"} up`} disabled={i === 0} onClick={() => move(i, -1)} />
              <RowButton icon={ArrowDown} label={`Move ${row.name || "phase"} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)} />
              <RowButton
                icon={X}
                label={locked ? `Can’t remove ${row.name}: ${locked}` : `Remove ${row.name || "phase"}`}
                title={locked ?? undefined}
                disabled={Boolean(locked) || rows.length === 1}
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
              />
            </li>
          );
        })}
      </ol>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onChange([...rows, newPhaseRow()])}
          disabled={rows.length >= MAX_PHASES}
          className="flex h-9 items-center gap-1.5 self-start rounded-lg px-2 text-[13px] text-accent hover:text-accent-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="size-4" aria-hidden /> Add phase
        </button>
        <span className="text-xs text-faint">
          {rows.length} of up to {MAX_PHASES}
        </span>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function RowButton({ icon: Icon, label, title, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
      className={cx("flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-30")}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
