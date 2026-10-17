"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { THEME_KEY, THEMES } from "@/lib/theme";

// Keeps the saved theme applied and lets Settings and the sidebar change it. The root layout's
// inline script applies it before the first paint.

const media = () => window.matchMedia("(prefers-color-scheme: light)");

function readPreference() {
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    return THEMES.includes(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

const resolve = (preference) => (preference === "system" ? (media().matches ? "light" : "dark") : preference);

function apply(preference) {
  document.documentElement.setAttribute("data-theme", resolve(preference));
}

const listeners = new Set();
const notify = () => listeners.forEach((l) => l());

function subscribe(listener) {
  listeners.add(listener);
  const onMedia = () => {
    if (readPreference() === "system") apply("system");
    listener();
  };
  const onStorage = (e) => {
    if (e.key !== THEME_KEY) return;
    apply(readPreference());
    listener();
  };
  media().addEventListener("change", onMedia);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    media().removeEventListener("change", onMedia);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * { preference, resolved, setPreference }: preference is what was picked ("system" included),
 * resolved is the theme on screen ("light" or "dark").
 */
export function useTheme() {
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system");
  const resolved = useSyncExternalStore(subscribe, () => resolve(readPreference()), () => "dark");

  // Re-apply on mount in case the attribute was lost (it lives outside React).
  useEffect(() => apply(preference), [preference]);

  const setPreference = useCallback((next) => {
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Still applied for this page view.
    }
    apply(next);
    notify();
  }, []);

  return { preference, resolved, setPreference };
}
