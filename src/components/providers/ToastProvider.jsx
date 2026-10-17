"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

/**
 * Toasts, top right in the primary colour: a bold title, a line of text and an optional action
 * (a reminder's Join). They fade out after 3.5s (12s with an action); clicking one dismisses it.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const dismiss = useCallback(
    (id) => {
      setToasts((list) => list.map((t) => (t.id === id ? { ...t, out: true } : t)));
      setTimeout(() => remove(id), 300);
    },
    [remove]
  );

  const push = useCallback(
    (type, title, description, action) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((list) => [...list.slice(-3), { id, type, title, description, action }]);
      setTimeout(() => dismiss(id), action ? 12000 : type === "error" ? 6000 : 3500);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (title, description, action) => push("success", title, description, action),
      error: (title, description, action) => push("error", title, description, action),
      info: (title, description, action) => push("info", title, description, action),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed top-[18px] right-[18px] left-[18px] z-[60] flex flex-col items-end gap-2.5 sm:left-auto">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === "error" ? "alert" : "status"}
            onClick={() => dismiss(t.id)}
            className={`animate-pop-in pointer-events-auto flex w-full max-w-[340px] min-w-[260px] cursor-default flex-col gap-1 rounded-2xl bg-primary px-4 py-3.5 text-[13px] text-primary-on transition-[opacity,transform] duration-300 ${t.out ? "-translate-y-1.5 opacity-0" : ""}`}
          >
            {t.title && <b className="text-sm font-semibold">{t.title}</b>}
            {t.description && <span>{t.description}</span>}
            {t.action && (
              <a
                href={t.action.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="mt-2 inline-flex h-[34px] items-center self-start rounded-full bg-accent px-3.5 text-[13px] font-medium text-white hover:brightness-[1.08]"
              >
                {t.action.label}
              </a>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
