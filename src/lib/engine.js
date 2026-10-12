import {
  clientInput,
  conversationInput,
  fieldErrorsFrom,
  messageInput,
  profileInput,
  projectInput,
  taskInput,
  taskMoveInput,
  workspaceInput,
} from "./schemas";
import { CLIENT_STATUS_META, PROJECT_STATUS_META, TASK_STATUS_META } from "./constants";

/**
 * The domain engine applies one action to an organization snapshot.
 *
 * It is pure: given the same snapshot, action and context it produces a new snapshot plus a
 * changeset describing which documents were written or removed. Demo mode keeps the new snapshot
 * in the browser; database mode persists the changeset to MongoDB. Both modes therefore share the
 * same validation, organization scoping, reference checks, cascades and activity log.
 *
 * Snapshot: { org, users, memberships, clients, projects, tasks, conversations, messages, activities }
 * Context:  { orgId, userId, now: Date, newId(prefix) } — always supplied by the trusted runtime,
 *           never by request payloads.
 */

export class DomainError extends Error {
  constructor(message, { status = 400, fieldErrors } = {}) {
    super(message);
    this.name = "DomainError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export const COLLECTIONS = ["users", "memberships", "clients", "projects", "tasks", "conversations", "messages", "activities"];

const MAX_ACTIVITIES = 200;

function parse(schema, input) {
  const result = schema.safeParse(input ?? {});
  if (!result.success) {
    throw new DomainError("Please fix the highlighted fields.", { fieldErrors: fieldErrorsFrom(result.error) });
  }
  return result.data;
}

function createTx(snapshot, ctx) {
  const state = { ...snapshot };
  const changes = { put: {}, del: {} };

  const tx = {
    state,
    changes,
    find(collection, id, label = "Record") {
      const doc = typeof id === "string" ? state[collection].find((d) => d._id === id) : undefined;
      // Records are always loaded per organization; the orgId check is defence in depth.
      if (!doc || (doc.orgId && doc.orgId !== ctx.orgId)) {
        throw new DomainError(`${label} not found.`, { status: 404 });
      }
      return doc;
    },
    put(collection, doc) {
      if (collection === "org") {
        state.org = doc;
        changes.org = doc;
        return doc;
      }
      const list = state[collection];
      const index = list.findIndex((d) => d._id === doc._id);
      state[collection] = index === -1 ? [...list, doc] : list.map((d, i) => (i === index ? doc : d));
      (changes.put[collection] ??= []).push(doc);
      return doc;
    },
    remove(collection, ids) {
      const set = new Set(ids);
      if (!set.size) return;
      state[collection] = state[collection].filter((d) => !set.has(d._id));
      (changes.del[collection] ??= []).push(...set);
    },
    log(verb, entityType, entity, summary, context = {}) {
      const activity = {
        _id: ctx.newId("act"),
        orgId: ctx.orgId,
        actorId: ctx.userId,
        verb,
        entityType,
        entityId: entity?._id ?? null,
        summary,
        clientId: context.clientId ?? null,
        projectId: context.projectId ?? null,
        createdAt: ctx.now.toISOString(),
      };
      tx.put("activities", activity);
      const sorted = [...state.activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      tx.remove("activities", sorted.slice(MAX_ACTIVITIES).map((a) => a._id));
    },
  };
  return tx;
}

function assertMember(tx, userId, label) {
  if (!userId) return;
  if (!tx.state.memberships.some((m) => m.userId === userId && m.orgId === tx.state.org._id)) {
    throw new DomainError(`${label} must be a member of this workspace.`, {
      fieldErrors: { [label === "Assignee" ? "assigneeId" : "memberIds"]: `${label} is not a workspace member` },
    });
  }
}

function assertReference(tx, collection, id, field, label) {
  if (!id) return null;
  const doc = tx.state[collection].find((d) => d._id === id && d.orgId === tx.state.org._id);
  if (!doc) throw new DomainError(`${label} not found in this workspace.`, { fieldErrors: { [field]: `Choose an existing ${label.toLowerCase()}` } });
  return doc;
}

const nextOrder = (tasks, status) =>
  tasks.filter((t) => t.status === status).reduce((max, t) => Math.max(max, t.order ?? 0), 0) + 1;

const handlers = {
  // ---------------------------------------------------------------- clients
  "client.create"(tx, ctx, { data }) {
    const input = parse(clientInput, data);
    const now = ctx.now.toISOString();
    const client = tx.put("clients", { _id: ctx.newId("cli"), orgId: ctx.orgId, ...input, createdBy: ctx.userId, createdAt: now, updatedAt: now });
    tx.log("created", "client", client, `added client ${client.company}`, { clientId: client._id });
    return client;
  },
  "client.update"(tx, ctx, { id, data }) {
    const current = tx.find("clients", id, "Client");
    const input = parse(clientInput, { ...current, ...data });
    const client = tx.put("clients", { ...current, ...input, updatedAt: ctx.now.toISOString() });
    const summary =
      current.status !== client.status
        ? `marked ${client.company} as ${CLIENT_STATUS_META[client.status].label.toLowerCase()}`
        : `updated client ${client.company}`;
    tx.log("updated", "client", client, summary, { clientId: client._id });
    return client;
  },
  "client.delete"(tx, ctx, { id }) {
    const client = tx.find("clients", id, "Client");
    const projectIds = tx.state.projects.filter((p) => p.clientId === id).map((p) => p._id);
    removeProjects(tx, projectIds);
    removeConversations(tx, tx.state.conversations.filter((c) => c.clientId === id).map((c) => c._id));
    tx.remove("clients", [id]);
    tx.log("deleted", "client", null, `deleted client ${client.company}`);
    return { _id: id };
  },

  // --------------------------------------------------------------- projects
  "project.create"(tx, ctx, { data }) {
    const input = parse(projectInput, data);
    validateProjectRefs(tx, input);
    const now = ctx.now.toISOString();
    const project = tx.put("projects", { _id: ctx.newId("prj"), orgId: ctx.orgId, ...input, createdBy: ctx.userId, createdAt: now, updatedAt: now });
    tx.log("created", "project", project, `created project ${project.name}`, { clientId: project.clientId, projectId: project._id });
    return project;
  },
  "project.update"(tx, ctx, { id, data }) {
    const current = tx.find("projects", id, "Project");
    const input = parse(projectInput, { ...current, ...data });
    validateProjectRefs(tx, input);
    const project = tx.put("projects", { ...current, ...input, updatedAt: ctx.now.toISOString() });
    const summary =
      current.status !== project.status
        ? `moved ${project.name} to ${PROJECT_STATUS_META[project.status].label}`
        : `updated project ${project.name}`;
    tx.log("updated", "project", project, summary, { clientId: project.clientId, projectId: project._id });
    // Conversations follow their project's client so client-facing context stays accurate.
    for (const c of tx.state.conversations.filter((c) => c.projectId === id && c.clientId !== project.clientId)) {
      tx.put("conversations", { ...c, clientId: project.clientId, visibility: project.clientId ? c.visibility : "internal" });
    }
    return project;
  },
  "project.delete"(tx, ctx, { id }) {
    const project = tx.find("projects", id, "Project");
    removeProjects(tx, [id]);
    tx.log("deleted", "project", null, `deleted project ${project.name}`, { clientId: project.clientId });
    return { _id: id };
  },

  // ------------------------------------------------------------------ tasks
  "task.create"(tx, ctx, { data }) {
    const input = parse(taskInput, data);
    const project = validateTaskRefs(tx, input);
    const now = ctx.now.toISOString();
    const task = tx.put("tasks", {
      _id: ctx.newId("tsk"),
      orgId: ctx.orgId,
      ...input,
      order: nextOrder(tx.state.tasks, input.status),
      createdBy: ctx.userId,
      completedAt: input.status === "done" ? now : null,
      createdAt: now,
      updatedAt: now,
    });
    tx.log("created", "task", task, `created task ${task.title}`, { clientId: project?.clientId, projectId: task.projectId });
    return task;
  },
  "task.update"(tx, ctx, { id, data }) {
    const current = tx.find("tasks", id, "Task");
    const input = parse(taskInput, { ...current, ...data });
    const project = validateTaskRefs(tx, input);
    const statusChanged = input.status !== current.status;
    const task = tx.put("tasks", {
      ...current,
      ...input,
      order: statusChanged ? nextOrder(tx.state.tasks, input.status) : current.order,
      completedAt: input.status === "done" ? current.completedAt ?? ctx.now.toISOString() : null,
      updatedAt: ctx.now.toISOString(),
    });
    logTaskChange(tx, current, task, project);
    return task;
  },
  "task.move"(tx, ctx, { id, data }) {
    const current = tx.find("tasks", id, "Task");
    const { status, beforeId } = parse(taskMoveInput, data);
    const column = tx.state.tasks.filter((t) => t.status === status && t._id !== id).sort((a, b) => a.order - b.order);
    let order = nextOrder(column, status);
    const index = beforeId ? column.findIndex((t) => t._id === beforeId) : -1;
    if (index !== -1) {
      const prev = column[index - 1]?.order ?? column[index].order - 1;
      order = (prev + column[index].order) / 2;
    }
    const task = tx.put("tasks", {
      ...current,
      status,
      order,
      completedAt: status === "done" ? current.completedAt ?? ctx.now.toISOString() : null,
      updatedAt: ctx.now.toISOString(),
    });
    const project = task.projectId ? tx.state.projects.find((p) => p._id === task.projectId) : null;
    if (current.status !== status) logTaskChange(tx, current, task, project);
    return task;
  },
  "task.delete"(tx, ctx, { id }) {
    const task = tx.find("tasks", id, "Task");
    tx.remove("tasks", [id]);
    const project = task.projectId ? tx.state.projects.find((p) => p._id === task.projectId) : null;
    tx.log("deleted", "task", null, `deleted task ${task.title}`, { clientId: project?.clientId, projectId: task.projectId });
    return { _id: id };
  },

  // ---------------------------------------------------------- conversations
  "conversation.create"(tx, ctx, { data }) {
    const input = parse(conversationInput, data);
    const project = assertReference(tx, "projects", input.projectId, "projectId", "Project");
    if (project?.clientId && input.clientId && project.clientId !== input.clientId) {
      throw new DomainError("That project belongs to a different client.", { fieldErrors: { projectId: "Project belongs to a different client" } });
    }
    const clientId = input.clientId ?? project?.clientId ?? null;
    assertReference(tx, "clients", clientId, "clientId", "Client");
    if (input.visibility === "client" && !clientId) {
      throw new DomainError("Client-facing threads need a client.", { fieldErrors: { clientId: "Choose a client for a client-facing thread" } });
    }
    const now = ctx.now.toISOString();
    const conversation = tx.put("conversations", {
      _id: ctx.newId("cnv"),
      orgId: ctx.orgId,
      subject: input.subject,
      visibility: input.visibility,
      clientId,
      projectId: input.projectId,
      createdBy: ctx.userId,
      lastMessageAt: now,
      lastReadAt: { [ctx.userId]: now },
      createdAt: now,
    });
    tx.put("messages", { _id: ctx.newId("msg"), orgId: ctx.orgId, conversationId: conversation._id, authorType: "member", authorId: ctx.userId, body: input.body, createdAt: now });
    tx.log("created", "conversation", conversation, `started ${input.visibility === "client" ? "client thread" : "internal thread"} “${conversation.subject}”`, { clientId, projectId: input.projectId });
    return conversation;
  },
  "conversation.read"(tx, ctx, { id }) {
    const current = tx.find("conversations", id, "Conversation");
    return tx.put("conversations", { ...current, lastReadAt: { ...current.lastReadAt, [ctx.userId]: ctx.now.toISOString() } });
  },
  "conversation.delete"(tx, ctx, { id }) {
    const conversation = tx.find("conversations", id, "Conversation");
    removeConversations(tx, [id]);
    tx.log("deleted", "conversation", null, `deleted thread “${conversation.subject}”`, { clientId: conversation.clientId, projectId: conversation.projectId });
    return { _id: id };
  },
  "message.create"(tx, ctx, { conversationId, data }) {
    const current = tx.find("conversations", conversationId, "Conversation");
    const input = parse(messageInput, data);
    if (input.authorType === "client" && current.visibility !== "client") {
      throw new DomainError("Client messages can only be logged on client-facing threads.");
    }
    const now = ctx.now.toISOString();
    const message = tx.put("messages", {
      _id: ctx.newId("msg"),
      orgId: ctx.orgId,
      conversationId,
      authorType: input.authorType,
      // Logged client messages are recorded by a member; the client is identified via the thread.
      authorId: ctx.userId,
      body: input.body,
      createdAt: now,
    });
    tx.put("conversations", { ...current, lastMessageAt: now, lastReadAt: { ...current.lastReadAt, [ctx.userId]: now } });
    tx.log(
      "replied",
      "conversation",
      current,
      input.authorType === "client" ? `logged a client reply in “${current.subject}”` : `replied in “${current.subject}”`,
      { clientId: current.clientId, projectId: current.projectId }
    );
    return message;
  },

  // ------------------------------------------------------ workspace/profile
  "workspace.update"(tx, ctx, { data }) {
    const input = parse(workspaceInput, data);
    const org = tx.put("org", { ...tx.state.org, ...input, updatedAt: ctx.now.toISOString() });
    tx.log("updated", "workspace", org, "updated workspace settings");
    return org;
  },
  "profile.update"(tx, ctx, { data }) {
    const current = tx.find("users", ctx.userId, "User");
    const input = parse(profileInput, data);
    return tx.put("users", { ...current, ...input, updatedAt: ctx.now.toISOString() });
  },
};

function validateProjectRefs(tx, input) {
  assertReference(tx, "clients", input.clientId, "clientId", "Client");
  input.memberIds = [...new Set(input.memberIds)];
  input.memberIds.forEach((id) => assertMember(tx, id, "Team member"));
}

function validateTaskRefs(tx, input) {
  assertMember(tx, input.assigneeId, "Assignee");
  return assertReference(tx, "projects", input.projectId, "projectId", "Project");
}

function logTaskChange(tx, before, task, project) {
  const context = { clientId: project?.clientId, projectId: task.projectId };
  if (before.status !== task.status) {
    const verb = task.status === "done" ? "completed" : "moved";
    const summary = task.status === "done" ? `completed ${task.title}` : `moved ${task.title} to ${TASK_STATUS_META[task.status].label}`;
    tx.log(verb, "task", task, summary, context);
  } else if (before.assigneeId !== task.assigneeId && task.assigneeId) {
    const assignee = tx.state.users.find((u) => u._id === task.assigneeId);
    tx.log("assigned", "task", task, `assigned ${task.title} to ${assignee?.name ?? "a teammate"}`, context);
  } else {
    tx.log("updated", "task", task, `updated task ${task.title}`, context);
  }
}

function removeProjects(tx, projectIds) {
  if (!projectIds.length) return;
  const ids = new Set(projectIds);
  tx.remove("tasks", tx.state.tasks.filter((t) => ids.has(t.projectId)).map((t) => t._id));
  removeConversations(tx, tx.state.conversations.filter((c) => ids.has(c.projectId)).map((c) => c._id));
  tx.remove("projects", projectIds);
}

function removeConversations(tx, conversationIds) {
  if (!conversationIds.length) return;
  const ids = new Set(conversationIds);
  tx.remove("messages", tx.state.messages.filter((m) => ids.has(m.conversationId)).map((m) => m._id));
  tx.remove("conversations", conversationIds);
}

/** Records that would be removed alongside a client or project — shown in delete confirmations. */
export function deletionImpact(snapshot, entityType, id) {
  const projectIds = entityType === "client" ? snapshot.projects.filter((p) => p.clientId === id).map((p) => p._id) : [id];
  const set = new Set(projectIds);
  const conversations = snapshot.conversations.filter((c) => set.has(c.projectId) || (entityType === "client" && c.clientId === id));
  return {
    projects: entityType === "client" ? projectIds.length : 0,
    tasks: snapshot.tasks.filter((t) => set.has(t.projectId)).length,
    conversations: conversations.length,
  };
}

export function applyAction(snapshot, action, ctx) {
  const handler = handlers[action?.type];
  if (!handler) throw new DomainError(`Unknown action “${action?.type}”.`);
  if (!snapshot?.org || snapshot.org._id !== ctx.orgId) throw new DomainError("Workspace not found.", { status: 404 });
  const tx = createTx(snapshot, ctx);
  const result = handler(tx, ctx, action);
  return { state: tx.state, changes: tx.changes, result };
}

/** Applies a changeset returned by the server to the browser's copy of the snapshot. */
export function applyChanges(snapshot, changes) {
  const next = { ...snapshot };
  if (changes.org) next.org = changes.org;
  for (const [collection, docs] of Object.entries(changes.put ?? {})) {
    const byId = new Map(docs.map((d) => [d._id, d]));
    const existing = next[collection].map((d) => byId.get(d._id) ?? d);
    const known = new Set(next[collection].map((d) => d._id));
    next[collection] = [...existing, ...[...byId.values()].filter((d) => !known.has(d._id))];
  }
  for (const [collection, ids] of Object.entries(changes.del ?? {})) {
    const set = new Set(ids);
    next[collection] = next[collection].filter((d) => !set.has(d._id));
  }
  return next;
}
