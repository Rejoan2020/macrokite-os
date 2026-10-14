import "server-only";
import mongoose, { Schema } from "mongoose";
import { CONVERSATION_TYPES, NOTIFICATION_TYPES, PHASES, ROLES, TASK_SOURCES, TASK_STATUSES } from "../constants";

// String ids keep identifiers identical across demo mode and database mode.
// Every business collection carries an indexed orgId; all queries filter on it.

const options = { versionKey: false, minimize: false };
const id = { type: String, required: true };
const orgId = { type: String, required: true, index: true };
const ref = { type: String, default: null };
const timestamps = { createdAt: String, updatedAt: String };

function model(name, definition, indexes = []) {
  if (mongoose.models[name]) return mongoose.models[name];
  const schema = new Schema({ _id: id, ...definition }, options);
  indexes.forEach((index) => (Array.isArray(index) ? schema.index(...index) : schema.index(index)));
  return mongoose.model(name, schema);
}

export const Organization = model("Organization", {
  name: String,
  slug: { type: String, unique: true },
  schemaVersion: Number,
  ...timestamps,
});

export const User = model(
  "User",
  {
    orgId,
    authId: { type: String, default: null }, // sign-in account (WorkOS user id), linked on first sign-in
    name: String,
    email: String,
    avatarUrl: String,
    avatarColor: String,
    role: { type: String, enum: ROLES },
    active: Boolean,
    notificationPrefs: Schema.Types.Mixed,
    ...timestamps,
  },
  [[{ orgId: 1, email: 1 }, { unique: true }], { authId: 1 }, { email: 1 }]
);

export const Invite = model("Invite", { orgId, email: String, invitedBy: String, createdAt: String, sentAt: String, acceptedAt: ref }, [
  { email: 1, acceptedAt: 1 },
]);

export const Project = model("Project", {
  orgId,
  name: String,
  description: String,
  phase: { type: String, enum: PHASES },
  onHold: Boolean,
  archived: Boolean,
  deadline: String,
  memberIds: [String],
  notes: String,
  isInternal: Boolean,
  createdBy: String,
  ...timestamps,
});

export const Task = model(
  "Task",
  {
    orgId,
    projectId: { type: String, required: true },
    phase: { type: String, enum: PHASES },
    title: String,
    assigneeId: String,
    status: { type: String, enum: TASK_STATUSES },
    dueDate: String,
    source: { type: String, enum: TASK_SOURCES },
    meetingId: ref,
    messageId: ref,
    completedAt: ref,
    createdBy: String,
    ...timestamps,
  },
  [{ orgId: 1, projectId: 1 }, { orgId: 1, assigneeId: 1 }]
);

const AgendaItem = new Schema({ _id: String, title: String, covered: Boolean }, { _id: false });
const Decision = new Schema({ _id: String, text: String, createdBy: String, createdAt: String }, { _id: false });

export const Meeting = model(
  "Meeting",
  {
    orgId,
    projectId: { type: String, required: true },
    title: String,
    startsAt: String,
    callUrl: String,
    attendeeIds: [String],
    agenda: [AgendaItem],
    notes: String,
    decisions: [Decision],
    endedAt: ref,
    createdBy: String,
    ...timestamps,
  },
  [{ orgId: 1, projectId: 1, startsAt: -1 }]
);

export const Conversation = model("Conversation", {
  orgId,
  type: { type: String, enum: CONVERSATION_TYPES },
  projectId: ref,
  memberIds: [String],
  createdAt: String,
});

export const Message = model(
  "Message",
  { orgId, conversationId: { type: String, required: true }, authorId: String, body: String, mentions: [String], editedAt: ref, deletedAt: ref, createdAt: String },
  [{ orgId: 1, conversationId: 1, createdAt: 1 }]
);

export const ReadState = model("ReadState", { orgId, userId: String, conversationId: String, lastReadAt: String });

export const Notification = model(
  "Notification",
  {
    orgId,
    userId: String,
    type: { type: String, enum: NOTIFICATION_TYPES },
    targetType: String,
    targetId: String,
    text: ref,
    readAt: ref,
    createdAt: String,
  },
  [{ orgId: 1, userId: 1, createdAt: -1 }]
);

export const COLLECTION_MODELS = {
  users: User,
  invites: Invite,
  projects: Project,
  tasks: Task,
  meetings: Meeting,
  conversations: Conversation,
  messages: Message,
  readStates: ReadState,
  notifications: Notification,
};
