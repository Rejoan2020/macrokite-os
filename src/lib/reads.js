/**
 * What an action reads from the two collections that grow without limit, messages and
 * notifications, so database mode loads only that instead of every record. The engine sees just
 * these records; both collections are otherwise empty.
 *
 * Returns [collection, filter] steps, run in order. A filter is a MongoDB filter (the server adds
 * the orgId) or a function of the snapshot loaded so far that returns one; null loads nothing.
 */
export function actionReads({ type, id, data }, userId) {
  const key = typeof id === "string" ? id : null;
  const threadOf = (s, taskId) => s.conversations.find((c) => c.type === "task" && c.taskId === taskId);
  // Earlier commenters on a task are notified of new comments.
  const comments = (thread) => (thread ? { conversationId: thread._id, event: null } : null);
  const aboutLoadedMessages = (s) => ({ targetType: "message", targetId: { $in: s.messages.map((m) => m._id) } });

  switch (type) {
    case "project.delete": {
      const taskIds = (s) => s.tasks.filter((t) => t.projectId === key).map((t) => t._id);
      return [
        [
          "messages",
          (s) => {
            const tasks = new Set(taskIds(s));
            return { conversationId: { $in: s.conversations.filter((c) => c.projectId === key || tasks.has(c.taskId)).map((c) => c._id) } };
          },
        ],
        [
          "notifications",
          (s) => ({
            $or: [
              { targetType: "project", targetId: key },
              { targetType: "task", targetId: { $in: taskIds(s) } },
              { targetType: "meeting", targetId: { $in: s.meetings.filter((m) => m.projectId === key).map((m) => m._id) } },
              aboutLoadedMessages(s),
            ],
          }),
        ],
      ];
    }
    case "task.delete":
      return [
        ["messages", (s) => (threadOf(s, key) ? { conversationId: threadOf(s, key)._id } : null)],
        ["notifications", aboutLoadedMessages],
      ];
    case "group.delete":
      return [
        ["messages", { conversationId: key }],
        ["notifications", aboutLoadedMessages],
      ];
    case "task.comment":
      return [["messages", (s) => comments(threadOf(s, key))]];
    case "message.create":
      return [["messages", (s) => comments(s.conversations.find((c) => c._id === key && c.type === "task"))]];
    case "task.create":
      return typeof data?.messageId === "string" ? [["messages", { _id: data.messageId }]] : [];
    case "message.edit":
    case "message.delete":
      return [
        ["messages", { _id: key }],
        ["notifications", { targetId: key }],
      ];
    case "conversation.read":
      return [
        ["notifications", { userId, readAt: null, targetType: "message" }],
        ["messages", (s) => ({ conversationId: key, _id: { $in: s.notifications.map((n) => n.targetId) } })],
      ];
    case "notification.read":
      return [["notifications", { _id: key }]];
    case "notification.readAll":
      return [["notifications", { userId, readAt: null }]];
    case "member.delete":
      return [["notifications", { userId: key }]];
    default:
      return [];
  }
}
