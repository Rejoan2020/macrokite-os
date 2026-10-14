"use client";

import { useLiveUpdates, useWorkspace } from "@/components/providers/WorkspaceProvider";
import { ChannelMessage, Composer, conversationMessages, useMarkRead, useSendMessage, useStickToBottom, useTaskFromMessage, withDayDividers } from "@/components/chat/Chat";
import { pluralize } from "@/lib/format";

/** Full-height chat layout shared by General and Messages. */
export const chatHeight = "h-[calc(100dvh-3.5rem)] lg:h-dvh";

export function GeneralView() {
  const { data, chats, activeUsers } = useWorkspace();
  const conversation = chats.general;
  const messages = conversation ? conversationMessages(data, conversation._id) : [];
  const send = useSendMessage(conversation?._id);
  const createTask = useTaskFromMessage();
  const listRef = useStickToBottom(messages.length);
  useMarkRead(conversation?._id);
  useLiveUpdates();

  return (
    <div className={`flex flex-col ${chatHeight}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-divider px-4 py-5 sm:px-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-[-0.01em] text-strong"># General</h1>
          <p className="text-[13px] text-muted">Whole team · announcements, news, memes and posts</p>
        </div>
        <span className="text-[13px] text-muted">{pluralize(activeUsers.length, "member")}</span>
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-[760px] flex-col gap-[22px]">
          {messages.length ? withDayDividers(messages, (m) => <ChannelMessage message={m} onCreateTask={createTask} />) : <p className="text-muted">Say hello to the team.</p>}
        </div>
      </div>

      <div className="border-t border-divider px-4 pt-4 pb-6 sm:px-8">
        <div className="mx-auto max-w-[760px]">
          <Composer label="Message General" placeholder="Message # General" onSend={send} hint="Paste a Facebook or Instagram link to share a post · @ to mention someone" />
        </div>
      </div>
    </div>
  );
}
