"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { TaskTable } from "@/components/tasks/TaskRow";
import { useTaskManagement } from "@/components/tasks/taskHooks";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Avatar, Breadcrumbs, Button, cx, EmptyNote, EmptyState, OnHoldPill, Page, Pill } from "@/components/ui/primitives";
import { useAction } from "@/lib/client/useAction";
import { formatShortDate, todayISO } from "@/lib/format";
import { canManageProject } from "@/lib/permissions";
import { isPastDeadline, projectTrail } from "@/lib/selectors";

/** One labelled fact in the project's details card: Deadline / Nov 5. */
function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="mb-2 text-xs font-medium text-faint">{label}</dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-x-[18px] gap-y-2">{children}</dd>
    </div>
  );
}

export function ProjectDetailView() {
  const { id } = useParams();
  const { data, lookup, currentUser } = useWorkspace();
  const overlays = useOverlays();
  const { canManage } = useTaskManagement();
  const { run, busy } = useAction();
  const [archiving, setArchiving] = useState(false);
  const project = lookup.projects[id];

  if (!project) {
    return (
      <Page width="md">
        <EmptyNote action={<Button href="/company" size="sm">Back to company</Button>}>This project doesn’t exist, or the link is wrong.</EmptyNote>
      </Page>
    );
  }

  const today = todayISO();
  // Open tasks first, in the order they were added; done ones after.
  const tasks = data.tasks.filter((t) => t.projectId === id).sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));
  const members = project.memberIds.map((uid) => lookup.users[uid]).filter(Boolean);
  const manageProject = canManageProject(project, currentUser);
  const late = isPastDeadline(project, today) && !project.archived;

  const archive = async () => {
    if (await run({ type: "project.archive", id, data: { archived: true } }, { success: "Project archived" })) setArchiving(false);
  };

  return (
    <Page className="gap-0">
      <header>
        <Breadcrumbs items={projectTrail(project, lookup.clients)} className="mb-2" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[32px] leading-[1.1] font-normal tracking-[-0.035em] text-strong sm:text-[38px]">{project.name}</h1>
              {project.onHold && <OnHoldPill />}
              {project.archived && <Pill tone="neutral">Archived</Pill>}
            </div>
            <p className="mt-2 text-sm text-secondary">{project.description || "No description"}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            {manageProject && (
              <ActionMenu
                label="Project actions"
                items={[
                  {
                    label: project.onHold ? "Resume project" : "Put on hold",
                    onClick: () => run({ type: "project.hold", id, data: { onHold: !project.onHold } }, { success: project.onHold ? "Project resumed" : "Project put on hold" }),
                  },
                  !project.isInternal && {
                    label: project.archived ? "Unarchive" : "Archive",
                    tone: project.archived ? undefined : "danger",
                    onClick: () => (project.archived ? run({ type: "project.archive", id, data: { archived: false } }, { success: "Project unarchived" }) : setArchiving(true)),
                  },
                ].filter(Boolean)}
              />
            )}
            {manageProject && (
              <Button size="lg" icon={Pencil} onClick={() => overlays.editProject(id)}>
                Edit
              </Button>
            )}
            {canManage(project) && (
              <Button variant="primary" icon={Plus} onClick={() => overlays.newTask({ projectId: id })}>
                New task
              </Button>
            )}
          </div>
        </div>
      </header>

      <dl className="mt-[26px] mb-[18px] grid grid-cols-1 items-start gap-6 rounded-[24px] border border-card-line bg-card px-[26px] py-6 sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-16">
        <Fact label="Deadline">
          <span className={cx("text-[13px] font-medium", late ? "text-danger" : "text-fg")}>{project.deadline ? formatShortDate(project.deadline) : "No deadline"}</span>
        </Fact>
        <Fact label="Team">
          {members.length ? (
            members.map((u) => (
              <span key={u._id} className="inline-flex items-center gap-2 text-[13px] font-medium text-fg">
                <Avatar user={u} size="team" />
                {u.name}
              </span>
            ))
          ) : (
            <span className="text-[13px] font-medium text-faint">No one yet</span>
          )}
        </Fact>
      </dl>

      {tasks.length ? (
        <TaskTable tasks={tasks} meta="none" className="mb-7" />
      ) : (
        <EmptyState
          title="No tasks yet"
          action={
            canManage(project) && (
              <Button variant="primary" icon={Plus} onClick={() => overlays.newTask({ projectId: id })}>
                New task
              </Button>
            )
          }
        >
          {canManage(project) ? `Break ${project.name} into tasks. Each task gets its own chat.` : "This project’s leads add tasks here."}
        </EmptyState>
      )}

      <ConfirmDialog
        open={archiving}
        onClose={() => setArchiving(false)}
        onConfirm={archive}
        busy={busy}
        tone="danger"
        title="Archive this project?"
        description="It moves to the archived projects at the bottom of the list. Its tasks are kept, and you can unarchive it any time."
        confirmLabel="Archive"
      />
    </Page>
  );
}
