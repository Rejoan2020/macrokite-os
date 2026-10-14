import { MessagesView } from "@/components/views/MessagesView";

export const metadata = { title: "Messages" };

// The app shell renders on the client from browser/API workspace data, so navigation is not prefetch-instant.
export const instant = false;

export default function Page() {
  return <MessagesView />;
}
