import { COMPANY_LABEL, TASK_PRIORITIES, taskAssigneeIds, taskPriority } from "./constants";
import { todayISO, weekBounds } from "./format";

// Derived data. Every count shown in the UI is computed here from the current snapshot.

export const isOpenTask = (task) => task.status !== "done";
export const isOverdue = (task, today = todayISO()) => isOpenTask(task) && !!task.dueDate && task.dueDate < today;
export const isPastDeadline = (project, today = todayISO()) => !!project.deadline && project.deadline < today;

export const indexById = (list) => Object.fromEntries(list.map((item) => [item._id, item]));

export const readStateId = (conversationId, userId) => `${conversationId}:${userId}`;

/**
 * Users who belong to a conversation: General is everyone active, project chats follow the project,
 * a task's discussion is its project's members plus the task's assignees and creator, and DMs and
 * groups list their members.
 */
export function conversationMemberIds(conversation, data) {
  if (conversation.type === "general") return data.users.filter((u) => u.active).map((u) => u._id);
  if (conversation.type === "project") return data.projects.find((p) => p._id === conversation.projectId)?.memberIds ?? [];
  if (conversation.type === "task") {
    const task = data.tasks.find((t) => t._id === conversation.taskId);
    if (!task) return [];
    const project = data.projects.find((p) => p._id === task.projectId);
    return [...new Set([...(project?.memberIds ?? []), ...taskAssigneeIds(task), task.createdBy])];
  }
  return conversation.memberIds;
}

/**
 * Per-conversation unread state for one user: { [conversationId]: { count, mentioned } }.
 * Unread = someone else's message newer than the user's lastReadAt.
 */
export function unreadByConversation(data, userId) {
  const readAt = {};
  for (const r of data.readStates) if (r.userId === userId) readAt[r.conversationId] = r.lastReadAt;
  const result = {};
  for (const m of data.messages) {
    if (m.authorId === userId || m.deletedAt) continue;
    const since = readAt[m.conversationId];
    if (since && m.createdAt <= since) continue;
    const entry = (result[m.conversationId] ??= { count: 0, mentioned: false });
    entry.count += 1;
    if (m.mentions?.includes(userId)) entry.mentioned = true;
  }
  return result;
}

const priorityRank = (task) => TASK_PRIORITIES.indexOf(taskPriority(task));

/** By due date (none last), then priority, then doing before to do. */
export const sortByDue = (tasks) =>
  [...tasks].sort(
    (a, b) =>
      (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
      priorityRank(a) - priorityRank(b) ||
      (a.status === "doing" ? -1 : 0) - (b.status === "doing" ? -1 : 0)
  );

/** Groups for My tasks: overdue, today, rest of this week, later, no due date. */
export function groupMyTasks(tasks, today = todayISO()) {
  const { end } = weekBounds(today);
  const groups = { overdue: [], today: [], week: [], later: [], none: [] };
  for (const t of sortByDue(tasks.filter(isOpenTask))) {
    if (!t.dueDate) groups.none.push(t);
    else if (t.dueDate < today) groups.overdue.push(t);
    else if (t.dueDate === today) groups.today.push(t);
    else if (t.dueDate <= end) groups.week.push(t);
    else groups.later.push(t);
  }
  return groups;
}

export function completedThisWeek(tasks, today = todayISO()) {
  const { start } = weekBounds(today);
  return tasks
    .filter((t) => t.status === "done" && t.completedAt && todayISO(new Date(t.completedAt)) >= start)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

/** The meeting of the same project that started most recently before this one. */
export function previousMeeting(meeting, meetings) {
  return meetings
    .filter((m) => m.projectId === meeting.projectId && m._id !== meeting._id && m.startsAt < meeting.startsAt)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0] ?? null;
}

export const actionItems = (meeting, tasks) =>
  tasks.filter((t) => t.meetingId === meeting._id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

/** Undone action items from the previous meeting of the same project. */
export function stillOpenFromLast(meeting, data) {
  const previous = previousMeeting(meeting, data.meetings);
  return previous ? actionItems(previous, data.tasks).filter(isOpenTask) : [];
}

export const isUpcoming = (meeting, today = todayISO()) => !meeting.endedAt && todayISO(new Date(meeting.startsAt)) >= today;

export function meetingBuckets(meetings, today = todayISO()) {
  const upcoming = meetings.filter((m) => isUpcoming(m, today)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = meetings.filter((m) => !isUpcoming(m, today)).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return { upcoming, past };
}

/** Decision log entries for a set of meetings, newest first. */
export function decisionLog(meetings) {
  return meetings
    .flatMap((meeting) => meeting.decisions.map((decision) => ({ ...decision, meeting })))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const isThisWeek = (iso, today = todayISO()) => {
  const { end } = weekBounds(today);
  return iso >= today && iso <= end;
};

export function matches(query, ...fields) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(q));
}

/** Who a project is for: its client, or the company. { label, href, clientId }. */
export function projectOwner(project, clientsById) {
  const client = project?.clientId ? clientsById[project.clientId] : null;
  return client ? { label: client.name, href: `/clients/${client._id}`, clientId: client._id } : { label: COMPANY_LABEL, href: "/company", clientId: null };
}

/** Breadcrumb trail down to a project: Clients / Client / Project, or Company / Project. */
export function projectTrail(project, clientsById) {
  const owner = projectOwner(project, clientsById);
  const head = owner.clientId ? [{ label: "Clients", href: "/clients" }, owner] : [owner];
  return project ? [...head, { label: project.name, href: `/projects/${project._id}` }] : head;
}

export const isAssignedTo = (task, userId) => taskAssigneeIds(task).includes(userId);

/** Open first (in progress, then to do), each by due date; done last, most recently finished first. */
export function sortForList(tasks) {
  const rank = { doing: 0, todo: 1, done: 2 };
  return [...tasks].sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      (a.status === "done" ? (b.completedAt ?? "").localeCompare(a.completedAt ?? "") : 0) ||
      (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
      priorityRank(a) - priorityRank(b)
  );
}
