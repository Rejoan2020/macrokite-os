import { GeneralView } from "@/components/views/GeneralView";

export const metadata = { title: "General" };

// The app shell renders on the client from browser/API workspace data, so navigation is not prefetch-instant.
export const instant = false;

export default function Page() {
  return <GeneralView />;
}
