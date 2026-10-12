"use client";

import Link from "next/link";
import { CalendarDays, CheckSquare } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { AvatarStack, cx, ProgressBar, StatusBadge } from "@/components/ui/primitives";
import { isOverdue, projectAttention, projectProgress, todayISO } from "@/lib/selectors";
import { formatShortDate } from "@/lib/format";

export function ProjectCard({ project }) {
  const { data, lookup, preferences } = useWorkspace();
  const progress = projectProgress(project._id, data.tasks);
  const client = project.clientId ? lookup.clients[project.clientId] : null;
  const members = project.memberIds.map((id) => lookup.users[id]).filter(Boolean);
  const today = todayISO();
  const attention = projectAttention(project, data.tasks, { today, dueSoonDays: preferences.dueSoonDays });
  const overdue = data.tasks.filter((t) => t.projectId === project._id && isOverdue(t, today)).length;

  return (
    <Link
      href={`/projects/${project._id}`}
      className="group flex flex-col rounded-xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] text-subtle">{client ? client.company : "Internal"}</p>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-fg group-hover:text-accent">{project.name}</h3>
        </div>
        <StatusBadge kind="project" value={project.status} />
      </div>
      <p className="mt-2 line-clamp-2 min-h-[2.5em] text-xs leading-relaxed text-muted">{project.description || "No description yet."}</p>
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <CheckSquare className="size-3" aria-hidden />
            {progress.done}/{progress.total} tasks
          </span>
          <span className="tabular-nums">{progress.percent}%</span>
        </div>
        <ProgressBar value={progress.percent} label={`${project.name} progress`} />
      </div>
      <div className="mt-4 flex items-center gap-3 text-[11px]">
        <StatusBadge kind="priority" value={project.priority} />
        <span className={cx("inline-flex items-center gap-1", project.deadline && project.deadline < today && project.status !== "completed" ? "text-danger" : "text-muted")}>
          <CalendarDays className="size-3" aria-hidden />
          {project.deadline ? formatShortDate(project.deadline) : "No deadline"}
        </span>
        {overdue > 0 && <span className="text-danger">{overdue} overdue</span>}
        <span className="ml-auto">
          <AvatarStack users={members} size="xs" />
        </span>
      </div>
      {attention && (
        <p className="mt-3 rounded-md bg-[var(--tone-amber-bg)] px-2 py-1 text-[11px] text-[var(--tone-amber-fg)]">{attention.join(" · ")}</p>
      )}
    </Link>
  );
}
