/**
 * Who may change what. Shared by the engine, which enforces it, and the UI, which hides or disables
 * controls people can't use. `user` is the acting member record.
 */

/** Details (title, description, project, phase, assignee, due date, priority) and deleting: the task's creator and admins. */
export const canEditTask = (task, user) => Boolean(user?.active && (user.role === "admin" || task.createdBy === user._id));

/** Status (to do, doing, done): also the assignee. Everyone else can view and comment. */
export const canSetTaskStatus = (task, user) => canEditTask(task, user) || Boolean(user?.active && task.assigneeId === user._id);

/** Fields only canEditTask may change. */
export const TASK_DETAIL_FIELDS = ["title", "description", "projectId", "phase", "assigneeId", "dueDate", "priority"];
