// Domain engine checks. Run: node --import ./scripts/register.mjs scripts/engine.test.mjs
import assert from "node:assert/strict";
import { applyAction, applyChanges, deletionImpact, DomainError } from "../src/lib/engine.js";
import { buildSeed, SEED_ORG_ID, SEED_OWNER_ID } from "../src/lib/seed.js";
import { dashboardMetrics, projectProgress, todayISO } from "../src/lib/selectors.js";

let n = 0;
const ctx = { orgId: SEED_ORG_ID, userId: SEED_OWNER_ID, now: new Date(), newId: (p) => `${p}_t${++n}` };
let state = buildSeed(new Date());
const run = (action) => {
  const out = applyAction(state, action, ctx);
  // The changeset must reproduce the same state (this is what database mode persists).
  const replayed = applyChanges(state, out.changes);
  for (const key of ["clients", "projects", "tasks", "conversations", "messages"]) {
    assert.deepEqual(new Set(replayed[key].map((d) => d._id)), new Set(out.state[key].map((d) => d._id)), `changeset mismatch in ${key}`);
  }
  state = out.state;
  return out.result;
};
const fails = (action, check) => {
  try { applyAction(state, action, ctx); } catch (e) { assert.ok(e instanceof DomainError); check?.(e); return; }
  assert.fail(`expected ${action.type} to fail`);
};
const test = (name, fn) => { fn(); console.log("ok -", name); };

test("validation rejects invalid client input", () => {
  fails({ type: "client.create", data: { name: "", company: "X", email: "nope", status: "lead" } }, (e) => {
    assert.equal(e.status, 400);
    assert.ok(e.fieldErrors.name && e.fieldErrors.email);
  });
});

let client;
test("client create / update", () => {
  client = run({ type: "client.create", data: { name: "Jo Park", company: "Test Co", email: "JO@test.example", status: "lead", orgId: "org_evil" } });
  assert.equal(client.orgId, SEED_ORG_ID, "orgId comes from context, not payload");
  assert.equal(client.email, "jo@test.example");
  const updated = run({ type: "client.update", id: client._id, data: { status: "active" } });
  assert.equal(updated.status, "active");
  assert.ok(state.activities.some((a) => a.clientId === client._id));
});

let project;
test("project linked to client; reference checks", () => {
  fails({ type: "project.create", data: { name: "P", clientId: "cli_missing", status: "planning", priority: "low" } }, (e) => assert.ok(e.fieldErrors.clientId));
  fails({ type: "project.create", data: { name: "P", status: "planning", priority: "low", memberIds: ["usr_intruder"] } });
  fails({ type: "project.create", data: { name: "P", status: "planning", priority: "low", startDate: "2026-05-02", deadline: "2026-05-01" } }, (e) => assert.ok(e.fieldErrors.deadline));
  fails({ type: "project.create", data: { name: "P", status: "planning", priority: "low", deadline: "2026-02-31" } }, (e) => assert.equal(e.fieldErrors.deadline, "Use a valid date"));
  project = run({ type: "project.create", data: { name: "Launch", clientId: client._id, status: "in_progress", priority: "high", memberIds: [SEED_OWNER_ID] } });
  assert.equal(project.clientId, client._id);
});

test("tasks: create, assign, move, progress, metrics", () => {
  const before = dashboardMetrics(state, { today: todayISO() });
  const a = run({ type: "task.create", data: { title: "A", projectId: project._id, status: "todo", priority: "high", assigneeId: "usr_sam", dueDate: "2000-01-01" } });
  run({ type: "task.create", data: { title: "B", projectId: project._id, status: "todo", priority: "low" } });
  fails({ type: "task.create", data: { title: "C", status: "todo", priority: "low", assigneeId: "usr_nobody" } });
  let m = dashboardMetrics(state, { today: todayISO() });
  assert.equal(m.openTasks, before.openTasks + 2);
  assert.equal(m.overdueTasks.length, before.overdueTasks.length + 1);
  assert.equal(projectProgress(project._id, state.tasks).percent, 0);
  run({ type: "task.move", id: a._id, data: { status: "done" } });
  assert.equal(projectProgress(project._id, state.tasks).percent, 50);
  assert.ok(state.tasks.find((t) => t._id === a._id).completedAt);
  m = dashboardMetrics(state, { today: todayISO() });
  assert.equal(m.overdueTasks.length, before.overdueTasks.length);
  const edited = run({ type: "task.update", id: a._id, data: { status: "in_review", assigneeId: SEED_OWNER_ID } });
  assert.equal(edited.completedAt, null);
  fails({ type: "task.update", id: "tsk_missing", data: {} }, (e) => assert.equal(e.status, 404));
});

let thread;
test("conversations: create, reply, read state, client log", () => {
  fails({ type: "conversation.create", data: { subject: "S", visibility: "client", body: "hi" } });
  thread = run({ type: "conversation.create", data: { subject: "Kickoff", visibility: "client", projectId: project._id, body: "Hello" } });
  assert.equal(thread.clientId, client._id, "client derived from project");
  run({ type: "message.create", conversationId: thread._id, data: { body: "Client said yes", authorType: "client" } });
  assert.equal(state.messages.filter((m) => m.conversationId === thread._id).length, 2);
  const internal = run({ type: "conversation.create", data: { subject: "Internal", visibility: "internal", body: "x" } });
  fails({ type: "message.create", conversationId: internal._id, data: { body: "y", authorType: "client" } });
  fails({ type: "message.create", conversationId: thread._id, data: { body: "   " } });
});

test("cascade delete of client removes projects, tasks, threads, messages", () => {
  const impact = deletionImpact(state, "client", client._id);
  assert.deepEqual(impact, { projects: 1, tasks: 2, conversations: 1 });
  run({ type: "client.delete", id: client._id });
  assert.ok(!state.projects.some((p) => p._id === project._id));
  assert.ok(!state.tasks.some((t) => t.projectId === project._id));
  assert.ok(!state.messages.some((m) => m.conversationId === thread._id));
});

test("workspace + profile updates; foreign org rejected", () => {
  fails({ type: "workspace.update", data: { name: "", preferences: { defaultTaskPriority: "low", dueSoonDays: 7, dateFormat: "yyyy-MM-dd" } } });
  run({ type: "workspace.update", data: { name: "MacroKite Studio", description: "", preferences: { defaultTaskPriority: "low", dueSoonDays: 10, dateFormat: "yyyy-MM-dd" } } });
  assert.equal(state.org.name, "MacroKite Studio");
  run({ type: "profile.update", data: { name: "Alex M." } });
  assert.equal(state.users.find((u) => u._id === SEED_OWNER_ID).name, "Alex M.");
  assert.throws(() => applyAction(state, { type: "client.delete", id: "cli_harbor" }, { ...ctx, orgId: "org_other" }), DomainError);
});

console.log("\nall engine checks passed");
