import { DEFAULT_NOTIFICATION_PREFS, FORMER_MEMBER, TEAM_CHANNEL } from "./constants";
import { messagePreview } from "./attachments";
import { conversationHref, describeNotification } from "./notifications";
import { conversationMemberIds } from "./selectors";

/**
 * Push notifications for an action, to the phones and computers people turned them on for.
 * Everything that creates an in-app notification is pushed. Chat messages in the team chat, groups
 * and project chats are pushed too, to people who chose "Every chat message" in Settings; the rest
 * only hear about them when @mentioned. Pure, shared by the server and the tests.
 *
 * Returns [{ userId, title, body, url, tag }]. Pushes with the same tag replace each other on the
 * device, so a busy conversation shows as one notification.
 */
export function pushNotifications({ state, changes, actorId, now }) {
  const nowIso = now.toISOString();
  const users = Object.fromEntries(state.users.map((u) => [u._id, u]));
  const reachable = (userId) => users[userId]?.active && !users[userId].deletedAt && userId !== actorId;
  const pushes = [];
  const told = new Set(); // `${userId}:${messageId}`: already pushed about this message

  for (const n of changes.put?.notifications ?? []) {
    if (n.createdAt !== nowIso || n.readAt || !reachable(n.userId)) continue;
    const view = describeNotification(n, state);
    if (!view) continue;
    const message = n.targetType === "message" ? state.messages.find((m) => m._id === n.targetId) : null;
    if (message) told.add(`${n.userId}:${message._id}`);
    pushes.push({ userId: n.userId, title: view.text, body: view.detail ?? "", url: view.href, tag: message ? `cnv:${message.conversationId}` : `${n.targetType}:${n.targetId}` });
  }

  for (const message of changes.put?.messages ?? []) {
    if (message.createdAt !== nowIso || message.event || message.deletedAt) continue;
    const conversation = state.conversations.find((c) => c._id === message.conversationId);
    if (!conversation || !["general", "group", "project"].includes(conversation.type)) continue;
    const place =
      conversation.type === "general" ? TEAM_CHANNEL : conversation.type === "group" ? conversation.name : `# ${state.projects.find((p) => p._id === conversation.projectId)?.name ?? "Project"}`;
    const author = users[message.authorId]?.name || FORMER_MEMBER;
    for (const userId of conversationMemberIds(conversation, state)) {
      if (!reachable(userId) || told.has(`${userId}:${message._id}`)) continue;
      if (!{ ...DEFAULT_NOTIFICATION_PREFS, ...users[userId].notificationPrefs }.chatMessages) continue;
      pushes.push({ userId, title: `${author} in ${place}`, body: messagePreview(message), url: conversationHref(conversation, userId), tag: `cnv:${conversation._id}` });
    }
  }
  return pushes;
}
