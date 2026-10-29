// Shared enums and display metadata. Used by the domain engine, server models and UI.

export const PHASES = ["idea", "planning", "design", "build", "test", "launch", "maintain"];
export const PHASE_LABELS = {
  idea: "Idea",
  planning: "Planning",
  design: "Design",
  build: "Build",
  test: "Test",
  launch: "Launch",
  maintain: "Maintain",
};

export const ROLES = ["admin", "member"];
export const ROLE_LABELS = { admin: "Admin", member: "Member" };

export const TASK_STATUSES = ["todo", "doing", "done"];
export const TASK_STATUS_LABELS = { todo: "To do", doing: "In progress", done: "Done" };
export const TASK_SOURCES = ["manual", "meeting", "message"];
export const TASK_PRIORITIES = ["urgent", "high", "medium", "low"];
export const TASK_PRIORITY_LABELS = { urgent: "Urgent", high: "High", medium: "Medium", low: "Low" };
export const DEFAULT_TASK_PRIORITY = "medium";
// Tasks saved before priorities existed count as the default.
export const taskPriority = (task) => task.priority ?? DEFAULT_TASK_PRIORITY;

// "group": a named chat people start from the Inbox. "general": the whole-team chat every workspace starts with.
export const CONVERSATION_TYPES = ["project", "general", "dm", "task", "group"];
export const NOTIFICATION_TYPES = ["mention", "assignment", "meetingInvite", "dm", "taskComment"];

// Meeting reminders: minutes before the start, chosen per person from the bell on a meeting card.
export const REMINDER_OPTIONS = [5, 15, 30, 60, 1440];
export const reminderLabel = (minutes) => (minutes >= 1440 ? `${minutes / 1440} day` : minutes >= 60 ? `${minutes / 60} hour` : `${minutes} min`);

// Email notifications. Mentions and direct messages are in-app only.
export const NOTIFICATION_PREFS = [
  { key: "assignment", label: "A task is assigned to me", hint: "Includes action items from meetings" },
  { key: "meetingInvite", label: "Meetings I’m invited to", hint: "The invite, and its decisions and action items when it ends" },
];
// chatMessages: push every message in the team chat, groups and project chats, not just @mentions.
export const DEFAULT_NOTIFICATION_PREFS = { assignment: true, meetingInvite: true, chatMessages: false };

// Files sent in chat: the size limit per file and how many go in one message.
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MAX_ATTACHMENTS = 10;

// The team-wide chat (conversation type "general"). Listed in the Inbox with the groups.
export const TEAM_CHANNEL = "Everyone";

// The project every workspace starts with, for company-wide work (isInternal: true).
export const COMPANY_PROJECT = "Operations";

// Where company projects (no client) are listed, and how they're labelled in breadcrumbs.
export const COMPANY_LABEL = "Company";

/** A task's assignees. Tasks saved before tasks could have several people have a single assigneeId. */
export const taskAssigneeIds = (task) => task.assigneeIds ?? (task.assigneeId ? [task.assigneeId] : []);

// Shown wherever a deleted member appears in history.
export const FORMER_MEMBER = "Former member";

export const phaseLabel = (phase) => PHASE_LABELS[phase] ?? phase;
export const phaseIndex = (phase) => PHASES.indexOf(phase);
export const nextPhase = (phase) => PHASES[phaseIndex(phase) + 1] ?? null;
