"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { StatTile } from "@/components/ui/StatTile";
import { AvatarStack, Button, CountBadge, cx, EmptyNote, OnHoldPill, Page, PageHeader, PhaseBar, Pill, SearchField, Summary, TabGroup } from "@/components/ui/primitives";
import { usePersistentState } from "@/lib/client/usePersistentState";
import { phaseName, phaseStep } from "@/lib/phases";
import { firstName, formatShortDate, parseDate, pluralize, todayISO } from "@/lib/format";
import { canCreateProject, projectLeadIds } from "@/lib/permissions";
import { isOverdue, isPastDeadline, matches } from "@/lib/selectors";

/** "in 12 days", "today", "5 days late". */
function deadlineHint(project, today) {
  if (!project.deadline) return null;
  const days = Math.round((parseDate(project.deadline) - parseDate(today)) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return days > 0 ? `in ${days} days` : `${pluralize(-days, "day")} late`;
}

/** Summary tiles; each one is also a filter. */
const TILES = [
  { key: "active", label: "Active", test: (row) => !row.project.onHold },
  { key: "attention", label: "Need attention", test: (row) => row.overdue > 0 || row.late, tone: "danger" },
  { key: "onHold", label: "On hold", test: (row) => row.project.onHold },
];

/** Active and on-hold projects alike: soonest deadline first, no deadline last, then by name. */
const byDeadline = (a, b) => (a.project.deadline || "9999").localeCompare(b.project.deadline || "9999") || a.project.name.localeCompare(b.project.name);

/** Projects in two sections, yours and everyone else's, with archived ones folded away at the bottom. */
export function ProjectsView() {
  const { data, unread, chats, lookup, currentUser, currentUserId } = useWorkspace();
  const overlays = useOverlays();
  const [view, setView] = usePersistentState("projects-view", "table");
  const [focus, setFocus] = useState(null);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const today = todayISO();

  // One row per project with the numbers the page shows.
  const rows = data.projects.map((p) => ({
    project: p,
    overdue: data.tasks.filter((t) => t.projectId === p._id && isOverdue(t, today)).length,
    late: isPastDeadline(p, today) && !p.archived,
    team: p.memberIds.map((id) => lookup.users[id]).filter(Boolean),
    leads: projectLeadIds(p).map((id) => lookup.users[id]).filter(Boolean),
    mine: p.memberIds.includes(currentUserId),
    unread: p.memberIds.includes(currentUserId) ? unread[chats.projects[p._id]?._id]?.count ?? 0 : 0,
  }));

  const searched = (list) => list.filter((row) => matches(query, row.project.name, row.project.description));
  const live = rows.filter((row) => !row.project.archived);
  const tile = TILES.find((t) => t.key === focus);
  const tileCounts = Object.fromEntries(TILES.map((t) => [t.key, searched(live).filter((row) => t.test(row)).length]));
  const shown = searched(live)
    .filter((row) => !tile || tile.test(row))
    .sort(byDeadline);
  const sections = [
    { key: "mine", title: "My projects", rows: shown.filter((r) => r.mine), empty: "You’re not a member of any projects that match." },
    { key: "others", title: "Others", rows: shown.filter((r) => !r.mine), empty: "No other projects match." },
  ];
  const archived = searched(rows.filter((row) => row.project.archived)).sort(byDeadline);

  const filtersOn = Boolean(focus || query);
  const clearFilters = () => {
    setFocus(null);
    setQuery("");
  };

  const renderRows = (list) =>
    view === "cards" ? (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-4">
        {list.map((row) => (
          <ProjectCard key={row.project._id} row={row} today={today} />
        ))}
      </div>
    ) : (
      <ProjectTable rows={list} today={today} />
    );

  return (
    <Page>
      <PageHeader
        title="Projects"
        summary={
          <Summary
            parts={[
              `${live.filter((r) => !r.project.onHold).length} active`,
              live.some((r) => r.project.onHold) && `${live.filter((r) => r.project.onHold).length} on hold`,
              live.some((r) => r.late) && <span className="text-danger">{live.filter((r) => r.late).length} past deadline</span>,
            ]}
          />
        }
        actions={
          canCreateProject(currentUser) && (
            <Button variant="primary" icon={Plus} onClick={overlays.newProject}>
              New project
            </Button>
          )
        }
      />

      <div className="grid grid-cols-3 gap-2.5" aria-label="Filter by">
        {TILES.map((t) => (
          <StatTile key={t.key} label={t.label} count={tileCounts[t.key]} tone={t.tone} active={focus === t.key} onClick={() => setFocus(focus === t.key ? null : t.key)} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchField value={query} onChange={setQuery} placeholder="Search projects" className="flex-[1_1_220px]" />
        <div className="ml-auto flex items-center gap-2.5">
          {filtersOn && (
            <button type="button" onClick={clearFilters} className="h-11 px-2 text-[13px] text-accent hover:text-accent-light">
              Clear filters
            </button>
          )}
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
      </div>

      {sections.map((section) => (
        <section key={section.key} aria-labelledby={`ps-${section.key}`} className="flex flex-col gap-3">
          <h2 id={`ps-${section.key}`} className="label-caps text-secondary">
            {section.title} · {section.rows.length}
          </h2>
          {section.rows.length ? renderRows(section.rows) : <EmptyNote>{section.empty}</EmptyNote>}
        </section>
      ))}

      {archived.length > 0 && (
        <section aria-label="Archived projects" className="flex flex-col gap-3">
          <button
            type="button"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((v) => !v)}
            className="flex h-12 items-center justify-between rounded-xl border border-dashed border-dash px-[18px] font-medium text-muted hover:text-fg"
          >
            Archived · {archived.length}
            <span className="text-accent">{showArchived ? "Hide" : "Show"}</span>
          </button>
          {showArchived && renderRows(archived)}
        </section>
      )}
    </Page>
  );
}

const TABLE_COLUMNS = "grid-cols-[minmax(0,2.4fr)_minmax(0,2fr)_130px_96px_32px]";

function ProjectTable({ rows, today }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-card">
      <div className="min-w-[780px]">
        <div className={cx("label-caps grid gap-5 border-b border-line px-5 py-3 text-[11px] text-muted", TABLE_COLUMNS)}>
          <span>Project</span>
          <span>Phase</span>
          <span>Deadline</span>
          <span>Team</span>
          <span className="sr-only">Unread chat</span>
        </div>
        {rows.map((row) => (
          <ProjectTableRow key={row.project._id} row={row} today={today} />
        ))}
      </div>
    </div>
  );
}

function PhaseCell({ project }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between gap-2 text-[13px]">
        <span className="truncate font-medium">{phaseName(project, project.phase)}</span>
        <span className="font-mono text-muted">
          {phaseStep(project).index + 1}/{phaseStep(project).count}
        </span>
      </div>
      <PhaseBar project={project} />
    </div>
  );
}

function DeadlineCell({ row, today }) {
  const hint = deadlineHint(row.project, today);
  return (
    <div className="flex flex-col gap-0.5 text-[13px]">
      <span className={cx(row.late ? "font-medium text-danger" : "text-soft")}>{row.project.deadline ? formatShortDate(row.project.deadline) : "No deadline"}</span>
      {hint && !row.project.archived && <span className={cx("text-[12px]", row.late ? "text-danger" : "text-muted")}>{hint}</span>}
    </div>
  );
}

function Leads({ leads }) {
  if (!leads.length) return null;
  return (
    <span className="text-[12px] text-muted">
      Lead{leads.length > 1 ? "s" : ""}: <span className="text-secondary">{leads.map((u) => firstName(u.name)).join(", ")}</span>
    </span>
  );
}

/** Red note for projects with overdue tasks. */
function OverdueNote({ count }) {
  return count > 0 ? <span className="text-[12px] font-medium text-danger">{pluralize(count, "overdue task")}</span> : null;
}

function ProjectTableRow({ row, today }) {
  const { project } = row;
  return (
    <div className={cx("relative grid items-center gap-5 border-b border-row px-5 py-4 last:border-b-0 hover:bg-hover/40", TABLE_COLUMNS)}>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/projects/${project._id}`} className="font-semibold text-strong after:absolute after:inset-0">
            {project.name}
          </Link>
          {project.onHold && <OnHoldPill />}
          {project.archived && <Pill tone="neutral">Archived</Pill>}
        </div>
        {project.description && <span className="truncate text-[13px] text-muted">{project.description}</span>}
        <span className="flex flex-wrap gap-x-3">
          <Leads leads={row.leads} />
          <OverdueNote count={row.overdue} />
        </span>
      </div>
      <PhaseCell project={project} />
      <DeadlineCell row={row} today={today} />
      <AvatarStack users={row.team} max={3} />
      <div className="flex justify-end">
        <CountBadge count={row.unread} label={`${row.unread} unread messages in project chat`} />
      </div>
    </div>
  );
}

function ProjectCard({ row, today }) {
  const { project } = row;
  return (
    <Link
      href={`/projects/${project._id}`}
      className={cx("flex min-h-[220px] flex-col gap-3 rounded-xl border bg-card p-5 transition-colors hover:bg-hover/40", row.late || row.overdue ? "border-danger-line" : "border-line")}
    >
      <div className="flex items-start justify-between gap-2.5">
        <span className="text-base font-semibold text-strong">{project.name}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {project.onHold && <OnHoldPill />}
          {project.archived && <Pill tone="neutral">Archived</Pill>}
          <CountBadge count={row.unread} label={`${row.unread} unread messages in project chat`} />
        </span>
      </div>
      {project.description && <span className="text-[13px] leading-normal text-muted">{project.description}</span>}
      <span className="flex flex-wrap gap-x-3">
        <Leads leads={row.leads} />
        <OverdueNote count={row.overdue} />
      </span>
      <div className="mt-auto">
        <PhaseCell project={project} />
      </div>
      <div className="flex items-center justify-between gap-2.5 border-t border-row pt-3">
        <DeadlineCell row={row} today={today} />
        <AvatarStack users={row.team} max={4} />
      </div>
    </Link>
  );
}
