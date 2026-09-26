import { index, integer, numeric, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Persistence for the lineage model. See docs/integration/phase-2-postgres.md
 * for why it has this shape.
 *
 * Ids stay app-generated text (`image_<batch>_<i>`, `col_<batch>`), so the
 * seed ids and the client's own id handling keep working. References are a
 * plain array rather than a join table: they are soft links, nothing asks
 * "who references X", and a node is always read with its collection.
 *
 * Nothing here enforces that a node's parent sits in the same collection.
 * The generate route checks it on insert instead of paying for a trigger.
 */

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  client: text("client"),
  createdAt: createdAt(),
});

export const collections = pgTable(
  "collections",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // 'image' | 'video'
    name: text("name").notNull(),
    // Video only. Points at a node of this collection, so it is written after
    // the nodes exist, and cleared rather than blocking a delete.
    cutLeafId: text("cut_leaf_id").references(() => nodes.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("collections_project_created_idx").on(t.projectId, t.createdAt.desc())]
);

export const nodes = pgTable(
  "nodes",
  {
    id: text("id").primaryKey(),
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    parentId: text("parent_id").references(() => nodes.id),
    referenceIds: text("reference_ids").array().notNull().default([]),
    prompt: text("prompt").notNull(),
    model: text("model").notNull(),
    aspectRatio: text("aspect_ratio").notNull(),
    quality: text("quality"),
    resolution: text("resolution"),
    url: text("url"), // the image, or a video's poster frame
    videoUrl: text("video_url"),
    lastFrameUrl: text("last_frame_url"), // phase 3 "continue"
    durationSeconds: real("duration_seconds"),
    beat: integer("beat"),
    // Filled by phase 3's background video jobs; image takes land completed.
    status: text("status").notNull().default("completed"), // 'pending' | 'completed' | 'failed'
    error: text("error"),
    providerJobId: text("provider_job_id"),
    cost: numeric("cost", { precision: 10, scale: 5 }),
    createdAt: createdAt(),
  },
  (t) => [index("nodes_collection_idx").on(t.collectionId)]
);
