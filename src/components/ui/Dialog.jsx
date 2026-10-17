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

  // Every window is 520px wide, as in the prototype.
  const widths = { sm: "sm:max-w-[520px]", md: "sm:max-w-[520px]" };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="animate-fade-in absolute inset-0 bg-[var(--overlay)] backdrop-blur-[6px]" onMouseDown={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx("animate-pop-in relative flex max-h-[calc(100dvh-40px)] w-full flex-col rounded-t-[28px] border border-card-line bg-card sm:rounded-[28px]", widths[size])}
      >
        <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-1.5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[22px] leading-tight font-normal tracking-[-0.03em] text-strong">
              {title}
            </h2>
            {description && <p className="mt-1.5 text-[13px] text-secondary">{description}</p>}
          </div>
          <IconButton icon={X} label="Close" outline onClick={onClose} className="shrink-0" />
        </div>
        <div className="flex-1 overflow-y-auto px-6 pt-[18px] pb-2">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2.5 px-6 pt-[18px] pb-6">{footer}</div>}
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
          <Button size="lg" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone === "danger" ? "danger-solid" : "primary"} size="lg" onClick={onConfirm} loading={busy} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[13px] leading-5 text-secondary">{description}</p>
    </Dialog>
  );
}
