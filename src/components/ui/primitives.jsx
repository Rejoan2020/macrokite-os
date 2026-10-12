"use client";

import Link from "next/link";
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { initials } from "@/lib/format";
import { CLIENT_STATUS_META, PRIORITY_META, PROJECT_STATUS_META, TASK_STATUS_META, VISIBILITY_META } from "@/lib/constants";

export const cx = (...classes) => classes.filter(Boolean).join(" ");

const BUTTON_VARIANTS = {
  primary: "bg-accent text-accent-fg hover:bg-accent-strong font-medium shadow-[0_0_0_1px_rgb(0_0_0/0.1)_inset]",
  secondary: "bg-surface-2 text-fg border border-border hover:bg-surface-3 hover:border-border-strong",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-danger-soft text-danger border border-transparent hover:border-danger/40",
};
const BUTTON_SIZES = {
  sm: "h-7 px-2.5 text-xs gap-1.5",
  md: "h-8 px-3 text-[13px] gap-2",
  lg: "h-10 px-4 text-sm gap-2",
};

export const Button = forwardRef(function Button(
  { variant = "secondary", size = "md", icon: Icon, loading, className, children, href, type = "button", ...props },
  ref
) {
  const classes = cx(
    "inline-flex items-center justify-center rounded-md whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none select-none",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className
  );
  const content = (
    <>
      {loading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
      {children}
    </>
  );
  if (href) {
    return (
      <Link ref={ref} href={href} className={classes} {...props}>
        {content}
      </Link>
    );
  }
  return (
    <button ref={ref} type={type} className={classes} disabled={loading || props.disabled} {...props}>
      {content}
    </button>
  );
});

export const IconButton = forwardRef(function IconButton({ icon: Icon, label, className, size = "md", ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex items-center justify-center rounded-md text-muted hover:text-fg hover:bg-surface-2 transition-colors disabled:opacity-40",
        size === "sm" ? "size-7" : "size-8",
        className
      )}
      {...props}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
});

export function Badge({ tone = "slate", dot, className, children }) {
  return (
    <span className={cx(`tone-${tone}`, "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap", className)}>
      {dot && <span className={cx(`dot-${tone}`, "size-1.5 rounded-full")} aria-hidden />}
      {children}
    </span>
  );
}

const STATUS_METAS = { client: CLIENT_STATUS_META, project: PROJECT_STATUS_META, task: TASK_STATUS_META, priority: PRIORITY_META, visibility: VISIBILITY_META };

export function StatusBadge({ kind, value, className }) {
  const meta = STATUS_METAS[kind]?.[value];
  if (!meta) return null;
  return (
    <Badge tone={meta.tone} dot={kind !== "priority"} className={className}>
      {meta.label}
    </Badge>
  );
}

export function PriorityIcon({ priority, className }) {
  const rank = PRIORITY_META[priority]?.rank ?? 0;
  const tone = PRIORITY_META[priority]?.tone ?? "slate";
  if (priority === "urgent") {
    return (
      <span title="Urgent priority" className={cx("tone-red inline-flex size-4 items-center justify-center rounded-[4px] text-[10px] font-bold", className)}>
        !
      </span>
    );
  }
  return (
    <span title={`${PRIORITY_META[priority]?.label} priority`} className={cx("inline-flex h-3.5 items-end gap-[2px]", className)} aria-label={`${PRIORITY_META[priority]?.label} priority`}>
      {[0, 1, 2].map((bar) => (
        <span key={bar} className={cx("w-[3px] rounded-sm", bar <= rank ? `dot-${tone}` : "bg-border-strong")} style={{ height: `${5 + bar * 4}px` }} />
      ))}
    </span>
  );
}

const AVATAR_TONES = { teal: "tone-teal", violet: "tone-violet", blue: "tone-blue", amber: "tone-amber" };

export function Avatar({ user, name, size = "md", className, tone }) {
  const label = user?.name ?? name ?? "Unassigned";
  const sizes = { xs: "size-5 text-[9px]", sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-12 text-base", xl: "size-16 text-xl" };
  return (
    <span
      title={label}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-black/10",
        user || name ? AVATAR_TONES[tone ?? user?.avatarColor] ?? "tone-blue" : "border border-dashed border-border-strong text-subtle",
        sizes[size],
        className
      )}
    >
      {user || name ? initials(label) : "?"}
    </span>
  );
}

export function AvatarStack({ users, size = "sm", max = 4 }) {
  const shown = users.slice(0, max);
  return (
    <span className={cx("flex", size === "xs" ? "-space-x-1" : "-space-x-1.5")}>
      {shown.map((u) => (
        <Avatar key={u._id} user={u} size={size} className="ring-2 ring-surface" />
      ))}
      {users.length > max && <span className="text-xs text-muted pl-2.5">+{users.length - max}</span>}
    </span>
  );
}

export function Card({ as: Tag = "div", className, children, ...props }) {
  return (
    <Tag className={cx("rounded-xl border border-border bg-surface shadow-card", className)} {...props}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, icon: Icon, action, description }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-fg">
          {Icon && <Icon className="size-4 text-subtle" aria-hidden />}
          {title}
        </h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ className, label = "Loading" }) {
  return <Loader2 className={cx("size-4 animate-spin text-muted", className)} aria-label={label} role="status" />;
}

export function ProgressBar({ value, className, label }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cx("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progress"}>
      <div className={cx("h-full rounded-full transition-[width] duration-500", pct === 100 ? "dot-green" : "bg-accent")} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className, compact }) {
  return (
    <div className={cx("flex flex-col items-center justify-center text-center", compact ? "px-4 py-8" : "px-6 py-14", className)}>
      {Icon && (
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl border border-border bg-surface-2 text-muted">
          <Icon className="size-5" aria-hidden />
        </div>
      )}
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions, breadcrumbs, children }) {
  return (
    <header className="mb-6">
      {breadcrumbs && (
        <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-subtle">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.label + i} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden>/</span>}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-fg">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-muted" aria-current="page">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-[22px]">{title}</h1>
          {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function Stat({ label, value, icon: Icon, hint, tone = "teal", href }) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        {Icon && (
          <span className={cx(`tone-${tone}`, "flex size-7 items-center justify-center rounded-lg")}>
            <Icon className="size-3.5" aria-hidden />
          </span>
        )}
      </div>
      <div className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-fg">{value}</div>
      {hint && <div className="mt-1 text-xs text-subtle">{hint}</div>}
    </>
  );
  const classes = "block rounded-xl border border-border bg-surface p-4 shadow-card transition-colors";
  return href ? (
    <Link href={href} className={cx(classes, "hover:border-border-strong")}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}

export function Kbd({ children }) {
  return <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">{children}</kbd>;
}
