/**
 * Seed data for the mocked backend.
 *
 * Model notes:
 * - A *collection* is a lineage, not a batch. The batch that started it is
 *   simply the root row (every node with `parentId === null`).
 * - `parentId` is structural and singular. It is the node you selected before
 *   hitting regenerate, and it alone determines tree layout.
 * - `referenceIds` are soft links. They may point at nodes in *other*
 *   collections, and they render as dashed edges only while a node is active.
 * - `prompt` on a node is the prompt that *produced* it, which is what the
 *   incoming edge from its parent displays on hover.
 * - Video nodes additionally carry a `videoUrl` (a real, playable file), while
 *   `url` stays the poster frame used everywhere the take is shown as a
 *   thumbnail. The lightbox is the only place `videoUrl` is read.
 */

const photo = (seed) => `https://picsum.photos/seed/${seed}/640/640`;

// A small pool of long-standing public CC0 sample clips (Google's GTV test
// bucket), cycled by index the same way thumbnails are cycled by seed. Real
// generation would replace this with the model's actual output file.
const SAMPLE_VIDEOS = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
];

let counter = 0;
let videoCounter = 0;
const uid = (prefix) => `${prefix}_${(counter += 1).toString(36)}`;

function node({
  id,
  parentId = null,
  prompt,
  seed,
  model = "Fomi Core v3",
  aspectRatio = "1:1",
  quality = "standard",
  resolution = "2K",
  referenceIds = [],
  durationSeconds,
}) {
  const isVideo = Boolean(durationSeconds);
  return {
    id,
    parentId,
    prompt,
    model,
    aspectRatio,
    quality,
    resolution,
    referenceIds,
    url: photo(seed),
    ...(isVideo
      ? {
          durationSeconds,
          videoUrl: SAMPLE_VIDEOS[videoCounter++ % SAMPLE_VIDEOS.length],
        }
      : {}),
  };
}

const AMBER = "col_amber";
const SAGE = "col_sage";
const FIGURE = "col_figure";
const POUR = "col_pour";

const amberBase =
  "Cast iron skillet on scorched oak, single window light from the left, steam rising, shallow depth of field";
const amberWarm =
  "Warmer key light from camera left, shift the skillet a few inches left of centre so the handle catches the highlight, deepen the shadow pooling under the rim, keep a thin curl of steam still rising off the seared crust, and let the oak grain stay visible but soft in the background blur";
const amberTight = "Kill the steam, tighter crop on the handle, hold the highlight";

const sageBase =
  "Matte sage ceramic set on raw plaster, overhead diffuse light, soft contact shadows";
const sageStack = "Stack the two smaller bowls, angle the lip toward camera";

const figureBase =
  "Editorial portrait, auburn hair, cream knit, blurred gallery interior, directional soft light";

const pourBase =
  "Slow pour of olive oil into a shallow ceramic dish, macro, 120fps, warm rim light";
const pourWider = "Pull back to a three quarter view, let the pour finish in frame";

export const COLLECTIONS = [
  {
    id: AMBER,
    kind: "image",
    name: "Amber Kitchen Hero",
    nodes: [
      node({ id: "amber_r1", prompt: amberBase, seed: "amber-cast-iron-1" }),
      node({ id: "amber_r2", prompt: amberBase, seed: "amber-cast-iron-2" }),
      node({ id: "amber_r3", prompt: amberBase, seed: "amber-cast-iron-3" }),
      node({ id: "amber_r4", prompt: amberBase, seed: "amber-cast-iron-4" }),

      node({
        id: "amber_a1",
        parentId: "amber_r2",
        prompt: amberWarm,
        seed: "amber-warm-1",
        quality: "refined",
        resolution: "4K",
      }),
      node({ id: "amber_a2", parentId: "amber_r2", prompt: amberWarm, seed: "amber-warm-2" }),
      node({ id: "amber_a3", parentId: "amber_r2", prompt: amberWarm, seed: "amber-warm-3" }),

      node({
        id: "amber_b1",
        parentId: "amber_a1",
        prompt: amberTight,
        seed: "amber-tight-1",
        referenceIds: ["sage_r1"],
        quality: "refined",
        resolution: "4K",
      }),
      node({ id: "amber_b2", parentId: "amber_a1", prompt: amberTight, seed: "amber-tight-2" }),
    ],
  },
  {
    id: SAGE,
    kind: "image",
    name: "Sage Ceramics Set",
    nodes: [
      node({ id: "sage_r1", prompt: sageBase, seed: "sage-ceramic-1" }),
      node({ id: "sage_r2", prompt: sageBase, seed: "sage-ceramic-2" }),
      node({ id: "sage_r3", prompt: sageBase, seed: "sage-ceramic-3" }),
      node({
        id: "sage_a1",
        parentId: "sage_r3",
        prompt: sageStack,
        seed: "sage-stack-1",
        quality: "draft",
      }),
      node({ id: "sage_a2", parentId: "sage_r3", prompt: sageStack, seed: "sage-stack-2" }),
    ],
  },
  {
    id: FIGURE,
    kind: "image",
    name: "Gallery Portraits",
    nodes: [
      node({ id: "figure_r1", prompt: figureBase, seed: "figure-portrait-1", aspectRatio: "3:4" }),
      node({ id: "figure_r2", prompt: figureBase, seed: "figure-portrait-2", aspectRatio: "3:4" }),
      node({ id: "figure_r3", prompt: figureBase, seed: "figure-portrait-3", aspectRatio: "3:4" }),
    ],
  },
  {
    id: POUR,
    kind: "video",
    name: "Pour Sequence",
    assembly: ["pour_r2", "pour_a1"],
    nodes: [
      node({
        id: "pour_r1",
        prompt: pourBase,
        seed: "pour-macro-1",
        model: "Fomi Motion v2",
        aspectRatio: "16:9",
        durationSeconds: 4,
      }),
      node({
        id: "pour_r2",
        prompt: pourBase,
        seed: "pour-macro-2",
        model: "Fomi Motion v2",
        aspectRatio: "16:9",
        durationSeconds: 4,
      }),
      node({
        id: "pour_r3",
        prompt: pourBase,
        seed: "pour-macro-3",
        model: "Fomi Motion v2",
        aspectRatio: "16:9",
        durationSeconds: 4,
      }),
      node({
        id: "pour_a1",
        parentId: "pour_r2",
        prompt: pourWider,
        seed: "pour-wide-1",
        model: "Fomi Motion v2",
        aspectRatio: "16:9",
        durationSeconds: 6,
        referenceIds: ["amber_a1"],
      }),
      node({
        id: "pour_a2",
        parentId: "pour_r2",
        prompt: pourWider,
        seed: "pour-wide-2",
        model: "Fomi Motion v2",
        aspectRatio: "16:9",
        durationSeconds: 6,
      }),
    ],
  },
];

export const PROJECTS = [
  {
    id: "prj_hearth",
    name: "Hearth Cookware",
    client: "Sable and Oak",
    collectionIds: [AMBER, SAGE, POUR],
  },
  {
    id: "prj_atrium",
    name: "Atrium Editorial",
    client: "Issue 04",
    collectionIds: [FIGURE],
  },
  {
    id: "prj_lumen",
    name: "Lumen Skincare",
    client: "Launch film",
    collectionIds: [],
  },
];

export { photo, uid, SAMPLE_VIDEOS };
