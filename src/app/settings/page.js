import { SettingsView } from "@/components/views/SettingsView";

export const metadata = { title: "Settings" };

// The app shell renders on the client from browser/API workspace data, so navigation is not prefetch-instant.
export const instant = false;

export default function Page() {
  return <SettingsView />;
}
