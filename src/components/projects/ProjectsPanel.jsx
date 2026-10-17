"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { AvatarStack, Button, cx, OnHoldPill, Pill, SearchField } from "@/components/ui/primitives";
import { formatShortDate, pluralize, todayISO } from "@/lib/format";
import { canCreateProject } from "@/lib/permissions";
import { isOpenTask, isOverdue, isPastDeadline, matches } from "@/lib/selectors";

/** Soonest deadline first, no deadline last, then by name. */
const byDeadline = (a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999") || a.name.localeCompare(b.name);

/** The Projects card on a client's page and the Company page: search, New project, and project cards. */
export function ProjectsPanel({ projects, clientId = null, emptyText }) {
  const { currentUser } = useWorkspace();
  const overlays = useOverlays();
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const live = projects.filter((p) => !p.archived && matches(query, p.name, p.description)).sort(byDeadline);
  const archived = projects.filter((p) => p.archived && matches(query, p.name, p.description)).sort(byDeadline);
  const canCreate = canCreateProject(currentUser);

  return (
    <section aria-labelledby="projects-title" className="flex flex-col gap-5 rounded-[22px] border border-card-line bg-card px-6 py-6">
      <h2 id="projects-title" className="flex items-center gap-2.5 text-xl font-medium text-strong">
        Projects
        <span className="rounded-full bg-selected px-2 py-0.5 text-xs font-medium text-secondary tabular-nums">{projects.filter((p) => !p.archived).length}</span>
      </h2>
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchField value={query} onChange={setQuery} placeholder="Search projects" className="flex-[1_1_240px] border-transparent bg-input" />
        {canCreate && (
          <Button variant="primary" icon={Plus} onClick={() => overlays.newProject({ clientId })}>
            New project
          </Button>
        )}
      </div>

      {live.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-4">
          {live.map((p) => (
            <ProjectCard key={p._id} project={p} />
          ))}
        </div>
      ) : (
        <p className="text-[14px] text-muted">{query ? "No projects match." : emptyText}</p>
      )}

      {archived.length > 0 && (
        <div className="flex flex-col gap-4">
          <button type="button" aria-expanded={showArchived} onClick={() => setShowArchived((v) => !v)} className="self-start text-[13px] font-medium text-muted hover:text-fg">
            {showArchived ? "Hide" : "Show"} {pluralize(archived.length, "archived project")}
          </button>
          {showArchived && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-4">
              {archived.map((p) => (
                <ProjectCard key={p._id} project={p} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function ProjectCard({ project }) {
  const { data, lookup } = useWorkspace();
  const today = todayISO();
  const tasks = data.tasks.filter((t) => t.projectId === project._id);
  const open = tasks.filter(isOpenTask).length;
  const overdue = tasks.filter((t) => isOverdue(t, today)).length;
  const late = isPastDeadline(project, today) && !project.archived;
  const team = project.memberIds.map((id) => lookup.users[id]).filter(Boolean);

  return (
    <Link href={`/projects/${project._id}`} className="flex min-h-[172px] flex-col rounded-[18px] bg-raised px-5 pt-5 pb-4 transition-colors hover:bg-hover">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[17px] font-medium text-strong">{project.name}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {project.onHold && <OnHoldPill />}
          {project.archived && <Pill tone="neutral">Archived</Pill>}
        </span>
      </div>
      {project.description && <span className="mt-1 line-clamp-2 text-[14px] text-secondary">{project.description}</span>}
      <span className="mt-1.5 text-xs text-muted">
        {pluralize(tasks.length, "task")} · {open} open
        {overdue > 0 && <span className="font-medium text-danger"> · {overdue} overdue</span>}
      </span>
      <div className="mt-auto flex items-center justify-between gap-2.5 border-t border-line pt-3.5">
        <span className={cx("text-[14px] font-medium", late ? "text-danger" : project.deadline ? "text-strong" : "text-faint")}>{project.deadline ? formatShortDate(project.deadline) : "No deadline"}</span>
        <AvatarStack users={team} max={4} size="xs" />
      </div>
    </Link>
  );
}
