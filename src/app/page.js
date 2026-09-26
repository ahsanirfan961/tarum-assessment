import { redirect } from "next/navigation";
import { listProjects } from "@/lib/data/projects";

/**
 * The brief's user is returning to work already in progress, so the app opens
 * straight into their most recent project rather than a chooser.
 */
export const dynamic = "force-dynamic";

export default async function RootPage() {
  const [mostRecent] = await listProjects();
  redirect(mostRecent ? `/project/${mostRecent.id}/image` : "/projects");
}
