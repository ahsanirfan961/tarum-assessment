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
 *
 * Video takes get real clips, rendered here with ffmpeg from each take's
 * photo and stored in MinIO like a generated take (clip, poster, last frame),
 * so the demo plays, and can be continued, without any remote host. Clips
 * already stored are kept, which keeps re-seeding quick and the stored URLs
 * (served as immutable) stable. This needs MinIO up, as well as Postgres.
 *
 * Runs with `--conditions=react-server`, so the `server-only` import in the
 * shared ffmpeg module resolves to its empty build under plain Node.
 */
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { COLLECTIONS, PROJECTS } from "../src/lib/mock/seed.js";
import { collections, nodes, projects } from "../src/lib/db/schema.js";
import { hasMedia, MEDIA_PREFIX, putMedia } from "../src/lib/storage.js";
import { clipSize, extractFrames, renderMockClip } from "../src/lib/video/ffmpeg.js";

const BASE = Date.parse("2026-09-01T12:00:00Z");
const MINUTE = 60_000;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgres://fomi:fomi@localhost:5432/fomi",
});
const db = drizzle(pool);

/**
 * Stores one seed video take's clip, poster and last frame under the same
 * keys a generated take uses, rendering the clip only if they aren't stored
 * yet. Returns the three URLs, as `/api/media/<key>`.
 */
async function storeSeedClip(collectionId, node) {
  const base = `videos/${collectionId}/${node.id}`;
  const keys = {
    videoUrl: `${base}.mp4`,
    url: `${base}-poster.jpg`,
    lastFrameUrl: `${base}-last.jpg`,
  };
  const stored = await Promise.all(Object.values(keys).map(hasMedia));
  if (stored.every(Boolean)) {
    return { rendered: false, ...mapValues(keys, (key) => `${MEDIA_PREFIX}${key}`) };
  }

  const [width, height] = clipSize(node.aspectRatio);
  const clip = await renderMockClip({
    seconds: node.durationSeconds,
    width,
    height,
    startFrame: await fetchPhoto(node.url),
  });
  const { poster, lastFrame } = await extractFrames(clip);
  const [videoUrl, url, lastFrameUrl] = await Promise.all([
    putMedia(clip, "video/mp4", keys.videoUrl),
    putMedia(poster, "image/jpeg", keys.url),
    putMedia(lastFrame, "image/jpeg", keys.lastFrameUrl),
  ]);
  return { rendered: true, url, videoUrl, lastFrameUrl };
}

/** A seed photo's bytes, or null (and a gradient clip) when it can't be fetched. */
async function fetchPhoto(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.warn(`Couldn't fetch ${url} (${err.message}); its clip will be a plain gradient.`);
    return null;
  }
}

function mapValues(object, fn) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, fn(value)]));
}

/** `excluded.<col>` for every column but the key, for ON CONFLICT DO UPDATE. */
function excludedAll(table, columns) {
  return Object.fromEntries(
    columns.map((key) => [key, sql.raw(`excluded."${table[key].name}"`)])
  );
}

try {
  // Clips first, outside the transaction: rendering and uploading take a
  // few seconds, and none of it needs a lock.
  const clips = new Map();
  for (const collection of COLLECTIONS) {
    for (const node of collection.nodes) {
      if (node.durationSeconds) clips.set(node.id, await storeSeedClip(collection.id, node));
    }
  }
  const rendered = [...clips.values()].filter((clip) => clip.rendered).length;
  console.log(`Seed clips: ${rendered} rendered, ${clips.size - rendered} already stored.`);

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
          const clip = clips.get(node.id);
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
            url: clip?.url ?? node.url ?? null,
            videoUrl: clip?.videoUrl ?? null,
            lastFrameUrl: clip?.lastFrameUrl ?? null,
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
