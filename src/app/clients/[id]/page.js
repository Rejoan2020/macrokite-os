import { ClientDetailView } from "@/components/views/ClientDetailView";

export const metadata = { title: "Client" };

// The app shell renders on the client from browser/API workspace data, so navigation is not prefetch-instant.
export const instant = false;

export default function Page() {
  return <ClientDetailView />;
}
