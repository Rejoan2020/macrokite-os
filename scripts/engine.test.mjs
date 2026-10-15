// Domain engine checks. Run: npm test
import assert from "node:assert/strict";
import { applyAction, applyChanges, COLLECTIONS, DomainError } from "../src/lib/engine.js";
import { buildSeed, SEED_ORG_ID, SEED_OWNER_ID } from "../src/lib/seed.js";
import { groupMyTasks, stillOpenFromLast, unreadByConversation } from "../src/lib/selectors.js";
import { addDaysISO, todayISO } from "../src/lib/format.js";
import { mentionHandle, mentionSuggestions, parseActionItem, parseDay, parseMentions, socialLink, tokenize } from "../src/lib/text.js";
import { canCreateWorkspace, matchMembers, newWorkspace, pickMembership, rejoinedMember } from "../src/lib/membership.js";
import { notificationEmails } from "../src/lib/emails.js";
import { myNotifications } from "../src/lib/notifications.js";

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
  act({ type: "task.create", data: { title: "Fix login", projectId: "prj_jajabor", assigneeId: "usr_sara" } });
  const mine = myNotifications(inbox, "usr_sara");
  assert.equal(mine.length, before + 2);
  assert.deepEqual(mine[0].view, { actorId: "usr_alex", text: "Alex Morgan assigned you a task", detail: "Fix login", href: "/tasks" }, "newest first");
  assert.equal(mine[1].view.text, "Alex Morgan mentioned you in # Jajabor");
  assert.equal(mine[1].view.href, "/projects/prj_jajabor?tab=chat");
  assert.equal(mine[0].actorId, "usr_alex", "notifications record who caused them");

  assert.ok(mine.some((n) => !n.readAt));
  act({ type: "notification.readAll" }, "usr_sara");
  assert.ok(myNotifications(inbox, "usr_sara").every((n) => n.readAt));
  assert.ok(inbox.notifications.some((n) => n.userId !== "usr_sara" && !n.readAt), "only your own are marked read");
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
  const task = run({ type: "task.create", data: { title: "Hand over notes", projectId: project._id, assigneeId: "usr_nadia" } });
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
  assert.equal(state.tasks.find((t) => t._id === task._id).assigneeId, "usr_nadia", "history keeps the same id");
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

  let { emails } = send({ type: "task.create", data: { title: "Fix <b>login</b>", projectId: "prj_jajabor", assigneeId: "usr_tanvir", dueDate: today } });
  assert.deepEqual(emails.map((e) => [e.to, e.subject]), [["tanvir@macrokite.dev", "Alex Morgan assigned you: Fix <b>login</b>"]]);
  assert.ok(emails[0].html.includes("Fix &lt;b&gt;login&lt;/b&gt;"), "content is escaped in HTML");
  assert.ok(emails[0].text.includes("https://app.test/tasks"));
  assert.equal(send({ type: "task.create", data: { title: "Mine", projectId: "prj_jajabor" } }).emails.length, 0, "no email about your own actions");
  setPrefs("usr_tanvir", { assignment: false, meetingInvite: true });
  assert.equal(send({ type: "task.create", data: { title: "Quiet", projectId: "prj_jajabor", assigneeId: "usr_tanvir" } }).emails.length, 0, "turned off in Settings");
  setPrefs("usr_tanvir", { assignment: true, meetingInvite: true });

  // Meetings: invite emails, then one summary per attendee instead of action item emails.
  const startsAt = new Date(Date.now() + 86_400_000).toISOString();
  const { result: meeting, emails: invites } = send({ type: "meeting.create", data: { title: "Sprint review", projectId: "prj_jajabor", startsAt, attendeeIds: ["usr_alex", "usr_sara", "usr_tanvir"] } });
  assert.deepEqual(invites.map((e) => e.to).sort(), ["sara@macrokite.dev", "tanvir@macrokite.dev"]);
  assert.match(invites[0].text, /When: .*GMT\+6/, "meeting time uses the configured time zone");
  send({ type: "decision.add", id: meeting._id, data: { text: "Ship on Friday" } });
  assert.equal(send({ type: "task.create", data: { title: "Write release notes", projectId: "prj_jajabor", assigneeId: "usr_tanvir", meetingId: meeting._id } }).emails.length, 0, "announced when the meeting ends");
  ({ emails } = send({ type: "meeting.end", id: meeting._id }));
  assert.deepEqual(emails.map((e) => e.to).sort(), ["alex@macrokite.dev", "sara@macrokite.dev", "tanvir@macrokite.dev"]);
  assert.ok(emails.every((e) => e.subject === "Summary: Sprint review"));
  assert.ok(emails[0].text.includes("Decision: Ship on Friday") && emails[0].text.includes("Action item: Write release notes (Tanvir Karim)"));
});

console.log("\nall engine checks passed");
