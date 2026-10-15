import {
  fieldErrorsFrom,
  inviteInput,
  lineInput,
  meetingInput,
  messageInput,
  profileInput,
  projectInput,
  roleInput,
  taskInput,
  workspaceInput,
} from "./schemas";
import { FORMER_MEMBER, nextPhase, phaseLabel } from "./constants";
import { parseMentions } from "./text";
import { conversationMemberIds, readStateId } from "./selectors";
import { pluralize } from "./format";

/**
 * The domain engine applies one action to an organization snapshot.
 *
 * It is pure: given the same snapshot, action and context it produces a new snapshot plus a
 * changeset describing which documents were written or removed. Demo mode keeps the new snapshot
 * in the browser; database mode persists the changeset to MongoDB. Both modes therefore share the
 * same validation, organization scoping, permissions, reference checks and notifications.
 *
 * Snapshot: { org, users, invites, projects, tasks, meetings, conversations, messages, readStates, notifications }
 * Action:   { type, id?, data? }
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

export const COLLECTIONS = ["users", "invites", "projects", "tasks", "meetings", "conversations", "messages", "readStates", "notifications"];

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
  const now = ctx.now.toISOString();

  const tx = {
    state,
    changes,
    now,
    find(collection, id, label = "Record") {
      const doc = typeof id === "string" ? state[collection].find((d) => d._id === id) : undefined;
      // Records are always loaded per organization; the orgId check is defence in depth.
      if (!doc || doc.orgId !== ctx.orgId) throw new DomainError(`${label} not found.`, { status: 404 });
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
    create(collection, prefix, fields) {
      return tx.put(collection, { _id: ctx.newId(prefix), orgId: ctx.orgId, ...fields });
    },
    me: () => state.users.find((u) => u._id === ctx.userId),
    notify(userId, type, targetType, targetId, text) {
      if (userId === ctx.userId) return;
      const user = state.users.find((u) => u._id === userId);
      if (!user?.active) return;
      tx.create("notifications", "ntf", { userId, type, targetType, targetId, text, readAt: null, createdAt: now });
    },
  };
  return tx;
}

function requireAdmin(tx) {
  if (tx.me()?.role !== "admin") throw new DomainError("Only admins can do that.", { status: 403 });
}

/** Checks that people being added are active members. Ids in `kept` were already there and may stay. */
function activeUserIds(tx, ids, field, kept = []) {
  const active = new Set(tx.state.users.filter((u) => u.active).map((u) => u._id));
  const unknown = ids.find((id) => !active.has(id) && !kept.includes(id));
  if (unknown) throw new DomainError("Pick people who are on the team.", { fieldErrors: { [field]: "Someone selected is not an active team member" } });
  return ids;
}

function findProject(tx, id, field = "projectId") {
  const project = tx.state.projects.find((p) => p._id === id);
  if (!project) throw new DomainError("Project not found.", { fieldErrors: { [field]: "Choose an existing project" } });
  return project;
}

function conversationFor(tx, projectId) {
  return tx.state.conversations.find((c) => c.type === "project" && c.projectId === projectId);
}

function markRead(tx, conversationId, userId) {
  const _id = readStateId(conversationId, userId);
  tx.put("readStates", { _id, orgId: tx.state.org._id, userId, conversationId, lastReadAt: tx.now });
}

function updateMeeting(tx, id, change) {
  const meeting = tx.find("meetings", id, "Meeting");
  return tx.put("meetings", { ...meeting, ...change(meeting), updatedAt: tx.now });
}

function findItem(list, itemId, label) {
  if (!list.some((i) => i._id === itemId)) throw new DomainError(`${label} not found.`, { status: 404 });
}

function postMessage(tx, ctx, conversation, body) {
  const members = tx.state.users.filter((u) => conversationMemberIds(conversation, tx.state).includes(u._id) && u.active);
  const mentions = parseMentions(body, members).filter((id) => id !== ctx.userId);
  const message = tx.create("messages", "msg", {
    conversationId: conversation._id,
    authorId: ctx.userId,
    body,
    mentions,
    editedAt: null,
    deletedAt: null,
    createdAt: tx.now,
  });
  mentions.forEach((userId) => tx.notify(userId, "mention", "message", message._id));
  if (conversation.type === "dm") {
    const other = conversation.memberIds.find((id) => id !== ctx.userId);
    if (!mentions.includes(other)) tx.notify(other, "dm", "message", message._id);
  }
  markRead(tx, conversation._id, ctx.userId);
  return message;
}

const handlers = {
  // --------------------------------------------------------------- projects
  "project.create"(tx, ctx, { data }) {
    const input = parse(projectInput, { phase: "idea", ...data });
    const memberIds = activeUserIds(tx, [...new Set([ctx.userId, ...input.memberIds])], "memberIds");
    const project = tx.create("projects", "prj", {
      ...input,
      memberIds,
      onHold: false,
      archived: false,
      isInternal: false,
      createdBy: ctx.userId,
      createdAt: tx.now,
      updatedAt: tx.now,
    });
    tx.create("conversations", "cnv", { type: "project", projectId: project._id, memberIds, createdAt: tx.now });
    return project;
  },
  "project.update"(tx, ctx, { id, data }) {
    const current = tx.find("projects", id, "Project");
    const input = parse(projectInput, { ...current, ...data });
    const memberIds = activeUserIds(tx, input.memberIds, "memberIds", current.memberIds);
    if (!memberIds.length) throw new DomainError("A project needs at least one member.", { fieldErrors: { memberIds: "Add at least one member" } });
    const project = tx.put("projects", { ...current, ...input, memberIds, updatedAt: tx.now });
    const conversation = conversationFor(tx, id);
    if (conversation) tx.put("conversations", { ...conversation, memberIds });
    return project;
  },
  "project.advance"(tx, ctx, { id }) {
    const current = tx.find("projects", id, "Project");
    const phase = nextPhase(current.phase);
    if (!phase) throw new DomainError(`${phaseLabel(current.phase)} is the last phase.`);
    return tx.put("projects", { ...current, phase, updatedAt: tx.now });
  },
  "project.hold"(tx, ctx, { id, data }) {
    const current = tx.find("projects", id, "Project");
    return tx.put("projects", { ...current, onHold: Boolean(data?.onHold), updatedAt: tx.now });
  },
  "project.archive"(tx, ctx, { id, data }) {
    const current = tx.find("projects", id, "Project");
    if (current.isInternal) throw new DomainError("The Internal project can’t be archived.");
    return tx.put("projects", { ...current, archived: Boolean(data?.archived), updatedAt: tx.now });
  },

  // ------------------------------------------------------------------ tasks
  "task.create"(tx, ctx, { data }) {
    const project = data?.projectId ? tx.state.projects.find((p) => p._id === data.projectId) : null;
    const input = parse(taskInput, { phase: project?.phase, assigneeId: ctx.userId, status: "todo", ...data });
    findProject(tx, input.projectId);
    activeUserIds(tx, [input.assigneeId], "assigneeId");
    let meeting = null;
    if (input.meetingId) {
      meeting = tx.find("meetings", input.meetingId, "Meeting");
      if (meeting.projectId !== input.projectId) throw new DomainError("Action items belong to the meeting’s project.");
    }
    if (input.messageId) tx.find("messages", input.messageId, "Message");
    const task = tx.create("tasks", "tsk", {
      ...input,
      source: meeting ? "meeting" : input.messageId ? "message" : "manual",
      completedAt: input.status === "done" ? tx.now : null,
      createdBy: ctx.userId,
      createdAt: tx.now,
      updatedAt: tx.now,
    });
    // Action items from a running meeting are announced in one batch when the meeting ends.
    if (!meeting || meeting.endedAt) tx.notify(task.assigneeId, "assignment", "task", task._id);
    return task;
  },
  "task.update"(tx, ctx, { id, data }) {
    const current = tx.find("tasks", id, "Task");
    const input = parse(taskInput, { ...current, ...data });
    findProject(tx, input.projectId);
    activeUserIds(tx, [input.assigneeId], "assigneeId", [current.assigneeId]);
    const task = tx.put("tasks", {
      ...current,
      ...input,
      source: current.source,
      meetingId: current.meetingId,
      messageId: current.messageId,
      completedAt: input.status === "done" ? current.completedAt ?? tx.now : null,
      updatedAt: tx.now,
    });
    if (task.assigneeId !== current.assigneeId) tx.notify(task.assigneeId, "assignment", "task", task._id);
    return task;
  },
  "task.toggle"(tx, ctx, { id, data }) {
    const current = tx.find("tasks", id, "Task");
    const done = Boolean(data?.done);
    return tx.put("tasks", { ...current, status: done ? "done" : "todo", completedAt: done ? tx.now : null, updatedAt: tx.now });
  },
  "task.delete"(tx, ctx, { id }) {
    tx.find("tasks", id, "Task");
    tx.remove("tasks", [id]);
    return { _id: id };
  },

  // --------------------------------------------------------------- meetings
  "meeting.create"(tx, ctx, { data }) {
    const input = parse(meetingInput, data);
    findProject(tx, input.projectId);
    activeUserIds(tx, input.attendeeIds, "attendeeIds");
    const meeting = tx.create("meetings", "mtg", {
      ...input,
      agenda: [],
      decisions: [],
      endedAt: null,
      createdBy: ctx.userId,
      createdAt: tx.now,
      updatedAt: tx.now,
    });
    input.attendeeIds.forEach((userId) => tx.notify(userId, "meetingInvite", "meeting", meeting._id));
    return meeting;
  },
  "meeting.update"(tx, ctx, { id, data }) {
    const current = tx.find("meetings", id, "Meeting");
    const input = parse(meetingInput, { ...current, ...data });
    findProject(tx, input.projectId);
    activeUserIds(tx, input.attendeeIds, "attendeeIds", current.attendeeIds);
    if (input.projectId !== current.projectId && tx.state.tasks.some((t) => t.meetingId === id)) {
      throw new DomainError("This meeting already has action items, so its project can’t change.", { fieldErrors: { projectId: "Fixed once action items exist" } });
    }
    const meeting = tx.put("meetings", { ...current, ...input, updatedAt: tx.now });
    input.attendeeIds
      .filter((userId) => !current.attendeeIds.includes(userId))
      .forEach((userId) => tx.notify(userId, "meetingInvite", "meeting", id));
    return meeting;
  },
  "meeting.delete"(tx, ctx, { id }) {
    tx.find("meetings", id, "Meeting");
    // Action items stay as ordinary tasks.
    for (const task of tx.state.tasks.filter((t) => t.meetingId === id)) tx.put("tasks", { ...task, meetingId: null, updatedAt: tx.now });
    tx.remove("meetings", [id]);
    return { _id: id };
  },
  "agenda.add"(tx, ctx, { id, data }) {
    const { text } = parse(lineInput("Topic", 200), data);
    return updateMeeting(tx, id, (m) => ({ agenda: [...m.agenda, { _id: ctx.newId("agd"), title: text, covered: false }] }));
  },
  "agenda.toggle"(tx, ctx, { id, data }) {
    return updateMeeting(tx, id, (m) => {
      findItem(m.agenda, data?.itemId, "Topic");
      return { agenda: m.agenda.map((i) => (i._id === data.itemId ? { ...i, covered: !i.covered } : i)) };
    });
  },
  "agenda.remove"(tx, ctx, { id, data }) {
    return updateMeeting(tx, id, (m) => {
      findItem(m.agenda, data?.itemId, "Topic");
      return { agenda: m.agenda.filter((i) => i._id !== data.itemId) };
    });
  },
  "decision.add"(tx, ctx, { id, data }) {
    const { text } = parse(lineInput("Decision", 500), data);
    return updateMeeting(tx, id, (m) => ({
      decisions: [...m.decisions, { _id: ctx.newId("dec"), text, createdBy: ctx.userId, createdAt: tx.now }],
    }));
  },
  "decision.remove"(tx, ctx, { id, data }) {
    return updateMeeting(tx, id, (m) => {
      findItem(m.decisions, data?.itemId, "Decision");
      return { decisions: m.decisions.filter((d) => d._id !== data.itemId) };
    });
  },
  "meeting.end"(tx, ctx, { id }) {
    const current = tx.find("meetings", id, "Meeting");
    if (current.endedAt) throw new DomainError("This meeting has already ended.");
    const meeting = tx.put("meetings", { ...current, endedAt: tx.now, updatedAt: tx.now });
    const byAssignee = {};
    for (const task of tx.state.tasks.filter((t) => t.meetingId === id)) (byAssignee[task.assigneeId] ??= []).push(task);
    let notified = 0;
    for (const [userId, tasks] of Object.entries(byAssignee)) {
      if (userId === ctx.userId) continue;
      tx.notify(userId, "assignment", "meeting", id, `You got ${pluralize(tasks.length, "action item")} from ${meeting.title}`);
      notified += 1;
    }
    return { ...meeting, notified };
  },

  // ---------------------------------------------------------- conversations
  "conversation.read"(tx, ctx, { id }) {
    const conversation = tx.find("conversations", id, "Conversation");
    markRead(tx, id, ctx.userId);
    const messageIds = new Set(tx.state.messages.filter((m) => m.conversationId === id).map((m) => m._id));
    for (const n of tx.state.notifications) {
      if (n.userId === ctx.userId && !n.readAt && n.targetType === "message" && messageIds.has(n.targetId)) {
        tx.put("notifications", { ...n, readAt: tx.now });
      }
    }
    return conversation;
  },
  "message.create"(tx, ctx, { id, data }) {
    const conversation = tx.find("conversations", id, "Conversation");
    if (conversation.type === "dm" && !conversation.memberIds.includes(ctx.userId)) {
      throw new DomainError("Conversation not found.", { status: 404 });
    }
    const { body } = parse(messageInput, data);
    return postMessage(tx, ctx, conversation, body);
  },
  "dm.send"(tx, ctx, { data }) {
    const { body } = parse(messageInput, data);
    const otherId = data?.userId;
    if (otherId === ctx.userId) throw new DomainError("You can’t message yourself.");
    activeUserIds(tx, [otherId], "userId");
    const conversation =
      tx.state.conversations.find((c) => c.type === "dm" && c.memberIds.includes(ctx.userId) && c.memberIds.includes(otherId)) ??
      tx.create("conversations", "cnv", { type: "dm", projectId: null, memberIds: [ctx.userId, otherId], createdAt: tx.now });
    return postMessage(tx, ctx, conversation, body);
  },
  "notification.read"(tx, ctx, { id }) {
    const n = tx.find("notifications", id, "Notification");
    if (n.userId !== ctx.userId) throw new DomainError("Notification not found.", { status: 404 });
    return tx.put("notifications", { ...n, readAt: n.readAt ?? tx.now });
  },

  // ------------------------------------------------------------------- team
  "member.invite"(tx, ctx, { data }) {
    requireAdmin(tx);
    const { email } = parse(inviteInput, data);
    // A deleted member's record is kept for history; inviting the same email brings them back to it.
    if (tx.state.users.some((u) => u.email === email && !u.deletedAt)) throw new DomainError("That person is already on the team.", { fieldErrors: { email: "Already on the team" } });
    if (tx.state.invites.some((i) => i.email === email && !i.acceptedAt)) throw new DomainError("That email already has a pending invite.", { fieldErrors: { email: "Already invited" } });
    return tx.create("invites", "inv", { email, invitedBy: ctx.userId, createdAt: tx.now, sentAt: tx.now, acceptedAt: null });
  },
  "invite.resend"(tx, ctx, { id }) {
    requireAdmin(tx);
    const invite = tx.find("invites", id, "Invite");
    return tx.put("invites", { ...invite, invitedBy: ctx.userId, sentAt: tx.now });
  },
  "invite.cancel"(tx, ctx, { id }) {
    requireAdmin(tx);
    tx.find("invites", id, "Invite");
    tx.remove("invites", [id]);
    return { _id: id };
  },
  "member.role"(tx, ctx, { id, data }) {
    requireAdmin(tx);
    if (id === ctx.userId) throw new DomainError("You can’t change your own role.");
    const user = tx.find("users", id, "Member");
    const { role } = parse(roleInput, data);
    return tx.put("users", { ...user, role, updatedAt: tx.now });
  },
  "member.active"(tx, ctx, { id, data }) {
    requireAdmin(tx);
    if (id === ctx.userId) throw new DomainError("You can’t remove yourself.");
    const user = tx.find("users", id, "Member");
    if (user.deletedAt) throw new DomainError("This member was deleted. Invite them again instead.");
    return tx.put("users", { ...user, active: Boolean(data?.active), updatedAt: tx.now });
  },
  /**
   * Permanently deletes a removed member. Their personal details, notifications and read state go,
   * and they leave every project. A nameless record stays so tasks, messages and decisions show
   * "Former member"; it keeps the email so a new invite to that address restores their history.
   */
  "member.delete"(tx, ctx, { id }) {
    requireAdmin(tx);
    if (id === ctx.userId) throw new DomainError("You can’t delete yourself.");
    const user = tx.find("users", id, "Member");
    if (user.active) throw new DomainError("Remove this member before deleting them.");
    if (user.deletedAt) throw new DomainError("This member was already deleted.");
    for (const project of tx.state.projects.filter((p) => p.memberIds.includes(id))) {
      const memberIds = project.memberIds.filter((uid) => uid !== id);
      tx.put("projects", { ...project, memberIds, updatedAt: tx.now });
      const conversation = conversationFor(tx, project._id);
      if (conversation) tx.put("conversations", { ...conversation, memberIds });
    }
    tx.remove("notifications", tx.state.notifications.filter((n) => n.userId === id).map((n) => n._id));
    tx.remove("readStates", tx.state.readStates.filter((r) => r.userId === id).map((r) => r._id));
    return tx.put("users", {
      _id: user._id,
      orgId: user.orgId,
      authId: null,
      name: FORMER_MEMBER,
      email: user.email,
      avatarUrl: "",
      avatarColor: user.avatarColor,
      role: "member",
      active: false,
      deletedAt: tx.now,
      notificationPrefs: {},
      createdAt: user.createdAt,
      updatedAt: tx.now,
    });
  },

  // ------------------------------------------------------ workspace/profile
  "workspace.update"(tx, ctx, { data }) {
    requireAdmin(tx);
    const input = parse(workspaceInput, data);
    return tx.put("org", { ...tx.state.org, ...input, updatedAt: tx.now });
  },
  "profile.update"(tx, ctx, { data }) {
    const current = tx.me();
    const input = parse(profileInput, { ...current, ...data });
    return tx.put("users", { ...current, ...input, updatedAt: tx.now });
  },
};

export const ACTION_TYPES = Object.keys(handlers);

export function applyAction(snapshot, action, ctx) {
  const handler = handlers[action?.type];
  if (!handler) throw new DomainError(`Unknown action “${action?.type}”.`);
  if (!snapshot?.org || snapshot.org._id !== ctx.orgId) throw new DomainError("Workspace not found.", { status: 404 });
  if (!snapshot.users.some((u) => u._id === ctx.userId && u.active)) throw new DomainError("You are not an active member of this workspace.", { status: 403 });
  const tx = createTx(snapshot, ctx);
  const result = handler(tx, ctx, { id: action.id, data: action.data ?? {} });
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
