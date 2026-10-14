import { MeetingsView } from "@/components/views/MeetingsView";

export const metadata = { title: "Meetings" };

// The app shell renders on the client from browser/API workspace data, so navigation is not prefetch-instant.
export const instant = false;

export default function Page() {
  return <MeetingsView />;
}
