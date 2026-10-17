import { InboxView } from "@/components/views/InboxView";

export const metadata = { title: "Inbox" };

// The app shell renders on the client from browser/API workspace data, so navigation is not prefetch-instant.
export const instant = false;

export default function Page() {
  return <InboxView />;
}
