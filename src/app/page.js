import { redirect } from "next/navigation";
import { listProjects } from "@/lib/data/projects";

/**
 * The brief's user is returning to work already in progress, so the app opens
 * straight into their most recent project rather than a chooser.
 */
export default function RootPage() {
  const [mostRecent] = listProjects();
  redirect(mostRecent ? `/project/${mostRecent.id}/image` : "/projects");
}
