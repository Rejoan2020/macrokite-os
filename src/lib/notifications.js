import { FORMER_MEMBER, TEAM_CHANNEL } from "./constants";
import { messagePreview } from "./attachments";

/** Where a conversation opens: DMs by the other person, groups and the team chat by id, project chats on their project. */
export function conversationHref(conversation, userId) {
  if (conversation.type === "dm") return `/inbox/${conversation.memberIds.find((id) => id !== userId) ?? userId}`;
  if (conversation.type === "project") return `/projects/${conversation.projectId}`;
  if (conversation.type === "task") return `/tasks/${conversation.taskId}`;
  return `/inbox/${conversation._id}`;
}

/**
 * What a notification says and where it leads, from the current snapshot. Pure, shared by the
 * notification list and the tests. Returns { actorId, text, detail, href }, or null when what it
 * points to no longer exists (a deleted task or meeting).
 */
export function describeNotification(n, data) {
  const byId = (collection, id) => data[collection].find((d) => d._id === id);
  const userName = (id) => byId("users", id)?.name ?? FORMER_MEMBER;

  if (n.targetType === "message") {
    // Database mode loads recent chat history only; older messages notified about come separately.
    const message = byId("messages", n.targetId) ?? data.notifiedMessages?.find((m) => m._id === n.targetId);
    const conversation = message && byId("conversations", message.conversationId);
    if (!conversation) return null;
    const actorId = n.actorId ?? message.authorId;
    const detail = message.deletedAt ? "Message deleted" : messagePreview(message);
    if (conversation.type === "task") {
      const task = byId("tasks", conversation.taskId);
      if (!task) return null;
      const verb = n.type === "mention" ? "mentioned you on" : "commented on";
      return { actorId, text: `${userName(actorId)} ${verb} “${task.title}”`, detail, href: `/tasks/${task._id}` };
    }
    if (n.type === "dm") return { actorId, text: `${userName(actorId)} sent you a message`, detail, href: `/inbox/${actorId}` };
    const project = conversation.type === "project" ? byId("projects", conversation.projectId) : null;
    const place = conversation.type === "general" ? TEAM_CHANNEL : conversation.type === "group" ? conversation.name : project ? `# ${project.name}` : "a message";
    return { actorId, text: `${userName(actorId)} mentioned you in ${place}`, detail, href: conversationHref(conversation, n.userId) };
  }

  if (n.targetType === "task") {
    const task = byId("tasks", n.targetId);
    if (!task) return null;
    const actorId = n.actorId ?? task.createdBy;
    return { actorId, text: `${userName(actorId)} assigned you a task`, detail: task.title, href: `/tasks/${task._id}` };
  }

  if (n.targetType === "meeting") {
    const meeting = byId("meetings", n.targetId);
    if (!meeting) return null;
    const actorId = n.actorId ?? meeting.createdBy;
    const href = `/meetings/${meeting._id}`;
    if (n.type === "meetingInvite") return { actorId, text: `${userName(actorId)} invited you to a meeting`, detail: meeting.title, href };
    return { actorId, text: n.text || `You got action items from ${meeting.title}`, detail: meeting.title, href };
  }

  return null;
}

/** The current user's notifications that still point somewhere, newest first. */
export function myNotifications(data, userId) {
  return data.notifications
    .filter((n) => n.userId === userId)
    .map((n) => ({ ...n, view: describeNotification(n, data) }))
    .filter((n) => n.view)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
