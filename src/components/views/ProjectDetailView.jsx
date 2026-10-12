"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Activity, CalendarDays, CheckSquare, Columns3, FolderKanban, List, MessageSquare, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { useAction } from "@/lib/client/useAction";
import { Avatar, Button, Card, CardHeader, cx, EmptyState, PageHeader, ProgressBar } from "@/components/ui/primitives";
import { FilterSelect, SearchInput, Segmented } from "@/components/ui/form";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { TaskList } from "@/components/tasks/TaskList";
import { ActivityFeed } from "@/components/shared/Activity";
import { DeleteRecordDialog } from "@/components/shared/DeleteRecordDialog";
import { ConversationSummary } from "@/components/inbox/ConversationSummary";
import { PRIORITIES, PRIORITY_META, PROJECT_STATUSES, PROJECT_STATUS_META, TASK_STATUSES, TASK_STATUS_META, toOptions } from "@/lib/constants";
import { conversationsSorted, isOverdue, matches, projectAttention, projectProgress, sortTasks, todayISO } from "@/lib/selectors";
import { dueLabel, formatDate } from "@/lib/format";

export function ProjectDetailView() {
  const { id } = useParams();
  const { data, lookup, members, preferences } = useWorkspace();
  const overlays = useOverlays();
  const router = useRouter();
  const { run } = useAction();
  const [tab, setTab] = useState("tasks");
  const [taskView, setTaskView] = useState("board");
  const [query, setQuery] = useState("");
  const [assignee, setAssignee] = useState("");
  const [deleting, setDeleting] = useState(false);
  const project = lookup.projects[id];

  if (!project) {
    return (
      <Card>
        <EmptyState icon={FolderKanban} title="Project not found" description="It may have been deleted, or the link is incorrect." action={<Button href="/projects" size="sm">Back to projects</Button>} />
      </Card>
    );
  }

  const today = todayISO();
  const client = project.clientId ? lookup.clients[project.clientId] : null;
  const tasks = data.tasks.filter((t) => t.projectId === project._id);
  const progress = projectProgress(project._id, data.tasks);
  const overdue = tasks.filter((t) => isOverdue(t, today)).length;
  const attention = projectAttention(project, data.tasks, { today, dueSoonDays: preferences.dueSoonDays });
  const conversations = conversationsSorted(data.conversations.filter((c) => c.projectId === project._id));
  const visibleTasks = tasks.filter(
    (t) => (!assignee || (assignee === "none" ? !t.assigneeId : t.assigneeId === assignee)) && matches(query, t.title, t.description, t.labels)
  );
  const team = project.memberIds.map((uid) => lookup.users[uid]).filter(Boolean);
  const update = (data, success) => run({ type: "project.update", id: project._id, data }, { success });

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Projects", href: "/projects" },
          ...(client ? [{ label: client.company, href: `/clients/${client._id}` }] : []),
          { label: project.name },
        ]}
        title={project.name}
        description={
          <>
            {client ? (
              <Link href={`/clients/${client._id}`} className="hover:text-fg">
                {client.company}
              </Link>
            ) : (
              "Internal project"
            )}
            {project.description && <span className="mt-1 block max-w-3xl text-muted">{project.description}</span>}
          </>
        }
        actions={
          <>
            <Button icon={Pencil} onClick={() => overlays.editProject(project)}>Edit</Button>
            <Button variant="primary" icon={Plus} onClick={() => overlays.newTask({ projectId: project._id })}>Add task</Button>
          </>
        }
      />

      <section aria-label="Project summary" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">Progress</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums">{progress.percent}%</span>
            <span className="text-xs text-subtle">{progress.done} of {progress.total} tasks done</span>
          </div>
          <ProgressBar value={progress.percent} className="mt-3" label="Project progress" />
          {overdue > 0 && <p className="mt-2 text-xs text-danger">{overdue} overdue</p>}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">Status & priority</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <select
              aria-label="Project status"
              value={project.status}
              onChange={(e) => update({ status: e.target.value }, `Status: ${PROJECT_STATUS_META[e.target.value].label}`)}
              className="h-8 rounded-md border border-border bg-surface-2 px-2 text-xs text-fg focus:border-accent focus:outline-none"
            >
              {toOptions(PROJECT_STATUSES, PROJECT_STATUS_META).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select
              aria-label="Project priority"
              value={project.priority}
              onChange={(e) => update({ priority: e.target.value }, `Priority: ${PRIORITY_META[e.target.value].label}`)}
              className="h-8 rounded-md border border-border bg-surface-2 px-2 text-xs text-fg focus:border-accent focus:outline-none"
            >
              {toOptions(PRIORITIES, PRIORITY_META).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {attention && <p className="mt-2 text-xs text-[var(--tone-amber-fg)]">{attention.join(" · ")}</p>}
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted"><CalendarDays className="size-3" aria-hidden /> Timeline</p>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-[13px]">
            <div>
              <dt className="text-[11px] text-subtle">Start</dt>
              <dd>{formatDate(project.startDate, preferences.dateFormat)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-subtle">Deadline</dt>
              <dd className={cx(project.deadline && project.deadline < today && project.status !== "completed" && "text-danger")}>{formatDate(project.deadline, preferences.dateFormat)}</dd>
            </div>
          </dl>
          {project.deadline && project.status !== "completed" && <p className="mt-2 text-xs text-subtle">{dueLabel(project.deadline, today).replace("Due", "Deadline")}</p>}
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted"><Users className="size-3" aria-hidden /> Team</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {team.length ? (
              team.map((u) => {
                const open = tasks.filter((t) => t.assigneeId === u._id && t.status !== "done").length;
                return (
                  <li key={u._id} className="flex items-center gap-2 text-[13px]">
                    <Avatar user={u} size="xs" />
                    <span className="truncate">{u.name}</span>
                    <span className="ml-auto text-[11px] text-subtle">{open} open</span>
                  </li>
                );
              })
            ) : (
              <li className="text-xs text-subtle">No one assigned. <button type="button" className="text-accent hover:underline" onClick={() => overlays.editProject(project)}>Add team</button></li>
            )}
          </ul>
        </Card>
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          label="Project sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: "tasks", label: "Tasks", icon: CheckSquare, count: tasks.length },
            { value: "discussions", label: "Discussions", icon: MessageSquare, count: conversations.length },
            { value: "activity", label: "Activity", icon: Activity },
          ]}
        />
      </div>

      {tab === "tasks" && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SearchInput value={query} onChange={setQuery} placeholder="Filter tasks…" className="w-full sm:w-60" label="Filter tasks" />
            <FilterSelect
              label="Assignee"
              value={assignee}
              onChange={setAssignee}
              options={[...members.map((m) => ({ value: m.user._id, label: m.user.name })), { value: "none", label: "Unassigned" }]}
            />
            <div className="ml-auto">
              <Segmented
                label="Task view"
                value={taskView}
                onChange={setTaskView}
                options={[
                  { value: "board", label: "Board", icon: Columns3 },
                  { value: "list", label: "List", icon: List },
                ]}
              />
            </div>
          </div>
          {!tasks.length ? (
            <Card>
              <EmptyState
                icon={CheckSquare}
                title="No tasks yet"
                description="Break this project into tasks to track progress."
                action={<Button size="sm" variant="primary" icon={Plus} onClick={() => overlays.newTask({ projectId: project._id })}>Add first task</Button>}
              />
            </Card>
          ) : taskView === "board" ? (
            <TaskBoard tasks={visibleTasks} showProject={false} defaults={{ projectId: project._id }} />
          ) : (
            <Card className="overflow-hidden">
              {TASK_STATUSES.map((s) => {
                const group = sortTasks(visibleTasks.filter((t) => t.status === s));
                if (!group.length) return null;
                return (
                  <section key={s} aria-label={TASK_STATUS_META[s].label}>
                    <h3 className="flex items-center gap-2 border-y border-border bg-surface-2/50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted first:border-t-0">
                      <span className={`dot-${TASK_STATUS_META[s].tone} size-1.5 rounded-full`} aria-hidden />
                      {TASK_STATUS_META[s].label} <span className="text-subtle">{group.length}</span>
                    </h3>
                    <TaskList tasks={group} showProject={false} />
                  </section>
                );
              })}
              {!visibleTasks.length && <EmptyState icon={CheckSquare} title="No tasks match these filters" compact />}
            </Card>
          )}
        </>
      )}

      {tab === "discussions" && (
        <Card>
          <CardHeader
            title="Discussions & updates"
            icon={MessageSquare}
            description="Threads linked to this project. Internal threads stay with your team."
            action={<Button size="sm" icon={Plus} onClick={() => overlays.newThread({ projectId: project._id, visibility: client ? "client" : "internal" })}>New thread</Button>}
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
            <EmptyState icon={MessageSquare} title="No discussions yet" description="Post an update or start a thread about this project." compact />
          )}
        </Card>
      )}

      {tab === "activity" && (
        <Card>
          <div className="py-1">
            <ActivityFeed filter={(a) => a.projectId === project._id} limit={30} emptyText="Changes to this project will appear here." />
          </div>
        </Card>
      )}

      <div className="mt-8 flex justify-end border-t border-border pt-4">
        <Button variant="danger" size="sm" icon={Trash2} onClick={() => setDeleting(true)}>Delete project</Button>
      </div>

      {deleting && <DeleteRecordDialog kind="project" record={project} onClose={() => setDeleting(false)} onDeleted={() => router.push(client ? `/clients/${client._id}` : "/projects")} />}
    </>
  );
}
