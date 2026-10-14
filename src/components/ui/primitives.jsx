"use client";

import Link from "next/link";
import { forwardRef } from "react";
import { Loader2, Search } from "lucide-react";
import { initials } from "@/lib/format";
import { PHASES, phaseIndex } from "@/lib/constants";

export const cx = (...classes) => classes.filter(Boolean).join(" ");

const BUTTON_VARIANTS = {
  primary: "bg-accent text-accent-on hover:bg-accent-light",
  secondary: "border border-line bg-card text-fg hover:bg-hover",
  outline: "border border-line text-fg hover:bg-hover",
  quiet: "border border-line text-secondary hover:bg-hover hover:text-fg",
  danger: "border border-danger-line text-danger hover:bg-danger-outline/40",
  ghost: "text-muted hover:bg-hover hover:text-fg",
};
const BUTTON_SIZES = {
  md: "h-11 px-[18px] text-sm gap-2",
  sm: "h-9 px-3.5 text-[13px] gap-1.5",
  xs: "h-8 px-3 text-xs gap-1.5",
};

export const Button = forwardRef(function Button(
  { variant = "secondary", size = "md", icon: Icon, loading, className, children, href, type = "button", ...props },
  ref
) {
  const classes = cx(
    "inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 select-none",
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

export const IconButton = forwardRef(function IconButton({ icon: Icon, label, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cx("inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-fg disabled:opacity-40", className)}
      {...props}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
});

const PILL_TONES = {
  accent: "bg-accent-tint text-accent-light",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-outline text-danger",
  neutral: "bg-selected text-secondary",
};

export function Pill({ tone = "accent", className, children }) {
  return <span className={cx("inline-flex shrink-0 items-center rounded-[10px] px-2 py-px text-[11px] font-medium whitespace-nowrap", PILL_TONES[tone], className)}>{children}</span>;
}

export const OnHoldPill = () => <Pill tone="warning">On hold</Pill>;
export const DoingPill = () => <Pill>Doing</Pill>;

/** Teal unread badge. */
export function CountBadge({ count, label, className }) {
  if (!count) return null;
  return (
    <span aria-label={label} className={cx("inline-flex h-[18px] min-w-[20px] shrink-0 items-center justify-center rounded-[10px] bg-accent px-[7px] text-[11px] font-semibold text-accent-on tabular-nums", className)}>
      {count}
    </span>
  );
}

const AVATAR_SIZES = { sm: "size-7 text-[10px]", md: "size-9 text-xs", lg: "size-[52px] text-base" };

export function Avatar({ user, size = "md", className, ring }) {
  const name = user?.name ?? "Unknown";
  return (
    <span
      title={name}
      className={cx(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold",
        `avatar-${user?.avatarColor ?? "blue"}`,
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

export function AvatarStack({ users, max = 4 }) {
  const shown = users.slice(0, max);
  return (
    <span className="flex items-center" aria-label={users.map((u) => u.name).join(", ")}>
      {shown.map((u, i) => (
        <Avatar key={u._id} user={u} size="sm" ring className={i ? "-ml-2" : ""} />
      ))}
      {users.length > max && <span className="pl-1.5 text-xs text-muted">+{users.length - max}</span>}
    </span>
  );
}

export function Card({ as: Tag = "div", className, children, ...props }) {
  return (
    <Tag className={cx("rounded-xl border border-line bg-card", className)} {...props}>
      {children}
    </Tag>
  );
}

/** Card with a 14px title row and an optional link on the right. */
export function Panel({ title, action, className, children, id }) {
  return (
    <section aria-labelledby={id} className={cx("flex flex-col rounded-xl border border-line bg-card", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-[18px] py-3.5">
        <h2 id={id} className="text-sm font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
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

/** Centred page column: 48px × 32px padding, max width 760–1040px. */
export function Page({ width = "lg", className, children }) {
  const widths = { sm: "max-w-[720px]", md: "max-w-[880px]", lg: "max-w-[1040px]" };
  return (
    <div className="px-4 pt-8 pb-16 sm:px-8 lg:pt-12">
      <div className={cx("mx-auto flex flex-col gap-6", widths[width], className)}>{children}</div>
    </div>
  );
}

export function PageHeader({ title, summary, actions, eyebrow }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && <p className="font-mono text-xs text-faint">{eyebrow}</p>}
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] text-strong">{title}</h1>
        {summary && <p className="text-muted">{summary}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
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
    <Tag className={cx("label-caps text-secondary", className)} {...props}>
      {children}
    </Tag>
  );
}

/** 7-segment lifecycle bar. Done segments filled, current in the light accent, later empty; greys when on hold. */
export function PhaseBar({ phase, onHold, height = 6, className }) {
  const current = phaseIndex(phase);
  return (
    <span aria-hidden className={cx("grid grid-cols-7 gap-[3px]", className)}>
      {PHASES.map((p, i) => (
        <span
          key={p}
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

/** Segmented control / tab group (10px radius, 36px items). */
export function TabGroup({ label, items, value, onChange, role = "tablist", className }) {
  return (
    <div role={role} aria-label={label} className={cx("flex max-w-full flex-wrap gap-1 self-start rounded-[10px] border border-line bg-card p-1", className)}>
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
              "flex h-9 items-center gap-1.5 rounded-[7px] px-3 text-[13px] font-medium transition-colors",
              selected ? "bg-selected text-strong" : "text-secondary hover:text-fg",
              item.gap && "sm:ml-2.5"
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

export function SearchField({ value, onChange, placeholder, className }) {
  return (
    <label className={cx("flex h-11 items-center gap-2.5 rounded-lg border border-line bg-card px-3.5 text-muted focus-within:border-accent/60", className)}>
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

export function Spinner({ className, label = "Loading" }) {
  return <Loader2 className={cx("size-4 animate-spin text-muted", className)} aria-label={label} role="status" />;
}

/** A quiet line of text for the rare case where a whole page has nothing to show. */
export function EmptyNote({ children, action }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-dash px-[18px] py-5 text-muted">
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
