"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button, IconButton, cx } from "./primitives";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal surface. Escape and backdrop clicks close it; focus is trapped and restored on close.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = "md" }) {
  const panelRef = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const panel = panelRef.current;
    const first = panel?.querySelector("[data-autofocus]") ?? panel?.querySelector(FOCUSABLE);
    first?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "Tab" && panel) {
        const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const [head, tail] = [items[0], items[items.length - 1]];
        if (e.shiftKey && document.activeElement === head) {
          e.preventDefault();
          tail.focus();
        } else if (!e.shiftKey && document.activeElement === tail) {
          e.preventDefault();
          head.focus();
        }
      }
    };
    panel?.addEventListener("keydown", onKey);
    return () => {
      panel?.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const widths = { sm: "sm:max-w-md", md: "sm:max-w-lg" };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="animate-fade-in absolute inset-0 bg-[var(--overlay)] backdrop-blur-sm" onMouseDown={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx("animate-pop-in relative flex max-h-[92dvh] w-full flex-col rounded-t-[22px] border border-card-line bg-card shadow-pop sm:rounded-[22px]", widths[size])}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 sm:px-7">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[22px] leading-tight font-medium tracking-[-0.01em] text-strong">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          <IconButton icon={X} label="Close" outline onClick={onClose} className="-mt-0.5 shrink-0" />
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-2 sm:px-7">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2.5 px-6 pt-5 pb-6 sm:px-7">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/** Small confirmation dialog. `tone="danger"` for destructive actions. */
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = "Confirm", tone = "primary", busy }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={busy} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-secondary">{description}</p>
    </Dialog>
  );
}
