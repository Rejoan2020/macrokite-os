"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Pencil } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { ProjectsPanel } from "@/components/projects/ProjectsPanel";
import { clientMembers } from "@/components/views/ClientsView";
import { AvatarStack, Breadcrumbs, Button, EmptyNote, fullHeightPage, LogoTile, Page } from "@/components/ui/primitives";
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
  const people = clientMembers(client, projects.filter((p) => !p.archived), lookup.users);

  return (
    <div className={fullHeightPage}>
      <header className="flex flex-col gap-3 pb-[18px]">
        <Breadcrumbs items={[{ label: "Clients", href: "/clients" }, { label: client.name }]} />
        <div className="flex flex-wrap items-center gap-3.5">
          <LogoTile name={client.name} />
          <h1 className="min-w-0 truncate text-[28px] font-medium tracking-[-0.03em] text-strong">{client.name}</h1>
          <div className="ml-auto flex items-center gap-3">
            <AvatarStack users={people} max={4} />
            <span className="text-xs text-secondary">{people.length} members</span>
            {canManageClients(currentUser) && (
              <Button icon={Pencil} onClick={() => overlays.editClient(id)}>
                Edit
              </Button>
            )}
          </div>
        </div>
        <About key={client.description} text={client.description} />
      </header>

      <ProjectsPanel projects={projects} clientId={id} ownerLabel="this client" className="min-h-0 flex-1 lg:overflow-y-auto" />
    </div>
  );
}

/** The description under the name, folded to two lines when long. */
function About({ text }) {
  const [open, setOpen] = useState(false);
  if (!text) return <p className="text-sm text-faint">There is no description</p>;
  const long = text.length > 220 || text.split("\n").length > 2;
  return (
    <div className="max-w-[760px]">
      <p className={`text-sm leading-[22px] whitespace-pre-wrap text-secondary ${long && !open ? "line-clamp-2" : ""}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 text-xs font-medium text-secondary underline decoration-line underline-offset-4 hover:text-fg">
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
