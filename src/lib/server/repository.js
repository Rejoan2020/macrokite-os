import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { applyAction, DomainError } from "../engine";
import { canCreateWorkspace, matchMembers, newMember, newWorkspace, pickMembership, rejoinedMember } from "../membership";
import { SCHEMA_VERSION } from "../seed";
import { connectToDatabase } from "./db";
import { revokeInviteEmail, sendInviteEmail } from "./invitations";
import { COLLECTION_MODELS, Conversation, Invite, Organization, Project, User } from "./models";

/**
 * Organization-scoped data access for database mode.
 *
 * Identity: every call takes the signed-in account from ./auth (never from the request body). The
 * account is mapped to a member record, and that record's orgId scopes every read and write below.
 */

const newId = (prefix) => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

const isDuplicateKey = (error) => error?.code === 11000 || error?.writeErrors?.every?.((e) => e.code === 11000);

async function findMembers(identity) {
  const or = [{ authId: identity.id }];
  // { authId: null } also matches records that have no authId field yet.
  if (identity.emailVerified) or.push({ email: identity.email, authId: null });
  return matchMembers(await User.find({ $or: or }).lean(), identity);
}

/** Pending invites for a verified email become memberships the first time that person signs in. */
async function acceptInvites(identity) {
  if (!identity.emailVerified) return;
  const invites = await Invite.find({ email: identity.email, acceptedAt: null }).lean();
  for (const invite of invites) {
    const now = new Date();
    const deleted = await User.findOne({ orgId: invite.orgId, email: identity.email, deletedAt: { $ne: null } }).lean();
    let member;
    if (deleted) {
      // Invited back after being deleted: revive the old record so their history shows their name again.
      member = rejoinedMember(deleted, { identity, now, newId });
      const { _id, ...fields } = member;
      // Matching on deletedAt means a concurrent request can't revive the record twice.
      const { modifiedCount } = await User.updateOne({ _id, deletedAt: { $ne: null } }, { $set: fields });
      if (!modifiedCount) continue;
    } else {
      member = newMember({ orgId: invite.orgId, identity, role: "member", now, newId });
      try {
        await User.create(member);
      } catch (error) {
        // Accepted concurrently by another request, or already a member: nothing more to do here.
        if (!isDuplicateKey(error)) throw error;
        continue;
      }
    }
    const internal = await Project.findOneAndUpdate(
      { orgId: invite.orgId, isInternal: true },
      { $addToSet: { memberIds: member._id }, $set: { updatedAt: now.toISOString() } }
    ).lean();
    if (internal) await Conversation.updateOne({ orgId: invite.orgId, type: "project", projectId: internal._id }, { $addToSet: { memberIds: member._id } });
    await Invite.updateOne({ _id: invite._id, acceptedAt: null }, { $set: { acceptedAt: now.toISOString() } });
  }
}

/**
 * Maps the account to a workspace member: { status: "member", orgId, userId } or, when there is
 * no active membership, { status: "onboarding", removed, canCreate }.
 */
async function resolveAccount(identity) {
  await connectToDatabase();
  await acceptInvites(identity);
  const members = await findMembers(identity);
  const unlinked = members.filter((u) => !u.authId).map((u) => u._id);
  if (unlinked.length) await User.updateMany({ _id: { $in: unlinked }, authId: null }, { $set: { authId: identity.id } });

  const member = pickMembership(members);
  if (member) return { status: "member", orgId: member.orgId, userId: member._id };
  return {
    status: "onboarding",
    removed: members.length > 0,
    canCreate: canCreateWorkspace(identity, process.env.MACROKITE_WORKSPACE_CREATORS),
  };
}

async function loadSnapshot(orgId) {
  const org = await Organization.findById(orgId).lean();
  if (!org) throw new DomainError("Workspace not found.", { status: 404 });
  if (org.schemaVersion !== SCHEMA_VERSION) {
    throw new DomainError(
      "This workspace holds data from an older version of MacroKite OS. Point MONGODB_DB at a new database (or drop the old one) and reload to start fresh.",
      { status: 409 }
    );
  }
  const snapshot = { org };
  const entries = Object.entries(COLLECTION_MODELS);
  const results = await Promise.all(entries.map(([, Model]) => Model.find({ orgId: org._id }).lean()));
  entries.forEach(([name], i) => (snapshot[name] = results[i]));
  return snapshot;
}

async function persistChanges(org, changes) {
  const orgId = org._id;
  if (changes.org) {
    const { _id, ...rest } = changes.org;
    await Organization.replaceOne({ _id: orgId }, { _id: orgId, ...rest, slug: org.slug, schemaVersion: SCHEMA_VERSION });
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

const accountSummary = (identity) => ({ email: identity.email, name: identity.name });

export async function getWorkspace(identity) {
  const account = await resolveAccount(identity);
  if (account.status !== "member") return { ...account, account: accountSummary(identity) };
  const data = await loadSnapshot(account.orgId);
  return { status: "member", account: accountSummary(identity), currentUserId: account.userId, data };
}

/** Starts a workspace with the signed-in account as its first admin. */
export async function createWorkspace(identity, input) {
  await connectToDatabase();
  if (!canCreateWorkspace(identity, process.env.MACROKITE_WORKSPACE_CREATORS)) {
    throw new DomainError("You can’t create a workspace. Ask an admin to invite you instead.", { status: 403 });
  }
  const built = newWorkspace({ name: input?.name, identity, now: new Date(), newId, slugSuffix: randomBytes(3).toString("hex") });
  if (built.error) throw new DomainError("Please fix the highlighted fields.", { fieldErrors: { name: built.error } });
  await User.insertMany(built.users);
  await Project.insertMany(built.projects);
  await Conversation.insertMany(built.conversations);
  // Created last: the workspace only becomes visible once its records exist.
  await Organization.create(built.org);
  return { _id: built.org._id, name: built.org.name };
}

/**
 * Emails for invite actions, after the engine has validated them and before they are saved, so the
 * saved invite records which WorkOS invitation it sent. Returns the action result, plus
 * emailSent/emailError for invites.
 */
async function deliverInviteEmail(identity, snapshot, action, changes, result) {
  if (action.type === "invite.cancel") {
    await revokeInviteEmail(snapshot.invites.find((i) => i._id === action.id));
    return result;
  }
  if (action.type !== "member.invite" && action.type !== "invite.resend") return result;
  const { workosInvitationId, emailError } = await sendInviteEmail(result, identity.id);
  if (emailError) return { ...result, emailSent: false, emailError };
  const invite = { ...result, workosInvitationId };
  changes.put.invites = changes.put.invites.map((doc) => (doc._id === invite._id ? invite : doc));
  return { ...invite, emailSent: true };
}

// Mutations are serialized per server process so concurrent requests cannot interleave
// their read-modify-write cycles.
let queue = Promise.resolve();

export function runAction(identity, action) {
  const run = async () => {
    const account = await resolveAccount(identity);
    if (account.status !== "member") throw new DomainError("You are not a member of a workspace.", { status: 403 });
    const snapshot = await loadSnapshot(account.orgId);
    const { changes, result } = applyAction(snapshot, action, { orgId: snapshot.org._id, userId: account.userId, now: new Date(), newId });
    const delivered = await deliverInviteEmail(identity, snapshot, action, changes, result);
    await persistChanges(snapshot.org, changes);
    return { result: delivered, changes };
  };
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}
