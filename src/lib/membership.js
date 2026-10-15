import { COMPANY_PROJECT, DEFAULT_NOTIFICATION_PREFS } from "./constants";
import { DEFAULT_PHASES } from "./phases";
import { workspaceInput } from "./schemas";
import { SCHEMA_VERSION } from "./seed";

/**
 * Membership rules for database mode: how a signed-in account maps to workspace members, and the
 * records created when someone joins or starts a workspace. Pure, so it is shared by the server
 * and the tests; the server repository does the reads and writes.
 *
 * Identity: { id, email, emailVerified, name, avatarUrl } as verified by the sign-in provider.
 * A member record belongs to one organization, so a person in two workspaces has two records
 * that share an email and authId.
 */

export const AVATAR_COLORS = ["teal", "violet", "amber", "blue"];

export const normalizeEmail = (email) => String(email ?? "").trim().toLowerCase();

export function displayName(identity) {
  const name = identity.name?.trim();
  if (name) return name.slice(0, 80);
  const local = normalizeEmail(identity.email).split("@")[0] || "New member";
  return local.slice(0, 80);
}

/** Stable color per account so a person looks the same in every workspace. */
export function avatarColorFor(key) {
  let hash = 0;
  for (const char of String(key)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/**
 * Member records this account may act as. A record matches by authId, or by verified email when it
 * has never been linked (invited or pre-existing members). A record linked to a different account
 * never matches, even with the same email. Deleted members never match; only a new invite revives them.
 */
export function matchMembers(users, identity) {
  const email = normalizeEmail(identity.email);
  return users.filter((u) => !u.deletedAt && (u.authId ? u.authId === identity.id : identity.emailVerified && u.email === email));
}

/** Picks the workspace to open: the oldest active membership. */
export function pickMembership(members) {
  const active = members.filter((u) => u.active).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  return active[0] ?? null;
}

/**
 * Who may start a new workspace, from MACROKITE_WORKSPACE_CREATORS: a comma-separated list of
 * emails, or "*" for open sign-up. Empty means nobody. The email must be verified either way.
 */
export function canCreateWorkspace(identity, setting) {
  if (!identity?.emailVerified) return false;
  const allowed = String(setting ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
  return allowed.includes("*") || allowed.includes(normalizeEmail(identity.email));
}

export function newMember({ orgId, identity, role, now, newId }) {
  const at = now.toISOString();
  return {
    _id: newId("usr"),
    orgId,
    authId: identity.id,
    name: displayName(identity),
    email: normalizeEmail(identity.email),
    avatarUrl: identity.avatarUrl ?? "",
    avatarColor: avatarColorFor(identity.id),
    role,
    active: true,
    notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS },
    createdAt: at,
    updatedAt: at,
  };
}

/**
 * A deleted member accepting a new invite: the same record (and so the same id in every task,
 * message and decision) comes back with this account's details as a regular member.
 */
export function rejoinedMember(deleted, { identity, now, newId }) {
  const { _id, createdAt, ...fresh } = newMember({ orgId: deleted.orgId, identity, role: "member", now, newId });
  return { ...deleted, ...fresh, deletedAt: null };
}

/**
 * Workspaces created before the team chat was named "Internal" have a company-wide project with
 * that name too. Returns that project renamed to COMPANY_PROJECT, or null when there is nothing to do.
 */
export function renamedCompanyProject(projects, now) {
  const legacy = projects.find((p) => p.isInternal && p.name === "Internal");
  return legacy ? { ...legacy, name: COMPANY_PROJECT, updatedAt: now.toISOString() } : null;
}

export function slugify(name, suffix) {
  const base = String(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return [base || "workspace", suffix].filter(Boolean).join("-");
}

/** The records for a brand-new workspace with its creator as the first admin. */
export function newWorkspace({ name: rawName, identity, now, newId, slugSuffix }) {
  const parsed = workspaceInput.safeParse({ name: rawName });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a workspace name" };
  const { name } = parsed.data;
  const at = now.toISOString();
  const orgId = newId("org");
  const owner = newMember({ orgId, identity, role: "admin", now, newId });
  const internal = {
    _id: newId("prj"),
    orgId,
    name: COMPANY_PROJECT,
    phases: DEFAULT_PHASES.map((p) => ({ ...p })),
    description: "Company-wide work: hiring, operations, tooling and team rituals.",
    phase: "maintain",
    deadline: "",
    memberIds: [owner._id],
    leadIds: [],
    notes: "",
    onHold: false,
    archived: false,
    isInternal: true,
    createdBy: owner._id,
    createdAt: at,
    updatedAt: at,
  };
  return {
    org: { _id: orgId, name, slug: slugify(name, slugSuffix), schemaVersion: SCHEMA_VERSION, createdAt: at, updatedAt: at },
    users: [owner],
    projects: [internal],
    conversations: [
      { _id: newId("cnv"), orgId, type: "general", projectId: null, memberIds: [owner._id], createdAt: at },
      { _id: newId("cnv"), orgId, type: "project", projectId: internal._id, memberIds: [owner._id], createdAt: at },
    ],
  };
}
