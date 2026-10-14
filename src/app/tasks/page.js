import { MyTasksView } from "@/components/views/MyTasksView";

export const metadata = { title: "My tasks" };

// The app shell renders on the client from browser/API workspace data, so navigation is not prefetch-instant.
export const instant = false;

export default function Page() {
  return <MyTasksView />;
}
