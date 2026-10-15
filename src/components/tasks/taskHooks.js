"use client";

import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { conversationMessages } from "@/components/chat/Chat";
import { canEditTask, canSetTaskStatus } from "@/lib/permissions";

/** Comment count and unread count of a task's discussion. */
export function useTaskThreadSummary(taskId) {
  const { data, chats, unread } = useWorkspace();
  const thread = chats.tasks[taskId];
  if (!thread) return { count: 0, unread: 0 };
  return { count: conversationMessages(data, thread._id).length, unread: unread[thread._id]?.count ?? 0 };
}

/** What the current user may do with a task: { canEdit, canSetStatus }. */
export function useTaskAccess(task) {
  const { currentUser } = useWorkspace();
  return { canEdit: canEditTask(task, currentUser), canSetStatus: canSetTaskStatus(task, currentUser) };
}

/** Opens a task: the quick edit dialog for people who may edit it, otherwise its page. */
export function useOpenTask() {
  const { currentUser } = useWorkspace();
  const overlays = useOverlays();
  const router = useRouter();
  return (task) => (canEditTask(task, currentUser) ? overlays.editTask(task._id) : router.push(`/tasks/${task._id}`));
}
