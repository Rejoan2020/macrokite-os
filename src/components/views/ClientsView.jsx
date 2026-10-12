"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, LayoutGrid, Mail, Pencil, Plus, Rows3, Trash2 } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { Avatar, Button, Card, EmptyState, IconButton, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { SearchInput, Segmented } from "@/components/ui/form";
import { DeleteRecordDialog } from "@/components/shared/DeleteRecordDialog";
import { CLIENT_STATUSES, CLIENT_STATUS_META } from "@/lib/constants";
import { matches } from "@/lib/selectors";
import { formatDate, pluralize } from "@/lib/format";

// Remount when the query string changes so URL filters (e.g. dashboard links) always apply.
export function ClientsView() {
  const params = useSearchParams();
  return <ClientsInner key={params.toString()} />;
}

function ClientsInner() {
  const { data, preferences } = useWorkspace();
  const overlays = useOverlays();
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(CLIENT_STATUSES.includes(params.get("status")) ? params.get("status") : "all");
  const [view, setView] = useState("table");
  const [deleting, setDeleting] = useState(null);

  const stats = Object.fromEntries(
    data.clients.map((c) => {
      const projects = data.projects.filter((p) => p.clientId === c._id);
      const ids = new Set(projects.map((p) => p._id));
      return [c._id, { projects: projects.length, active: projects.filter((p) => p.status === "in_progress").length, openTasks: data.tasks.filter((t) => ids.has(t.projectId) && t.status !== "done").length }];
    })
  );

  const filtered = data.clients
    .filter((c) => (status === "all" || c.status === status) && matches(query, c.company, c.name, c.email, c.service))
    .sort((a, b) => a.company.localeCompare(b.company));

  const statusOptions = [
    { value: "all", label: "All", count: data.clients.length },
    ...CLIENT_STATUSES.map((s) => ({ value: s, label: CLIENT_STATUS_META[s].label, count: data.clients.filter((c) => c.status === s).length })),
  ];

  return (
    <>
      <PageHeader
        title="Clients"
        description={`${pluralize(data.clients.length, "client")} · leads, active accounts and past work`}
        actions={<Button variant="primary" icon={Plus} onClick={overlays.newClient}>New client</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput value={query} onChange={setQuery} placeholder="Search by company, contact, email…" className="lg:w-72" label="Search clients" />
        <div className="overflow-x-auto">
          <Segmented label="Filter by status" value={status} onChange={setStatus} options={statusOptions} />
        </div>
        <div className="lg:ml-auto">
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "table", label: "Table", icon: Rows3 },
              { value: "cards", label: "Cards", icon: LayoutGrid },
            ]}
          />
        </div>
      </div>

      {!filtered.length ? (
        <Card>
          {data.clients.length ? (
            <EmptyState icon={Building2} title="No clients match" description="Try a different search or status filter." action={<Button size="sm" onClick={() => { setQuery(""); setStatus("all"); }}>Clear filters</Button>} />
          ) : (
            <EmptyState icon={Building2} title="No clients yet" description="Add your first client to start tracking projects and conversations." action={<Button variant="primary" size="sm" icon={Plus} onClick={overlays.newClient}>New client</Button>} />
          )}
        </Card>
      ) : view === "table" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead className="border-b border-border text-[11px] uppercase tracking-wide text-subtle">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Client</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Contact</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Projects</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Open tasks</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Added</th>
                  <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => (
                  <tr key={c._id} className="cursor-pointer hover:bg-surface-2/60" onClick={() => router.push(`/clients/${c._id}`)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.company} size="md" tone={c.status === "active" ? "teal" : "blue"} />
                        <div className="min-w-0">
                          <Link href={`/clients/${c._id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-fg hover:text-accent">
                            {c.company}
                          </Link>
                          <p className="max-w-64 truncate text-xs text-subtle">{c.service || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge kind="client" value={c.status} /></td>
                    <td className="px-4 py-3">
                      <p className="text-fg">{c.name}</p>
                      <p className="text-xs text-subtle">{c.email}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted">
                      {stats[c._id].projects}
                      {stats[c._id].active > 0 && <span className="text-subtle"> · {stats[c._id].active} active</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted">{stats[c._id].openTasks}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(c.createdAt, preferences.dateFormat)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <IconButton icon={Pencil} size="sm" label={`Edit ${c.company}`} onClick={() => overlays.editClient(c)} />
                        <IconButton icon={Trash2} size="sm" label={`Delete ${c.company}`} onClick={() => setDeleting(c)} className="hover:text-danger" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c._id} className="flex flex-col p-4 transition-colors hover:border-border-strong">
              <div className="flex items-start gap-3">
                <Avatar name={c.company} size="md" tone={c.status === "active" ? "teal" : "blue"} />
                <div className="min-w-0 flex-1">
                  <Link href={`/clients/${c._id}`} className="block truncate text-sm font-semibold text-fg hover:text-accent">
                    {c.company}
                  </Link>
                  <p className="truncate text-xs text-subtle">{c.name}</p>
                </div>
                <StatusBadge kind="client" value={c.status} />
              </div>
              <p className="mt-3 line-clamp-2 min-h-[2.5em] text-xs text-muted">{c.service || "No engagement description."}</p>
              <div className="mt-4 flex items-center gap-3 border-t border-border pt-3 text-xs text-muted">
                <span>{pluralize(stats[c._id].projects, "project")}</span>
                <span>{stats[c._id].openTasks} open tasks</span>
                <a href={`mailto:${c.email}`} className="ml-auto inline-flex items-center gap-1 hover:text-fg" title={`Email ${c.email} with your mail app`}>
                  <Mail className="size-3.5" aria-hidden />
                  <span className="sr-only">Email {c.name}</span>
                </a>
                <IconButton icon={Pencil} size="sm" label={`Edit ${c.company}`} onClick={() => overlays.editClient(c)} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <DeleteRecordDialog kind="client" record={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
