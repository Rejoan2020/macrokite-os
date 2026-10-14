import "server-only";
import { randomUUID } from "node:crypto";
import { applyAction, DomainError } from "../engine";
import { buildSeed, SCHEMA_VERSION } from "../seed";
import { connectToDatabase } from "./db";
import { COLLECTION_MODELS, Organization } from "./models";

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
  for (const [collection, Model] of Object.entries(COLLECTION_MODELS)) {
    if (seed[collection].length) await Model.insertMany(seed[collection], { ordered: false });
  }
  // Created last: the workspace only becomes visible once its records exist.
  await Organization.create(seed.org);
}

const isDuplicateKey = (error) => error?.code === 11000 || error?.writeErrors?.every?.((e) => e.code === 11000);

// Concurrent first requests share one seeding run; another process seeding at the same time
// surfaces as duplicate keys, which is safe to ignore.
let seeding = null;
function seedOnce() {
  seeding ??= seedDatabase()
    .catch((error) => {
      if (!isDuplicateKey(error)) throw error;
    })
    .finally(() => {
      seeding = null;
    });
  return seeding;
}

async function loadSnapshot() {
  await connectToDatabase();
  let org = await Organization.findOne({ slug: ORG_SLUG() }).lean();
  if (!org && ORG_SLUG() === "macrokite") {
    await seedOnce();
    org = await Organization.findOne({ slug: ORG_SLUG() }).lean();
  }
  if (!org) throw new DomainError(`Workspace “${ORG_SLUG()}” does not exist.`, { status: 404 });
  if (org.schemaVersion !== SCHEMA_VERSION) {
    throw new DomainError(
      "This database holds data from an older version of MacroKite OS. Point MONGODB_DB at a new database (or drop the old one) and reload to start fresh.",
      { status: 409 }
    );
  }

  const snapshot = { org };
  const entries = Object.entries(COLLECTION_MODELS);
  const results = await Promise.all(entries.map(([, Model]) => Model.find({ orgId: org._id }).lean()));
  entries.forEach(([name], i) => (snapshot[name] = results[i]));

  const email = process.env.MACROKITE_ACTING_USER_EMAIL?.trim().toLowerCase();
  const actingUser = email
    ? snapshot.users.find((u) => u.email === email && u.active)
    : snapshot.users.find((u) => u.role === "admin" && u.active);
  if (!actingUser) throw new DomainError("The configured acting user is not an active member of this workspace.", { status: 403 });

  return { snapshot, userId: actingUser._id };
}

async function persistChanges(orgId, changes) {
  if (changes.org) {
    const { _id, ...rest } = changes.org;
    await Organization.replaceOne({ _id: orgId }, { _id: orgId, ...rest, slug: ORG_SLUG(), schemaVersion: SCHEMA_VERSION });
  }
  for (const [collection, docs] of Object.entries(changes.put ?? {})) {
    const Model = COLLECTION_MODELS[collection];
    if (!Model) continue;
    const latest = [...new Map(docs.map((d) => [d._id, d])).values()];
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
  const { snapshot, userId } = await loadSnapshot();
  return { data: snapshot, currentUserId: userId };
}

// Mutations are serialized per server process so concurrent requests cannot interleave
// their read-modify-write cycles.
let queue = Promise.resolve();

export function runAction(action) {
  const run = async () => {
    const { snapshot, userId } = await loadSnapshot();
    const { changes, result } = applyAction(snapshot, action, { orgId: snapshot.org._id, userId, now: new Date(), newId });
    await persistChanges(snapshot.org._id, changes);
    return { result, changes };
  };
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}
