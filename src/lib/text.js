import { addDaysISO, parseDate, todayISO } from "./format";

// Plain-text parsing shared by the engine and the UI: @mentions, quick action items, social links.

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
};

const firstNameKey = (user) => user.name.split(/\s+/)[0].toLowerCase();

/** Finds the user an @token refers to: exact first name first, then a unique prefix. */
export function matchUser(token, users) {
  const key = token.toLowerCase();
  const exact = users.find((u) => firstNameKey(u) === key || u.name.replace(/\s+/g, "").toLowerCase() === key);
  if (exact) return exact;
  const prefixed = users.filter((u) => firstNameKey(u).startsWith(key));
  return prefixed.length === 1 ? prefixed[0] : null;
}

const MENTION = /(^|[^\w@])@([A-Za-z][\w.-]*)/g;

/** User ids mentioned in a message body, limited to `users`. */
export function parseMentions(body, users) {
  const ids = new Set();
  for (const match of body.matchAll(MENTION)) {
    const user = matchUser(match[2].replace(/[.-]+$/, ""), users);
    if (user) ids.add(user._id);
  }
  return [...ids];
}

/** Splits a message into text, link and mention segments for rendering. */
export function tokenize(body, users) {
  const pattern = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])|(^|[^\w@])@([A-Za-z][\w-]*)/g;
  const parts = [];
  let last = 0;
  for (const m of body.matchAll(pattern)) {
    if (m[1]) {
      parts.push({ type: "text", value: body.slice(last, m.index) });
      parts.push({ type: "link", value: m[1] });
      last = m.index + m[0].length;
    } else {
      const user = matchUser(m[3], users);
      if (!user) continue;
      const start = m.index + m[2].length;
      parts.push({ type: "text", value: body.slice(last, start) });
      parts.push({ type: "mention", value: `@${m[3]}`, userId: user._id });
      last = start + m[3].length + 1;
    }
  }
  parts.push({ type: "text", value: body.slice(last) });
  return parts.filter((p) => p.value);
}

/** Facebook / Instagram links render as cards in chat. */
export function socialLink(url) {
  let host;
  try {
    host = new URL(url).hostname.replace(/^(www\.|m\.)/, "");
  } catch {
    return null;
  }
  if (host === "instagram.com" || host === "instagr.am") return { platform: "Instagram", url };
  if (host === "facebook.com" || host === "fb.watch" || host === "fb.com") return { platform: "Facebook", url };
  return null;
}

export const socialLinks = (body) => (body.match(/https?:\/\/[^\s<]+/g) ?? []).map(socialLink).filter(Boolean);

/**
 * Parses a day phrase into YYYY-MM-DD. Accepts today, tomorrow, weekdays (next occurrence),
 * "in 3 days", "Oct 21", "21 Oct" and ISO dates. Returns null when it cannot.
 */
export function parseDay(input, today = todayISO()) {
  const text = input.trim().toLowerCase().replace(/^(by|on|due)\s+/, "").replace(/[.,]$/, "");
  if (!text) return null;
  if (["today", "tod", "tonight", "eod"].includes(text)) return today;
  if (["tomorrow", "tmr", "tmrw", "tom"].includes(text)) return addDaysISO(today, 1);
  const inDays = text.match(/^in (\d{1,3}) days?$/);
  if (inDays) return addDaysISO(today, Number(inDays[1]));
  if (text === "next week") {
    const day = parseDate(today).getDay();
    return addDaysISO(today, ((8 - day) % 7) || 7);
  }
  const weekday = WEEKDAYS[text];
  if (weekday !== undefined) {
    const diff = (weekday - parseDate(today).getDay() + 7) % 7 || 7;
    return addDaysISO(today, diff);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return parseDate(text) ? text : null;
  const md = text.match(/^([a-z]{3,9})\s+(\d{1,2})$/) ?? text.match(/^(\d{1,2})\s+([a-z]{3,9})$/);
  if (md) {
    const [monthText, dayText] = /^\d/.test(md[1]) ? [md[2], md[1]] : [md[1], md[2]];
    const month = MONTHS.indexOf(monthText.slice(0, 3));
    const day = Number(dayText);
    if (month === -1 || day < 1 || day > 31) return null;
    let year = parseDate(today).getFullYear();
    const iso = (y) => `${y}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (iso(year) < addDaysISO(today, -60)) year += 1;
    const candidate = iso(year);
    return parseDate(candidate) && todayISO(parseDate(candidate)) === candidate ? candidate : null;
  }
  return null;
}

/**
 * Parses a one-line action item: "Task title @name day".
 * Returns what it understood plus `problems` describing anything to ask for inline.
 */
export function parseActionItem(input, members, today = todayISO()) {
  const line = input.trim();
  const at = line.match(/(^|\s)@([A-Za-z][\w-]*)/);
  if (!at) return { title: line, assigneeId: null, dueDate: "", problems: { assignee: "missing" } };
  const title = line.slice(0, at.index).trim();
  const rest = line.slice(at.index + at[0].length).trim();
  const user = matchUser(at[2], members);
  const problems = {};
  if (!user) problems.assignee = `unknown:${at[2]}`;
  let dueDate = "";
  if (rest) {
    dueDate = parseDay(rest, today) ?? "";
    if (!dueDate) problems.day = rest;
  }
  if (!title) problems.title = "missing";
  return { title, assigneeId: user?._id ?? null, dueDate, problems };
}
