// Domain engine checks. Run: npm test
import assert from "node:assert/strict";
import { applyAction, applyChanges, COLLECTIONS, DomainError } from "../src/lib/engine.js";
import { buildSeed, SEED_ORG_ID, SEED_OWNER_ID } from "../src/lib/seed.js";
import { groupMyTasks, stillOpenFromLast, unreadByConversation } from "../src/lib/selectors.js";
import { addDaysISO, todayISO } from "../src/lib/format.js";
import { mentionHandle, mentionSuggestions, parseActionItem, parseDay, parseMentions, socialLink, tokenize } from "../src/lib/text.js";
import { canCreateWorkspace, matchMembers, newWorkspace, pickMembership, rejoinedMember, renamedCompanyProject } from "../src/lib/membership.js";
import { notificationEmails } from "../src/lib/emails.js";
import { myNotifications } from "../src/lib/notifications.js";
import { COMPANY_PROJECT, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS } from "../src/lib/constants.js";
import { attachmentFolder, messagePreview } from "../src/lib/attachments.js";
import { normalizeSnapshot } from "../src/lib/compat.js";
import { actionReads } from "../src/lib/reads.js";
import { pendingAction, withPending } from "../src/lib/client/storage.js";
import { keepLoadedHistory, MESSAGE_PAGE, newestMessages, olderPage, recentMessages, withOlderMessages } from "../src/lib/history.js";

let n = 0;
const ctx = { orgId: SEED_ORG_ID, userId: SEED_OWNER_ID, now: new Date(), newId: (p) => `${p}_t${++n}` };
let state = buildSeed(new Date());

// The subset of MongoDB filters actionReads uses: equality (null also matches a missing field), $in and $or.
const matchesFilter = (doc, filter) =>
  Object.entries(filter).every(([key, cond]) => {
    if (key === "$or") return cond.some((f) => matchesFilter(doc, f));
    const value = doc[key] ?? null;
    return cond !== null && typeof cond === "object" ? cond.$in.includes(value) : value === cond;
  });

/** The snapshot as database mode loads it for an action: only the messages and notifications it reads. */
function scopedFor(full, action, userId) {
  const scoped = { ...full, messages: [], notifications: [] };
  for (const [name, filter] of actionReads(action, userId)) {
    const query = typeof filter === "function" ? filter(scoped) : filter;
    if (query) scoped[name] = full[name].filter((d) => matchesFilter(d, query));
  }
  return scoped;
}

const run = (action, context = ctx) => {
  const start = n;
  const out = applyAction(state, action, context);
  // The changeset must reproduce the same state (this is what database mode persists).
  const replayed = applyChanges(state, out.changes);
  for (const key of COLLECTIONS) {
    assert.deepEqual(replayed[key], out.state[key], `changeset mismatch in ${key}`);
  }
  // Database mode loads only what the action reads; that must give the same changes and result.
  const end = n;
  n = start;
  const scoped = applyAction(scopedFor(state, action, context.userId), action, context);
  assert.deepEqual(scoped.changes, out.changes, `${action.type}: changes differ when loading only what it reads`);
  assert.deepEqual(scoped.result, out.result, `${action.type}: result differs when loading only what it reads`);
  assert.equal(n, end);
  state = out.state;
  return out.result;
};
const fails = (action, check, context = ctx) => {
  try {
    applyAction(state, action, context);
  } catch (e) {
    assert.ok(e instanceof DomainError, e);
    check?.(e);
    return;
  }
  assert.fail(`expected ${action.type} to fail`);
};
const as = (userId) => ({ ...ctx, userId });
const test = (name, fn) => {
  fn();
  console.log("ok -", name);
};
const today = todayISO();

test("seed is consistent", () => {
  const ids = new Set(state.projects.map((p) => p._id));
  assert.equal(state.projects.filter((p) => p.isInternal).length, 1, "exactly one Internal project");
  assert.ok(state.tasks.every((t) => ids.has(t.projectId) && t.assigneeIds.length), "every task has a project and assignee");
  assert.ok(state.projects.every((p) => state.conversations.some((c) => c.type === "project" && c.projectId === p._id)), "every project has a channel");
  const unread = unreadByConversation(state, SEED_OWNER_ID);
  assert.equal(unread.cnv_general.count, 4);
  assert.equal(unread.cnv_general.mentioned, true);
  assert.equal(unread.cnv_jajabor.count, 2);
  assert.equal(unread.cnv_dm_tanvir.count, 1);
  assert.equal(unread.cnv_dm_sara, undefined);
});

let project;
test("projects: create with channel, advance phase, hold, archive", () => {
  fails({ type: "project.create", data: { name: "" } }, (e) => assert.ok(e.fieldErrors.name));
  fails({ type: "project.create", data: { name: "P", memberIds: ["usr_intruder"] } }, (e) => assert.ok(e.fieldErrors.memberIds));
  project = run({ type: "project.create", data: { name: "Launchpad", description: "One line", memberIds: ["usr_sara"], orgId: "org_evil" } });
  assert.equal(project.orgId, SEED_ORG_ID, "orgId comes from context, not payload");
  assert.equal(project.phase, "idea");
  assert.deepEqual(project.memberIds.sort(), ["usr_alex", "usr_sara"], "creator is always a member");
  assert.ok(state.conversations.some((c) => c.type === "project" && c.projectId === project._id));
  assert.equal(run({ type: "project.advance", id: project._id }).phase, "planning");
  run({ type: "project.hold", id: project._id, data: { onHold: true } });
  assert.equal(state.projects.find((p) => p._id === project._id).onHold, true);
  fails({ type: "project.archive", id: "prj_internal", data: { archived: true } });
  const finished = run({ type: "project.update", id: project._id, data: { phase: "maintain" } });
  fails({ type: "project.advance", id: finished._id });
  run({ type: "project.update", id: project._id, data: { phase: "planning" } });
});

test("tasks: defaults, toggle, assignment notifications", () => {
  fails({ type: "task.create", data: { title: "No project" } }, (e) => assert.ok(e.fieldErrors.projectId));
  fails({ type: "task.create", data: { title: "X", projectId: project._id, assigneeIds: ["usr_nobody"] } }, (e) => assert.ok(e.fieldErrors.assigneeIds));
  const mine = run({ type: "task.create", data: { title: "Mine", projectId: project._id } });
  assert.deepEqual(mine.assigneeIds, [SEED_OWNER_ID], "assignee defaults to me");
  assert.equal(mine.phase, "planning", "phase defaults to the project's phase");
  assert.equal(mine.status, "todo");
  const before = state.notifications.length;
  const theirs = run({ type: "task.create", data: { title: "Theirs", projectId: project._id, assigneeIds: ["usr_sara"], dueDate: "2000-01-01" } });
  assert.equal(state.notifications.length, before + 1);
  assert.equal(state.notifications.at(-1).userId, "usr_sara");
  run({ type: "task.toggle", id: theirs._id, data: { done: true } });
  assert.ok(state.tasks.find((t) => t._id === theirs._id).completedAt);
  run({ type: "task.toggle", id: theirs._id, data: { done: false } });
  assert.equal(state.tasks.find((t) => t._id === theirs._id).completedAt, null);
  const doing = run({ type: "task.update", id: mine._id, data: { status: "doing", dueDate: today } });
  assert.equal(doing.status, "doing");
  assert.ok(groupMyTasks(state.tasks.filter((t) => t._id === mine._id), today).today.length === 1);
  fails({ type: "task.update", id: "tsk_missing", data: {} }, (e) => assert.equal(e.status, 404));
  run({ type: "task.delete", id: mine._id });
});

let meeting;
test("meetings: agenda, decisions, action items, end notifies once per person", () => {
  const startsAt = new Date(Date.now() + 3600_000).toISOString();
  meeting = run({ type: "meeting.create", data: { projectId: project._id, title: "Kickoff", startsAt, attendeeIds: ["usr_alex", "usr_sara"] } });
  assert.ok(state.notifications.some((x) => x.userId === "usr_sara" && x.type === "meetingInvite" && x.targetId === meeting._id));
  fails({ type: "meeting.create", data: { projectId: project._id, title: "Bad", startsAt: "nope" } }, (e) => assert.ok(e.fieldErrors.startsAt));
  fails({ type: "meeting.create", data: { projectId: project._id, title: "Bad", startsAt, callUrl: "javascript:alert(1)" } }, (e) => assert.ok(e.fieldErrors.callUrl));

  run({ type: "agenda.add", id: meeting._id, data: { text: "Scope" } });
  const topic = state.meetings.find((m) => m._id === meeting._id).agenda[0];
  run({ type: "agenda.toggle", id: meeting._id, data: { itemId: topic._id } });
  assert.equal(state.meetings.find((m) => m._id === meeting._id).agenda[0].covered, true);
  fails({ type: "agenda.add", id: meeting._id, data: { text: " " } });
  run({ type: "decision.add", id: meeting._id, data: { text: "Ship in two releases" } });
  assert.equal(state.meetings.find((m) => m._id === meeting._id).decisions.length, 1);

  const notesBefore = state.notifications.length;
  run({ type: "task.create", data: { projectId: project._id, meetingId: meeting._id, title: "A", assigneeIds: ["usr_sara"] } });
  run({ type: "task.create", data: { projectId: project._id, meetingId: meeting._id, title: "B", assigneeIds: ["usr_sara"] } });
  run({ type: "task.create", data: { projectId: project._id, meetingId: meeting._id, title: "C" } });
  assert.equal(state.notifications.length, notesBefore, "action items are announced when the meeting ends");
  assert.ok(state.tasks.filter((t) => t.meetingId === meeting._id).every((t) => t.source === "meeting"));
  fails({ type: "task.create", data: { projectId: "prj_jajabor", meetingId: meeting._id, title: "Wrong project" } });

  const ended = run({ type: "meeting.end", id: meeting._id });
  assert.equal(ended.notified, 1);
  const batch = state.notifications.slice(notesBefore);
  assert.equal(batch.length, 1);
  assert.equal(batch[0].text, "You got 2 action items from Kickoff");
  fails({ type: "meeting.end", id: meeting._id });

  // The next meeting surfaces what is still open from this one.
  const next = run({ type: "meeting.create", data: { projectId: project._id, title: "Follow-up", startsAt: new Date(Date.now() + 86_400_000).toISOString() } });
  assert.equal(stillOpenFromLast(next, state).length, 3);
  run({ type: "meeting.delete", id: next._id });
});

test("conversations: mentions, DMs, read state", () => {
  const general = state.conversations.find((c) => c.type === "general");
  const message = run({ type: "message.create", id: general._id, data: { body: "Hey @sara and @Tanvir, see https://example.com" } }, as("usr_nadia"));
  assert.deepEqual(message.mentions.sort(), ["usr_sara", "usr_tanvir"]);
  assert.ok(state.notifications.some((x) => x.userId === "usr_sara" && x.type === "mention" && x.targetId === message._id));
  assert.equal(unreadByConversation(state, "usr_nadia")[general._id], undefined, "author has read their own message");

  const dm = run({ type: "dm.send", data: { userId: "usr_sara", body: "ping" } });
  assert.equal(dm.conversationId, "cnv_dm_sara", "reuses the existing DM");
  const fresh = run({ type: "dm.send", data: { userId: "usr_tanvir", body: "hi" } }, as("usr_nadia"));
  const conv = state.conversations.find((c) => c._id === fresh.conversationId);
  assert.deepEqual(conv.memberIds.sort(), ["usr_nadia", "usr_tanvir"]);
  assert.ok(state.notifications.some((x) => x.userId === "usr_tanvir" && x.type === "dm"));
  fails({ type: "message.create", id: conv._id, data: { body: "snoop" } }, (e) => assert.equal(e.status, 404));
  fails({ type: "dm.send", data: { userId: SEED_OWNER_ID, body: "me" } });

  assert.equal(unreadByConversation(state, "usr_tanvir")[conv._id].count, 1);
  run({ type: "conversation.read", id: conv._id }, as("usr_tanvir"));
  assert.equal(unreadByConversation(state, "usr_tanvir")[conv._id], undefined);
  assert.ok(state.notifications.filter((x) => x.userId === "usr_tanvir" && x.targetId === fresh._id).every((x) => x.readAt));
});

test("team: admin-only invites, roles and deactivation", () => {
  fails({ type: "member.invite", data: { email: "x@y.dev" } }, (e) => assert.equal(e.status, 403), as("usr_sara"));
  fails({ type: "member.invite", data: { email: "sara@macrokite.dev" } }, (e) => assert.ok(e.fieldErrors.email));
  fails({ type: "member.invite", data: { email: "rafi@macrokite.dev" } }, (e) => assert.ok(e.fieldErrors.email));
  const invite = run({ type: "member.invite", data: { email: "New@Macrokite.dev" } });
  assert.equal(invite.email, "new@macrokite.dev");
  run({ type: "invite.resend", id: invite._id });
  run({ type: "invite.cancel", id: invite._id });
  fails({ type: "member.role", id: SEED_OWNER_ID, data: { role: "member" } });
  assert.equal(run({ type: "member.role", id: "usr_sara", data: { role: "admin" } }).role, "admin");
  run({ type: "member.active", id: "usr_nadia", data: { active: false } });
  fails({ type: "task.create", data: { title: "X", projectId: project._id, assigneeIds: ["usr_nadia"] } });
  fails({ type: "dm.send", data: { userId: "usr_alex", body: "hi" } }, (e) => assert.equal(e.status, 403), as("usr_nadia"));
  run({ type: "member.active", id: "usr_nadia", data: { active: true } });
  run({ type: "member.role", id: "usr_sara", data: { role: "member" } });
});

test("workspace + profile; foreign org rejected", () => {
  fails({ type: "workspace.update", data: { name: "" } });
  fails({ type: "workspace.update", data: { name: "X" } }, (e) => assert.equal(e.status, 403), as("usr_sara"));
  run({ type: "workspace.update", data: { name: "Macrokite Studio" } });
  // The drop-in call link saves on its own and keeps the name; only full links are accepted.
  run({ type: "workspace.update", data: { callUrl: "https://meet.google.com/abc-defg-hij" } });
  assert.equal(state.org.name, "Macrokite Studio");
  assert.equal(state.org.callUrl, "https://meet.google.com/abc-defg-hij");
  fails({ type: "workspace.update", data: { callUrl: "meet.google.com/x" } }, (e) => assert.ok(e.fieldErrors.callUrl));
  fails({ type: "workspace.update", data: { callUrl: "https://x.com" } }, (e) => assert.equal(e.status, 403), as("usr_sara"));
  run({ type: "workspace.update", data: { name: "Macrokite Studio 2" } });
  assert.equal(state.org.callUrl, "https://meet.google.com/abc-defg-hij", "renaming keeps the link");
  run({ type: "workspace.update", data: { name: "Macrokite Studio" } });
  assert.equal(state.org.name, "Macrokite Studio");
  run({ type: "profile.update", data: { name: "Alex M.", notificationPrefs: { assignment: false, meetingInvite: true } } });
  const me = state.users.find((u) => u._id === SEED_OWNER_ID);
  assert.equal(me.name, "Alex M.");
  assert.deepEqual(me.notificationPrefs, { assignment: false, meetingInvite: true });
  assert.equal(me.role, "admin", "profile updates cannot change role");
  fails({ type: "profile.update", data: { avatarUrl: "ftp://x" } }, (e) => assert.ok(e.fieldErrors.avatarUrl));
  assert.throws(() => applyAction(state, { type: "task.delete", id: "tsk_j1" }, { ...ctx, orgId: "org_other" }), DomainError);
});

test("text parsing: action items, days, mentions, links", () => {
  const people = state.users;
  const mon = parseDay("mon", "2026-10-14"); // a Wednesday
  assert.equal(mon, "2026-10-19");
  assert.equal(parseDay("fri", "2026-10-14"), "2026-10-16");
  assert.equal(parseDay("wed", "2026-10-14"), "2026-10-21", "same weekday means next week");
  assert.equal(parseDay("tomorrow", "2026-10-14"), "2026-10-15");
  assert.equal(parseDay("Oct 21", "2026-10-14"), "2026-10-21");
  assert.equal(parseDay("3 jan", "2026-10-14"), "2027-01-03");
  assert.equal(parseDay("in 3 days", today), addDaysISO(today, 3));
  assert.equal(parseDay("someday", today), null);

  const ok = parseActionItem("Create prod database @Alex fri", people, "2026-10-14");
  assert.deepEqual(ok, { title: "Create prod database", assigneeId: "usr_alex", dueDate: "2026-10-16", problems: {} });
  assert.equal(parseActionItem("No owner", people).problems.assignee, "missing");
  assert.equal(parseActionItem("Thing @Zed", people).problems.assignee, "unknown:Zed");
  assert.equal(parseActionItem("Thing @tan whenever", people).problems.day, "whenever");
  assert.equal(parseActionItem("Thing @tan", people).assigneeId, "usr_tanvir", "unique prefix matches");

  assert.deepEqual(parseMentions("email a@b.com, @nobody", people), []);
  assert.deepEqual(tokenize("hi @Sara see https://x.dev/a.", people).map((p) => p.type), ["text", "mention", "text", "link", "text"]);
  assert.equal(socialLink("https://www.instagram.com/p/abc/").platform, "Instagram");
  assert.equal(socialLink("https://m.facebook.com/x/posts/1").platform, "Facebook");
  assert.equal(socialLink("https://example.com"), null);
});

test("notification list: who, what, where, and mark all read", () => {
  let inbox = buildSeed(new Date());
  let k = 0;
  const act = (action, userId = SEED_OWNER_ID) => {
    const out = applyAction(inbox, action, { orgId: SEED_ORG_ID, userId, now: new Date(Date.now() + ++k * 1000), newId: (p) => `${p}_n${k}` });
    inbox = out.state;
    return out.result;
  };
  const before = myNotifications(inbox, "usr_sara").length;
  act({ type: "message.create", id: "cnv_jajabor", data: { body: "@Sara review please" } });
  act({ type: "task.create", data: { title: "Fix login", projectId: "prj_jajabor", assigneeIds: ["usr_sara"] } });
  const mine = myNotifications(inbox, "usr_sara");
  assert.equal(mine.length, before + 2);
  assert.deepEqual(mine[0].view, { actorId: "usr_alex", text: "Alex Morgan assigned you a task", detail: "Fix login", href: `/tasks/${mine[0].targetId}` }, "newest first");
  assert.equal(mine[1].view.text, "Alex Morgan mentioned you in # Jajabor");
  assert.equal(mine[1].view.href, "/projects/prj_jajabor");
  assert.equal(mine[0].actorId, "usr_alex", "notifications record who caused them");

  assert.ok(mine.some((n) => !n.readAt));
  act({ type: "notification.readAll" }, "usr_sara");
  assert.ok(myNotifications(inbox, "usr_sara").every((n) => n.readAt));
  assert.ok(inbox.notifications.some((n) => n.userId !== "usr_sara" && !n.readAt), "only your own are marked read");
});

test("task permissions: project leads and admins manage tasks, the assignee only moves status", () => {
  // Jajabor: Sara (member) leads it; Tanvir is a member; Alex is an admin; Nadia isn't in the project.
  const forbidden = (e) => assert.equal(e.status, 403);
  fails({ type: "task.create", data: { title: "Self-assigned", projectId: "prj_jajabor", assigneeIds: ["usr_tanvir"] } }, forbidden, as("usr_tanvir"));
  fails({ type: "task.create", data: { title: "Elsewhere", projectId: "prj_storefront", assigneeIds: ["usr_sara"] } }, forbidden, as("usr_sara"));
  const task = run({ type: "task.create", data: { title: "Draft copy", projectId: "prj_jajabor", assigneeIds: ["usr_tanvir"] } }, as("usr_sara"));
  fails({ type: "task.update", id: task._id, data: { projectId: "prj_storefront" } }, forbidden, as("usr_sara"));

  fails({ type: "task.update", id: task._id, data: { title: "Renamed" } }, forbidden, as("usr_tanvir"));
  fails({ type: "task.update", id: task._id, data: { dueDate: today } }, forbidden, as("usr_tanvir"));
  fails({ type: "task.update", id: task._id, data: { assigneeIds: ["usr_sara"] } }, forbidden, as("usr_tanvir"));
  fails({ type: "task.update", id: task._id, data: { priority: "high" } }, forbidden, as("usr_tanvir"));
  fails({ type: "task.update", id: task._id, data: { description: "Rewritten" } }, forbidden, as("usr_tanvir"));
  assert.equal(task.description, "", "the description is optional");
  assert.equal(task.priority, "medium", "new tasks default to medium priority");
  fails({ type: "task.delete", id: task._id }, forbidden, as("usr_tanvir"));
  assert.equal(run({ type: "task.update", id: task._id, data: { status: "doing" } }, as("usr_tanvir")).status, "doing", "the assignee moves the status");
  assert.equal(run({ type: "task.toggle", id: task._id, data: { done: true } }, as("usr_tanvir")).status, "done");
  // Saving the full form unchanged except for status is allowed too.
  const { _id, orgId, createdAt, updatedAt, completedAt, createdBy, source, ...form } = state.tasks.find((t) => t._id === task._id);
  assert.equal(run({ type: "task.update", id: task._id, data: { ...form, status: "todo" } }, as("usr_tanvir")).status, "todo");

  fails({ type: "task.toggle", id: task._id, data: { done: true } }, forbidden, as("usr_nadia"));
  fails({ type: "task.update", id: task._id, data: { title: "Mine now" } }, forbidden, as("usr_nadia"));
  run({ type: "task.comment", id: task._id, data: { body: "Can I help?" } }, as("usr_nadia"));

  assert.equal(run({ type: "task.update", id: task._id, data: { title: "Draft landing copy" } }, as("usr_sara")).title, "Draft landing copy", "the lead edits");
  assert.equal(run({ type: "task.update", id: task._id, data: { dueDate: today } }).dueDate, today, "admins edit");
  assert.equal(run({ type: "task.update", id: task._id, data: { priority: "high" } }, as("usr_sara")).priority, "high");
  assert.equal(run({ type: "task.update", id: task._id, data: { description: "  Hero, pricing and FAQ sections  " } }, as("usr_sara")).description, "Hero, pricing and FAQ sections", "trimmed");
  fails({ type: "task.update", id: task._id, data: { description: "x".repeat(5001) } }, (e) => assert.ok(e.fieldErrors.description), as("usr_sara"));
  // Tasks saved before descriptions existed can still have their status moved by the assignee.
  state = { ...state, tasks: state.tasks.map((t) => (t._id === task._id ? { ...t, description: undefined } : t)) };
  assert.equal(run({ type: "task.update", id: task._id, data: { status: "todo" } }, as("usr_tanvir")).status, "todo");
  // A task saved before priorities existed can still have its status moved by the assignee.
  state = { ...state, tasks: state.tasks.map((t) => (t._id === task._id ? { ...t, priority: undefined } : t)) };
  assert.equal(run({ type: "task.update", id: task._id, data: { status: "doing" } }, as("usr_tanvir")).status, "doing");
  run({ type: "task.delete", id: task._id }, as("usr_sara"));

  // Leads: chosen by admins, always project members, and gone when they leave the project.
  fails({ type: "project.update", id: "prj_jajabor", data: { leadIds: ["usr_sara", "usr_tanvir"] } }, forbidden, as("usr_sara"));
  run({ type: "project.update", id: "prj_jajabor", data: { name: "Jajabor" } }, as("usr_sara"));
  assert.deepEqual(state.projects.find((p) => p._id === "prj_jajabor").leadIds, ["usr_sara"], "saving without leads keeps them");
  run({ type: "project.update", id: "prj_jajabor", data: { leadIds: ["usr_tanvir", "usr_nadia"] } });
  assert.deepEqual(state.projects.find((p) => p._id === "prj_jajabor").leadIds, ["usr_tanvir"], "only members can lead");
  run({ type: "task.create", data: { title: "Now I can", projectId: "prj_jajabor", assigneeIds: ["usr_sara"] } }, as("usr_tanvir"));
  fails({ type: "task.create", data: { title: "Not any more", projectId: "prj_jajabor", assigneeIds: ["usr_tanvir"] } }, forbidden, as("usr_sara"));
  run({ type: "project.update", id: "prj_jajabor", data: { memberIds: ["usr_alex", "usr_sara"] } });
  assert.deepEqual(state.projects.find((p) => p._id === "prj_jajabor").leadIds, [], "leaving the project ends being a lead");
  run({ type: "project.update", id: "prj_jajabor", data: { memberIds: ["usr_alex", "usr_sara", "usr_tanvir"], leadIds: ["usr_sara"] } });

  // Project details, phase moves, hold and archive: leads and admins. Notes: anyone.
  fails({ type: "project.update", id: "prj_jajabor", data: { name: "Renamed" } }, forbidden, as("usr_tanvir"));
  fails({ type: "project.advance", id: "prj_jajabor" }, forbidden, as("usr_tanvir"));
  fails({ type: "project.hold", id: "prj_jajabor", data: { onHold: true } }, forbidden, as("usr_tanvir"));
  fails({ type: "project.archive", id: "prj_jajabor", data: { archived: true } }, forbidden, as("usr_tanvir"));
  assert.equal(run({ type: "project.update", id: "prj_jajabor", data: { notes: "Staging is down until Monday" } }, as("usr_tanvir")).notes, "Staging is down until Monday");
  run({ type: "project.hold", id: "prj_jajabor", data: { onHold: true } }, as("usr_sara"));
  run({ type: "project.hold", id: "prj_jajabor", data: { onHold: false } }, as("usr_sara"));

  // Only admins create projects, even leads can't; the admin picks the leads or leads it.
  fails({ type: "project.create", data: { name: "Side project", memberIds: [] } }, forbidden, as("usr_tanvir"));
  fails({ type: "project.create", data: { name: "Side project", memberIds: [] } }, forbidden, as("usr_sara"));
  const own = run({ type: "project.create", data: { name: "Side project", memberIds: [] } });
  assert.deepEqual(own.leadIds, ["usr_alex"]);
  const picked = run({ type: "project.create", data: { name: "Client work", memberIds: ["usr_sara"], leadIds: ["usr_sara"] } });
  assert.deepEqual(picked.leadIds, ["usr_sara"]);
});

test("custom phases: each project has its own, admins edit them safely", () => {
  const forbidden = (e) => assert.equal(e.status, 403);
  // An admin creates a project with four phases; it starts in the first.
  const site = run({ type: "project.create", data: { name: "Landing page", memberIds: ["usr_sara"], leadIds: ["usr_sara"], phases: [{ name: "Brief" }, { name: "Content" }, { name: "Build" }, { name: "Live" }] } });
  assert.deepEqual(site.phases.map((p) => p.name), ["Brief", "Content", "Build", "Live"]);
  assert.equal(site.phase, site.phases[0]._id);
  assert.ok(site.phases.every((p) => p._id), "new phases get ids");
  const [brief, content, build, live] = site.phases;
  fails({ type: "project.create", data: { name: "Dupes", phases: [{ name: "Build" }, { name: " build " }] } }, (e) => assert.ok(e.fieldErrors.phases));
  fails({ type: "project.create", data: { name: "None", phases: [] } }, (e) => assert.ok(e.fieldErrors.phases));
  assert.deepEqual(run({ type: "project.create", data: { name: "Standard" } }).phases.map((p) => p._id), ["idea", "planning", "design", "build", "test", "launch", "maintain"], "the standard seven by default");

  // Tasks use the project's phases.
  const task = run({ type: "task.create", data: { title: "Hero copy", projectId: site._id, assigneeIds: ["usr_sara"] } }, as("usr_sara"));
  assert.equal(task.phase, brief._id, "defaults to the project's phase");
  fails({ type: "task.create", data: { title: "Wrong", projectId: site._id, phase: "design" } }, (e) => assert.ok(e.fieldErrors.phase));
  assert.equal(run({ type: "task.update", id: task._id, data: { phase: content._id } }, as("usr_sara")).phase, content._id);

  // Advancing walks the project's own order and stops at its last phase.
  run({ type: "project.advance", id: site._id });
  assert.equal(state.projects.find((p) => p._id === site._id).phase, content._id);
  run({ type: "project.update", id: site._id, data: { phase: live._id } });
  fails({ type: "project.advance", id: site._id }, (e) => assert.match(e.message, /Live is the last phase/));

  // Only admins change phases, even a lead can't; renaming, adding and reordering keep the ids.
  const renamed = [live, { ...content, name: "Copy" }, build, brief, { name: "Retro" }];
  fails({ type: "project.update", id: site._id, data: { phases: renamed } }, forbidden, as("usr_sara"));
  const updated = run({ type: "project.update", id: site._id, data: { phases: renamed } });
  assert.deepEqual(updated.phases.map((p) => p.name), ["Live", "Copy", "Build", "Brief", "Retro"]);
  assert.equal(updated.phases[1]._id, content._id, "renaming keeps the id, so tasks stay put");
  run({ type: "project.update", id: site._id, data: { name: "Landing page v2" } }, as("usr_sara"));
  assert.equal(state.projects.find((p) => p._id === site._id).phases.length, 5, "saving without phases keeps them");

  // A phase can't be removed while it's current or still has tasks.
  fails({ type: "project.update", id: site._id, data: { phases: [content, build, brief] } }, (e) => assert.match(e.message, /current phase/));
  fails({ type: "project.update", id: site._id, data: { phases: [live, build, brief] } }, (e) => assert.match(e.message, /still has 1 task/));
  run({ type: "project.update", id: site._id, data: { phases: [live, { ...content, name: "Copy" }, build] } });
  assert.deepEqual(state.projects.find((p) => p._id === site._id).phases.map((p) => p.name), ["Live", "Copy", "Build"], "empty phases can go");
});

test("task discussions: comments notify followers and are removed with the task", () => {
  // Alex creates a task for Tanvir in Jajabor (members: Alex, Sara, Tanvir).
  const task = run({ type: "task.create", data: { title: "Payment webhook", projectId: "prj_jajabor", assigneeIds: ["usr_tanvir"] } });
  const notes = (userId) => state.notifications.filter((n) => n.userId === userId && n.type === "taskComment");

  const first = run({ type: "task.comment", id: task._id, data: { body: "Blocked: no sandbox keys yet" } }, as("usr_tanvir"));
  const thread = state.conversations.find((c) => c.type === "task" && c.taskId === task._id);
  assert.ok(thread, "the discussion starts with the first comment");
  assert.equal(first.conversationId, thread._id);
  assert.equal(notes("usr_alex").length, 1, "the task's creator hears about it");
  assert.equal(notes("usr_tanvir").length, 0, "not the author");

  // Sara joins in and mentions Alex: Alex gets one mention (not a second comment notification); Tanvir and Sara follow.
  const reply = run({ type: "task.comment", id: task._id, data: { body: "@Alex can you share the keys?" } }, as("usr_sara"));
  assert.deepEqual(reply.mentions, ["usr_alex"]);
  assert.equal(notes("usr_alex").length, 1);
  assert.ok(state.notifications.some((n) => n.userId === "usr_alex" && n.type === "mention" && n.targetId === reply._id));
  assert.equal(notes("usr_tanvir").length, 1, "the assignee hears about it");

  run({ type: "task.comment", id: task._id, data: { body: "Sent them over" } });
  assert.equal(notes("usr_sara").length, 1, "earlier commenters follow the discussion");
  fails({ type: "task.comment", id: task._id, data: { body: "  " } });

  // Posting through the chat action still notifies followers.
  run({ type: "message.create", id: thread._id, data: { body: "Thanks, unblocked" } }, as("usr_tanvir"));
  assert.equal(notes("usr_sara").length, 2);

  // The shared test state stamps every action with the same time, so look it up rather than take the newest.
  const view = myNotifications(state, "usr_sara").find((n) => n.type === "taskComment" && n.actorId === "usr_tanvir");
  assert.equal(view.view.text, "Tanvir Karim commented on “Payment webhook”");
  assert.equal(view.view.href, `/tasks/${task._id}`, "opens the task's page");

  run({ type: "task.delete", id: task._id });
  assert.ok(!state.conversations.some((c) => c._id === thread._id), "discussion removed with the task");
  assert.ok(!state.messages.some((m) => m.conversationId === thread._id));
  assert.ok(!state.notifications.some((n) => n.type === "taskComment"));
});

test("mention suggestions and picked names resolve to the right person", () => {
  const people = [
    { _id: "u1", name: "Rafi Ahmed" },
    { _id: "u2", name: "Rina Das" },
    { _id: "u3", name: "Sara Rahman" },
    { _id: "u4", name: "Rafi Karim" },
  ];
  assert.deepEqual(mentionSuggestions("r", people).map((u) => u._id), ["u1", "u2", "u3", "u4"], "first or last name");
  assert.deepEqual(mentionSuggestions("ri", people).map((u) => u._id), ["u2"]);
  assert.deepEqual(mentionSuggestions("", people).length, 4, "a bare @ lists everyone");
  assert.equal(mentionHandle(people[1], people), "Rina");
  assert.equal(mentionHandle(people[0], people), "RafiAhmed", "shared first names use the full name");
  for (const user of people) {
    assert.deepEqual(parseMentions(`hey @${mentionHandle(user, people)} check this`, people), [user._id]);
  }
});

test("deleting a member keeps history as Former member, and a new invite brings them back", () => {
  const nadia = state.users.find((u) => u._id === "usr_nadia");
  const project = state.projects.find((p) => p.memberIds.includes("usr_nadia"));
  const task = run({ type: "task.create", data: { title: "Hand over notes", projectId: project._id, assigneeIds: ["usr_nadia"] } });
  fails({ type: "member.delete", id: "usr_nadia" }, (e) => assert.match(e.message, /Remove this member/));
  run({ type: "member.active", id: "usr_nadia", data: { active: false } });
  fails({ type: "member.delete", id: "usr_nadia" }, (e) => assert.equal(e.status, 403), as("usr_sara"));
  fails({ type: "member.delete", id: SEED_OWNER_ID });

  const deleted = run({ type: "member.delete", id: "usr_nadia" });
  assert.equal(deleted.name, "Former member");
  assert.equal(deleted.email, nadia.email, "email stays so a new invite can match");
  assert.equal(deleted.authId, null);
  assert.ok(deleted.deletedAt);
  assert.ok(!state.projects.some((p) => p.memberIds.includes("usr_nadia")), "leaves every project");
  assert.ok(!state.notifications.some((n) => n.userId === "usr_nadia"));
  assert.equal(state.tasks.find((t) => t._id === task._id).assigneeIds[0], "usr_nadia", "history keeps the same id");
  fails({ type: "member.active", id: "usr_nadia", data: { active: true } }, (e) => assert.match(e.message, /Invite them again/));
  fails({ type: "member.delete", id: "usr_nadia" });

  // A task still assigned to the deleted member stays editable.
  run({ type: "task.update", id: task._id, data: { title: "Hand over all notes" } });
  // Signing in with the old account no longer opens the workspace.
  assert.deepEqual(matchMembers([{ ...deleted, authId: null }], { id: nadia.authId ?? "user_n", email: nadia.email, emailVerified: true }), []);

  const invite = run({ type: "member.invite", data: { email: nadia.email } });
  run({ type: "invite.cancel", id: invite._id });
  const back = rejoinedMember(deleted, { identity: { id: "user_n2", email: nadia.email, emailVerified: true, name: "Nadia H.", avatarUrl: "" }, now: new Date(), newId: (p) => `${p}_x` });
  assert.equal(back._id, "usr_nadia", "same record, so old tasks and messages show their name again");
  assert.equal(back.name, "Nadia H.");
  assert.equal(back.active, true);
  assert.equal(back.role, "member");
  assert.equal(back.deletedAt, null);
  assert.equal(back.authId, "user_n2");
  assert.equal(back.createdAt, deleted.createdAt);
});

test("sign-in accounts map to members safely", () => {
  const verified = { id: "user_01", email: "sara@acme.dev", emailVerified: true, name: "Sara Rahman", avatarUrl: "" };
  const members = [
    { _id: "usr_a", orgId: "org_a", email: "sara@acme.dev", authId: null, active: true, createdAt: "2026-02-01" },
    { _id: "usr_b", orgId: "org_b", email: "other@acme.dev", authId: "user_01", active: true, createdAt: "2026-01-01" },
    { _id: "usr_c", orgId: "org_c", email: "sara@acme.dev", authId: "user_99", active: true, createdAt: "2025-01-01" },
  ];
  assert.deepEqual(matchMembers(members, verified).map((u) => u._id), ["usr_a", "usr_b"], "an account linked to someone else never matches by email");
  assert.deepEqual(matchMembers(members, { ...verified, emailVerified: false }).map((u) => u._id), ["usr_b"], "unverified email only matches by account id");
  assert.equal(pickMembership(matchMembers(members, verified))._id, "usr_b", "oldest active membership opens first");
  assert.equal(pickMembership([{ ...members[0], active: false }]), null, "removed members get no workspace");

  assert.equal(canCreateWorkspace(verified, ""), false, "nobody may create workspaces by default");
  assert.equal(canCreateWorkspace(verified, " Sara@Acme.dev , boss@acme.dev"), true);
  assert.equal(canCreateWorkspace(verified, "*"), true);
  assert.equal(canCreateWorkspace({ ...verified, emailVerified: false }, "*"), false, "creating needs a verified email");
});

test("an older workspace's Internal project is renamed to Company once", () => {
  const projects = [
    { _id: "p1", name: "Internal", isInternal: true },
    { _id: "p2", name: "Internal", isInternal: false },
  ];
  assert.deepEqual(renamedCompanyProject(projects, new Date()).name, COMPANY_PROJECT);
  assert.equal(renamedCompanyProject([{ ...projects[0], name: COMPANY_PROJECT }, projects[1]], new Date()), null, "already renamed, and other projects are never touched");
  assert.equal(renamedCompanyProject([{ ...projects[0], name: "Ops" }], new Date()), null, "a custom name is kept");
});

test("a new workspace is usable by its creator", () => {
  const identity = { id: "user_02", email: "Founder@Startup.io", emailVerified: true, name: "", avatarUrl: "" };
  let k = 0;
  const wid = (p) => `${p}_w${++k}`;
  const built = newWorkspace({ name: "  Startup Co ", identity, now: new Date(), newId: wid, slugSuffix: "a1b2c3" });
  assert.equal(built.org.slug, "startup-co-a1b2c3");
  const [owner] = built.users;
  assert.equal(owner.role, "admin");
  assert.equal(owner.email, "founder@startup.io");
  assert.equal(owner.name, "founder", "falls back to the email name");
  assert.equal(owner.authId, "user_02");
  assert.ok(newWorkspace({ name: "  ", identity, now: new Date(), newId: wid }).error, "name is required");

  const snapshot = { ...Object.fromEntries(COLLECTIONS.map((c) => [c, []])), ...built };
  const wctx = { orgId: built.org._id, userId: owner._id, now: new Date(), newId: wid };
  const general = built.conversations.find((c) => c.type === "general");
  const { state: next } = applyAction(snapshot, { type: "message.create", id: general._id, data: { body: "Hello team" } }, wctx);
  assert.equal(next.messages.length, 1);
  applyAction(next, { type: "task.create", data: { projectId: built.projects[0]._id, title: "Set up billing" } }, wctx);
  applyAction(next, { type: "member.invite", data: { email: "cto@startup.io" } }, wctx);
});

test("notification emails follow each person's settings", () => {
  let mail = buildSeed(new Date());
  let k = 0;
  // Each action gets a distinct "now", as real requests do.
  const send = (action, userId = SEED_OWNER_ID) => {
    const now = new Date(Date.now() + ++k * 1000);
    const out = applyAction(mail, action, { orgId: SEED_ORG_ID, userId, now, newId: (p) => `${p}_m${k}_${Math.random().toString(36).slice(2, 8)}` });
    mail = out.state;
    const emails = notificationEmails({ state: out.state, changes: out.changes, action, actorId: userId, now, appUrl: (path) => `https://app.test${path}`, timeZone: "Asia/Dhaka" });
    return { result: out.result, emails };
  };
  const setPrefs = (userId, prefs) => send({ type: "profile.update", data: { notificationPrefs: { ...prefs } } }, userId);

  // Mentions and direct messages stay in-app.
  assert.equal(send({ type: "message.create", id: "cnv_jajabor", data: { body: "@Sara can you check this?" } }).emails.length, 0);
  assert.equal(send({ type: "dm.send", data: { userId: "usr_sara", body: "hi" } }).emails.length, 0);
  assert.ok(mail.notifications.some((n) => n.userId === "usr_sara" && n.type === "mention"), "the in-app notification is still there");

  let { emails } = send({ type: "task.create", data: { title: "Fix <b>login</b>", projectId: "prj_jajabor", assigneeIds: ["usr_tanvir"], dueDate: today } });
  assert.deepEqual(emails.map((e) => [e.to, e.subject]), [["tanvir@macrokite.dev", "Alex Morgan assigned you: Fix <b>login</b>"]]);
  assert.ok(emails[0].html.includes("Fix &lt;b&gt;login&lt;/b&gt;"), "content is escaped in HTML");
  assert.ok(emails[0].text.includes(`https://app.test/tasks/${mail.tasks.at(-1)._id}`), "links to the task page");
  assert.equal(send({ type: "task.create", data: { title: "Mine", projectId: "prj_jajabor" } }).emails.length, 0, "no email about your own actions");
  setPrefs("usr_tanvir", { assignment: false, meetingInvite: true });
  assert.equal(send({ type: "task.create", data: { title: "Quiet", projectId: "prj_jajabor", assigneeIds: ["usr_tanvir"] } }).emails.length, 0, "turned off in Settings");
  setPrefs("usr_tanvir", { assignment: true, meetingInvite: true });

  // Meetings: invite emails, then one summary per attendee instead of action item emails.
  const startsAt = new Date(Date.now() + 86_400_000).toISOString();
  const { result: meeting, emails: invites } = send({ type: "meeting.create", data: { title: "Sprint review", projectId: "prj_jajabor", startsAt, attendeeIds: ["usr_alex", "usr_sara", "usr_tanvir"] } });
  assert.deepEqual(invites.map((e) => e.to).sort(), ["sara@macrokite.dev", "tanvir@macrokite.dev"]);
  assert.match(invites[0].text, /When: .*GMT\+6/, "meeting time uses the configured time zone");
  send({ type: "decision.add", id: meeting._id, data: { text: "Ship on Friday" } });
  assert.equal(send({ type: "task.create", data: { title: "Write release notes", projectId: "prj_jajabor", assigneeIds: ["usr_tanvir"], meetingId: meeting._id } }).emails.length, 0, "announced when the meeting ends");
  ({ emails } = send({ type: "meeting.end", id: meeting._id }));
  assert.deepEqual(emails.map((e) => e.to).sort(), ["alex@macrokite.dev", "sara@macrokite.dev", "tanvir@macrokite.dev"]);
  assert.ok(emails.every((e) => e.subject === "Summary: Sprint review"));
  assert.ok(emails[0].text.includes("Decision: Ship on Friday") && emails[0].text.includes("Action item: Write release notes (Tanvir Karim)"));
});

test("clients: admins add them, projects belong to one, and a client with projects can't be removed", () => {
  const forbidden = (e) => assert.equal(e.status, 403);
  fails({ type: "client.create", data: { name: "Acme" } }, forbidden, as("usr_sara"));
  fails({ type: "client.create", data: { name: " " } }, (e) => assert.ok(e.fieldErrors.name));
  const acme = run({ type: "client.create", data: { name: "Acme", description: "Rockets" } });
  const project = run({ type: "project.create", data: { name: "Acme site", clientId: acme._id } });
  assert.equal(project.clientId, acme._id);
  fails({ type: "project.create", data: { name: "Ghost", clientId: "cli_nope" } }, (e) => assert.ok(e.fieldErrors.clientId));
  fails({ type: "client.delete", id: acme._id });
  run({ type: "project.update", id: project._id, data: { clientId: null } });
  assert.equal(state.projects.find((p) => p._id === project._id).clientId, null, "moved to the company");
  run({ type: "client.update", id: acme._id, data: { name: "Acme Corp" } });
  run({ type: "client.delete", id: acme._id });
  assert.ok(!state.clients.some((c) => c._id === acme._id));
});

test("tasks can have several assignees, or none yet", () => {
  const task = run({ type: "task.create", data: { title: "Pair on it", projectId: "prj_jajabor", assigneeIds: ["usr_sara", "usr_tanvir"] } });
  assert.deepEqual(task.assigneeIds, ["usr_sara", "usr_tanvir"]);
  assert.ok(["usr_sara", "usr_tanvir"].every((id) => state.notifications.some((n) => n.userId === id && n.targetId === task._id)), "each assignee is notified");
  run({ type: "task.update", id: task._id, data: { status: "doing" } }, as("usr_tanvir"));
  const before = state.notifications.length;
  run({ type: "task.update", id: task._id, data: { assigneeIds: ["usr_sara", "usr_tanvir", "usr_alex"] } });
  assert.equal(state.notifications.length, before, "only people newly added are notified (and not yourself)");
  const empty = run({ type: "task.create", data: { title: "Someone, someday", projectId: "prj_jajabor", assigneeIds: [] } });
  assert.deepEqual(empty.assigneeIds, []);
});

test("tasks saved with a single assignee still work", () => {
  const legacy = { ...state.tasks.find((t) => t.projectId === "prj_jajabor"), _id: "tsk_legacy", assigneeId: "usr_tanvir" };
  delete legacy.assigneeIds;
  const old = { ...state, tasks: [...state.tasks, legacy] };
  delete old.clients;
  const upgraded = normalizeSnapshot(old);
  assert.deepEqual(upgraded.clients, []);
  assert.deepEqual(upgraded.tasks.find((t) => t._id === "tsk_legacy").assigneeIds, ["usr_tanvir"]);
  // The engine also accepts the old shape directly.
  const { result } = applyAction(old, { type: "task.update", id: "tsk_legacy", data: { status: "done" } }, as("usr_tanvir"));
  assert.deepEqual(result.assigneeIds, ["usr_tanvir"]);
  assert.ok(!("assigneeId" in result), "saved in the new shape");
});

test("groups: named chats for the people picked", () => {
  fails({ type: "group.create", data: { name: "Just me", memberIds: [] } }, (e) => assert.ok(e.fieldErrors.memberIds));
  const group = run({ type: "group.create", data: { name: "Design crit", memberIds: ["usr_sara"] } });
  assert.deepEqual([...group.memberIds].sort(), ["usr_alex", "usr_sara"], "whoever starts it is in it");
  const message = run({ type: "message.create", id: group._id, data: { body: "Friday at 2? @Sara" } });
  assert.deepEqual(message.mentions, ["usr_sara"]);
  assert.equal(myNotifications(state, "usr_sara").find((x) => x.targetId === message._id).view.href, `/inbox/${group._id}`);
  fails({ type: "message.create", id: group._id, data: { body: "Let me in" } }, (e) => assert.equal(e.status, 404), as("usr_tanvir"));
  fails({ type: "group.update", id: group._id, data: { name: "Mine now" } }, (e) => assert.equal(e.status, 404), as("usr_tanvir"));
  run({ type: "group.update", id: group._id, data: { name: "Design review", memberIds: [...group.memberIds, "usr_tanvir"] } }, as("usr_sara"));
  run({ type: "message.create", id: group._id, data: { body: "Thanks for adding me" } }, as("usr_tanvir"));
});

test("meetings can be scheduled with an agenda, and editing it keeps ticked topics", () => {
  const startsAt = new Date(Date.now() + 86_400_000).toISOString();
  const meeting = run({ type: "meeting.create", data: { projectId: "prj_internal", title: "Planning", startsAt, agenda: ["Wins", "", "  Hiring  "] } });
  assert.deepEqual(meeting.agenda.map((a) => a.title), ["Wins", "Hiring"], "blank lines dropped, lines trimmed");
  run({ type: "agenda.toggle", id: meeting._id, data: { itemId: meeting.agenda[1]._id } });
  const edited = run({ type: "meeting.update", id: meeting._id, data: { agenda: ["Hiring", "Budget"] } });
  assert.deepEqual(edited.agenda.map((a) => [a.title, a.covered]), [["Hiring", true], ["Budget", false]]);
  assert.equal(edited.agenda[0]._id, meeting.agenda[1]._id, "same topic, same item");
  const renamed = run({ type: "meeting.update", id: meeting._id, data: { title: "Planning v2" } });
  assert.equal(renamed.agenda.length, 2, "leaving the agenda out keeps it");
});

test("meeting reminders are per person", () => {
  const meeting = state.meetings.find((m) => m._id === "mtg_jaj_today");
  run({ type: "meeting.reminder", id: meeting._id, data: { minutes: 15 } });
  run({ type: "meeting.reminder", id: meeting._id, data: { minutes: 60 } }, as("usr_sara"));
  assert.deepEqual(state.meetings.find((m) => m._id === meeting._id).reminders, { usr_alex: 15, usr_sara: 60 });
  run({ type: "meeting.reminder", id: meeting._id, data: { minutes: null } });
  assert.deepEqual(state.meetings.find((m) => m._id === meeting._id).reminders, { usr_sara: 60 }, "turning yours off leaves others alone");
  fails({ type: "meeting.reminder", id: meeting._id, data: { minutes: 7 } }, (e) => assert.ok(e.fieldErrors.minutes));
});

test("task activity logs changes without notifying anyone", () => {
  const task = run({ type: "task.create", data: { title: "Logged", projectId: "prj_jajabor", assigneeIds: ["usr_sara"] } });
  const before = state.notifications.length;
  run({ type: "task.update", id: task._id, data: { status: "doing", priority: "urgent", dueDate: "2030-01-05", assigneeIds: ["usr_tanvir"], description: "New" } });
  const thread = state.conversations.find((c) => c.type === "task" && c.taskId === task._id);
  const events = state.messages.filter((m) => m.conversationId === thread._id).map((m) => m.event);
  assert.deepEqual(events, [
    "changed status from **To do** to **In progress**",
    "set priority to **Urgent**",
    "set the due date to **Jan 5, 2030**",
    "assigned **Tanvir Karim**",
    "unassigned **Sara Rahman**",
    "updated the description",
  ]);
  assert.equal(state.notifications.length, before + 1, "only the new assignee hears about it");
  assert.equal(unreadByConversation(state, "usr_tanvir")[thread._id], undefined, "events don't count as unread");
});

test("clients have members, and groups can be deleted", () => {
  const client = run({ type: "client.create", data: { name: "Members Inc", memberIds: ["usr_sara"] } });
  assert.deepEqual([...client.memberIds].sort(), ["usr_alex", "usr_sara"], "whoever adds a client is a member");
  const group = run({ type: "group.create", data: { name: "Temp", memberIds: ["usr_sara"] } });
  run({ type: "message.create", id: group._id, data: { body: "hi" } });
  fails({ type: "group.delete", id: group._id }, (e) => assert.equal(e.status, 404), as("usr_tanvir"));
  run({ type: "group.delete", id: group._id }, as("usr_sara"));
  assert.ok(!state.conversations.some((c) => c._id === group._id) && !state.messages.some((m) => m.conversationId === group._id));
});

test("deleting a project removes its tasks, meetings and chats; admins only", () => {
  const id = "prj_jajabor";
  const taskIds = state.tasks.filter((t) => t.projectId === id).map((t) => t._id);
  const conversationIds = state.conversations.filter((c) => c.projectId === id).map((c) => c._id);
  assert.ok(taskIds.length && conversationIds.length && state.meetings.some((m) => m.projectId === id));
  fails({ type: "project.delete", id }, (e) => assert.equal(e.status, 403), as("usr_sara"));
  fails({ type: "project.delete", id: "prj_internal" });
  run({ type: "project.delete", id });
  assert.ok(!state.projects.some((p) => p._id === id));
  assert.ok(!state.tasks.some((t) => t.projectId === id) && !state.meetings.some((m) => m.projectId === id));
  assert.ok(!state.conversations.some((c) => c.projectId === id || taskIds.includes(c.taskId)));
  assert.ok(!state.messages.some((m) => conversationIds.includes(m.conversationId)));
  assert.ok(!state.readStates.some((r) => conversationIds.includes(r.conversationId)));
});

test("messages can carry files from the workspace's own folder", () => {
  const general = state.conversations.find((c) => c.type === "general");
  const photo = { pathname: `${attachmentFolder(SEED_ORG_ID)}shot-Ab12.png`, name: "shot.png", size: 2048, contentType: "image/png", width: 800, height: 600 };
  const doc = { pathname: `${attachmentFolder(SEED_ORG_ID)}brief-Cd34.pdf`, name: "brief.pdf", size: 90000, contentType: "application/pdf" };

  const onlyFiles = run({ type: "message.create", id: general._id, data: { attachments: [photo] } });
  assert.equal(onlyFiles.body, "");
  assert.deepEqual(onlyFiles.attachments, [photo]);
  assert.equal(messagePreview(onlyFiles), "Sent a photo");
  const both = run({ type: "dm.send", data: { userId: "usr_sara", body: "see attached", attachments: [doc] } });
  assert.equal(both.attachments[0].height, null);
  assert.equal(messagePreview({ body: "", attachments: [photo, doc] }), "Sent 2 files");

  fails({ type: "message.create", id: general._id, data: { body: "" } }, (e) => assert.ok(e.fieldErrors.body));
  fails({ type: "message.create", id: general._id, data: { attachments: [{ ...photo, pathname: "orgs/org_other/chat/x.png" }] } }, (e) => assert.ok(e.fieldErrors.attachments));
  fails({ type: "message.create", id: general._id, data: { attachments: [{ ...photo, pathname: `${attachmentFolder(SEED_ORG_ID)}../x.png` }] } });
  fails({ type: "message.create", id: general._id, data: { attachments: [{ ...doc, size: MAX_ATTACHMENT_BYTES + 1 }] } });
  fails({ type: "message.create", id: general._id, data: { attachments: Array.from({ length: MAX_ATTACHMENTS + 1 }, () => photo) } });
});

test("messages can be deleted by their author or an admin", () => {
  const general = state.conversations.find((c) => c.type === "general");
  // Earlier checks deactivate some members; use whoever is still active.
  const [writer, other, third] = state.users.filter((u) => u.active && u.role !== "admin").map((u) => u._id);
  const file = { pathname: `${attachmentFolder(SEED_ORG_ID)}notes-Ef56.pdf`, name: "notes.pdf", size: 1200, contentType: "application/pdf" };
  const mine = run({ type: "dm.send", data: { userId: other, body: "see notes", attachments: [file] } }, as(writer));
  assert.ok(state.notifications.some((x) => x.targetId === mine._id));

  fails({ type: "message.delete", id: mine._id }, (e) => assert.equal(e.status, 403), as(other));
  const deleted = run({ type: "message.delete", id: mine._id }, as(writer));
  assert.ok(deleted.deletedAt);
  assert.equal(deleted.body, "");
  assert.deepEqual(deleted.attachments, []);
  assert.ok(!state.notifications.some((x) => x.targetId === mine._id), "its notifications go too");
  fails({ type: "message.delete", id: mine._id }, (e) => assert.equal(e.status, 404), as(writer));

  // An admin may remove anyone's message, but not a task's logged changes or a DM they aren't in.
  const theirs = run({ type: "message.create", id: general._id, data: { body: "oops" } }, as(other));
  run({ type: "message.delete", id: theirs._id });
  const event = state.messages.find((m) => m.event);
  fails({ type: "message.delete", id: event._id }, (e) => assert.equal(e.status, 403));
  const dm = run({ type: "dm.send", data: { userId: third, body: "private" } }, as(other));
  fails({ type: "message.delete", id: dm._id }, (e) => assert.equal(e.status, 404));
});

test("messages can be edited by their author", () => {
  const general = state.conversations.find((c) => c.type === "general");
  const [writer, other] = state.users.filter((u) => u.active && u.role !== "admin");
  const third = state.users.find((u) => u.active && u !== writer && u !== other);
  const handle = (u) => `@${mentionHandle(u, state.users.filter((x) => x.active))}`;
  const message = run({ type: "message.create", id: general._id, data: { body: `hi ${handle(other)}` } }, as(writer._id));
  const pinged = (userId) => state.notifications.some((n) => n.type === "mention" && n.targetId === message._id && n.userId === userId);
  assert.ok(pinged(other._id) && !message.editedAt);

  fails({ type: "message.edit", id: message._id, data: { body: "hijacked" } }, (e) => assert.equal(e.status, 403), as(other._id));
  fails({ type: "message.edit", id: message._id, data: { body: "admins can't reword" } }, (e) => assert.equal(e.status, 403));
  fails({ type: "message.edit", id: message._id, data: { body: "  " } }, (e) => assert.ok(e.fieldErrors.body), as(writer._id));

  const edited = run({ type: "message.edit", id: message._id, data: { body: `actually ${handle(third)}` } }, as(writer._id));
  assert.equal(edited.body, `actually ${handle(third)}`);
  assert.ok(edited.editedAt);
  assert.deepEqual(edited.mentions, [third._id]);
  assert.ok(pinged(third._id) && !pinged(other._id), "mentions follow the new text");

  // A message with files may lose its text; a deleted one can't be edited.
  const file = { pathname: `${attachmentFolder(SEED_ORG_ID)}a-Gh78.png`, name: "a.png", size: 10, contentType: "image/png" };
  const withFile = run({ type: "message.create", id: general._id, data: { body: "caption", attachments: [file] } }, as(writer._id));
  assert.equal(run({ type: "message.edit", id: withFile._id, data: { body: "" } }, as(writer._id)).body, "");
  run({ type: "message.delete", id: withFile._id }, as(writer._id));
  fails({ type: "message.edit", id: withFile._id, data: { body: "back" } }, (e) => assert.equal(e.status, 404), as(writer._id));
});

test("chat history: recent window, older pages and refreshes", () => {
  const at = (i) => new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString();
  const msg = (i, createdAt = at(i)) => ({ _id: `m${i}`, conversationId: "c", createdAt });
  const newestFirst = (count) => Array.from({ length: count }, (_, i) => msg(count - 1 - i));

  // A short conversation comes whole; a long one sends the newest page and says there's more.
  assert.deepEqual(recentMessages(newestFirst(10), null), { messages: newestFirst(10).reverse(), hasOlder: false });
  const long = recentMessages(newestFirst(101), at(100));
  assert.equal(long.messages.length, MESSAGE_PAGE);
  assert.equal(long.messages.at(-1)._id, "m100", "oldest first");
  assert.ok(long.hasOlder);
  // Everything unread comes too, up to the limit.
  assert.equal(recentMessages(newestFirst(101), at(30)).messages.length, 70);
  assert.equal(recentMessages(newestFirst(101), null).messages.length, 100);

  // Messages logged together are never split across pages.
  const tied = [msg(5), msg(4), msg(3, at(2)), msg(2), msg(1)];
  assert.deepEqual(newestMessages(tied, 3).map((m) => m._id), ["m5", "m4", "m3", "m2"]);
  assert.equal(olderPage(newestFirst(MESSAGE_PAGE)).hasOlder, false);
  assert.equal(olderPage(newestFirst(MESSAGE_PAGE + 1)).hasOlder, true);

  // Scrolling back adds a page; a refresh keeps it, and keeps knowing whether there's more.
  const loaded = { messages: [msg(50), msg(51)], conversations: [{ _id: "c" }], hasOlder: { c: true } };
  const scrolled = withOlderMessages(loaded, "c", [msg(48), msg(49)], false);
  assert.deepEqual(scrolled.messages.map((m) => m._id), ["m48", "m49", "m50", "m51"]);
  const refreshed = keepLoadedHistory(scrolled, { messages: [msg(51), msg(52)], conversations: [{ _id: "c" }], hasOlder: { c: true } });
  assert.deepEqual(refreshed.messages.map((m) => m._id).sort(), ["m48", "m49", "m50", "m51", "m52"]);
  assert.equal(refreshed.hasOlder.c, false);
  // A conversation that's gone takes its history with it.
  assert.equal(keepLoadedHistory(scrolled, { messages: [], hasOlder: {} }).messages.length, 0);
});

test("optimistic updates: pending actions show on top of the saved data", () => {
  const general = state.conversations.find((c) => c.type === "general");
  const sending = pendingAction({ type: "message.create", id: general._id, data: { body: "on its way" } }, SEED_OWNER_ID);
  const denied = pendingAction({ type: "message.edit", id: "msg_missing", data: { body: "x" } }, SEED_OWNER_ID);
  const shown = withPending(state, [denied, sending]);
  const message = shown.messages.find((m) => m.body === "on its way");
  assert.ok(message?.pending, "the new message shows, marked pending");
  assert.equal(shown.messages.length, state.messages.length + 1, "an action the browser can't apply is skipped");
  // Showing it again (another update while it waits) keeps its id, so the row isn't replaced.
  assert.equal(withPending(state, [denied, sending]).messages.find((m) => m.body === "on its way")._id, message._id);
  assert.equal(withPending(state, []), state);
});

console.log("\nall engine checks passed");
