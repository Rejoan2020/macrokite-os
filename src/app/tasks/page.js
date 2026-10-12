import { MyTasksView } from "@/components/views/MyTasksView";

export const metadata = { title: "My Tasks" };

// Rendered on the client from URL params and workspace data, so navigation is not prefetch-instant.
export const instant = false;

export default function Page() {
  return <MyTasksView />;
}
