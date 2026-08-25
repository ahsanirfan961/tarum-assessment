import { notFound } from "next/navigation";
import { getProject, getProjectCollections } from "@/lib/data/projects";
import { WorkspaceProvider } from "@/lib/store/WorkspaceProvider";

/**
 * Owns the project's data for both the image and video routes, so switching
 * between them keeps everything already generated in this session.
 */
export default async function ProjectLayout({ children, params }) {
  const { projectId } = await params;
  const record = getProject(projectId);
  if (!record) notFound();

  const { collectionIds, ...project } = record;

  return (
    <WorkspaceProvider project={project} collections={getProjectCollections(projectId)}>
      {children}
    </WorkspaceProvider>
  );
}

export async function generateMetadata({ params }) {
  const { projectId } = await params;
  const project = getProject(projectId);
  return { title: project ? `${project.name} · Fomi` : "Fomi" };
}
