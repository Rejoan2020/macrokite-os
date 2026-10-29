// Chat history in database mode. The workspace carries only the newest messages of each
// conversation (and every unread one, up to a limit); older messages are fetched a page at a time
// when someone scrolls back. data.hasOlder marks conversations with more on the server.

export const MESSAGE_PAGE = 50;
/** Most unread messages loaded per conversation: enough to show "99+". */
export const MAX_UNREAD = 100;
/** How many of a conversation's newest messages the server reads to pick what it sends. */
export const RECENT_FETCH = MAX_UNREAD + 1;
export const PAGE_FETCH = MESSAGE_PAGE + 1;

/**
 * The first `count` of messages sorted newest first, extended so messages sharing a timestamp stay
 * together (a task change logs several at once). Paging by timestamp would otherwise skip some.
 */
export function newestMessages(newestFirst, count) {
  let end = Math.min(count, newestFirst.length);
  while (end > 0 && end < newestFirst.length && newestFirst[end].createdAt === newestFirst[end - 1].createdAt) end += 1;
  return newestFirst.slice(0, end);
}

function take(newestFirst, count, fetched) {
  const messages = newestMessages(newestFirst, count);
  return { messages: messages.reverse(), hasOlder: newestFirst.length >= fetched || messages.length < newestFirst.length };
}

/**
 * What a conversation shows on load, from its newest RECENT_FETCH messages (newest first): the newest
 * page, or more when the reader has more unread. Returns { messages (oldest first), hasOlder }.
 */
export function recentMessages(newestFirst, lastReadAt) {
  const unread = newestFirst.filter((m) => !lastReadAt || m.createdAt > lastReadAt).length;
  return take(newestFirst, Math.max(MESSAGE_PAGE, Math.min(unread, MAX_UNREAD)), RECENT_FETCH);
}

/** A page of older messages from PAGE_FETCH fetched (newest first): { messages (oldest first), hasOlder }. */
export const olderPage = (newestFirst) => take(newestFirst, MESSAGE_PAGE, PAGE_FETCH);

/** The workspace with a page of older messages of one conversation added. */
export function withOlderMessages(data, conversationId, older, hasOlder) {
  const known = new Set(data.messages.map((m) => m._id));
  return { ...data, messages: [...older.filter((m) => !known.has(m._id)), ...data.messages], hasOlder: { ...data.hasOlder, [conversationId]: hasOlder } };
}

/**
 * A freshly fetched workspace that keeps the older messages `previous` had loaded by scrolling back,
 * so a background refresh doesn't drop them.
 */
export function keepLoadedHistory(previous, next) {
  if (!previous) return next;
  const oldest = {};
  for (const m of next.messages) if (!(m.conversationId in oldest) || m.createdAt < oldest[m.conversationId]) oldest[m.conversationId] = m.createdAt;
  const ids = new Set(next.messages.map((m) => m._id));
  const kept = previous.messages.filter((m) => m.conversationId in oldest && !ids.has(m._id) && m.createdAt <= oldest[m.conversationId]);
  if (!kept.length) return next;
  // Where older messages are kept, the previous copy knows whether there are more before them.
  const hasOlder = { ...next.hasOlder };
  for (const conversationId of new Set(kept.map((m) => m.conversationId))) hasOlder[conversationId] = Boolean(previous.hasOlder?.[conversationId]);
  return { ...next, messages: [...kept, ...next.messages], hasOlder };
}
