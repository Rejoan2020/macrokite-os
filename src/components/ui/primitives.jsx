"use client";

import Link from "next/link";
import { Fragment, forwardRef } from "react";
import { Check, ChevronDown, Loader2, Plus, Search, X } from "lucide-react";
import { initials } from "@/lib/format";
import { phaseIndexIn, projectPhases } from "@/lib/phases";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";

export const cx = (...classes) => classes.filter(Boolean).join(" ");

const BUTTON_VARIANTS = {
  primary: "bg-primary text-primary-on hover:bg-primary-hover",
  accent: "bg-accent text-accent-on hover:brightness-110",
  secondary: "border border-line bg-card text-fg hover:bg-hover",
  outline: "border border-line text-fg hover:bg-hover",
  quiet: "border border-line text-secondary hover:bg-hover hover:text-fg",
  danger: "border border-danger-line text-danger hover:bg-danger-outline/60",
  ghost: "text-muted hover:bg-hover hover:text-fg",
};
const BUTTON_SIZES = {
  md: "h-11 px-5 text-sm gap-2",
  sm: "h-9 px-4 text-[13px] gap-1.5",
  xs: "h-8 px-3 text-xs gap-1.5",
};

export const Button = forwardRef(function Button(
  { variant = "secondary", size = "md", icon: Icon, loading, className, children, href, type = "button", ...props },
  ref
) {
  const classes = cx(
    "inline-flex shrink-0 items-center justify-center rounded-full font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 select-none",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className
  );
  const content = (
    <>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
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

/** Round icon-only button. `outline` gives it a border, as in card headers. */
export const IconButton = forwardRef(function IconButton({ icon: Icon, label, className, outline, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-hover hover:text-fg disabled:opacity-40",
        outline && "border border-line",
        className
      )}
      {...props}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
});

const PILL_TONES = {
  accent: "bg-accent-tint text-accent-tint-text",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-outline text-danger",
  success: "bg-success-tint text-success-text",
  info: "bg-info-tint text-info-text",
  neutral: "bg-selected text-secondary",
  outline: "border border-line text-fg hover:bg-hover",
};

export function Pill({ tone = "accent", className, children }) {
  return <span className={cx("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", PILL_TONES[tone], className)}>{children}</span>;
}

export const OnHoldPill = () => <Pill tone="warning">On hold</Pill>;

export const PRIORITY_TONES = { urgent: "danger", high: "warning", medium: "info", low: "neutral" };
const PRIORITY_DOTS = { urgent: "bg-danger", high: "bg-warning-strong", medium: "bg-info", low: "bg-muted" };

/** "● High" on a tinted pill. */
export function PriorityPill({ priority, className }) {
  return (
    <Pill tone={PRIORITY_TONES[priority]} className={className}>
      <span aria-hidden className={cx("size-1.5 rounded-full", PRIORITY_DOTS[priority])} />
      {TASK_PRIORITY_LABELS[priority]}
    </Pill>
  );
}

export const STATUS_TONES = { todo: "neutral", doing: "warning", done: "success" };

/** Status at a glance: a dashed ring (to do), a half-filled ring (in progress) or a green tick (done). */
export function StatusIcon({ status, className }) {
  const label = TASK_STATUS_LABELS[status];
  if (status === "done") {
    return (
      <span role="img" aria-label={label} className={cx("inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-success text-[var(--bg-card)]", className)}>
        <Check className="size-3" strokeWidth={3.5} aria-hidden />
      </span>
    );
  }
  if (status === "doing") {
    return (
      <svg role="img" aria-label={label} viewBox="0 0 18 18" className={cx("size-[18px] shrink-0 text-warning-strong", className)}>
        <circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9 4.5a4.5 4.5 0 0 1 0 9z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg role="img" aria-label={label} viewBox="0 0 18 18" className={cx("size-[18px] shrink-0 text-muted", className)}>
      <circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.4 2.2" />
    </svg>
  );
}

/**
 * A native select drawn as a pill with a chevron: status ("In progress ▾"), priority, filters.
 * `tone` tints it like the matching Pill.
 */
export function PillSelect({ value, onChange, options, label, tone = "neutral", disabled, className, children }) {
  return (
    <span className={cx("relative inline-flex shrink-0 items-center rounded-full", PILL_TONES[tone], disabled && "opacity-70", className)}>
      {children}
      <select
        aria-label={label}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={cx("h-8 cursor-pointer appearance-none rounded-full bg-transparent pr-8 text-[13px] font-medium outline-none disabled:cursor-default", children ? "pl-0" : "pl-3.5")}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-card text-fg">
            {o.label}
          </option>
        ))}
      </select>
      {!disabled && <ChevronDown aria-hidden className="pointer-events-none absolute right-3 size-3.5 opacity-70" />}
    </span>
  );
}

/** Orange unread badge. */
export function CountBadge({ count, label, className }) {
  if (!count) return null;
  return (
    <span aria-label={label} className={cx("inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-accent px-[5px] text-[11px] font-semibold text-accent-on tabular-nums", className)}>
      {count}
    </span>
  );
}

const AVATAR_SIZES = { xs: "size-6 text-[9px]", sm: "size-7 text-[10px]", md: "size-9 text-xs", lg: "size-[60px] text-lg" };

export function Avatar({ user, size = "md", className, ring }) {
  const name = user?.name ?? "Unknown";
  return (
    <span
      title={name}
      className={cx(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold",
        `avatar-${user?.avatarColor ?? "amber"}`,
        AVATAR_SIZES[size],
        ring && "border-2 border-card",
        user && !user.active && "opacity-50",
        className
      )}
    >
      {initials(name)}
      {user?.avatarUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" className="absolute inset-0 size-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
      )}
    </span>
  );
}

export function AvatarStack({ users, max = 4, size = "sm" }) {
  const shown = users.slice(0, max);
  return (
    <span className="flex items-center" aria-label={users.map((u) => u.name).join(", ")}>
      {shown.map((u, i) => (
        <Avatar key={u._id} user={u} size={size} ring className={i ? "-ml-2" : ""} />
      ))}
      {users.length > max && <span className="pl-1.5 text-xs text-muted">+{users.length - max}</span>}
    </span>
  );
}

/** A person as a chip: avatar and name. A remove button, when given, shows on hover in the space kept for it. */
export function PersonChip({ user, label, onRemove, removeLabel }) {
  return (
    <span className={cx("group inline-flex h-10 items-center gap-2 rounded-full bg-raised py-1 pl-1.5 text-[14px] font-medium text-strong", onRemove ? "pr-1.5" : "pr-4")}>
      <Avatar user={user} size="sm" />
      {label ?? user?.name}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={removeLabel} className="reveal ml-2 flex size-7 items-center justify-center rounded-full text-muted transition-opacity hover:bg-hover hover:text-fg">
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </span>
  );
}

/** Dashed "+ Add …" chip. */
export const AddChip = forwardRef(function AddChip({ children, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cx("inline-flex h-10 items-center gap-1.5 rounded-full border border-dashed border-dash px-4 text-[13px] font-medium text-secondary hover:border-secondary hover:text-fg", className)}
      {...props}
    >
      <Plus className="size-3.5" aria-hidden />
      {children}
    </button>
  );
});

/** The initial of a client in a rounded square, like an app icon. */
export function LogoTile({ name, size = "md", className }) {
  const sizes = { sm: "size-9 rounded-[10px] text-sm", md: "size-11 rounded-xl text-base", lg: "size-12 rounded-[14px] text-lg" };
  return (
    <span aria-hidden className={cx("flex shrink-0 items-center justify-center bg-primary font-semibold text-primary-on", sizes[size], className)}>
      {(name ?? "?").trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export function Card({ as: Tag = "div", className, children, ...props }) {
  return (
    <Tag className={cx("rounded-[22px] border border-card-line bg-card", className)} {...props}>
      {children}
    </Tag>
  );
}

/** A card with a title row and an optional action on the right. */
export function Panel({ title, action, className, children, id, bodyClassName }) {
  return (
    <section aria-labelledby={id} className={cx("flex flex-col rounded-[22px] border border-card-line bg-card", className)}>
      <div className="flex min-h-[72px] items-center justify-between gap-3 px-6 pt-5 pb-3">
        <h2 id={id} className="text-xl font-medium tracking-[-0.01em] text-strong">
          {title}
        </h2>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
      <div className={cx("flex flex-1 flex-col px-6 pb-6", bodyClassName)}>{children}</div>
    </section>
  );
}

export function TextLink({ href, className, children, ...props }) {
  return (
    <Link href={href} className={cx("text-[13px] text-accent hover:text-accent-light", className)} {...props}>
      {children}
    </Link>
  );
}

/** Page column. Pages use the full width up to a comfortable maximum; forms stay narrower. */
export function Page({ width = "lg", className, children }) {
  const widths = { sm: "max-w-[960px]", md: "max-w-[1280px]", lg: "max-w-none" };
  return (
    <div className="px-4 pt-6 pb-10 sm:px-8 lg:pt-7">
      <div className={cx("flex flex-col gap-6", widths[width], className)}>{children}</div>
    </div>
  );
}

export function PageHeader({ title, summary, actions, eyebrow, leading }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3.5">
        {leading}
        <div className="flex min-w-0 flex-col gap-1">
          {eyebrow && <div className="text-[13px] text-muted">{eyebrow}</div>}
          <h1 className="text-[32px] leading-tight font-medium tracking-[-0.025em] text-strong sm:text-[38px]">{title}</h1>
          {summary && <p className="text-muted">{summary}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** "Clients / Google / Search engine": links for every part but the last. */
export function Breadcrumbs({ items, className }) {
  return (
    <nav aria-label="Breadcrumb" className={cx("flex flex-wrap items-center gap-1.5 text-[13px] text-muted", className)}>
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden className="text-faint">/</span>}
          {item.href && i < items.length - 1 ? (
            <Link href={item.href} className="hover:text-fg">
              {item.label}
            </Link>
          ) : (
            <span className={i === items.length - 1 ? "text-soft" : undefined} aria-current={i === items.length - 1 ? "page" : undefined}>
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

/** Joins summary parts with " · ", dropping empty ones. */
export function Summary({ parts }) {
  const shown = parts.filter(Boolean);
  return shown.map((part, i) => (
    <span key={i}>
      {i > 0 && " · "}
      {part}
    </span>
  ));
}

export function SectionLabel({ as: Tag = "h2", className, children, ...props }) {
  return (
    <Tag className={cx("text-[13px] font-medium text-muted", className)} {...props}>
      {children}
    </Tag>
  );
}

/** A project's lifecycle bar, one segment per phase. Done segments filled, current in the light accent, later empty; greys when on hold. */
export function PhaseBar({ project, height = 6, className }) {
  const phases = projectPhases(project);
  const current = phaseIndexIn(project, project.phase);
  const onHold = project.onHold;
  return (
    <span aria-hidden className={cx("grid gap-[3px]", className)} style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))` }}>
      {phases.map((p, i) => (
        <span
          key={p._id}
          className="block"
          style={{
            height,
            borderRadius: height / 2,
            background:
              i < current
                ? onHold ? "var(--phase-done-hold)" : "var(--phase-done)"
                : i === current
                  ? onHold ? "var(--phase-current-hold)" : "var(--phase-current)"
                  : "var(--phase-todo)",
          }}
        />
      ))}
    </span>
  );
}

/** Segmented control / tab group: a pill track with the selected item raised. */
export function TabGroup({ label, items, value, onChange, role = "tablist", className }) {
  return (
    <div role={role} aria-label={label} className={cx("flex max-w-full flex-wrap gap-1 self-start rounded-full bg-input p-1", className)}>
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role={role === "tablist" ? "tab" : undefined}
            aria-selected={role === "tablist" ? selected : undefined}
            aria-pressed={role === "tablist" ? undefined : selected}
            onClick={() => onChange(item.value)}
            className={cx(
              "flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-colors",
              selected ? "bg-selected text-strong shadow-sm" : "text-secondary hover:text-fg"
            )}
          >
            {item.label}
            {item.badge ? <CountBadge count={item.badge} label={`${item.badge} unread`} /> : item.count !== undefined && <span className="text-faint tabular-nums">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Rounded search box. Sits on the page by default; pass bg-input inside a card. */
export function SearchField({ value, onChange, placeholder, className }) {
  return (
    <label className={cx("flex h-11 items-center gap-2.5 rounded-full border border-card-line bg-card px-4 text-muted focus-within:border-accent/60", className)}>
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="sr-only">{placeholder}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
      />
    </label>
  );
}

export function Checkbox({ className, ...props }) {
  return <input type="checkbox" className={cx("size-[18px] shrink-0 cursor-pointer", className)} {...props} />;
}

/** On/off switch (role="switch"). */
export function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx("relative inline-flex h-[26px] w-[44px] shrink-0 items-center rounded-full transition-colors disabled:opacity-50", checked ? "bg-success" : "bg-selected")}
    >
      <span aria-hidden className={cx("absolute size-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[21px]" : "translate-x-[3px]")} />
    </button>
  );
}

export function Spinner({ className, label = "Loading" }) {
  return <Loader2 className={cx("size-4 animate-spin text-muted", className)} aria-label={label} role="status" />;
}

/** A quiet line of text for the rare case where a whole page has nothing to show. */
export function EmptyNote({ children, action }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[18px] border border-dashed border-dash px-5 py-5 text-muted">
      <p>{children}</p>
      {action}
    </div>
  );
}

/** Day divider used in chats. */
export function DayDivider({ children }) {
  return (
    <div className="flex items-center gap-3 text-xs text-faint" role="separator">
      <span className="h-px flex-1 bg-divider" />
      {children}
      <span className="h-px flex-1 bg-divider" />
    </div>
  );
}
