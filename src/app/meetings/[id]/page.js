import { MeetingDetailView } from "@/components/views/MeetingDetailView";

export const metadata = { title: "Meeting" };

// The app shell renders on the client from browser/API workspace data, so navigation is not prefetch-instant.
export const instant = false;

export default function Page() {
  return <MeetingDetailView />;
}
