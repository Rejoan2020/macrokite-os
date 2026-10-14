"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "./WorkspaceProvider";
import { InviteDialog, MeetingDialog, ProjectDialog, TaskDialog } from "@/components/forms/Dialogs";

// One place that owns create/edit dialogs so any page can open them.
const OverlayContext = createContext(null);

export function OverlayProvider({ children }) {
  const router = useRouter();
  const { lookup } = useWorkspace();
  const [overlay, setOverlay] = useState(null); // { kind, id?, defaults? }

  const close = useCallback(() => setOverlay(null), []);

  const api = useMemo(
    () => ({
      newProject: () => setOverlay({ kind: "project" }),
      editProject: (id) => setOverlay({ kind: "project", id }),
      newTask: (defaults) => setOverlay({ kind: "task", defaults }),
      editTask: (id) => setOverlay({ kind: "task", id }),
      newMeeting: (defaults) => setOverlay({ kind: "meeting", defaults }),
      editMeeting: (id) => setOverlay({ kind: "meeting", id }),
      invite: () => setOverlay({ kind: "invite" }),
    }),
    []
  );

  // Edit dialogs read the live record so they never show stale data.
  const record = (collection) => (overlay?.id ? lookup?.[collection][overlay.id] : undefined);
  const isOpen = (kind, collection) => overlay?.kind === kind && (!overlay.id || !!record(collection));

  return (
    <OverlayContext.Provider value={api}>
      {children}
      <ProjectDialog
        open={isOpen("project", "projects")}
        project={record("projects")}
        onClose={close}
        onSaved={(project) => !overlay?.id && router.push(`/projects/${project._id}`)}
      />
      <TaskDialog open={isOpen("task", "tasks")} task={record("tasks")} defaults={overlay?.defaults} onClose={close} />
      <MeetingDialog
        open={isOpen("meeting", "meetings")}
        meeting={record("meetings")}
        defaults={overlay?.defaults}
        onClose={close}
        onSaved={(meeting) => {
          if (!meeting) router.push("/meetings");
          else if (!overlay?.id) router.push(`/meetings/${meeting._id}`);
        }}
      />
      <InviteDialog open={overlay?.kind === "invite"} onClose={close} />
    </OverlayContext.Provider>
  );
}

export function useOverlays() {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error("useOverlays must be used inside OverlayProvider");
  return ctx;
}
