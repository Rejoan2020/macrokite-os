import { applyAction, applyChanges, DomainError } from "../engine";
import { buildSeed, SEED_OWNER_ID } from "../seed";

// Browser-side storage adapters. Both expose the same interface so the UI never branches on mode:
//   load()            -> { data, currentUserId }
//   dispatch(state, action, currentUserId) -> { state, result }

const DEMO_KEY = "macrokite-os:demo:v1";

const newId = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

function readDemo() {
  try {
    const raw = window.localStorage.getItem(DEMO_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.data?.org && parsed.currentUserId ? parsed : null;
  } catch {
    return null;
  }
}

function writeDemo(data, currentUserId) {
  try {
    window.localStorage.setItem(DEMO_KEY, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), currentUserId, data }));
    return true;
  } catch {
    return false;
  }
}

export const demoAdapter = {
  mode: "demo",
  storageKey: DEMO_KEY,
  async load() {
    const saved = readDemo();
    if (saved) return saved;
    const fresh = { data: buildSeed(new Date()), currentUserId: SEED_OWNER_ID };
    writeDemo(fresh.data, fresh.currentUserId);
    return fresh;
  },
  async dispatch(state, action, currentUserId) {
    const { state: next, result } = applyAction(state, action, { orgId: state.org._id, userId: currentUserId, now: new Date(), newId });
    if (!writeDemo(next, currentUserId)) {
      throw new DomainError("Saved for this session only — browser storage is unavailable or full.");
    }
    return { state: next, result };
  },
  reset() {
    const fresh = { data: buildSeed(new Date()), currentUserId: SEED_OWNER_ID };
    writeDemo(fresh.data, fresh.currentUserId);
    return fresh;
  },
  readExternal: readDemo,
};

const enc = encodeURIComponent;

function requestFor(action) {
  switch (action.type) {
    case "client.create": return ["POST", "/api/clients", action.data];
    case "client.update": return ["PATCH", `/api/clients/${enc(action.id)}`, action.data];
    case "client.delete": return ["DELETE", `/api/clients/${enc(action.id)}`];
    case "project.create": return ["POST", "/api/projects", action.data];
    case "project.update": return ["PATCH", `/api/projects/${enc(action.id)}`, action.data];
    case "project.delete": return ["DELETE", `/api/projects/${enc(action.id)}`];
    case "task.create": return ["POST", "/api/tasks", action.data];
    case "task.update": return ["PATCH", `/api/tasks/${enc(action.id)}`, action.data];
    case "task.move": return ["POST", `/api/tasks/${enc(action.id)}/move`, action.data];
    case "task.delete": return ["DELETE", `/api/tasks/${enc(action.id)}`];
    case "conversation.create": return ["POST", "/api/conversations", action.data];
    case "conversation.read": return ["POST", `/api/conversations/${enc(action.id)}/read`];
    case "conversation.delete": return ["DELETE", `/api/conversations/${enc(action.id)}`];
    case "message.create": return ["POST", `/api/conversations/${enc(action.conversationId)}/messages`, action.data];
    case "workspace.update": return ["PATCH", "/api/workspace", action.data];
    case "profile.update": return ["PATCH", "/api/profile", action.data];
    default: throw new DomainError(`Unknown action “${action.type}”.`);
  }
}

async function call(method, url, body) {
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new DomainError("Network error — check your connection and try again.", { status: 0 });
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new DomainError(payload.error || `Request failed (${response.status}).`, { status: response.status, fieldErrors: payload.fieldErrors });
  }
  return payload;
}

export const databaseAdapter = {
  mode: "database",
  async dispatch(state, action) {
    const [method, url, body] = requestFor(action);
    const { result, changes } = await call(method, url, body);
    return { state: applyChanges(state, changes), result };
  },
};

/** Asks the server which storage mode is configured; returns database data when available. */
export async function detectMode() {
  const payload = await call("GET", "/api/workspace");
  return payload;
}
