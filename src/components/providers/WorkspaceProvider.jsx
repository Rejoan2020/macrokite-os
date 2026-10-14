"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { databaseAdapter, demoAdapter, fetchWorkspace } from "@/lib/client/storage";
import { indexById, unreadByConversation } from "@/lib/selectors";

const WorkspaceContext = createContext(null);

/** Database mode when the server has MongoDB configured; otherwise browser demo storage. */
async function resolveWorkspace() {
  const server = await fetchWorkspace();
  if (server.mode === "database") return { mode: "database", currentUserId: server.currentUserId, data: server.data };
  const local = demoAdapter.load();
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
  const enqueue = useCallback((run) => {
    const next = queueRef.current.then(run, run);
    queueRef.current = next.catch(() => {});
    return next;
  }, []);

  const dispatch = useCallback(
    (action) =>
      enqueue(async () => {
        const adapter = mode === "database" ? databaseAdapter : demoAdapter;
        const { state, result } = await adapter.dispatch(stateRef.current, action, currentUserId);
        commit(state);
        return result;
      }),
    [enqueue, mode, currentUserId, commit]
  );

  /** Pulls the latest snapshot from the server (database mode). Queued behind pending writes. */
  const refresh = useCallback(() => {
    if (mode !== "database") return Promise.resolve();
    return enqueue(async () => {
      const server = await fetchWorkspace();
      if (server.mode === "database") commit(server.data);
    }).catch(() => {});
  }, [enqueue, mode, commit]);

  const resetDemo = useCallback(() => {
    if (mode !== "demo") return;
    const fresh = demoAdapter.reset();
    setCurrentUserId(fresh.currentUserId);
    commit(fresh.data);
  }, [mode, commit]);

  const value = useMemo(() => {
    if (!data) return { status, error, mode, reload: load };
    const users = indexById(data.users);
    const general = data.conversations.find((c) => c.type === "general");
    const projectChats = {};
    const dms = {};
    for (const c of data.conversations) {
      if (c.type === "project") projectChats[c.projectId] = c;
      if (c.type === "dm" && c.memberIds.includes(currentUserId)) dms[c.memberIds.find((id) => id !== currentUserId) ?? currentUserId] = c;
    }
    const currentUser = users[currentUserId];
    return {
      status,
      error,
      mode,
      reload: load,
      data,
      dispatch,
      refresh,
      resetDemo,
      currentUser,
      currentUserId,
      isAdmin: currentUser?.role === "admin",
      activeUsers: data.users.filter((u) => u.active),
      unread: unreadByConversation(data, currentUserId),
      chats: { general, projects: projectChats, dms },
      lookup: {
        users,
        projects: indexById(data.projects),
        tasks: indexById(data.tasks),
        meetings: indexById(data.meetings),
        messages: indexById(data.messages),
      },
    };
  }, [data, status, error, mode, load, dispatch, refresh, resetDemo, currentUserId]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

/** Polls the server every few seconds while a chat is open (database mode only). */
export function useLiveUpdates(active = true, intervalMs = 4000) {
  const { mode, refresh } = useWorkspace();
  useEffect(() => {
    if (!active || mode !== "database") return;
    const tick = () => document.visibilityState === "visible" && refresh();
    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [active, mode, refresh, intervalMs]);
}
