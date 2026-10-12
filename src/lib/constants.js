// Shared enums and display metadata. Used by the domain engine, server models and UI.

export const CLIENT_STATUSES = ["lead", "active", "paused", "completed"];
export const PROJECT_STATUSES = ["planning", "in_progress", "on_hold", "completed"];
export const TASK_STATUSES = ["backlog", "todo", "in_progress", "in_review", "done"];
export const PRIORITIES = ["low", "medium", "high", "urgent"];
export const VISIBILITIES = ["internal", "client"];
export const ROLES = ["owner", "admin", "member"];
export const DATE_FORMATS = ["MMM d, yyyy", "d MMM yyyy", "yyyy-MM-dd"];

export const CLIENT_STATUS_META = {
  lead: { label: "Lead", tone: "violet" },
  active: { label: "Active", tone: "teal" },
  paused: { label: "Paused", tone: "amber" },
  completed: { label: "Completed", tone: "slate" },
};

export const PROJECT_STATUS_META = {
  planning: { label: "Planning", tone: "violet" },
  in_progress: { label: "In progress", tone: "teal" },
  on_hold: { label: "On hold", tone: "amber" },
  completed: { label: "Completed", tone: "slate" },
};

export const TASK_STATUS_META = {
  backlog: { label: "Backlog", tone: "slate" },
  todo: { label: "To do", tone: "blue" },
  in_progress: { label: "In progress", tone: "teal" },
  in_review: { label: "In review", tone: "violet" },
  done: { label: "Done", tone: "green" },
};

export const PRIORITY_META = {
  low: { label: "Low", tone: "slate", rank: 0 },
  medium: { label: "Medium", tone: "blue", rank: 1 },
  high: { label: "High", tone: "amber", rank: 2 },
  urgent: { label: "Urgent", tone: "red", rank: 3 },
};

export const VISIBILITY_META = {
  internal: { label: "Internal", tone: "slate" },
  client: { label: "Client-facing", tone: "teal" },
};

export const ROLE_META = {
  owner: { label: "Owner" },
  admin: { label: "Admin" },
  member: { label: "Member" },
};

export const DEFAULT_PREFERENCES = {
  defaultTaskPriority: "medium",
  dueSoonDays: 7,
  dateFormat: "MMM d, yyyy",
};

export const toOptions = (values, meta) =>
  values.map((value) => ({ value, label: meta?.[value]?.label ?? value }));
