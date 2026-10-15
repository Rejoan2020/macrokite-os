/**
 * Who may change what. Shared by the engine, which enforces it, and the UI, which hides or disables
 * controls people can't use. `user` is the acting member record.
 *
 * Tasks are managed per project: a project's leads (chosen by admins) and admins create, assign,
 * edit and delete its tasks. The assignee can also move a task's status. Everyone can comment.
 */

const isAdmin = (user) => Boolean(user?.active && user.role === "admin");

/** A project's leads. Projects saved before leads existed have none, so only admins manage them. */
export const projectLeadIds = (project) => project?.leadIds ?? [];

export const isProjectLead = (project, user) => Boolean(user?.active && projectLeadIds(project).includes(user._id));

/** Create and assign tasks in this project: its leads and admins. */
export const canManageTasks = (project, user) => isAdmin(user) || isProjectLead(project, user);

/** Change a project's details, move it between phases, put it on hold or archive it: its leads and admins. Anyone can edit its notes. */
export const canManageProject = (project, user) => isAdmin(user) || isProjectLead(project, user);

/** Edit a task's details (title, description, project, phase, assignee, due date, priority) or delete it. */
export const canEditTask = (task, user, project) => canManageTasks(project, user);

/** Move a task's status (to do, doing, done): also its assignee. */
export const canSetTaskStatus = (task, user, project) => canEditTask(task, user, project) || Boolean(user?.active && task.assigneeId === user._id);

/** Start a new project: admins only. They choose its leads. */
export const canCreateProject = (user) => isAdmin(user);

/** Define a project's phases: admins only. */
export const canEditPhases = (user) => isAdmin(user);

/** Choose a project's leads: admins only. */
export const canChooseLeads = (user) => isAdmin(user);

/** Fields only canEditTask may change. */
export const TASK_DETAIL_FIELDS = ["title", "description", "projectId", "phase", "assigneeId", "dueDate", "priority"];
