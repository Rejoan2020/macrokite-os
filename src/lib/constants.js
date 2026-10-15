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

export const NOTIFICATION_PREFS = [
  { key: "mention", label: "Someone @mentions me", hint: "In project chats, General or messages" },
  { key: "assignment", label: "A task is assigned to me", hint: "Includes action items from meetings" },
  { key: "meetingInvite", label: "I’m invited to a meeting", hint: "Plus a reminder before it starts" },
  { key: "dm", label: "New direct message", hint: "Only when I’m away from the app" },
];
export const DEFAULT_NOTIFICATION_PREFS = { mention: true, assignment: true, meetingInvite: true, dm: false };

// Shown wherever a deleted member appears in history.
export const FORMER_MEMBER = "Former member";

export const phaseLabel = (phase) => PHASE_LABELS[phase] ?? phase;
export const phaseIndex = (phase) => PHASES.indexOf(phase);
export const nextPhase = (phase) => PHASES[phaseIndex(phase) + 1] ?? null;
