import { CompanyView } from "@/components/views/CompanyView";

export const metadata = { title: "Company" };

// The app shell renders on the client from browser/API workspace data, so navigation is not prefetch-instant.
export const instant = false;

export default function Page() {
  return <CompanyView />;
}
