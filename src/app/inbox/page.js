import { InboxView } from "@/components/views/InboxView";

export const metadata = { title: "Inbox" };

// Rendered on the client from URL params and workspace data, so navigation is not prefetch-instant.
export const instant = false;

export default function Page() {
  return <InboxView />;
}
