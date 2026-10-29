import { applyAction, applyChanges, DomainError } from "../engine";
import { renamedCompanyProject } from "../membership";
import { normalizeSnapshot } from "../compat";
import { buildSeed, SCHEMA_VERSION, SEED_OWNER_ID } from "../seed";

// Browser-side storage adapters. Both expose the same interface so the UI never branches on mode:
//   dispatch(state, action, currentUserId) -> { state, result }

const DEMO_KEY = `macrokite-os:demo:v${SCHEMA_VERSION}`;

const newId = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

function readDemo() {
  try {
    const raw = window.localStorage.getItem(DEMO_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.data?.org?.schemaVersion === SCHEMA_VERSION && parsed.currentUserId ? { ...parsed, data: normalizeSnapshot(parsed.data) } : null;
  } catch {
    return null;
  }
}

function writeDemo(data, currentUserId) {
  try {
    window.localStorage.setItem(DEMO_KEY, JSON.stringify({ savedAt: new Date().toISOString(), currentUserId, data }));
    return true;
  } catch {
    return false;
  }
}

function freshDemo() {
  const fresh = { data: buildSeed(new Date()), currentUserId: SEED_OWNER_ID };
  writeDemo(fresh.data, fresh.currentUserId);
  return fresh;
}

export const demoAdapter = {
  mode: "demo",
  storageKey: DEMO_KEY,
  load() {
    const saved = readDemo();
    if (!saved) return freshDemo();
    const renamed = renamedCompanyProject(saved.data.projects, new Date());
    if (!renamed) return saved;
    const data = { ...saved.data, projects: saved.data.projects.map((p) => (p._id === renamed._id ? renamed : p)) };
    writeDemo(data, saved.currentUserId);
    return { ...saved, data };
  },
  async dispatch(state, action, currentUserId) {
    const { state: next, result } = applyAction(state, action, { orgId: state.org._id, userId: currentUserId, now: new Date(), newId });
    if (!writeDemo(next, currentUserId)) {
      throw new DomainError("Saved for this session only — browser storage is unavailable or full.");
    }
    return { state: next, result };
  },
  reset: freshDemo,
  readExternal: readDemo,
};

async function call(method, url, body) {
  let response;
  try {
    response = await fetch(url, {
      method,
      // The API requires JSON on every write (CSRF guard).
      headers: method === "GET" ? undefined : { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new DomainError("Network error — check your connection and try again.", { status: 0 });
  }
  const payload = await response.json().catch(() => ({}));
  // Session ended (signed out elsewhere, or expired): go through sign-in. A full page load, since
  // the sign-in route redirects to WorkOS.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  if (response.status === 401) window.location.assign("/auth/sign-in");
  if (!response.ok) {
    throw new DomainError(payload.error || `Request failed (${response.status}).`, { status: response.status, fieldErrors: payload.fieldErrors });
  }
  return payload;
}

export const databaseAdapter = {
  mode: "database",
  async dispatch(state, action) {
    const { result, changes, version } = await call("POST", "/api/actions", action);
    const next = applyChanges(state, changes);
    // Up to date when nothing else changed since our copy; otherwise the next poll catches up.
    const current = version && (state.org.version ?? 0) === version.from;
    return { state: { ...next, org: { ...next.org, version: current ? version.to : state.org.version } }, result };
  },
};

/**
 * Asks the server which storage mode is configured. In database mode the reply has the signed-in
 * account and either the workspace (status "member") or what to do first (status "onboarding").
 */
export const fetchWorkspace = (version) => call("GET", version === undefined ? "/api/workspace" : `/api/workspace?version=${version}`);

/** A page of a conversation's messages sent before `before` (database mode): { messages, hasOlder }. */
export const fetchOlderMessages = (conversationId, before) =>
  call("GET", `/api/messages?conversation=${encodeURIComponent(conversationId)}&before=${encodeURIComponent(before)}`);

/** Starts a workspace with the signed-in account as admin (database mode). */
export const createWorkspace = (name) => call("POST", "/api/workspace", { name });
