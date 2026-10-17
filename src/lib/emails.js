import { DEFAULT_NOTIFICATION_PREFS, FORMER_MEMBER, TASK_PRIORITY_LABELS, taskAssigneeIds, taskPriority } from "./constants";
import { formatShortDate } from "./format";

/**
 * Notification emails for one applied action. Pure, so it is shared by the server and the tests;
 * the server sends what this returns.
 *
 * Only task assignments, meeting invites and meeting summaries are emailed, each when its
 * recipient has it on in Settings; mentions and direct messages stay in-app. Ending a meeting
 * emails every attendee one summary instead of separate action item emails.
 *
 * Input: { state (snapshot after the action), changes, action, actorId, now: Date,
 *          appUrl(path) => absolute URL, timeZone (IANA name for meeting times) }
 * Output: [{ to, subject, text, html }]
 */

const EMAILED_TYPES = ["assignment", "meetingInvite"];

export const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** A short email in plain text and simple HTML. Every value is escaped here. */
export function emailBody({ intro, items = [], button, footer }) {
  const text = [intro, ...items.map((i) => `- ${i}`), button && `${button.label}: ${button.href}`, footer].filter(Boolean).join("\n\n");
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;max-width:520px">
  <p>${escapeHtml(intro)}</p>${
    items.length ? `\n  <ul style="padding-left:20px">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` : ""
  }${
    button
      ? `\n  <p><a href="${escapeHtml(button.href)}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">${escapeHtml(button.label)}</a></p>`
      : ""
  }${footer ? `\n  <p style="color:#888;font-size:13px">${escapeHtml(footer)}</p>` : ""}
</div>`;
  return { text, html };
}

function formatMeetingTime(iso, timeZone) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const options = { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" };
  try {
    return date.toLocaleString("en-US", { ...options, timeZone: timeZone || "UTC" });
  } catch {
    return date.toLocaleString("en-US", { ...options, timeZone: "UTC" });
  }
}

const wants = (user, type) => ({ ...DEFAULT_NOTIFICATION_PREFS, ...user.notificationPrefs })[type];

const reachable = (user) => user && user.active && !user.deletedAt && user.email;

export function notificationEmails({ state, changes, action, actorId, now, appUrl, timeZone }) {
  const nowIso = now.toISOString();
  const users = Object.fromEntries(state.users.map((u) => [u._id, u]));
  const byId = (collection, id) => state[collection].find((d) => d._id === id);
  const actorName = users[actorId]?.name || FORMER_MEMBER;
  const footer = `You get this because of your notification settings in ${state.org.name}. Change them: ${appUrl("/settings")}`;
  const emails = [];

  const summary = action.type === "meeting.end" ? byId("meetings", action.id) : null;
  const summaryTo = new Set();
  if (summary) {
    const tasks = state.tasks.filter((t) => t.meetingId === summary._id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const items = [
      ...summary.decisions.map((d) => `Decision: ${d.text}`),
      ...tasks.map((t) => `Action item: ${t.title} (${taskAssigneeIds(t).map((id) => users[id]?.name || FORMER_MEMBER).join(", ") || "Unassigned"}${t.dueDate ? `, due ${formatShortDate(t.dueDate)}` : ""})`),
    ];
    for (const id of summary.attendeeIds) {
      const user = users[id];
      if (!reachable(user) || !wants(user, "meetingInvite")) continue;
      summaryTo.add(id);
      emails.push({
        to: user.email,
        subject: `Summary: ${summary.title}`,
        ...emailBody({
          intro: items.length ? `${summary.title} has ended. Here is what was decided and who does what.` : `${summary.title} has ended. No decisions or action items were recorded.`,
          items,
          button: { label: "Open the meeting", href: appUrl(`/meetings/${summary._id}`) },
          footer,
        }),
      });
    }
  }

  const created = (changes.put?.notifications ?? []).filter((n) => n.createdAt === nowIso && !n.readAt);
  for (const n of created) {
    const user = users[n.userId];
    if (!EMAILED_TYPES.includes(n.type) || !reachable(user) || !wants(user, n.type)) continue;
    // Their action items are already in the meeting summary.
    if (n.targetType === "meeting" && summaryTo.has(n.userId)) continue;
    const email = buildNotification(n, { state, byId, actorName, appUrl, timeZone });
    if (email) emails.push({ to: user.email, ...email, ...emailBody({ ...email.body, footer }) });
  }
  return emails.map(({ body, ...email }) => email);
}

function buildNotification(n, { state, byId, actorName, appUrl, timeZone }) {
  if (n.targetType === "task") {
    const task = byId("tasks", n.targetId);
    if (!task) return null;
    const project = byId("projects", task.projectId);
    const description = task.description && (task.description.length > 300 ? `${task.description.slice(0, 300).trimEnd()}…` : task.description);
    const items = [description && `Details: ${description}`, project && `Project: ${project.name}`, task.dueDate && `Due: ${formatShortDate(task.dueDate)}`, `Priority: ${TASK_PRIORITY_LABELS[taskPriority(task)]}`].filter(Boolean);
    return { subject: `${actorName} assigned you: ${task.title}`, body: { intro: `${actorName} assigned you a task: ${task.title}`, items, button: { label: "Open the task", href: appUrl(`/tasks/${task._id}`) } } };
  }
  if (n.targetType === "meeting") {
    const meeting = byId("meetings", n.targetId);
    if (!meeting) return null;
    const href = appUrl(`/meetings/${meeting._id}`);
    if (n.type === "meetingInvite") {
      const project = byId("projects", meeting.projectId);
      const items = [`When: ${formatMeetingTime(meeting.startsAt, timeZone)}`, project && `Project: ${project.name}`, meeting.callUrl && `Call link: ${meeting.callUrl}`].filter(Boolean);
      return { subject: `${actorName} invited you to ${meeting.title}`, body: { intro: `${actorName} invited you to a meeting: ${meeting.title}`, items, button: { label: "Open the meeting", href } } };
    }
    // Action items from a meeting, for an assignee who wasn't sent the summary.
    const mine = state.tasks.filter((t) => t.meetingId === meeting._id && taskAssigneeIds(t).includes(n.userId)).map((t) => t.title);
    const subject = n.text || `Action items from ${meeting.title}`;
    return { subject, body: { intro: `${subject}.`, items: mine, button: { label: "Open the meeting", href } } };
  }
  return null;
}
