import { TeamView } from "@/components/views/TeamView";

export const metadata = { title: "Team" };

// The app shell renders on the client from browser/API workspace data, so navigation is not prefetch-instant.
export const instant = false;

export default function Page() {
  return <TeamView />;
}
