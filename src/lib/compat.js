import { taskAssigneeIds } from "./constants";

/**
 * Brings a snapshot saved by an older version up to date, in memory: tasks get `assigneeIds`
 * instead of a single `assigneeId`, and workspaces get a `clients` list. Records are written back
 * in the new shape the next time something changes them.
 */
export function normalizeSnapshot(data) {
  if (!data) return data;
  return {
    ...data,
    clients: data.clients ?? [],
    tasks: data.tasks.map(normalizeTask),
  };
}

export function normalizeTask(task) {
  if (task.assigneeIds) return task;
  const { assigneeId, ...rest } = task;
  return { ...rest, assigneeIds: taskAssigneeIds(task) };
}
