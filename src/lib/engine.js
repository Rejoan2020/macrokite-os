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
import { FORMER_MEMBER, taskPriority } from "./constants";
import { DEFAULT_PHASES, nextPhaseIn, phaseName, projectPhases } from "./phases";
import { parseMentions } from "./text";
import { conversationMemberIds, readStateId } from "./selectors";
import { pluralize } from "./format";
import { canChooseLeads, canCreateProject, canEditPhases, canManageProject, canEditTask, canManageTasks, canSetTaskStatus, projectLeadIds, TASK_DETAIL_FIELDS } from "./permissions";

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
      tx.create("notifications", "ntf", { userId, actorId: ctx.userId, type, targetType, targetId, text, readAt: null, createdAt: now });
    },
  };
  return tx;
}

const projectOf = (tx, task) => tx.state.projects.find((p) => p._id === task.projectId);

function requireTaskManager(tx, project) {
  if (!canManageTasks(project, tx.me())) throw new DomainError("Only this project’s leads or an admin can create and assign its tasks.", { status: 403 });
}

function requireTaskEdit(tx, task) {
  if (!canEditTask(task, tx.me(), projectOf(tx, task))) throw new DomainError("Only this project’s leads or an admin can change this task.", { status: 403 });
}

function requireTaskStatus(tx, task) {
  if (!canSetTaskStatus(task, tx.me(), projectOf(tx, task))) {
    throw new DomainError("Only the assignee, this project’s leads or an admin can change this task’s status.", { status: 403 });
  }
}

/** A project's phases from form input: names trimmed and unique, new phases given ids. */
function buildPhases(ctx, list) {
  const seenNames = new Set();
  const seenIds = new Set();
  return list.map((phase, i) => {
    const key = phase.name.toLowerCase();
    if (seenNames.has(key)) throw new DomainError("Each phase needs a different name.", { fieldErrors: { phases: `“${phase.name}” is used twice`, [`phases.${i}.name`]: "Already used" } });
    seenNames.add(key);
    const _id = phase._id && !seenIds.has(phase._id) ? phase._id : ctx.newId("phs");
    seenIds.add(_id);
    return { _id, name: phase.name };
  });
}

function requirePhaseOf(project, phase, field = "phase") {
  if (!projectPhases(project).some((p) => p._id === phase)) {
    throw new DomainError("Choose one of the project’s phases.", { fieldErrors: { [field]: "Choose one of this project’s phases" } });
  }
}

function requireProjectManager(tx, project) {
  if (!canManageProject(project, tx.me())) throw new DomainError("Only this project’s leads or an admin can change it.", { status: 403 });
}

/** Leads must be project members; anyone who leaves the project stops being a lead. */
const leadsAmong = (leadIds, memberIds) => leadIds.filter((id) => memberIds.includes(id));

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

const taskThreadFor = (tx, taskId) => tx.state.conversations.find((c) => c.type === "task" && c.taskId === taskId);

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

/**
 * New phases for a project edit. Only admins may change them, and a phase can't be removed while
 * it's the current phase or still has tasks.
 */
function updatedPhases(tx, ctx, current, input) {
  const phases = buildPhases(ctx, input.phases);
  const before = projectPhases(current);
  const changed = phases.length !== before.length || phases.some((p, i) => p._id !== before[i]._id || p.name !== before[i].name);
  if (!changed) return current.phases ?? phases;
  if (!canEditPhases(tx.me())) throw new DomainError("Only admins can change a project’s phases.", { status: 403, fieldErrors: { phases: "Only admins can change this" } });
  const kept = new Set(phases.map((p) => p._id));
  for (const removed of before.filter((p) => !kept.has(p._id))) {
    if ((input.phase ?? current.phase) === removed._id) {
      throw new DomainError(`“${removed.name}” is the current phase, so it can’t be removed.`, { fieldErrors: { phases: `Move the project out of “${removed.name}” first` } });
    }
    const left = tx.state.tasks.filter((t) => t.projectId === current._id && t.phase === removed._id).length;
    if (left) {
      throw new DomainError(`“${removed.name}” still has ${pluralize(left, "task")}, so it can’t be removed.`, { fieldErrors: { phases: `Move the ${pluralize(left, "task")} in “${removed.name}” to another phase first` } });
    }
  }
  return phases;
}

const handlers = {
  // --------------------------------------------------------------- projects
  "project.create"(tx, ctx, { data }) {
    if (!canCreateProject(tx.me())) throw new DomainError("Only admins can create projects.", { status: 403 });
    const input = parse(projectInput, data);
    const phases = input.phases ? buildPhases(ctx, input.phases) : DEFAULT_PHASES.map((p) => ({ ...p }));
    const phase = input.phase ?? phases[0]._id;
    requirePhaseOf({ phases }, phase);
    const memberIds = activeUserIds(tx, [...new Set([ctx.userId, ...input.memberIds])], "memberIds");
    // The admin creating it chooses the leads; without a choice, they lead it themselves.
    const leadIds = data?.leadIds ? leadsAmong(input.leadIds, memberIds) : [ctx.userId];
    const project = tx.create("projects", "prj", {
      ...input,
      phases,
      phase,
      memberIds,
      leadIds,
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
    // Anyone may edit the notes; every other change needs a lead or an admin.
    const same = (key) => JSON.stringify(input[key] ?? null) === JSON.stringify(current[key] ?? null);
    if (Object.keys(data ?? {}).some((key) => key !== "notes" && key in input && !same(key))) requireProjectManager(tx, current);
    const memberIds = activeUserIds(tx, input.memberIds, "memberIds", current.memberIds);
    if (!memberIds.length) throw new DomainError("A project needs at least one member.", { fieldErrors: { memberIds: "Add at least one member" } });
    const before = projectLeadIds(current);
    if (data?.leadIds && (input.leadIds.length !== before.length || input.leadIds.some((id) => !before.includes(id))) && !canChooseLeads(tx.me())) {
      throw new DomainError("Only admins can choose a project’s leads.", { status: 403, fieldErrors: { leadIds: "Only admins can change this" } });
    }
    const leadIds = leadsAmong(data?.leadIds ? input.leadIds : before, memberIds);
    const phases = data?.phases ? updatedPhases(tx, ctx, current, input) : current.phases;
    const phase = input.phase ?? current.phase;
    requirePhaseOf({ phases }, phase);
    const project = tx.put("projects", { ...current, ...input, phases, phase, memberIds, leadIds, updatedAt: tx.now });
    const conversation = conversationFor(tx, id);
    if (conversation) tx.put("conversations", { ...conversation, memberIds });
    return project;
  },
  "project.advance"(tx, ctx, { id }) {
    const current = tx.find("projects", id, "Project");
    requireProjectManager(tx, current);
    const next = nextPhaseIn(current, current.phase);
    if (!next) throw new DomainError(`${phaseName(current, current.phase)} is the last phase.`);
    return tx.put("projects", { ...current, phase: next._id, updatedAt: tx.now });
  },
  "project.hold"(tx, ctx, { id, data }) {
    const current = tx.find("projects", id, "Project");
    requireProjectManager(tx, current);
    return tx.put("projects", { ...current, onHold: Boolean(data?.onHold), updatedAt: tx.now });
  },
  "project.archive"(tx, ctx, { id, data }) {
    const current = tx.find("projects", id, "Project");
    requireProjectManager(tx, current);
    if (current.isInternal) throw new DomainError("The company-wide project can’t be archived.");
    return tx.put("projects", { ...current, archived: Boolean(data?.archived), updatedAt: tx.now });
  },

  // ------------------------------------------------------------------ tasks
  "task.create"(tx, ctx, { data }) {
    const project = data?.projectId ? tx.state.projects.find((p) => p._id === data.projectId) : null;
    const input = parse(taskInput, { phase: project?.phase, assigneeId: ctx.userId, status: "todo", ...data });
    const target = findProject(tx, input.projectId);
    requireTaskManager(tx, target);
    requirePhaseOf(target, input.phase);
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
    const before = { ...current, priority: taskPriority(current) };
    if (TASK_DETAIL_FIELDS.some((field) => (input[field] ?? "") !== (before[field] ?? ""))) requireTaskEdit(tx, current);
    if (input.projectId !== current.projectId) requireTaskManager(tx, findProject(tx, input.projectId));
    if (input.phase !== current.phase || input.projectId !== current.projectId) requirePhaseOf(findProject(tx, input.projectId), input.phase);
    if (input.status !== current.status) requireTaskStatus(tx, current);
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
    requireTaskStatus(tx, current);
    const done = Boolean(data?.done);
    return tx.put("tasks", { ...current, status: done ? "done" : "todo", completedAt: done ? tx.now : null, updatedAt: tx.now });
  },
  "task.delete"(tx, ctx, { id }) {
    requireTaskEdit(tx, tx.find("tasks", id, "Task"));
    tx.remove("tasks", [id]);
    // The task's discussion goes with it.
    const thread = taskThreadFor(tx, id);
    if (thread) {
      const messageIds = new Set(tx.state.messages.filter((m) => m.conversationId === thread._id).map((m) => m._id));
      tx.remove("notifications", tx.state.notifications.filter((n) => n.targetType === "message" && messageIds.has(n.targetId)).map((n) => n._id));
      tx.remove("readStates", tx.state.readStates.filter((r) => r.conversationId === thread._id).map((r) => r._id));
      tx.remove("messages", [...messageIds]);
      tx.remove("conversations", [thread._id]);
    }
    return { _id: id };
  },
  /**
   * Adds a comment to a task's discussion, creating it with the first comment. Mentions work as in
   * chat; the assignee, the task's creator and earlier commenters are notified as well.
   */
  "task.comment"(tx, ctx, { id, data }) {
    const task = tx.find("tasks", id, "Task");
    const { body } = parse(messageInput, data);
    const earlier = taskThreadFor(tx, id);
    const thread = earlier ?? tx.create("conversations", "cnv", { type: "task", projectId: task.projectId, taskId: id, memberIds: [], createdAt: tx.now });
    const commenters = earlier ? tx.state.messages.filter((m) => m.conversationId === earlier._id).map((m) => m.authorId) : [];
    const message = postMessage(tx, ctx, thread, body);
    const following = new Set([task.assigneeId, task.createdBy, ...commenters]);
    for (const userId of following) {
      if (!message.mentions.includes(userId)) tx.notify(userId, "taskComment", "message", message._id);
    }
    return message;
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
    // Task discussions also notify the people following the task.
    if (conversation.type === "task") return handlers["task.comment"](tx, ctx, { id: conversation.taskId, data });
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
  "notification.readAll"(tx, ctx) {
    const unread = tx.state.notifications.filter((n) => n.userId === ctx.userId && !n.readAt);
    for (const n of unread) tx.put("notifications", { ...n, readAt: tx.now });
    return { count: unread.length };
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
      tx.put("projects", { ...project, memberIds, leadIds: leadsAmong(projectLeadIds(project), memberIds), updatedAt: tx.now });
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
