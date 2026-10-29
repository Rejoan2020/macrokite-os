import "server-only";
import mongoose, { Schema } from "mongoose";
import { CONVERSATION_TYPES, NOTIFICATION_TYPES, ROLES, TASK_PRIORITIES, TASK_SOURCES, TASK_STATUSES } from "../constants";

// String ids keep identifiers identical across demo mode and database mode.
// Every business collection carries an indexed orgId; all queries filter on it.

const options = { versionKey: false, minimize: false };
const id = { type: String, required: true };
const orgId = { type: String, required: true, index: true };
const ref = { type: String, default: null };
const timestamps = { createdAt: String, updatedAt: String };

function model(name, definition, indexes = []) {
  // `next dev` re-runs this module when code changes. Rebuild the model instead of reusing the cached
  // one, or schema changes (new enum values, new fields) are rejected or dropped until a restart.
  if (mongoose.models[name]) mongoose.deleteModel(name);
  const schema = new Schema({ _id: id, ...definition }, options);
  indexes.forEach((index) => (Array.isArray(index) ? schema.index(...index) : schema.index(index)));
  return mongoose.model(name, schema);
}

export const Organization = model("Organization", {
  name: String,
  callUrl: String,
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
    deletedAt: ref, // set when an admin deletes the member; the record stays as "Former member"
    notificationPrefs: Schema.Types.Mixed,
    ...timestamps,
  },
  [[{ orgId: 1, email: 1 }, { unique: true }], { authId: 1 }, { email: 1 }]
);

// workosInvitationId: the emailed WorkOS invitation, so it can be resent or revoked.
export const Invite = model("Invite", { orgId, email: String, invitedBy: String, createdAt: String, sentAt: String, acceptedAt: ref, workosInvitationId: ref }, [
  { email: 1, acceptedAt: 1 },
]);

export const Client = model("Client", { orgId, name: String, description: String, memberIds: [String], createdBy: String, ...timestamps });

// A project's own phases, in order. Missing on older projects, which use the standard seven.
const Phase = new Schema({ _id: String, name: String }, { _id: false });

export const Project = model("Project", {
  orgId,
  name: String,
  description: String,
  phase: String, // one of the project's phase ids
  phases: { type: [Phase], default: undefined },
  onHold: Boolean,
  archived: Boolean,
  deadline: String,
  memberIds: [String],
  leadIds: [String], // create and assign this project's tasks; chosen by admins
  notes: String,
  isInternal: Boolean,
  clientId: ref, // null: a company project
  createdBy: String,
  ...timestamps,
});

export const Task = model(
  "Task",
  {
    orgId,
    projectId: { type: String, required: true },
    phase: String, // one of its project's phase ids
    title: String,
    description: String, // optional; missing on older tasks
    assigneeIds: [String],
    assigneeId: String, // tasks saved before several assignees; read as assigneeIds
    status: { type: String, enum: TASK_STATUSES },
    priority: { type: String, enum: TASK_PRIORITIES }, // missing on older tasks: treated as medium
    dueDate: String,
    source: { type: String, enum: TASK_SOURCES },
    meetingId: ref,
    messageId: ref,
    completedAt: ref,
    createdBy: String,
    ...timestamps,
  },
  [{ orgId: 1, projectId: 1 }, { orgId: 1, assigneeIds: 1 }]
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
    reminders: { type: Schema.Types.Mixed, default: undefined }, // { [userId]: minutes before }
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
  taskId: ref, // for a task's discussion
  name: String, // for a group
  memberIds: [String],
  createdBy: String,
  createdAt: String,
});

// A file sent in a message; the file itself is in Vercel Blob storage at pathname.
const Attachment = new Schema({ pathname: String, name: String, size: Number, contentType: String, width: Number, height: Number }, { _id: false });

export const Message = model(
  "Message",
  // event: a change logged in a task's activity ("changed status from **To do** to **Done**"); body is empty.
  {
    orgId,
    conversationId: { type: String, required: true },
    authorId: String,
    body: String,
    attachments: [Attachment],
    event: ref,
    mentions: [String],
    editedAt: ref,
    deletedAt: ref,
    createdAt: String,
  },
  [{ orgId: 1, conversationId: 1, createdAt: 1 }]
);

export const ReadState = model("ReadState", { orgId, userId: String, conversationId: String, lastReadAt: String });

export const Notification = model(
  "Notification",
  {
    orgId,
    userId: String,
    actorId: ref, // who caused it
    type: { type: String, enum: NOTIFICATION_TYPES },
    targetType: String,
    targetId: String,
    text: ref,
    readAt: ref,
    createdAt: String,
  },
  [{ orgId: 1, userId: 1, createdAt: -1 }, { orgId: 1, targetId: 1 }]
);

export const COLLECTION_MODELS = {
  users: User,
  invites: Invite,
  clients: Client,
  projects: Project,
  tasks: Task,
  meetings: Meeting,
  conversations: Conversation,
  messages: Message,
  readStates: ReadState,
  notifications: Notification,
};
