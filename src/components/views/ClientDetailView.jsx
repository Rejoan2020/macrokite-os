"use client";

import { useParams } from "next/navigation";
import { Pencil } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { ProjectsPanel } from "@/components/projects/ProjectsPanel";
import { projectPeople } from "@/components/views/ClientsView";
import { AvatarStack, Breadcrumbs, Button, EmptyNote, LogoTile, Page } from "@/components/ui/primitives";
import { pluralize } from "@/lib/format";
import { canManageClients } from "@/lib/permissions";

export function ClientDetailView() {
  const { id } = useParams();
  const { data, lookup, currentUser } = useWorkspace();
  const overlays = useOverlays();
  const client = lookup.clients[id];

  if (!client) {
    return (
      <Page width="sm">
        <EmptyNote action={<Button href="/clients" size="sm">Back to clients</Button>}>This client doesn’t exist, or it was removed.</EmptyNote>
      </Page>
    );
  }

  const projects = data.projects.filter((p) => p.clientId === id);
  const people = projectPeople(projects.filter((p) => !p.archived), lookup.users);

  return (
    <Page>
      <div className="flex flex-col gap-3">
        <Breadcrumbs items={[{ label: "Clients", href: "/clients" }, { label: client.name }]} />
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <LogoTile name={client.name} size="lg" />
            <h1 className="truncate text-[32px] leading-tight font-medium tracking-[-0.025em] text-strong sm:text-[36px]">{client.name}</h1>
          </div>
          <div className="flex items-center gap-3">
            {people.length > 0 && (
              <span className="flex items-center gap-2 text-[13px] text-secondary">
                <AvatarStack users={people} max={4} size="xs" />
                {pluralize(people.length, "member")}
              </span>
            )}
            {canManageClients(currentUser) && (
              <Button variant="outline" icon={Pencil} onClick={() => overlays.editClient(id)}>
                Edit
              </Button>
            )}
          </div>
        </header>
        {client.description && <p className="max-w-[720px] text-[15px] text-secondary">{client.description}</p>}
      </div>

      <ProjectsPanel projects={projects} clientId={id} emptyText={`No projects for ${client.name} yet.`} />
    </Page>
  );
}
