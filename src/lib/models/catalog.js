/**
 * Every model the composer can pick, and what each one supports.
 *
 * The composer builds its ratio, quality and resolution options from the
 * selected entry and hides any field set to `null`, so swapping or adding a
 * model is an edit here and nowhere else. Shared by client and server: the
 * generate route validates requests against the same entries.
 *
 * - `id` is stable and is what gets stored on nodes.
 * - `maxCount` is the `n` a single provider request accepts. A batch larger
 *   than that fans out into one request per take.
 * - `counts` are the takes-per-generation the composer offers, and the most
 *   the generate route accepts.
 * - `qualities` maps the composer's quality steps to the provider's values.
 * - `durations` (video only) are the clip lengths offered, in seconds; the
 *   first is the default, as with `resolutions`.
 */
export const MODELS = [
  {
    id: "draft-image",
    label: "Draft (GPT Image 2)",
    kind: "image",
    provider: { slug: "openai/gpt-image-2" },
    maxCount: 10,
    maxReferences: 16,
    counts: [1, 2, 4, 6],
    defaultCount: 4,
    aspectRatios: ["1:1", "3:4", "4:3", "16:9", "9:16"],
    resolutions: null,
    durations: null,
    qualities: { draft: "low", standard: "medium", refined: "high" },
  },
  {
    id: "flux-klein",
    label: "Fast (FLUX.2 Klein)",
    kind: "image",
    provider: { slug: "black-forest-labs/flux.2-klein-4b" },
    maxCount: 1,
    maxReferences: 4,
    counts: [1, 2, 4, 6],
    defaultCount: 4,
    aspectRatios: ["1:1", "3:4", "4:3", "16:9", "9:16"],
    resolutions: null,
    durations: null,
    qualities: null,
  },

  // Video renders as a background job: one job per take, so `maxCount` is 1
  // and `counts` doubles as a cost guard.
  {
    id: "draft-video",
    label: "Draft (Seedance 2.0 Mini)",
    kind: "video",
    provider: { slug: "bytedance/seedance-2.0-mini" },
    maxCount: 1,
    counts: [1, 2],
    defaultCount: 1,
    maxReferences: 4,
    aspectRatios: ["16:9", "9:16", "1:1"],
    resolutions: ["480p", "720p"],
    durations: [4, 5, 6, 8, 10],
    qualities: null,
    generateAudio: false,
  },
  {
    id: "fast-video",
    label: "Fast (Seedance 2.0 Fast)",
    kind: "video",
    provider: { slug: "bytedance/seedance-2.0-fast" },
    maxCount: 1,
    counts: [1, 2],
    defaultCount: 1,
    maxReferences: 4,
    aspectRatios: ["16:9", "9:16", "1:1"],
    resolutions: ["480p", "720p"],
    durations: [4, 5, 6, 8, 10],
    qualities: null,
    generateAudio: false,
  },
];

export const QUALITY_STEPS = [
  { value: "draft", label: "Draft, fastest" },
  { value: "standard", label: "Standard" },
  { value: "refined", label: "Refined, slowest" },
];

export function modelsFor(kind) {
  return MODELS.filter((m) => m.kind === kind);
}

export function getModel(id) {
  return MODELS.find((m) => m.id === id) ?? null;
}

export function defaultModel(kind) {
  return modelsFor(kind)[0];
}

/**
 * The catalog entry for `id`, or the kind's default when `id` isn't in the
 * catalog, such as the seed takes' "Fomi Core v3".
 */
export function resolveModel(kind, id) {
  const model = getModel(id);
  return model?.kind === kind ? model : defaultModel(kind);
}

// Mock video models from before phase 3. Takes made with them keep their id,
// so they still get a readable name.
const RETIRED_LABELS = { "fomi-motion-v2": "Fomi Motion v2", "fomi-cinematic": "Fomi Cinematic" };

/** Display name for a node's model; ids the catalog doesn't know show as-is. */
export function modelLabel(id) {
  return getModel(id)?.label ?? RETIRED_LABELS[id] ?? id;
}
