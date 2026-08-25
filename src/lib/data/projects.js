import { COLLECTIONS, PROJECTS } from "@/lib/mock/seed";

/**
 * Server-side read layer over the mocked store. Swapping this file for real
 * database or service calls is the only change the UI would need.
 */

export function listProjects() {
  return PROJECTS.map(({ collectionIds, ...project }) => ({
    ...project,
    collectionCount: collectionIds.length,
    cover: COLLECTIONS.find((c) => c.id === collectionIds[0])?.nodes[0]?.url ?? null,
  }));
}

export function getProject(projectId) {
  return PROJECTS.find((p) => p.id === projectId) ?? null;
}

/**
 * Collections belonging to one project. Projects are isolated by design, so
 * this never reaches across the project boundary.
 */
export function getProjectCollections(projectId) {
  const project = getProject(projectId);
  if (!project) return [];
  return project.collectionIds
    .map((id) => COLLECTIONS.find((c) => c.id === id))
    .filter(Boolean);
}
