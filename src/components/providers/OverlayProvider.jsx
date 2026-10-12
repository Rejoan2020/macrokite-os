"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "./WorkspaceProvider";
import { ClientFormDialog, ProjectFormDialog, TaskDialog } from "@/components/forms/EntityForms";
import { ThreadDialog } from "@/components/forms/ThreadForm";

// One place that owns create/edit dialogs so any page or quick action can open them.
const OverlayContext = createContext(null);

export function OverlayProvider({ children }) {
  const router = useRouter();
  const { lookup } = useWorkspace();
  const [overlay, setOverlay] = useState(null); // { kind, record?, defaults? }

  const close = useCallback(() => setOverlay(null), []);

  const api = useMemo(
    () => ({
      newClient: () => setOverlay({ kind: "client" }),
      editClient: (client) => setOverlay({ kind: "client", record: client }),
      newProject: (defaults) => setOverlay({ kind: "project", defaults }),
      editProject: (project) => setOverlay({ kind: "project", record: project }),
      newTask: (defaults) => setOverlay({ kind: "task", defaults }),
      openTask: (taskId) => setOverlay({ kind: "task", id: taskId }),
      newThread: (defaults) => setOverlay({ kind: "thread", defaults }),
    }),
    []
  );

  // Edit dialogs read the live record so they never show stale data.
  const task = overlay?.kind === "task" && overlay.id ? lookup?.tasks[overlay.id] : undefined;

  return (
    <OverlayContext.Provider value={api}>
      {children}
      <ClientFormDialog
        open={overlay?.kind === "client"}
        client={overlay?.record}
        onClose={close}
        onSaved={(client) => !overlay?.record && router.push(`/clients/${client._id}`)}
      />
      <ProjectFormDialog
        open={overlay?.kind === "project"}
        project={overlay?.record}
        defaults={overlay?.defaults}
        onClose={close}
        onSaved={(project) => !overlay?.record && router.push(`/projects/${project._id}`)}
      />
      <TaskDialog open={overlay?.kind === "task" && (!overlay.id || !!task)} task={task} defaults={overlay?.defaults} onClose={close} />
      <ThreadDialog
        open={overlay?.kind === "thread"}
        defaults={overlay?.defaults}
        onClose={close}
        onSaved={(conversation) => router.push(`/inbox?thread=${conversation._id}`)}
      />
    </OverlayContext.Provider>
  );
}

export function useOverlays() {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error("useOverlays must be used inside OverlayProvider");
  return ctx;
}
