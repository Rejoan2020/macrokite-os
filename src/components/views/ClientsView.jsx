"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { AvatarStack, Button, cx, EmptyState, LogoTile, Page, PageHeader } from "@/components/ui/primitives";
import { pluralize } from "@/lib/format";
import { canManageClients } from "@/lib/permissions";
import { isOpenTask } from "@/lib/selectors";

/** A client's members. Clients saved before they had members use the people on their projects. */
export function clientMembers(client, projects, users) {
  const ids = client.memberIds?.length ? client.memberIds : [...new Set(projects.flatMap((p) => p.memberIds))];
  return ids.map((id) => users[id]).filter((u) => u?.active);
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
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2">
          {clients.map((c) => (
            <ClientCard key={c._id} client={c} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No clients yet"
          action={
            canManage && (
              <Button variant="primary" icon={Plus} onClick={overlays.newClient}>
                New client
              </Button>
            )
          }
        >
          {canManage ? "Add a client to manage their projects, tasks and conversations in one place." : "Admins add clients here. Their projects, tasks and conversations will live in one place."}
        </EmptyState>
      )}
    </Page>
  );
}

function ClientCard({ client }) {
  const { data, lookup } = useWorkspace();
  const projects = data.projects.filter((p) => p.clientId === client._id && !p.archived);
  const ids = new Set(projects.map((p) => p._id));
  const open = data.tasks.filter((t) => ids.has(t.projectId) && isOpenTask(t)).length;
  const people = clientMembers(client, projects, lookup.users);

  return (
    <Link href={`/clients/${client._id}`} className="flex flex-col rounded-[24px] border border-card-line bg-card px-6 py-[22px] transition-colors duration-150 hover:bg-card-hover">
      <span className="flex items-center gap-3.5">
        <LogoTile name={client.name} />
        <span className="truncate text-base font-semibold tracking-[-0.01em] text-strong">{client.name}</span>
      </span>
      <span className={cx("mt-3.5 line-clamp-2 min-h-10 text-[13px] leading-5", client.description ? "text-secondary" : "text-faint")}>{client.description || "There is no description"}</span>
      <span className="mt-[18px] flex items-center justify-between gap-3 text-xs font-medium text-faint">
        <span>
          {pluralize(projects.length, "project")} · {pluralize(open, "open task")}
        </span>
        <AvatarStack users={people} max={4} />
      </span>
    </Link>
  );
}
