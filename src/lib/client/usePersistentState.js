"use client";

import { useCallback, useState } from "react";

/**
 * useState backed by localStorage, for per-user view preferences (collapsed panels, view mode).
 * Views render only after the workspace loads on the client, so reading storage here is safe.
 */
export function usePersistentState(key, initial) {
  const storageKey = `macrokite-os:${key}`;
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw === null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });
  const update = useCallback(
    (next) =>
      setValue((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(resolved));
        } catch {}
        return resolved;
      }),
    [storageKey]
  );
  return [value, update];
}
