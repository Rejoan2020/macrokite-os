import { OverviewView } from "@/components/views/OverviewView";

export const metadata = { title: "Overview" };

// The app shell renders on the client from browser/API workspace data, so navigation is not prefetch-instant.
export const instant = false;

export default function OverviewPage() {
  return <OverviewView />;
}
