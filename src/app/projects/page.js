import { ProjectsView } from "@/components/views/ProjectsView";

export const metadata = { title: "Projects" };

// Rendered on the client from URL params and workspace data, so navigation is not prefetch-instant.
export const instant = false;

export default function Page() {
  return <ProjectsView />;
}
