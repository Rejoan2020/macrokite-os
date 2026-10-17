"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { AvatarStack, Button, LogoTile, Page, PageHeader } from "@/components/ui/primitives";
import { pluralize } from "@/lib/format";
import { canManageClients } from "@/lib/permissions";
import { isOpenTask } from "@/lib/selectors";

/** People working on a set of projects, each once. */
export function projectPeople(projects, users) {
  return [...new Set(projects.flatMap((p) => p.memberIds))].map((id) => users[id]).filter((u) => u?.active);
}

export function ClientsView() {
  const { data, currentUser } = useWorkspace();
  const overlays = useOverlays();
  const clients = [...data.clients].sort((a, b) => a.name.localeCompare(b.name));
  const canManage = canManageClients(currentUser);

  return (
    <Page>
      <PageHeader
        title="Clients"
        actions={
          canManage &&
          clients.length > 0 && (
            <Button variant="primary" icon={Plus} onClick={overlays.newClient}>
              New client
            </Button>
          )
        }
      />
      {clients.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(380px,100%),1fr))] gap-4">
          {clients.map((c) => (
            <ClientCard key={c._id} client={c} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-[22px] border border-dashed border-dash px-6 py-16 text-center">
          <h2 className="text-[22px] font-medium tracking-[-0.01em] text-strong">No clients yet</h2>
          <p className="max-w-[400px] text-[14px] text-secondary">
            {canManage ? "Add a client to manage their projects, tasks and conversations in one place." : "Admins add clients here. Their projects, tasks and conversations will live in one place."}
          </p>
          {canManage && (
            <Button variant="primary" icon={Plus} onClick={overlays.newClient} className="mt-4">
              New client
            </Button>
          )}
        </div>
      )}
    </Page>
  );
}

function ClientCard({ client }) {
  const { data, lookup } = useWorkspace();
  const projects = data.projects.filter((p) => p.clientId === client._id && !p.archived);
  const ids = new Set(projects.map((p) => p._id));
  const open = data.tasks.filter((t) => ids.has(t.projectId) && isOpenTask(t)).length;
  const people = projectPeople(projects, lookup.users);

  return (
    <Link href={`/clients/${client._id}`} className="flex min-h-[184px] flex-col gap-3 rounded-[22px] border border-card-line bg-card p-6 transition-colors hover:bg-hover">
      <span className="flex items-center gap-3.5">
        <LogoTile name={client.name} />
        <span className="truncate text-[18px] font-medium text-strong">{client.name}</span>
      </span>
      {client.description && <span className="line-clamp-2 text-[14px] text-secondary">{client.description}</span>}
      <span className="mt-auto flex items-end justify-between gap-3 pt-3">
        <span className="text-xs text-muted">
          {pluralize(projects.length, "project")} · {pluralize(open, "open task")}
        </span>
        <AvatarStack users={people} max={4} size="xs" />
      </span>
    </Link>
  );
}
