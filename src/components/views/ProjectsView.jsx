"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { AvatarStack, Button, CountBadge, cx, EmptyNote, OnHoldPill, Page, PageHeader, PhaseBar, SearchField, Summary, TabGroup } from "@/components/ui/primitives";
import { usePersistentState } from "@/lib/client/usePersistentState";
import { PHASES, phaseIndex, phaseLabel } from "@/lib/constants";
import { formatShortDate, todayISO } from "@/lib/format";
import { isPastDeadline, matches } from "@/lib/selectors";

const FILTERS = {
  all: (p) => !p.archived,
  onHold: (p) => !p.archived && p.onHold,
  archived: (p) => p.archived,
  ...Object.fromEntries(PHASES.map((phase) => [phase, (p) => !p.archived && p.phase === phase])),
};

export function ProjectsView() {
  const { data, unread, chats, lookup, currentUserId } = useWorkspace();
  const overlays = useOverlays();
  const [view, setView] = usePersistentState("projects-view", "table");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const today = todayISO();

  const live = data.projects.filter(FILTERS.all);
  const onHold = live.filter((p) => p.onHold).length;
  const late = live.filter((p) => isPastDeadline(p, today)).length;

  const tabs = [
    { value: "all", label: "All" },
    ...PHASES.map((p) => ({ value: p, label: phaseLabel(p) })),
    { value: "onHold", label: "On hold", gap: true },
    { value: "archived", label: "Archived" },
  ].map((t) => ({ ...t, count: data.projects.filter(FILTERS[t.value]).length }));

  const projects = data.projects
    .filter(FILTERS[filter])
    .filter((p) => matches(query, p.name, p.description))
    .sort((a, b) => Number(a.isInternal) - Number(b.isInternal) || phaseIndex(a.phase) - phaseIndex(b.phase) || (a.deadline || "9999").localeCompare(b.deadline || "9999"))
    .map((p) => ({
      project: p,
      late: isPastDeadline(p, today) && !p.archived,
      team: p.memberIds.map((id) => lookup.users[id]).filter(Boolean),
      unread: p.memberIds.includes(currentUserId) ? unread[chats.projects[p._id]?._id]?.count ?? 0 : 0,
    }));

  return (
    <Page>
      <PageHeader
        title="Projects"
        summary={<Summary parts={[`${live.length - onHold} active`, onHold > 0 && `${onHold} on hold`, late > 0 && <span className="text-danger">{late} past deadline</span>]} />}
        actions={
          <Button variant="primary" icon={Plus} onClick={overlays.newProject}>
            New project
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <SearchField value={query} onChange={setQuery} placeholder="Search projects" className="w-full sm:w-80" />
        <TabGroup
          role="group"
          label="View"
          value={view}
          onChange={setView}
          items={[
            { value: "cards", label: "Cards" },
            { value: "table", label: "Table" },
          ]}
        />
      </div>

      <TabGroup label="Filter by phase" items={tabs} value={filter} onChange={setFilter} />

      {projects.length === 0 ? (
        <EmptyNote>{query ? "No projects match your search." : "No projects here."}</EmptyNote>
      ) : view === "cards" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(290px,100%),1fr))] gap-4">
          {projects.map((row) => (
            <ProjectCard key={row.project._id} {...row} />
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-line bg-card">
            <div className="min-w-[780px]">
              <div className="label-caps grid grid-cols-[minmax(0,2.4fr)_minmax(0,2fr)_110px_90px_40px] gap-5 border-b border-line px-5 py-3 text-muted">
                <span>Project</span>
                <span>Phase</span>
                <span>Deadline</span>
                <span>Team</span>
                <span className="sr-only">Unread chat</span>
              </div>
              {projects.map((row) => (
                <ProjectTableRow key={row.project._id} {...row} />
              ))}
            </div>
          </div>
          <p className="text-xs text-faint">Each bar has seven steps: Idea, Planning, Design, Build, Test, Launch, Maintain. Archived projects are hidden from All.</p>
        </>
      )}
    </Page>
  );
}

function PhaseCell({ project }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between gap-2 text-[13px]">
        <span className="font-medium">{phaseLabel(project.phase)}</span>
        <span className="font-mono text-muted">{phaseIndex(project.phase) + 1}/7</span>
      </div>
      <PhaseBar phase={project.phase} onHold={project.onHold} />
    </div>
  );
}

function ProjectTableRow({ project, late, team, unread }) {
  return (
    <div className="relative grid grid-cols-[minmax(0,2.4fr)_minmax(0,2fr)_110px_90px_40px] items-center gap-5 border-b border-row px-5 py-4 last:border-b-0 hover:bg-hover/40">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/projects/${project._id}`} className="font-semibold text-strong after:absolute after:inset-0">
            {project.name}
          </Link>
          {project.onHold && <OnHoldPill />}
        </div>
        <span className="truncate text-[13px] text-muted">{project.description}</span>
      </div>
      <PhaseCell project={project} />
      <span className={cx("text-[13px]", late ? "font-medium text-danger" : "text-soft")}>{project.deadline ? formatShortDate(project.deadline) : "—"}</span>
      <AvatarStack users={team} max={3} />
      <div className="flex justify-end">
        <CountBadge count={unread} label={`${unread} unread messages in project chat`} />
      </div>
    </div>
  );
}

function ProjectCard({ project, late, team, unread }) {
  return (
    <Link
      href={`/projects/${project._id}`}
      className={cx("flex min-h-[220px] flex-col gap-3 rounded-xl border bg-card p-5 transition-colors hover:bg-hover/40", late ? "border-danger-line" : "border-line")}
    >
      <div className="flex items-start justify-between gap-2.5">
        <span className="text-base font-semibold text-strong">{project.name}</span>
        {project.onHold && <OnHoldPill />}
      </div>
      <span className="text-[13px] leading-normal text-muted">{project.description}</span>
      <div className="mt-auto">
        <PhaseCell project={project} />
      </div>
      <div className="flex items-center justify-between gap-2.5 border-t border-row pt-3">
        <span className={cx("text-[13px]", late ? "font-medium text-danger" : "text-secondary")}>
          {late ? `Past deadline · ${formatShortDate(project.deadline)}` : project.deadline ? `Due ${formatShortDate(project.deadline)}` : "No deadline"}
        </span>
        <div className="flex items-center gap-2.5">
          <CountBadge count={unread} label={`${unread} unread messages in project chat`} />
          <AvatarStack users={team} max={3} />
        </div>
      </div>
    </Link>
  );
}
