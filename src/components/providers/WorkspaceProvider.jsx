"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { databaseAdapter, demoAdapter, fetchWorkspace } from "@/lib/client/storage";
import { indexById, unreadByConversation } from "@/lib/selectors";

const WorkspaceContext = createContext(null);

/** Database mode when the server has MongoDB configured; otherwise browser demo storage. */
async function resolveWorkspace() {
  const server = await fetchWorkspace();
  if (server.mode === "database") return fromServer(server);
  const local = demoAdapter.load();
  return { mode: "demo", status: "ready", currentUserId: local.currentUserId, data: local.data, account: null, onboarding: null };
}

function fromServer({ status, account, currentUserId, data, removed, canCreate }) {
  if (status === "member") return { mode: "database", status: "ready", currentUserId, data, account, onboarding: null };
  return { mode: "database", status: "onboarding", currentUserId: null, data: null, account, onboarding: { removed, canCreate } };
}

export function WorkspaceProvider({ children }) {
  const [status, setStatus] = useState("loading"); // loading | ready | onboarding | error
  const [error, setError] = useState(null);
  const [mode, setMode] = useState(null);
  const [account, setAccount] = useState(null); // signed-in account (database mode)
  const [onboarding, setOnboarding] = useState(null); // { removed, canCreate } when not in a workspace
  const [data, setData] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const stateRef = useRef(null);
  const queueRef = useRef(Promise.resolve());

  const commit = useCallback((next) => {
    stateRef.current = next;
    setData(next);
  }, []);

  const applyLoaded = useCallback(
    ({ mode, status, currentUserId, data, account, onboarding }) => {
      setMode(mode);
      setAccount(account);
      setOnboarding(onboarding);
      setCurrentUserId(currentUserId);
      commit(data);
      setError(null);
      setStatus(status);
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
      if (server.mode !== "database") return;
      // Removed from the workspace mid-session: show the onboarding screen instead.
      if (server.status === "member") commit(server.data);
      else applyLoaded(fromServer(server));
    }).catch(() => {});
  }, [enqueue, mode, commit, applyLoaded]);

  const resetDemo = useCallback(() => {
    if (mode !== "demo") return;
    const fresh = demoAdapter.reset();
    setCurrentUserId(fresh.currentUserId);
    commit(fresh.data);
  }, [mode, commit]);

  const value = useMemo(() => {
    if (!data) return { status, error, mode, account, onboarding, reload: load };
    const users = indexById(data.users);
    const general = data.conversations.find((c) => c.type === "general");
    const projectChats = {};
    const dms = {};
    const tasks = {}; // task discussions by taskId
    const groups = []; // groups the current user is in
    for (const c of data.conversations) {
      if (c.type === "project") projectChats[c.projectId] = c;
      if (c.type === "dm" && c.memberIds.includes(currentUserId)) dms[c.memberIds.find((id) => id !== currentUserId) ?? currentUserId] = c;
      if (c.type === "task") tasks[c.taskId] = c;
      if (c.type === "group" && c.memberIds.includes(currentUserId)) groups.push(c);
    }
    const currentUser = users[currentUserId];
    return {
      status,
      error,
      mode,
      account,
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
      chats: { general, projects: projectChats, dms, tasks, groups },
      lookup: {
        users,
        clients: indexById(data.clients),
        projects: indexById(data.projects),
        tasks: indexById(data.tasks),
        meetings: indexById(data.meetings),
        messages: indexById(data.messages),
        conversations: indexById(data.conversations),
      },
    };
  }, [data, status, error, mode, account, onboarding, load, dispatch, refresh, resetDemo, currentUserId]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

/**
 * Keeps every page current (database mode): polls every 30 seconds while the tab is visible, and
 * right away when you come back to the tab. Open chats poll faster with useLiveUpdates.
 */
export function useBackgroundRefresh(intervalMs = 30_000) {
  const { mode, refresh } = useWorkspace();
  useLiveUpdates(true, intervalMs);
  useEffect(() => {
    if (mode !== "database") return;
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [mode, refresh]);
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
