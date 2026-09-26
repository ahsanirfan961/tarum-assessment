/**
 * `npm run db:seed`: loads the demo projects from src/lib/mock/seed.js.
 *
 * Every insert is an upsert, so running it twice is harmless (and resets the
 * seed rows to their original names and cut). Rows created by generation
 * are left alone.
 *
 * The seed has fixed timestamps rather than `now()`, spaced so the database
 * reads back in the seed's own order: the first project and the first
 * collection in each project are the most recent, and nodes keep the order
 * they are listed in. Anything generated later is newer than all of it.
 */
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { COLLECTIONS, PROJECTS } from "../src/lib/mock/seed.js";
import { collections, nodes, projects } from "../src/lib/db/schema.js";

const BASE = Date.parse("2026-09-01T12:00:00Z");
const MINUTE = 60_000;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgres://fomi:fomi@localhost:5432/fomi",
});
const db = drizzle(pool);

/** `excluded.<col>` for every column but the key, for ON CONFLICT DO UPDATE. */
function excludedAll(table, columns) {
  return Object.fromEntries(
    columns.map((key) => [key, sql.raw(`excluded."${table[key].name}"`)])
  );
}

try {
  await db.transaction(async (tx) => {
    const collectionRows = [];
    const nodeRows = [];
    const cuts = [];

    PROJECTS.forEach((project, p) => {
      project.collectionIds.forEach((collectionId, c) => {
        const collection = COLLECTIONS.find((col) => col.id === collectionId);
        if (!collection) throw new Error(`Seed collection "${collectionId}" is missing.`);
        const createdAt = new Date(BASE - p * 60 * MINUTE - c * MINUTE);

        collectionRows.push({
          id: collection.id,
          projectId: project.id,
          kind: collection.kind,
          name: collection.name,
          createdAt,
        });
        if (collection.cutLeafId) cuts.push([collection.id, collection.cutLeafId]);

        collection.nodes.forEach((node, n) => {
          nodeRows.push({
            id: node.id,
            collectionId: collection.id,
            parentId: node.parentId ?? null,
            referenceIds: node.referenceIds ?? [],
            prompt: node.prompt,
            model: node.model,
            aspectRatio: node.aspectRatio,
            quality: node.quality ?? null,
            resolution: node.resolution ?? null,
            url: node.url ?? null,
            videoUrl: node.videoUrl ?? null,
            durationSeconds: node.durationSeconds ?? null,
            beat: node.beat ?? null,
            status: "completed",
            createdAt: new Date(createdAt.getTime() + n),
          });
        });
      });
    });

    await tx
      .insert(projects)
      .values(
        PROJECTS.map((project, p) => ({
          id: project.id,
          name: project.name,
          client: project.client ?? null,
          createdAt: new Date(BASE - p * 60 * MINUTE),
        }))
      )
      .onConflictDoUpdate({
        target: projects.id,
        set: excludedAll(projects, ["name", "client", "createdAt"]),
      });

    // Collections first without their cut, since the cut points at a node.
    await tx
      .insert(collections)
      .values(collectionRows)
      .onConflictDoUpdate({
        target: collections.id,
        set: excludedAll(collections, ["projectId", "kind", "name", "createdAt"]),
      });

    // Seed nodes are listed parent before child, so one insert satisfies the
    // parent foreign key.
    await tx
      .insert(nodes)
      .values(nodeRows)
      .onConflictDoUpdate({
        target: nodes.id,
        set: excludedAll(
          nodes,
          Object.keys(nodeRows[0]).filter((key) => key !== "id")
        ),
      });

    for (const [collectionId, cutLeafId] of cuts) {
      await tx
        .update(collections)
        .set({ cutLeafId })
        .where(eq(collections.id, collectionId));
    }

    console.log(
      `Seeded ${PROJECTS.length} projects, ${collectionRows.length} collections, ${nodeRows.length} nodes.`
    );
  });
} catch (err) {
  console.error(err.cause?.message ?? err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
