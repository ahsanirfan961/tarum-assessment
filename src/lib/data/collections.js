import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { collections, nodes } from "@/lib/db/schema";
import { nextCutLeafId } from "@/lib/video/cut";
import { query, toCollection, toNode } from "./projects";

/**
 * Server-side write layer. The generate route and the collection PATCH route
 * are the only callers.
 */

export class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "InputError";
    this.status = status;
  }
}

/**
 * Resolves what a generation builds on, by id, from the database, rather
 * than trusting URLs the client sends. Checks that:
 *
 * - the parent exists and belongs to the collection being continued (and,
 *   for images, is finished);
 * - that collection is in this project and is of this kind;
 * - every reference exists and is in the same project (projects are
 *   isolated by design, but references may cross collections).
 *
 * Returns the rows the route needs: the collection (null for a fresh one),
 * the parent node, and the references in the order they were staged.
 */
export async function resolveGenerationContext({
  kind,
  projectId,
  collectionId,
  parentId,
  referenceIds,
}) {
  const project = await query(() =>
    db.query.projects.findFirst({ where: (p, { eq }) => eq(p.id, projectId) })
  );
  if (!project) throw new InputError(`Unknown project "${projectId}".`);

  let collection = null;
  let parent = null;

  if (parentId != null) {
    if (collectionId == null) {
      throw new InputError("Continuing from a take needs the collection it belongs to.");
    }
    [collection, parent] = await Promise.all([
      query(() => db.query.collections.findFirst({ where: (c, { eq }) => eq(c.id, collectionId) })),
      query(() => db.query.nodes.findFirst({ where: (n, { eq }) => eq(n.id, parentId) })),
    ]);
    if (!collection || collection.projectId !== projectId || collection.kind !== kind) {
      const article = kind === "image" ? "an image" : "a video";
      throw new InputError(`Collection "${collectionId}" isn't ${article} collection in this project.`);
    }
    if (!parent || parent.collectionId !== collection.id) {
      throw new InputError(`Take "${parentId}" isn't part of this collection.`);
    }
    // Video checks its parent itself (see `startFrameFor`), since a new take
    // may start from one that is still rendering.
    if (kind === "image" && (parent.status !== "completed" || !parent.url)) {
      throw new InputError("That take hasn't finished generating, so nothing can branch from it yet.");
    }
  } else if (collectionId != null) {
    // A collection is one lineage: without a parent there is nothing in it to
    // attach to, and a fresh prompt always starts a new collection.
    throw new InputError("A new take in an existing collection needs a parent.");
  }

  const uniqueRefs = [...new Set(referenceIds)];
  const references = uniqueRefs.length
    ? await query(() =>
        db
          .select({
            id: nodes.id,
            url: nodes.url,
            status: nodes.status,
            projectId: collections.projectId,
          })
          .from(nodes)
          .innerJoin(collections, eq(collections.id, nodes.collectionId))
          .where(inArray(nodes.id, uniqueRefs))
      )
    : [];
  const refById = new Map(references.map((r) => [r.id, r]));
  for (const id of uniqueRefs) {
    const ref = refById.get(id);
    if (!ref || ref.projectId !== projectId) {
      throw new InputError(`Reference "${id}" isn't a take in this project.`);
    }
    if (ref.status !== "completed" || !ref.url) {
      throw new InputError(`Reference "${id}" hasn't finished generating yet.`);
    }
  }

  return {
    collection,
    parent,
    references: uniqueRefs.map((id) => refById.get(id)),
  };
}

/**
 * Writes one generation in a single transaction: the collection if it's new,
 * its nodes, and where the video cut now points (the same decision the
 * client applies, via `nextCutLeafId`). Returns the rows as the client
 * shapes them.
 */
export async function insertGeneration({
  kind,
  intent,
  projectId,
  collectionId,
  isNewCollection,
  name,
  parentId,
  referenceIds,
  takes,
}) {
  return query(() =>
    db.transaction(async (tx) => {
      let cutLeafId = null;
      if (isNewCollection) {
        await tx.insert(collections).values({ id: collectionId, projectId, kind, name });
      } else {
        // Lock the row, so two generations landing at once can't both read
        // the old cut and have one silently overwrite the other.
        const [locked] = await tx
          .select({ name: collections.name, cutLeafId: collections.cutLeafId })
          .from(collections)
          .where(eq(collections.id, collectionId))
          .for("update");
        name = locked.name;
        cutLeafId = locked.cutLeafId;
      }

      // One timestamp per take, a millisecond apart, so a batch reads back in
      // the order the provider returned it.
      const base = Date.now();
      const inserted = await tx
        .insert(nodes)
        .values(
          takes.map((take, i) => ({
            ...take,
            collectionId,
            parentId,
            referenceIds,
            // Video takes arrive `pending` with their job id; images are done.
            status: take.status ?? "completed",
            cost: take.cost == null ? null : String(take.cost),
            createdAt: new Date(base + i),
          }))
        )
        .returning();

      let nextCut = cutLeafId;
      if (kind === "video") {
        nextCut = nextCutLeafId({ intent, parentId, cutLeafId, newNodes: inserted });
        if (nextCut !== cutLeafId) {
          await tx
            .update(collections)
            .set({ cutLeafId: nextCut })
            .where(eq(collections.id, collectionId));
        }
      }

      return {
        name,
        nodes: inserted.map(toNode),
        ...(kind === "video" ? { cutLeafId: nextCut } : {}),
      };
    })
  );
}

/**
 * Renames a collection and/or picks its cut. `cutLeafId` must be a take in
 * that same video collection. Returns the collection without its nodes.
 */
export async function updateCollection(collectionId, { name, cutLeafId }) {
  return query(() =>
    db.transaction(async (tx) => {
      const [collection] = await tx
        .select()
        .from(collections)
        .where(eq(collections.id, collectionId))
        .for("update");
      if (!collection) throw new InputError(`Collection "${collectionId}" doesn't exist.`, 404);

      const changes = {};
      if (name !== undefined) changes.name = name;
      if (cutLeafId !== undefined) {
        if (collection.kind !== "video") {
          throw new InputError("Only video collections have a cut.");
        }
        const [leaf] = await tx
          .select({ collectionId: nodes.collectionId, status: nodes.status })
          .from(nodes)
          .where(eq(nodes.id, cutLeafId));
        if (!leaf || leaf.collectionId !== collectionId) {
          throw new InputError(`Take "${cutLeafId}" isn't part of this collection.`);
        }
        changes.cutLeafId = cutLeafId;
      }

      const [updated] = await tx
        .update(collections)
        .set(changes)
        .where(eq(collections.id, collectionId))
        .returning();
      const { nodes: _omit, ...rest } = toCollection(updated, []);
      return rest;
    })
  );
}
