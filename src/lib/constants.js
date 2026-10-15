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
export const TASK_STATUS_LABELS = { todo: "To do", doing: "Doing", done: "Done" };
export const TASK_SOURCES = ["manual", "meeting", "message"];

export const CONVERSATION_TYPES = ["project", "general", "dm"];
export const NOTIFICATION_TYPES = ["mention", "assignment", "meetingInvite", "dm"];

// Email notifications. Mentions and direct messages are in-app only.
export const NOTIFICATION_PREFS = [
  { key: "assignment", label: "A task is assigned to me", hint: "Includes action items from meetings" },
  { key: "meetingInvite", label: "Meetings I’m invited to", hint: "The invite, and its decisions and action items when it ends" },
];
export const DEFAULT_NOTIFICATION_PREFS = { assignment: true, meetingInvite: true };

// The team-wide chat (conversation type "general", at /general). Shown without a "#", unlike project chats.
export const TEAM_CHANNEL = "Internal";

// The project every workspace starts with, for company-wide work (isInternal: true).
export const COMPANY_PROJECT = "Company";

// Shown wherever a deleted member appears in history.
export const FORMER_MEMBER = "Former member";

export const phaseLabel = (phase) => PHASE_LABELS[phase] ?? phase;
export const phaseIndex = (phase) => PHASES.indexOf(phase);
export const nextPhase = (phase) => PHASES[phaseIndex(phase) + 1] ?? null;
