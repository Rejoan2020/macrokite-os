import { ProjectDetailView } from "@/components/views/ProjectDetailView";

export const metadata = { title: "Project" };

// The app shell renders on the client from browser/API workspace data, so navigation is not prefetch-instant.
export const instant = false;

export default function Page() {
  return <ProjectDetailView />;
}
