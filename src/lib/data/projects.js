import "server-only";
import { asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db, isConnectionError, unreachable } from "@/lib/db/client";
import { collections, nodes, projects } from "@/lib/db/schema";

/**
 * Server-side read layer. The UI only ever sees these three functions and the
 * shapes they return; where the rows come from is this file's business.
 */

export async function listProjects() {
  const [projectRows, counts, covers] = await Promise.all([
    query(() =>
      db
        .select({ id: projects.id, name: projects.name, client: projects.client })
        .from(projects)
        .orderBy(desc(projects.createdAt))
    ),
    query(() =>
      db
        .select({ projectId: collections.projectId, count: count() })
        .from(collections)
        .groupBy(collections.projectId)
    ),
    // Each project's cover: the first finished take of its most recent
    // collection that has one.
    query(() =>
      db.execute(sql`
        select distinct on (c.project_id) c.project_id, n.url
        from nodes n
        join collections c on c.id = n.collection_id
        where n.status = 'completed' and n.url is not null
        order by c.project_id, c.created_at desc, n.created_at asc, n.id asc
      `)
    ),
  ]);

  const countBy = new Map(counts.map((row) => [row.projectId, row.count]));
  const coverBy = new Map(covers.rows.map((row) => [row.project_id, row.url]));
  return projectRows.map((project) => ({
    ...project,
    collectionCount: countBy.get(project.id) ?? 0,
    cover: coverBy.get(project.id) ?? null,
  }));
}

export async function getProject(projectId) {
  const [row] = await query(() =>
    db
      .select({ id: projects.id, name: projects.name, client: projects.client })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)
  );
  return row ?? null;
}

/**
 * Collections belonging to one project, newest first, each with its nodes in
 * generation order. Projects are isolated by design, so this never reaches
 * across the project boundary. Two queries, grouped here.
 */
export async function getProjectCollections(projectId) {
  const collectionRows = await query(() =>
    db
      .select()
      .from(collections)
      .where(eq(collections.projectId, projectId))
      .orderBy(desc(collections.createdAt), asc(collections.id))
  );
  if (!collectionRows.length) return [];

  const nodeRows = await query(() =>
    db
      .select()
      .from(nodes)
      .where(
        inArray(
          nodes.collectionId,
          collectionRows.map((c) => c.id)
        )
      )
      .orderBy(asc(nodes.createdAt), asc(nodes.id))
  );

  const byCollection = new Map(collectionRows.map((c) => [c.id, []]));
  for (const row of nodeRows) byCollection.get(row.collectionId).push(toNode(row));

  return collectionRows.map((row) => toCollection(row, byCollection.get(row.id)));
}

/** A collection row in the shape the workspace store holds. */
export function toCollection(row, nodeList) {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    nodes: nodeList,
    ...(row.kind === "video" ? { cutLeafId: row.cutLeafId ?? null } : {}),
  };
}

/**
 * A node row in the shape the lineage graph reads. Video-only fields are
 * left off image takes rather than sent as nulls, and `cost` comes back from
 * Postgres as a numeric string.
 */
export function toNode(row) {
  const node = {
    id: row.id,
    parentId: row.parentId,
    referenceIds: row.referenceIds ?? [],
    prompt: row.prompt,
    model: row.model,
    aspectRatio: row.aspectRatio,
    quality: row.quality,
    resolution: row.resolution,
    url: row.url,
    status: row.status,
    cost: row.cost == null ? null : Number(row.cost),
  };
  const optional = {
    videoUrl: row.videoUrl,
    lastFrameUrl: row.lastFrameUrl,
    durationSeconds: row.durationSeconds,
    beat: row.beat,
    error: row.error,
    // Only while a job renders: when it was submitted, for the elapsed time.
    submittedAt:
      row.status === "pending" || row.status === "finalizing"
        ? row.submittedAt?.toISOString()
        : null,
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value != null) node[key] = value;
  }
  return node;
}

/** Runs a read, turning "Postgres isn't running" into a message that says so. */
export async function query(run) {
  try {
    return await run();
  } catch (err) {
    throw isConnectionError(err) || isConnectionError(err?.cause) ? unreachable(err) : err;
  }
}
