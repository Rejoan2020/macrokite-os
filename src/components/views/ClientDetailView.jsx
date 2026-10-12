"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Activity, Building2, CalendarDays, FolderKanban, Mail, MessageSquare, Pencil, Phone, Plus, StickyNote, Trash2 } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { useAction } from "@/lib/client/useAction";
import { Avatar, Button, Card, CardHeader, EmptyState, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { Select } from "@/components/ui/form";
import { ProjectCard } from "@/components/shared/ProjectCard";
import { ActivityFeed } from "@/components/shared/Activity";
import { DeleteRecordDialog } from "@/components/shared/DeleteRecordDialog";
import { ConversationSummary } from "@/components/inbox/ConversationSummary";
import { CLIENT_STATUSES, CLIENT_STATUS_META, toOptions } from "@/lib/constants";
import { conversationsSorted } from "@/lib/selectors";
import { formatDate, pluralize } from "@/lib/format";

export function ClientDetailView() {
  const { id } = useParams();
  const { data, lookup, preferences } = useWorkspace();
  const overlays = useOverlays();
  const router = useRouter();
  const { run } = useAction();
  const [deleting, setDeleting] = useState(false);
  const client = lookup.clients[id];

  if (!client) {
    return (
      <Card>
        <EmptyState
          icon={Building2}
          title="Client not found"
          description="It may have been deleted, or the link is incorrect."
          action={<Button href="/clients" size="sm">Back to clients</Button>}
        />
      </Card>
    );
  }

  const projects = data.projects.filter((p) => p.clientId === client._id).sort((a, b) => (a.status === "completed") - (b.status === "completed"));
  const conversations = conversationsSorted(data.conversations.filter((c) => c.clientId === client._id));
  const projectIds = new Set(projects.map((p) => p._id));
  const openTasks = data.tasks.filter((t) => projectIds.has(t.projectId) && t.status !== "done").length;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Clients", href: "/clients" }, { label: client.company }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {client.company}
            <StatusBadge kind="client" value={client.status} />
          </span>
        }
        description={`${client.name} · ${pluralize(projects.length, "project")} · ${openTasks} open tasks`}
        actions={
          <>
            <Button icon={Pencil} onClick={() => overlays.editClient(client)}>Edit</Button>
            <Button icon={MessageSquare} onClick={() => overlays.newThread({ clientId: client._id, visibility: "client" })}>New message</Button>
            <Button variant="primary" icon={Plus} onClick={() => overlays.newProject({ clientId: client._id })}>New project</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <section aria-labelledby="client-projects">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="client-projects" className="flex items-center gap-2 text-[13px] font-semibold">
                <FolderKanban className="size-4 text-subtle" aria-hidden /> Projects
              </h2>
              {projects.length > 0 && (
                <Link href={`/projects?client=${client._id}`} className="text-xs text-muted hover:text-fg">
                  View in projects
                </Link>
              )}
            </div>
            {projects.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {projects.map((p) => (
                  <ProjectCard key={p._id} project={p} />
                ))}
              </div>
            ) : (
              <Card>
                <EmptyState
                  icon={FolderKanban}
                  title="No projects for this client"
                  description="Create a project to plan work, assign tasks and track progress."
                  action={<Button size="sm" variant="primary" icon={Plus} onClick={() => overlays.newProject({ clientId: client._id })}>New project</Button>}
                  compact
                />
              </Card>
            )}
          </section>

          <Card>
            <CardHeader
              title="Communication history"
              icon={MessageSquare}
              description="Client-facing and internal threads linked to this client."
              action={<Button size="sm" icon={Plus} onClick={() => overlays.newThread({ clientId: client._id, visibility: "client" })}>New thread</Button>}
            />
            {conversations.length ? (
              <ul className="divide-y divide-border">
                {conversations.map((c) => (
                  <li key={c._id}>
                    <ConversationSummary conversation={c} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={MessageSquare} title="No conversations yet" description="Start a thread to keep a record of decisions and requests." compact />
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Details" icon={Building2} />
            <dl className="flex flex-col gap-4 p-4 text-[13px]">
              <div className="flex items-center gap-3">
                <Avatar name={client.name} size="md" />
                <div>
                  <dt className="sr-only">Contact</dt>
                  <dd className="font-medium text-fg">{client.name}</dd>
                  <dd className="text-xs text-subtle">Primary contact</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Mail className="mt-0.5 size-3.5 text-subtle" aria-hidden />
                <div>
                  <dt className="sr-only">Email</dt>
                  <dd><a className="text-fg hover:text-accent break-all" href={`mailto:${client.email}`}>{client.email}</a></dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Phone className="mt-0.5 size-3.5 text-subtle" aria-hidden />
                <div>
                  <dt className="sr-only">Phone</dt>
                  <dd className="text-muted">{client.phone || "No phone number"}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <CalendarDays className="mt-0.5 size-3.5 text-subtle" aria-hidden />
                <div>
                  <dt className="sr-only">Added</dt>
                  <dd className="text-muted">Added {formatDate(client.createdAt, preferences.dateFormat)}</dd>
                </div>
              </div>
              <div>
                <dt className="mb-1.5 text-xs font-medium text-muted">Status</dt>
                <dd>
                  <Select
                    aria-label="Client status"
                    value={client.status}
                    options={toOptions(CLIENT_STATUSES, CLIENT_STATUS_META)}
                    onChange={(e) => run({ type: "client.update", id: client._id, data: { status: e.target.value } }, { success: "Status updated" })}
                  />
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-xs font-medium text-muted">Services / engagement</dt>
                <dd className="text-fg">{client.service || <span className="text-subtle">Not specified</span>}</dd>
              </div>
              <div>
                <dt className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
                  <StickyNote className="size-3" aria-hidden /> Internal notes
                </dt>
                <dd className="whitespace-pre-wrap text-muted">{client.notes || <span className="text-subtle">No notes</span>}</dd>
              </div>
            </dl>
            <div className="border-t border-border p-3">
              <Button variant="danger" size="sm" icon={Trash2} onClick={() => setDeleting(true)}>
                Delete client
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Activity" icon={Activity} />
            <div className="py-1">
              <ActivityFeed filter={(a) => a.clientId === client._id} limit={8} emptyText="Changes to this client’s projects and threads will appear here." />
            </div>
          </Card>
        </div>
      </div>

      {deleting && <DeleteRecordDialog kind="client" record={client} onClose={() => setDeleting(false)} onDeleted={() => router.push("/clients")} />}
    </>
  );
}
