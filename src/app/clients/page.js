import { ClientsView } from "@/components/views/ClientsView";

export const metadata = { title: "Clients" };

// The app shell renders on the client from browser/API workspace data, so navigation is not prefetch-instant.
export const instant = false;

export default function Page() {
  return <ClientsView />;
}
