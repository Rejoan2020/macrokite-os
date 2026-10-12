import "server-only";
import mongoose, { Schema } from "mongoose";
import {
  CLIENT_STATUSES,
  PRIORITIES,
  PROJECT_STATUSES,
  ROLES,
  TASK_STATUSES,
  VISIBILITIES,
} from "../constants";

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
  indexes.forEach((index) => schema.index(index));
  return mongoose.model(name, schema);
}

export const Organization = model("Organization", {
  name: String,
  slug: { type: String, unique: true },
  description: String,
  preferences: Schema.Types.Mixed,
  ...timestamps,
});

export const User = model("User", {
  name: String,
  email: { type: String, unique: true },
  title: String,
  bio: String,
  timezone: String,
  avatarColor: String,
  ...timestamps,
});

export const Membership = model(
  "Membership",
  { orgId, userId: { type: String, required: true }, role: { type: String, enum: ROLES }, joinedAt: String },
  [{ orgId: 1, userId: 1 }]
);

export const Client = model("Client", {
  orgId,
  name: String,
  company: String,
  email: String,
  phone: String,
  status: { type: String, enum: CLIENT_STATUSES },
  service: String,
  notes: String,
  createdBy: String,
  ...timestamps,
});

export const Project = model(
  "Project",
  {
    orgId,
    clientId: ref,
    name: String,
    description: String,
    status: { type: String, enum: PROJECT_STATUSES },
    priority: { type: String, enum: PRIORITIES },
    startDate: String,
    deadline: String,
    memberIds: [String],
    createdBy: String,
    ...timestamps,
  },
  [{ orgId: 1, clientId: 1 }]
);

export const Task = model(
  "Task",
  {
    orgId,
    projectId: ref,
    title: String,
    description: String,
    status: { type: String, enum: TASK_STATUSES },
    priority: { type: String, enum: PRIORITIES },
    assigneeId: ref,
    dueDate: String,
    labels: [String],
    order: Number,
    createdBy: String,
    completedAt: { type: String, default: null },
    ...timestamps,
  },
  [{ orgId: 1, projectId: 1 }, { orgId: 1, assigneeId: 1 }]
);

export const Conversation = model("Conversation", {
  orgId,
  subject: String,
  visibility: { type: String, enum: VISIBILITIES },
  clientId: ref,
  projectId: ref,
  createdBy: String,
  lastMessageAt: String,
  lastReadAt: Schema.Types.Mixed,
  createdAt: String,
});

export const Message = model(
  "Message",
  { orgId, conversationId: { type: String, required: true }, authorType: String, authorId: String, body: String, createdAt: String },
  [{ orgId: 1, conversationId: 1, createdAt: 1 }]
);

export const Activity = model(
  "Activity",
  { orgId, actorId: String, verb: String, entityType: String, entityId: ref, summary: String, clientId: ref, projectId: ref, createdAt: String },
  [{ orgId: 1, createdAt: -1 }]
);

export const COLLECTION_MODELS = {
  memberships: Membership,
  clients: Client,
  projects: Project,
  tasks: Task,
  conversations: Conversation,
  messages: Message,
  activities: Activity,
};
