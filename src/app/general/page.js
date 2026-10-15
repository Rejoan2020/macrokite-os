import { GeneralView } from "@/components/views/GeneralView";
import { TEAM_CHANNEL } from "@/lib/constants";

export const metadata = { title: TEAM_CHANNEL };

// The app shell renders on the client from browser/API workspace data, so navigation is not prefetch-instant.
export const instant = false;

export default function Page() {
  return <GeneralView />;
}
