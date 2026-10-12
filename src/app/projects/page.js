import { ProjectsView } from "@/components/views/ProjectsView";

export const metadata = { title: "Projects" };

// The app shell renders on the client from browser/API workspace data, so navigation is not prefetch-instant.
export const instant = false;

export default function Page() {
  return <ProjectsView />;
}
