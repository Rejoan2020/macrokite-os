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
import { Avatar, Breadcrumbs, Button, cx, EmptyNote, OnHoldPill, Page, Pill } from "@/components/ui/primitives";
import { useAction } from "@/lib/client/useAction";
import { formatShortDate, todayISO } from "@/lib/format";
import { canManageProject } from "@/lib/permissions";
import { isPastDeadline, projectTrail, sortForList } from "@/lib/selectors";

/** One labelled fact in the project's details card: Deadline / Nov 5. */
function Fact({ label, children }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 text-[15px] font-medium text-strong">{children}</dd>
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
  const tasks = sortForList(data.tasks.filter((t) => t.projectId === id));
  const members = project.memberIds.map((uid) => lookup.users[uid]).filter(Boolean);
  const manageProject = canManageProject(project, currentUser);
  const late = isPastDeadline(project, today) && !project.archived;

  const archive = async () => {
    if (await run({ type: "project.archive", id, data: { archived: true } }, { success: "Project archived" })) setArchiving(false);
  };

  return (
    <Page>
      <header className="flex flex-col gap-2">
        <Breadcrumbs items={projectTrail(project, lookup.clients)} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[32px] leading-tight font-medium tracking-[-0.025em] text-strong sm:text-[38px]">{project.name}</h1>
              {project.onHold && <OnHoldPill />}
              {project.archived && <Pill tone="neutral">Archived</Pill>}
            </div>
            {project.description && <p className="max-w-[760px] text-[15px] text-secondary">{project.description}</p>}
          </div>
          <div className="flex items-center gap-2">
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
              <Button variant="outline" icon={Pencil} onClick={() => overlays.editProject(id)}>
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

      <dl className="flex flex-wrap gap-x-16 gap-y-5 rounded-[22px] border border-card-line bg-card px-6 py-6">
        <Fact label="Deadline">
          <span className={cx(late && "text-danger", !project.deadline && "font-normal text-muted")}>{project.deadline ? formatShortDate(project.deadline) : "No deadline"}</span>
        </Fact>
        <Fact label="Team">
          {members.length ? (
            members.map((u) => (
              <span key={u._id} className="flex items-center gap-2.5">
                <Avatar user={u} size="sm" />
                {u.name}
              </span>
            ))
          ) : (
            <span className="font-normal text-muted">No one yet</span>
          )}
        </Fact>
      </dl>

      {tasks.length ? (
        <TaskTable tasks={tasks} meta="none" />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-[22px] border border-dashed border-dash px-6 py-12 text-center">
          <p className="font-medium text-fg">No tasks yet</p>
          <p className="max-w-[420px] text-[13px] text-muted">{canManage(project) ? "Add the first task for this project." : "This project’s leads add tasks here."}</p>
          {canManage(project) && (
            <Button variant="primary" size="sm" icon={Plus} onClick={() => overlays.newTask({ projectId: id })}>
              New task
            </Button>
          )}
        </div>
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
