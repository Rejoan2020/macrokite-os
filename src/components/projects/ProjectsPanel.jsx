"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { AvatarStack, Button, cx, EmptyState, OnHoldPill, Pill, SearchField } from "@/components/ui/primitives";
import { formatShortDate, pluralize, todayISO } from "@/lib/format";
import { canCreateProject } from "@/lib/permissions";
import { isOpenTask, isPastDeadline, matches } from "@/lib/selectors";

/** Soonest deadline first, no deadline last, then by name. */
const byDeadline = (a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999") || a.name.localeCompare(b.name);

/**
 * The Projects card on a client's page and the Company page: a title with the count, search and
 * New project, then project tiles (two across, three on wide cards).
 */
export function ProjectsPanel({ projects, clientId = null, ownerLabel = "this client", showCount = true, className }) {
  const { currentUser } = useWorkspace();
  const overlays = useOverlays();
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const live = projects.filter((p) => !p.archived && matches(query, p.name, p.description)).sort(byDeadline);
  const archived = projects.filter((p) => p.archived && matches(query, p.name, p.description)).sort(byDeadline);
  const canCreate = canCreateProject(currentUser);
  const newProject = canCreate && (
    <Button variant="primary" icon={Plus} onClick={() => overlays.newProject({ clientId })}>
      New project
    </Button>
  );

  return (
    <section aria-labelledby="projects-title" className={cx("@container flex min-w-0 flex-col rounded-[24px] border border-card-line bg-card px-6 pt-[22px] pb-6", className)}>
      <div className="mb-4 flex items-center gap-2.5">
        <h2 id="projects-title" className="text-lg font-medium tracking-[-0.02em] text-strong">
          Projects
        </h2>
        {showCount && <span className="rounded-full bg-selected px-2 py-px text-[11px] font-semibold text-secondary tabular-nums">{projects.filter((p) => !p.archived).length}</span>}
      </div>

      {projects.length ? (
        <>
          <div className="mb-[22px] flex flex-wrap items-center gap-2.5">
            <SearchField value={query} onChange={setQuery} placeholder="Search projects" className="flex-[1_1_220px] bg-raised" />
            {newProject}
          </div>
          {live.length ? (
            <div className="grid grid-cols-1 gap-[18px] @min-[560px]:grid-cols-2 @min-[900px]:grid-cols-3">
              {live.map((p) => (
                <ProjectCard key={p._id} project={p} />
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-secondary">{query ? "No projects match." : "Every project here is archived."}</p>
          )}
          {archived.length > 0 && (
            <div className="mt-5 flex flex-col gap-4">
              <button type="button" aria-expanded={showArchived} onClick={() => setShowArchived((v) => !v)} className="self-start text-[13px] font-medium text-secondary underline decoration-line underline-offset-4 hover:text-fg">
                {showArchived ? "Hide" : "Show"} {pluralize(archived.length, "archived project")}
              </button>
              {showArchived && (
                <div className="grid grid-cols-1 gap-[18px] @min-[560px]:grid-cols-2 @min-[900px]:grid-cols-3">
                  {archived.map((p) => (
                    <ProjectCard key={p._id} project={p} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <EmptyState title="No projects yet" action={newProject} className="py-10">
          Projects hold the tasks for {ownerLabel}. Create the first one.
        </EmptyState>
      )}
    </section>
  );
}

export function ProjectCard({ project }) {
  const { data, lookup } = useWorkspace();
  const today = todayISO();
  const tasks = data.tasks.filter((t) => t.projectId === project._id);
  const open = tasks.filter(isOpenTask).length;
  const late = isPastDeadline(project, today) && !project.archived;
  const team = project.memberIds.map((id) => lookup.users[id]).filter(Boolean);

  return (
    <Link href={`/projects/${project._id}`} className="flex flex-col rounded-[24px] bg-raised p-6 transition-colors hover:bg-input">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-strong">{project.name}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {project.onHold && <OnHoldPill />}
          {project.archived && <Pill tone="neutral">Archived</Pill>}
        </span>
      </div>
      <span className="mt-1.5 truncate text-[13px] text-secondary">{project.description || "No description"}</span>
      <span className="mt-2 text-xs text-faint">
        {pluralize(tasks.length, "task")} · {open} open
      </span>
      <div className="mt-[22px] flex items-center justify-between gap-2.5 border-t border-line pt-[18px]">
        <span className={cx("text-[13px] font-medium", late ? "text-danger" : project.deadline ? "text-strong" : "text-faint")}>{project.deadline ? formatShortDate(project.deadline) : "No deadline"}</span>
        <AvatarStack users={team} max={4} />
      </div>
    </Link>
  );
}
