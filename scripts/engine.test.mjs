// Domain engine checks. Run: npm test
import assert from "node:assert/strict";
import { applyAction, applyChanges, COLLECTIONS, DomainError } from "../src/lib/engine.js";
import { buildSeed, SEED_ORG_ID, SEED_OWNER_ID } from "../src/lib/seed.js";
import { groupMyTasks, stillOpenFromLast, unreadByConversation } from "../src/lib/selectors.js";
import { addDaysISO, todayISO } from "../src/lib/format.js";
import { parseActionItem, parseDay, parseMentions, socialLink, tokenize } from "../src/lib/text.js";

let n = 0;
const ctx = { orgId: SEED_ORG_ID, userId: SEED_OWNER_ID, now: new Date(), newId: (p) => `${p}_t${++n}` };
let state = buildSeed(new Date());
const run = (action, context = ctx) => {
  const out = applyAction(state, action, context);
  // The changeset must reproduce the same state (this is what database mode persists).
  const replayed = applyChanges(state, out.changes);
  for (const key of COLLECTIONS) {
    assert.deepEqual(replayed[key], out.state[key], `changeset mismatch in ${key}`);
  }
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
  assert.ok(state.tasks.every((t) => ids.has(t.projectId) && t.assigneeId), "every task has a project and assignee");
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
  fails({ type: "task.create", data: { title: "X", projectId: project._id, assigneeId: "usr_nobody" } }, (e) => assert.ok(e.fieldErrors.assigneeId));
  const mine = run({ type: "task.create", data: { title: "Mine", projectId: project._id } });
  assert.equal(mine.assigneeId, SEED_OWNER_ID, "assignee defaults to me");
  assert.equal(mine.phase, "planning", "phase defaults to the project's phase");
  assert.equal(mine.status, "todo");
  const before = state.notifications.length;
  const theirs = run({ type: "task.create", data: { title: "Theirs", projectId: project._id, assigneeId: "usr_sara", dueDate: "2000-01-01" } });
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
  run({ type: "task.create", data: { projectId: project._id, meetingId: meeting._id, title: "A", assigneeId: "usr_sara" } });
  run({ type: "task.create", data: { projectId: project._id, meetingId: meeting._id, title: "B", assigneeId: "usr_sara" } });
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
  fails({ type: "task.create", data: { title: "X", projectId: project._id, assigneeId: "usr_nadia" } });
  fails({ type: "dm.send", data: { userId: "usr_alex", body: "hi" } }, (e) => assert.equal(e.status, 403), as("usr_nadia"));
  run({ type: "member.active", id: "usr_nadia", data: { active: true } });
  run({ type: "member.role", id: "usr_sara", data: { role: "member" } });
});

test("workspace + profile; foreign org rejected", () => {
  fails({ type: "workspace.update", data: { name: "" } });
  fails({ type: "workspace.update", data: { name: "X" } }, (e) => assert.equal(e.status, 403), as("usr_sara"));
  run({ type: "workspace.update", data: { name: "Macrokite Studio" } });
  assert.equal(state.org.name, "Macrokite Studio");
  run({ type: "profile.update", data: { name: "Alex M.", notificationPrefs: { mention: false, assignment: true, meetingInvite: true, dm: true } } });
  const me = state.users.find((u) => u._id === SEED_OWNER_ID);
  assert.equal(me.name, "Alex M.");
  assert.equal(me.notificationPrefs.mention, false);
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

console.log("\nall engine checks passed");
