"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { FolderKanban, LayoutGrid, Plus, Rows3 } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { AvatarStack, Button, Card, cx, EmptyState, PageHeader, ProgressBar, StatusBadge } from "@/components/ui/primitives";
import { FilterSelect, SearchInput, Segmented } from "@/components/ui/form";
import { ProjectCard } from "@/components/shared/ProjectCard";
import { PRIORITIES, PRIORITY_META, PROJECT_STATUSES, PROJECT_STATUS_META, toOptions } from "@/lib/constants";
import { matches, projectProgress, todayISO } from "@/lib/selectors";
import { formatShortDate, pluralize } from "@/lib/format";

// Remount when the query string changes so URL filters (e.g. dashboard links) always apply.
export function ProjectsView() {
  const params = useSearchParams();
  return <ProjectsInner key={params.toString()} />;
}

function ProjectsInner() {
  const { data, lookup } = useWorkspace();
  const overlays = useOverlays();
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(PROJECT_STATUSES.includes(params.get("status")) ? params.get("status") : "all");
  const [clientId, setClientId] = useState(lookup.clients[params.get("client")] ? params.get("client") : "");
  const [priority, setPriority] = useState("");
  const [view, setView] = useState("cards");
  const today = todayISO();

  const filtered = data.projects
    .filter(
      (p) =>
        (status === "all" || p.status === status) &&
        (!clientId || (clientId === "internal" ? !p.clientId : p.clientId === clientId)) &&
        (!priority || p.priority === priority) &&
        matches(query, p.name, p.description, lookup.clients[p.clientId]?.company)
    )
    .sort((a, b) => (a.status === "completed") - (b.status === "completed") || (a.deadline || "9999").localeCompare(b.deadline || "9999"));

  const clientOptions = [
    ...[...data.clients].sort((a, b) => a.company.localeCompare(b.company)).map((c) => ({ value: c._id, label: c.company })),
    { value: "internal", label: "Internal" },
  ];
  const hasFilters = query || status !== "all" || clientId || priority;

  return (
    <>
      <PageHeader
        title="Projects"
        description={`${pluralize(data.projects.length, "project")} · ${data.projects.filter((p) => p.status === "in_progress").length} in progress`}
        actions={<Button variant="primary" icon={Plus} onClick={() => overlays.newProject(clientId && clientId !== "internal" ? { clientId } : undefined)}>New project</Button>}
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput value={query} onChange={setQuery} placeholder="Search projects or clients…" className="lg:w-72" label="Search projects" />
          <div className="overflow-x-auto">
            <Segmented
              label="Filter by status"
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: "All", count: data.projects.length },
                ...PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_META[s].label, count: data.projects.filter((p) => p.status === s).length })),
              ]}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="Client" value={clientId} onChange={setClientId} options={clientOptions} />
          <FilterSelect label="Priority" value={priority} onChange={setPriority} options={toOptions(PRIORITIES, PRIORITY_META)} />
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={() => { setQuery(""); setStatus("all"); setClientId(""); setPriority(""); }}>
              Clear
            </Button>
          )}
          <div className="ml-auto">
            <Segmented
              label="View"
              value={view}
              onChange={setView}
              options={[
                { value: "cards", label: "Cards", icon: LayoutGrid },
                { value: "table", label: "Table", icon: Rows3 },
              ]}
            />
          </div>
        </div>
      </div>

      {!filtered.length ? (
        <Card>
          <EmptyState
            icon={FolderKanban}
            title={data.projects.length ? "No projects match" : "No projects yet"}
            description={data.projects.length ? "Adjust the filters to see more projects." : "Create a project for a client to start planning work."}
            action={<Button size="sm" variant="primary" icon={Plus} onClick={() => overlays.newProject()}>New project</Button>}
          />
        </Card>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <ProjectCard key={p._id} project={p} />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead className="border-b border-border text-[11px] uppercase tracking-wide text-subtle">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Project</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Priority</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Progress</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Deadline</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Team</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => {
                  const progress = projectProgress(p._id, data.tasks);
                  const late = p.deadline && p.deadline < today && p.status !== "completed";
                  return (
                    <tr key={p._id} className="hover:bg-surface-2/60">
                      <td className="px-4 py-3">
                        <Link href={`/projects/${p._id}`} className="font-medium text-fg hover:text-accent">{p.name}</Link>
                        <p className="text-xs text-subtle">{p.clientId ? lookup.clients[p.clientId]?.company : "Internal"}</p>
                      </td>
                      <td className="px-4 py-3"><StatusBadge kind="project" value={p.status} /></td>
                      <td className="px-4 py-3"><StatusBadge kind="priority" value={p.priority} /></td>
                      <td className="px-4 py-3">
                        <div className="flex w-36 items-center gap-2">
                          <ProgressBar value={progress.percent} label={`${p.name} progress`} />
                          <span className="w-9 text-right text-xs tabular-nums text-muted">{progress.percent}%</span>
                        </div>
                      </td>
                      <td className={cx("px-4 py-3", late ? "text-danger" : "text-muted")}>{p.deadline ? formatShortDate(p.deadline) : "—"}</td>
                      <td className="px-4 py-3"><AvatarStack users={p.memberIds.map((id) => lookup.users[id]).filter(Boolean)} size="xs" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
