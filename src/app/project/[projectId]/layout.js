import { notFound } from "next/navigation";
import { getProject, getProjectCollections } from "@/lib/data/projects";
import { WorkspaceProvider } from "@/lib/store/WorkspaceProvider";

// Every generation writes to the database, so this is never served stale.
export const dynamic = "force-dynamic";

/**
 * Owns the project's data for both the image and video routes, so switching
 * between them keeps the one store and doesn't refetch.
 */
export default async function ProjectLayout({ children, params }) {
  const { projectId } = await params;
  const [project, collections] = await Promise.all([
    getProject(projectId),
    getProjectCollections(projectId),
  ]);
  if (!project) notFound();

  return (
    <WorkspaceProvider project={project} collections={collections}>
      {children}
    </WorkspaceProvider>
  );
}

export async function generateMetadata({ params }) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  return { title: project ? `${project.name} · Fomi` : "Fomi" };
}
