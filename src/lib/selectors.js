import { PRIORITY_META, TASK_STATUSES } from "./constants";

// Derived data. Every metric shown in the UI is computed here from the current snapshot.

export const todayISO = (now = new Date()) => {
  const d = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 10);
};

export const addDaysISO = (iso, days) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return todayISO(d);
};

export const isOpenTask = (task) => task.status !== "done";
export const isOverdue = (task, today = todayISO()) => isOpenTask(task) && !!task.dueDate && task.dueDate < today;

export function indexById(list) {
  return Object.fromEntries(list.map((item) => [item._id, item]));
}

export function projectProgress(projectId, tasks) {
  const own = tasks.filter((t) => t.projectId === projectId);
  const done = own.filter((t) => t.status === "done").length;
  return { total: own.length, done, percent: own.length ? Math.round((done / own.length) * 100) : 0 };
}

export function groupTasksByStatus(tasks) {
  const groups = Object.fromEntries(TASK_STATUSES.map((s) => [s, []]));
  for (const task of tasks) groups[task.status]?.push(task);
  for (const status of TASK_STATUSES) groups[status].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return groups;
}

export function sortTasks(tasks, sort = "due") {
  const copy = [...tasks];
  if (sort === "priority") return copy.sort((a, b) => PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank || (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  if (sort === "updated") return copy.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  return copy.sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999") || PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank);
}

/** Why a project needs attention, or null. */
export function projectAttention(project, tasks, { today = todayISO(), dueSoonDays = 7 } = {}) {
  if (project.status === "completed") return null;
  const own = tasks.filter((t) => t.projectId === project._id);
  const overdue = own.filter((t) => isOverdue(t, today)).length;
  const reasons = [];
  if (project.deadline && project.deadline < today) reasons.push("Past deadline");
  else if (project.status !== "on_hold" && project.deadline && project.deadline <= addDaysISO(today, dueSoonDays)) {
    const { percent } = projectProgress(project._id, tasks);
    if (percent < 80) reasons.push(`Deadline soon · ${percent}% done`);
  }
  if (overdue) reasons.push(`${overdue} overdue task${overdue === 1 ? "" : "s"}`);
  if (project.status !== "on_hold" && own.some((t) => isOpenTask(t) && t.priority === "urgent" && !t.assigneeId)) reasons.push("Unassigned urgent work");
  return reasons.length ? reasons : null;
}

export function dashboardMetrics(data, { today = todayISO(), dueSoonDays = 7 } = {}) {
  const openTasks = data.tasks.filter(isOpenTask);
  const horizon = addDaysISO(today, dueSoonDays);
  const upcoming = [
    ...openTasks.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= horizon).map((t) => ({ kind: "task", date: t.dueDate, item: t })),
    ...data.projects
      .filter((p) => p.status !== "completed" && p.deadline && p.deadline >= today && p.deadline <= horizon)
      .map((p) => ({ kind: "project", date: p.deadline, item: p })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return {
    activeProjects: data.projects.filter((p) => p.status === "in_progress").length,
    plannedProjects: data.projects.filter((p) => p.status === "planning").length,
    totalClients: data.clients.length,
    activeClients: data.clients.filter((c) => c.status === "active").length,
    leads: data.clients.filter((c) => c.status === "lead").length,
    openTasks: openTasks.length,
    overdueTasks: openTasks.filter((t) => isOverdue(t, today)),
    upcoming,
    attention: data.projects
      .map((p) => ({ project: p, reasons: projectAttention(p, data.tasks, { today, dueSoonDays }) }))
      .filter((x) => x.reasons),
    byStatus: groupTasksByStatus(data.tasks),
  };
}

export function isUnread(conversation, userId) {
  const read = conversation.lastReadAt?.[userId];
  return !read || read < conversation.lastMessageAt;
}

export function conversationsSorted(conversations) {
  return [...conversations].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export function matches(query, ...fields) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => (Array.isArray(f) ? f.join(" ") : f ?? "").toLowerCase().includes(q));
}
