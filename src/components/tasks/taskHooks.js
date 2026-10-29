"use client";

import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { canEditTask, canManageTasks, canSetTaskStatus } from "@/lib/permissions";

/** Comment count and unread count of a task's discussion. */
export function useTaskThreadSummary(taskId) {
  const { chats, threads, unread } = useWorkspace();
  const thread = chats.tasks[taskId];
  if (!thread) return { count: 0, unread: 0 };
  return { count: threads[thread._id]?.length ?? 0, unread: unread[thread._id]?.count ?? 0 };
}

/** What the current user may do with a task: { canEdit, canSetStatus }. */
export function useTaskAccess(task) {
  const { currentUser, lookup } = useWorkspace();
  const project = lookup.projects[task.projectId];
  return { canEdit: canEditTask(task, currentUser, project), canSetStatus: canSetTaskStatus(task, currentUser, project) };
}

/**
 * Where the current user may create and assign tasks: `canManage(project)`, the open projects they
 * manage, and `canCreate` when there is at least one.
 */
export function useTaskManagement() {
  const { data, currentUser } = useWorkspace();
  const canManage = (project) => canManageTasks(project, currentUser);
  const projects = data.projects.filter((p) => !p.archived && canManage(p));
  return { canManage, projects, canCreate: projects.length > 0 };
}

/** Opens a task: the quick edit dialog for people who may edit it, otherwise its page. */
export function useOpenTask() {
  const { currentUser, lookup } = useWorkspace();
  const overlays = useOverlays();
  const router = useRouter();
  return (task) => (canEditTask(task, currentUser, lookup.projects[task.projectId]) ? overlays.editTask(task._id) : router.push(`/tasks/${task._id}`));
}
