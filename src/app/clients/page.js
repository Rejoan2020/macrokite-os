import { ClientsView } from "@/components/views/ClientsView";

export const metadata = { title: "Clients" };

// Rendered on the client from URL params and workspace data, so navigation is not prefetch-instant.
export const instant = false;

export default function Page() {
  return <ClientsView />;
}
