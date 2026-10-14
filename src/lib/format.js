const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function parseDate(value) {
  if (!value) return null;
  // Date-only values are calendar dates; parse them in local time to avoid off-by-one shifts.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Local calendar date as YYYY-MM-DD. */
export const todayISO = (now = new Date()) => {
  const d = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 10);
};

export const addDaysISO = (iso, days) => {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return todayISO(d);
};

const daysBetween = (fromIso, toIso) => Math.round((parseDate(toIso) - parseDate(fromIso)) / 86_400_000);

/** Monday and Sunday of the week containing `iso`. */
export function weekBounds(iso) {
  const day = parseDate(iso).getDay();
  const start = addDaysISO(iso, -((day + 6) % 7));
  return { start, end: addDaysISO(start, 6) };
}

export function formatShortDate(value) {
  const d = parseDate(value);
  if (!d) return "—";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${sameYear ? "" : `, ${d.getFullYear()}`}`;
}

export function formatLongDate(value) {
  const d = parseDate(value);
  return d ? `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}` : "";
}

/** "Today", a weekday within the next 6 days, otherwise "Oct 27". */
export function formatDue(iso, today = todayISO()) {
  if (!iso) return "—";
  const diff = daysBetween(today, iso);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return WEEKDAYS[parseDate(iso).getDay()];
  return formatShortDate(iso);
}

export function formatTime(value) {
  const d = parseDate(value);
  return d ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
}

/** Day label for a timestamp: "Today", "Yesterday", "Thu", or "Oct 7". */
export function formatDay(value, now = new Date()) {
  const d = parseDate(value);
  if (!d) return "";
  const diff = daysBetween(todayISO(now), todayISO(d));
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return WEEKDAYS[d.getDay()];
  return formatShortDate(todayISO(d));
}

/** "today", "yesterday" or "3 days ago". */
export function formatDaysAgo(value, now = new Date()) {
  const d = parseDate(value);
  if (!d) return "";
  const days = daysBetween(todayISO(d), todayISO(now));
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

/** "Today 3:00 PM", "Thu 3:00 PM" or "Oct 7 3:00 PM". */
export const formatWhen = (value, now = new Date()) => `${formatDay(value, now)} ${formatTime(value)}`;

/** Short timestamp for lists: time today, otherwise the day. */
export function formatStamp(value, now = new Date()) {
  const d = parseDate(value);
  if (!d) return "";
  return todayISO(d) === todayISO(now) ? formatTime(value) : formatDay(value, now);
}

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(value) {
  const d = parseDate(value);
  if (!d) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("") || "?";

export const firstName = (name = "") => name.split(/\s+/)[0] ?? name;

export const pluralize = (count, word, plural = `${word}s`) => `${count} ${count === 1 ? word : plural}`;

export const joinNames = (users) => users.map((u) => firstName(u.name)).join(", ");
