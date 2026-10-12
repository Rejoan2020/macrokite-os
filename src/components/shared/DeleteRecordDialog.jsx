"use client";

import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { useAction } from "@/lib/client/useAction";
import { deletionImpact } from "@/lib/engine";
import { pluralize } from "@/lib/format";

/** Confirms deletion of a client or project and spells out which dependent records go with it. */
export function DeleteRecordDialog({ kind, record, onClose, onDeleted }) {
  const { data } = useWorkspace();
  const { run, busy } = useAction();
  if (!record) return null;

  const impact = deletionImpact(data, kind, record._id);
  const name = kind === "client" ? record.company : record.name;
  const parts = [
    impact.projects && pluralize(impact.projects, "project"),
    impact.tasks && pluralize(impact.tasks, "task"),
    impact.conversations && pluralize(impact.conversations, "conversation"),
  ].filter(Boolean);

  const confirm = async () => {
    const result = await run({ type: `${kind}.delete`, id: record._id }, { success: `${kind === "client" ? "Client" : "Project"} deleted`, successDescription: name });
    if (result) {
      onClose();
      onDeleted?.();
    }
  };

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      onConfirm={confirm}
      busy={busy}
      title={`Delete ${kind}?`}
      confirmLabel={`Delete ${kind}`}
      description={`“${name}” will be permanently deleted. This can’t be undone.`}
      details={
        parts.length ? (
          <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
            Also deletes {parts.join(", ")} linked to this {kind}.
          </p>
        ) : (
          <p className="text-xs text-subtle">No linked projects, tasks or conversations.</p>
        )
      }
    />
  );
}
