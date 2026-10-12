import "server-only";
import { randomUUID } from "node:crypto";
import { applyAction, DomainError } from "../engine";
import { buildSeed } from "../seed";
import { connectToDatabase } from "./db";
import { COLLECTION_MODELS, Membership, Organization, User } from "./models";

/**
 * Organization-scoped data access for database mode.
 *
 * Identity: this MVP has no login. The workspace and acting user are resolved on the server from
 * configuration (MACROKITE_ORG_SLUG / MACROKITE_ACTING_USER_EMAIL) and are never taken from the
 * request. Every read and write below is filtered by that server-resolved orgId.
 */

const ORG_SLUG = () => process.env.MACROKITE_ORG_SLUG?.trim() || "macrokite";

const newId = (prefix) => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

async function seedDatabase() {
  const seed = buildSeed(new Date());
  await Organization.create(seed.org);
  for (const user of seed.users) {
    await User.updateOne({ _id: user._id }, { $setOnInsert: user }, { upsert: true });
  }
  for (const [collection, Model] of Object.entries(COLLECTION_MODELS)) {
    if (seed[collection].length) await Model.insertMany(seed[collection], { ordered: false });
  }
}

async function resolveContext() {
  await connectToDatabase();
  let org = await Organization.findOne({ slug: ORG_SLUG() }).lean();
  if (!org && ORG_SLUG() === "macrokite") {
    await seedDatabase();
    org = await Organization.findOne({ slug: ORG_SLUG() }).lean();
  }
  if (!org) throw new DomainError(`Workspace “${ORG_SLUG()}” does not exist.`, { status: 404 });

  const memberships = await Membership.find({ orgId: org._id }).lean();
  const users = await User.find({ _id: { $in: memberships.map((m) => m.userId) } }).lean();
  const email = process.env.MACROKITE_ACTING_USER_EMAIL?.trim().toLowerCase();
  const actingUser = email
    ? users.find((u) => u.email === email)
    : users.find((u) => u._id === memberships.find((m) => m.role === "owner")?.userId);
  if (!actingUser) throw new DomainError("The configured acting user is not a member of this workspace.", { status: 403 });

  return { org, memberships, users, userId: actingUser._id };
}

async function loadSnapshot({ org, memberships, users }) {
  const snapshot = { org, memberships, users };
  const scoped = Object.entries(COLLECTION_MODELS).filter(([name]) => name !== "memberships");
  const results = await Promise.all(scoped.map(([, Model]) => Model.find({ orgId: org._id }).lean()));
  scoped.forEach(([name], i) => (snapshot[name] = results[i]));
  return snapshot;
}

async function persistChanges(orgId, userId, changes) {
  if (changes.org) {
    const { _id, ...rest } = changes.org;
    await Organization.replaceOne({ _id: orgId }, { _id: orgId, ...rest, slug: ORG_SLUG() });
  }
  for (const [collection, docs] of Object.entries(changes.put ?? {})) {
    const latest = [...new Map(docs.map((d) => [d._id, d])).values()];
    if (collection === "users") {
      // Only the acting user's own profile can be edited.
      await Promise.all(latest.filter((u) => u._id === userId).map((u) => User.replaceOne({ _id: u._id }, u)));
      continue;
    }
    const Model = COLLECTION_MODELS[collection];
    if (!Model) continue;
    await Model.bulkWrite(
      latest.map((doc) => ({ replaceOne: { filter: { _id: doc._id, orgId }, replacement: { ...doc, orgId }, upsert: true } }))
    );
  }
  for (const [collection, ids] of Object.entries(changes.del ?? {})) {
    const Model = COLLECTION_MODELS[collection];
    if (Model && ids.length) await Model.deleteMany({ orgId, _id: { $in: ids } });
  }
}

export async function getWorkspace() {
  const ctx = await resolveContext();
  const snapshot = await loadSnapshot(ctx);
  return { ...snapshot, currentUserId: ctx.userId };
}

// Mutations are serialized per server process so concurrent requests cannot interleave
// their read-modify-write cycles.
let queue = Promise.resolve();

export function runAction(action) {
  const run = async () => {
    const ctx = await resolveContext();
    const snapshot = await loadSnapshot(ctx);
    const { changes, result } = applyAction(snapshot, action, { orgId: ctx.org._id, userId: ctx.userId, now: new Date(), newId });
    await persistChanges(ctx.org._id, ctx.userId, changes);
    return { result, changes };
  };
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}
