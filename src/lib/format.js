const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDate(value) {
  if (!value) return null;
  // Date-only values are calendar dates; parse them in local time to avoid off-by-one shifts.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value, pattern = "MMM d, yyyy") {
  const d = parseDate(value);
  if (!d) return "—";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  if (pattern === "yyyy-MM-dd") return `${yyyy}-${mm}-${dd}`;
  if (pattern === "d MMM yyyy") return `${d.getDate()} ${MONTHS[d.getMonth()]} ${yyyy}`;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${yyyy}`;
}

export function formatShortDate(value) {
  const d = parseDate(value);
  if (!d) return "—";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${sameYear ? "" : `, ${d.getFullYear()}`}`;
}

export function formatTime(value) {
  const d = parseDate(value);
  return d ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
}

export function formatRelative(value, now = new Date()) {
  const d = parseDate(value);
  if (!d) return "—";
  const seconds = Math.round((now - d) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatShortDate(value);
}

/** Human description of a due date relative to today, e.g. "Due in 3 days", "2 days overdue". */
export function dueLabel(iso, today) {
  if (!iso) return null;
  const diff = Math.round((parseDate(iso) - parseDate(today)) / 86_400_000);
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  if (diff > 1) return `Due in ${diff} days`;
  if (diff === -1) return "1 day overdue";
  return `${-diff} days overdue`;
}

export const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("") || "?";

export const pluralize = (count, word, plural = `${word}s`) => `${count} ${count === 1 ? word : plural}`;
