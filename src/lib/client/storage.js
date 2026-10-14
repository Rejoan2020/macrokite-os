import { applyAction, applyChanges, DomainError } from "../engine";
import { buildSeed, SCHEMA_VERSION, SEED_OWNER_ID } from "../seed";

// Browser-side storage adapters. Both expose the same interface so the UI never branches on mode:
//   dispatch(state, action, currentUserId) -> { state, result }

const DEMO_KEY = `macrokite-os:demo:v${SCHEMA_VERSION}`;

const newId = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

function readDemo() {
  try {
    const raw = window.localStorage.getItem(DEMO_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.data?.org?.schemaVersion === SCHEMA_VERSION && parsed.currentUserId ? parsed : null;
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
  load: () => readDemo() ?? freshDemo(),
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
  if (!response.ok) {
    throw new DomainError(payload.error || `Request failed (${response.status}).`, { status: response.status, fieldErrors: payload.fieldErrors });
  }
  return payload;
}

export const databaseAdapter = {
  mode: "database",
  async dispatch(state, action) {
    const { result, changes } = await call("POST", "/api/actions", action);
    return { state: applyChanges(state, changes), result };
  },
};

/** Asks the server which storage mode is configured; returns database data when available. */
export const fetchWorkspace = () => call("GET", "/api/workspace");
