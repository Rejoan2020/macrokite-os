"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { databaseAdapter, demoAdapter, fetchOlderMessages, fetchWorkspace, OPTIMISTIC_ACTIONS, pendingAction, withPending } from "@/lib/client/storage";
import { keepLoadedHistory, withOlderMessages } from "@/lib/history";
import { indexById, unreadByConversation } from "@/lib/selectors";

const WorkspaceContext = createContext(null);

/**
 * Database mode when the server has MongoDB configured; otherwise browser demo storage. `initial` is
 * the server's reply when the page brought it along; otherwise it's fetched.
 */
async function resolveWorkspace(initial) {
  const server = initial ?? (await fetchWorkspace());
  if (server.mode === "database") return fromServer(server);
  const local = demoAdapter.load();
  return { mode: "demo", status: "ready", currentUserId: local.currentUserId, data: local.data, account: null, onboarding: null };
}

function fromServer({ status, account, currentUserId, data, removed, canCreate }) {
  if (status === "member") return { mode: "database", status: "ready", currentUserId, data, account, onboarding: null };
  return { mode: "database", status: "onboarding", currentUserId: null, data: null, account, onboarding: { removed, canCreate } };
}

export function WorkspaceProvider({ initial = null, children }) {
  const [status, setStatus] = useState("loading"); // loading | ready | onboarding | error
  const [error, setError] = useState(null);
  const [mode, setMode] = useState(null);
  const [account, setAccount] = useState(null); // signed-in account (database mode)
  const [onboarding, setOnboarding] = useState(null); // { removed, canCreate } when not in a workspace
  const [data, setData] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const stateRef = useRef(null); // the data as the server (or demo storage) has it
  const pendingRef = useRef([]); // database-mode actions shown before the server confirms them
  const queueRef = useRef(Promise.resolve());

  // What's shown: the saved data plus the actions still on their way to the server.
  const show = useCallback(() => setData(pendingRef.current.length ? withPending(stateRef.current, pendingRef.current) : stateRef.current), []);

  const commit = useCallback(
    (next) => {
      stateRef.current = next;
      show();
    },
    [show]
  );

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

  // Applied after the first render rather than as initial state, so the server-rendered HTML (the
  // boot screen) matches; the page's data comes with it, so there's no request to wait for.
  useEffect(() => {
    resolveWorkspace(initial).then(applyLoaded, applyError);
  }, [initial, applyLoaded, applyError]);

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
    (action) => {
      // Some actions show right away; the server's reply then replaces them, or removes them if it fails.
      const entry = mode === "database" && OPTIMISTIC_ACTIONS.has(action.type) ? pendingAction(action, currentUserId) : null;
      const settle = () => (pendingRef.current = pendingRef.current.filter((p) => p !== entry));
      if (entry) {
        pendingRef.current = [...pendingRef.current, entry];
        show();
      }
      return enqueue(async () => {
        const adapter = mode === "database" ? databaseAdapter : demoAdapter;
        try {
          const { state, result } = await adapter.dispatch(stateRef.current, action, currentUserId);
          settle();
          commit(state);
          return result;
        } catch (error) {
          if (entry) {
            settle();
            show();
          }
          throw error;
        }
      });
    },
    [enqueue, mode, currentUserId, commit, show]
  );

  /**
   * Pulls the latest snapshot from the server (database mode). Queued behind pending writes. When
   * nothing changed the server says so, and nothing re-renders.
   */
  const refresh = useCallback(() => {
    if (mode !== "database") return Promise.resolve();
    return enqueue(async () => {
      const server = await fetchWorkspace(stateRef.current ? stateRef.current.org.version ?? 0 : undefined);
      if (server.mode !== "database" || server.status === "unchanged") return;
      // Removed from the workspace mid-session: show the onboarding screen instead.
      if (server.status === "member") commit(keepLoadedHistory(stateRef.current, server.data));
      else applyLoaded(fromServer(server));
    }).catch(() => {});
  }, [enqueue, mode, commit, applyLoaded]);

  /** Adds the page of messages before the oldest one loaded in a conversation (database mode). */
  const loadOlder = useCallback(
    async (conversationId) => {
      if (mode !== "database") return;
      const loaded = stateRef.current.messages.filter((m) => m.conversationId === conversationId);
      if (!loaded.length) return;
      const before = loaded.reduce((oldest, m) => (m.createdAt < oldest ? m.createdAt : oldest), loaded[0].createdAt);
      const { messages, hasOlder } = await fetchOlderMessages(conversationId, before);
      commit(withOlderMessages(stateRef.current, conversationId, messages, hasOlder));
    },
    [mode, commit]
  );

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
    // Each conversation's messages, oldest first, without deleted ones: grouped once per change
    // rather than filtered from every message wherever a chat or preview shows.
    const threads = {};
    for (const m of data.messages) if (!m.deletedAt) (threads[m.conversationId] ??= []).push(m);
    for (const list of Object.values(threads)) list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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
      loadOlder,
      resetDemo,
      currentUser,
      currentUserId,
      isAdmin: currentUser?.role === "admin",
      activeUsers: data.users.filter((u) => u.active),
      unread: unreadByConversation(data, currentUserId),
      chats: { general, projects: projectChats, dms, tasks, groups },
      threads,
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
  }, [data, status, error, mode, account, onboarding, load, dispatch, refresh, loadOlder, resetDemo, currentUserId]);

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
