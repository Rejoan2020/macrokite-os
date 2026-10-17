"use client";

import Link from "next/link";
import { Fragment, forwardRef } from "react";
import { Loader2, Plus, Search, X } from "lucide-react";
import { initials } from "@/lib/format";
import { phaseIndexIn, projectPhases } from "@/lib/phases";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";

export const cx = (...classes) => classes.filter(Boolean).join(" ");

const BUTTON_VARIANTS = {
  primary: "border border-primary bg-primary text-primary-on hover:bg-primary-hover",
  accent: "border border-accent bg-accent text-accent-on hover:brightness-110",
  secondary: "border border-line bg-card text-fg hover:bg-hover",
  outline: "border border-line bg-card text-fg hover:bg-hover",
  quiet: "border border-line text-secondary hover:bg-hover hover:text-fg",
  // A quiet destructive action (Delete meeting); "danger-solid" is its confirmation.
  danger: "border border-transparent bg-transparent text-accent-tint-text hover:bg-accent-tint",
  "danger-solid": "border border-accent bg-accent text-white hover:brightness-110",
  ghost: "text-muted hover:bg-hover hover:text-fg",
};
const BUTTON_SIZES = {
  lg: "h-[46px] px-[22px] text-sm gap-2",
  md: "h-10 px-[18px] text-[13px] gap-2",
  sm: "h-9 px-4 text-[13px] gap-1.5",
  xs: "h-8 px-3 text-xs gap-1.5",
};
// The page's main action is a bigger pill.
const PRIMARY_MD = "h-[46px] px-[22px] text-sm";

export const Button = forwardRef(function Button(
  { variant = "secondary", size = "md", icon: Icon, loading, className, children, href, type = "button", ...props },
  ref
) {
  const classes = cx(
    "inline-flex shrink-0 items-center justify-center rounded-full font-medium whitespace-nowrap transition-[background-color,box-shadow,filter,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-35 select-none",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    size === "md" && (variant === "primary" || variant === "accent") && PRIMARY_MD,
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
        "inline-flex size-[34px] shrink-0 items-center justify-center rounded-full text-secondary transition-colors hover:bg-hover hover:text-fg disabled:opacity-40",
        outline && "border border-row",
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
  neutral: "bg-input text-secondary",
  outline: "border border-line text-fg hover:bg-hover",
};

export function Pill({ tone = "accent", className, children }) {
  return <span className={cx("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs leading-[1.2] font-medium whitespace-nowrap", PILL_TONES[tone], className)}>{children}</span>;
}

export const OnHoldPill = () => <Pill tone="warning">On hold</Pill>;

export const PRIORITY_TONES = { urgent: "accent", high: "warning", medium: "info", low: "neutral" };
const PRIORITY_DOTS = { urgent: "bg-accent", high: "bg-amber", medium: "bg-info", low: "bg-faint" };

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

/** Status at a glance (Linear-style): a dashed ring (to do), a half-filled ring (in progress) or a filled check (done). */
export function StatusIcon({ status, className }) {
  const label = TASK_STATUS_LABELS[status];
  const color = status === "done" ? "text-success" : status === "doing" ? "text-warning-strong" : "text-todo";
  return (
    <svg role="img" aria-label={label} viewBox="0 0 16 16" className={cx("size-4 shrink-0", color, className)}>
      <title>{label}</title>
      {status === "done" ? (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="m5.2 8.2 1.9 1.9 3.7-4" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : status === "doing" ? (
        <>
          <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 4.2a3.8 3.8 0 0 1 0 7.6z" fill="currentColor" />
        </>
      ) : (
        <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.6 2.2" />
      )}
    </svg>
  );
}

/** The small chevron used by every dropdown. */
export const Chevron = ({ className, size = 12, strokeWidth = 2.2 }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={cx("shrink-0", className)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

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
        className={cx("h-8 cursor-pointer appearance-none rounded-full bg-transparent pr-[30px] text-xs font-semibold outline-none disabled:cursor-default", children ? "pl-0" : "pl-3.5")}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-card text-fg">
            {o.label}
          </option>
        ))}
      </select>
      {!disabled && <Chevron size={10} strokeWidth={2.5} className="pointer-events-none absolute right-[11px] text-[#5f6575]" />}
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

// xs: stacks in cells · cell: one person in a table · sm: stacks · md: most places · chip: in a person chip ·
// notif: notifications · row: list rows (Inbox, Team) · chat: beside messages · lg: profile.
const AVATAR_SIZES = {
  xs: "size-6 text-[9px]",
  cell: "size-[26px] text-[9px]",
  sm: "size-7 text-[9px]",
  team: "size-7 text-[10px]",
  md: "size-[30px] text-[10px]",
  chip: "size-[30px] text-[9px]",
  notif: "size-[34px] text-[10px]",
  row: "size-10 text-xs",
  chat: "size-[38px] text-[11px]",
  lg: "size-[60px] text-lg",
};

export function Avatar({ user, size = "md", className, ring }) {
  const name = user?.name ?? "Unknown";
  return (
    <span
      title={name}
      className={cx(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold tracking-[0.02em]",
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
    <span className={cx("group inline-flex h-10 items-center gap-2 rounded-full border border-transparent bg-input py-0 pl-[5px] text-[13px] font-medium text-strong transition-colors hover:bg-selected", onRemove ? "pr-1.5" : "pr-3.5")}>
      <Avatar user={user} size="chip" />
      {label ?? user?.name}
      {onRemove && (
        // The × keeps its space and fades in on hover, so the chip doesn't jump.
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="ml-1.5 grid size-[22px] place-items-center rounded-full text-secondary opacity-0 transition-[opacity,background-color] duration-[120ms] group-hover:opacity-100 hover:bg-card hover:text-fg focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <X className="size-[11px]" strokeWidth={2.2} aria-hidden />
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
      className={cx(
        "group/add inline-flex h-10 items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-dash px-3.5 text-[13px] font-medium text-secondary transition-colors duration-150 hover:border-secondary hover:bg-input hover:text-fg aria-expanded:border-solid aria-expanded:border-primary aria-expanded:bg-primary aria-expanded:text-primary-on",
        className
      )}
      {...props}
    >
      {/* While its list is open the + turns into a ×. */}
      <Plus className="size-3.5 transition-transform duration-150 group-aria-expanded/add:rotate-45" strokeWidth={2} aria-hidden />
      {children}
    </button>
  );
});

/** The initial of a client in a rounded square, like an app icon. */
export function LogoTile({ name, size = "md", className }) {
  const sizes = { sm: "size-10 rounded-xl text-[15px]", md: "size-11 rounded-[14px] text-base", lg: "size-[52px] rounded-2xl text-[19px]" };
  return (
    <span aria-hidden className={cx("flex shrink-0 items-center justify-center bg-primary font-semibold text-primary-on", sizes[size], className)}>
      {(name ?? "?").trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export function Card({ as: Tag = "div", className, children, ...props }) {
  return (
    <Tag className={cx("rounded-[24px] border border-card-line bg-card", className)} {...props}>
      {children}
    </Tag>
  );
}

/** A card with a title row and an optional action on the right. */
export function Panel({ title, action, className, children, id, bodyClassName }) {
  return (
    <section aria-labelledby={id} className={cx("flex flex-col rounded-[24px] border border-card-line bg-card", className)}>
      <div className="flex items-center justify-between gap-3 px-6 pt-[22px] pb-[18px]">
        <h2 id={id} className="text-xl font-medium tracking-[-0.02em] text-strong">
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

/** A page whose panels fill the screen height beside the sidebar (Company, a client), each scrolling on its own. */
export const fullHeightPage = "flex flex-col px-4 pt-6 pb-4 sm:px-8 lg:h-dvh lg:pt-9 lg:pb-[14px]";

/** Page column. Pages use the full width up to 1800px; settings panels stay at 980px. */
export function Page({ width = "lg", className, children }) {
  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 pt-6 pb-10 sm:px-8 lg:pt-9">
      {/* Pages that set their own gap replace the default one rather than competing with it. */}
      <div className={cx("flex flex-col", !/(^|\s)gap-/.test(className ?? "") && "gap-[22px]", width === "sm" && "max-w-[980px]", className)}>{children}</div>
    </div>
  );
}

export function PageHeader({ title, summary, actions, eyebrow, leading }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3.5">
        {leading}
        <div className="flex min-w-0 flex-col">
          {eyebrow && <div className="mb-2.5 text-[13px] font-medium text-faint">{eyebrow}</div>}
          <h1 className="text-[32px] leading-[1.1] font-normal tracking-[-0.035em] text-strong sm:text-[38px]">{title}</h1>
          {summary && <p className="mt-2.5 text-sm text-secondary">{summary}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** "Clients / Google / Search engine": links for every part but the last. */
export function Breadcrumbs({ items, className }) {
  return (
    <nav aria-label="Breadcrumb" className={cx("flex flex-wrap items-center gap-1.5 text-xs font-medium text-faint", className)}>
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden className="text-dash">/</span>}
          {item.href && i < items.length - 1 ? (
            <Link href={item.href} className="hover:text-fg">
              {item.label}
            </Link>
          ) : (
            <span className={i === items.length - 1 ? "text-secondary" : undefined} aria-current={i === items.length - 1 ? "page" : undefined}>
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
    <Tag className={cx("text-xs font-medium text-faint", className)} {...props}>
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
    <div role={role} aria-label={label} className={cx("flex max-w-full flex-wrap gap-0.5 self-start rounded-full bg-selected p-1", className)}>
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
              "flex h-[38px] items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-colors",
              selected ? "bg-card text-strong" : "text-secondary hover:text-fg"
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
    <label className={cx("flex h-[46px] items-center gap-2.5 rounded-full border border-transparent bg-card px-[18px] text-faint", className)}>
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="sr-only">{placeholder}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
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
      className={cx("relative inline-flex h-6 w-[42px] shrink-0 items-center rounded-full transition-colors disabled:opacity-50", checked ? "bg-success" : "bg-selected")}
    >
      <span aria-hidden className={cx("absolute size-[18px] rounded-full bg-white transition-transform duration-200", checked ? "translate-x-[21px]" : "translate-x-[3px]")} />
    </button>
  );
}

export function Spinner({ className, label = "Loading" }) {
  return <Loader2 className={cx("size-4 animate-spin text-muted", className)} aria-label={label} role="status" />;
}

/** A quiet line of text for the rare case where a whole page has nothing to show. */
export function EmptyNote({ children, action }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[18px] border-[1.5px] border-dashed border-dash bg-[var(--ghost)] px-[22px] py-[22px] text-[13px] text-secondary">
      <p>{children}</p>
      {action}
    </div>
  );
}

/** Day divider used in chats. */
export function DayDivider({ children }) {
  return (
    <div className="flex items-center gap-3 text-xs font-medium text-faint" role="separator">
      <span className="h-px flex-1 bg-divider" />
      {children}
      <span className="h-px flex-1 bg-divider" />
    </div>
  );
}

/** A roomy, centred empty state for a page or panel that has nothing yet: title, a line, an action. */
export function EmptyState({ title, children, action, className }) {
  return (
    <div className={cx("flex flex-col items-center rounded-[24px] border-[1.5px] border-dashed border-dash bg-[var(--ghost)] px-6 py-14 text-center", className)}>
      <h2 className="text-[22px] font-normal tracking-[-0.03em] text-strong">{title}</h2>
      {children && <p className="mx-auto mt-2 max-w-[420px] text-[13px] leading-5 text-secondary">{children}</p>}
      {action && <div className="mt-[22px]">{action}</div>}
    </div>
  );
}
