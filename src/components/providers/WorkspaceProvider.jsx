"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { databaseAdapter, demoAdapter, detectMode } from "@/lib/client/storage";
import { indexById } from "@/lib/selectors";
import { DEFAULT_PREFERENCES } from "@/lib/constants";

const WorkspaceContext = createContext(null);

/** Database mode when the server has MongoDB configured; otherwise browser demo storage. */
async function resolveWorkspace() {
  const server = await detectMode();
  if (server.mode === "database") return { mode: "database", currentUserId: server.currentUserId, data: server.data };
  const local = await demoAdapter.load();
  return { mode: "demo", currentUserId: local.currentUserId, data: local.data };
}

export function WorkspaceProvider({ children }) {
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState(null);
  const [mode, setMode] = useState(null);
  const [data, setData] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const stateRef = useRef(null);
  const queueRef = useRef(Promise.resolve());

  const commit = useCallback((next) => {
    stateRef.current = next;
    setData(next);
  }, []);

  const applyLoaded = useCallback(
    ({ mode, currentUserId, data }) => {
      setMode(mode);
      setCurrentUserId(currentUserId);
      commit(data);
      setError(null);
      setStatus("ready");
    },
    [commit]
  );

  const applyError = useCallback((err) => {
    setError(err.message || "Could not load the workspace.");
    setStatus("error");
  }, []);

  useEffect(() => {
    resolveWorkspace().then(applyLoaded, applyError);
  }, [applyLoaded, applyError]);

  const load = useCallback(() => {
    setStatus("loading");
    return resolveWorkspace().then(applyLoaded, applyError);
  }, [applyLoaded, applyError]);

  // Keep demo data in sync when it changes in another tab.
  useEffect(() => {
    if (mode !== "demo") return;
    const onStorage = (event) => {
      if (event.key !== demoAdapter.storageKey) return;
      const saved = demoAdapter.readExternal();
      if (saved) commit(saved.data);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [mode, commit]);

  // Actions run one at a time so each sees the result of the previous one.
  const dispatch = useCallback(
    (action) => {
      const run = async () => {
        const adapter = mode === "database" ? databaseAdapter : demoAdapter;
        const { state, result } = await adapter.dispatch(stateRef.current, action, currentUserId);
        commit(state);
        return result;
      };
      const next = queueRef.current.then(run, run);
      queueRef.current = next.catch(() => {});
      return next;
    },
    [mode, currentUserId, commit]
  );

  const resetDemo = useCallback(() => {
    if (mode !== "demo") return;
    const fresh = demoAdapter.reset();
    setCurrentUserId(fresh.currentUserId);
    commit(fresh.data);
  }, [mode, commit]);

  const value = useMemo(() => {
    if (!data) return { status, error, mode, reload: load };
    const usersById = indexById(data.users);
    return {
      status,
      error,
      mode,
      reload: load,
      data,
      dispatch,
      resetDemo,
      currentUser: usersById[currentUserId],
      currentUserId,
      preferences: { ...DEFAULT_PREFERENCES, ...data.org.preferences },
      lookup: {
        users: usersById,
        clients: indexById(data.clients),
        projects: indexById(data.projects),
        tasks: indexById(data.tasks),
        conversations: indexById(data.conversations),
      },
      members: data.memberships
        .map((m) => ({ ...m, user: usersById[m.userId] }))
        .filter((m) => m.user),
    };
  }, [data, status, error, mode, load, dispatch, resetDemo, currentUserId]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
