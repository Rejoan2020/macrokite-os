import { TaskDetailView } from "@/components/views/TaskDetailView";

export const metadata = { title: "Task" };

// The app shell renders on the client from browser/API workspace data, so navigation is not prefetch-instant.
export const instant = false;

export default function Page() {
  return <TaskDetailView />;
}
