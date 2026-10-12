import { ClientDetailView } from "@/components/views/ClientDetailView";

export const metadata = { title: "Client" };

// Rendered on the client from URL params and workspace data, so navigation is not prefetch-instant.
export const instant = false;

export default function Page() {
  return <ClientDetailView />;
}
