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
 * - `qualities` maps the composer's quality steps to the provider's values.
 */
export const MODELS = [
  {
    id: "draft-image",
    label: "Draft (GPT Image 2)",
    kind: "image",
    provider: { slug: "openai/gpt-image-2" },
    maxCount: 10,
    maxReferences: 16,
    aspectRatios: ["1:1", "3:4", "4:3", "16:9", "9:16"],
    resolutions: null,
    qualities: { draft: "low", standard: "medium", refined: "high" },
  },
  {
    id: "flux-klein",
    label: "Fast (FLUX.2 Klein)",
    kind: "image",
    provider: { slug: "black-forest-labs/flux.2-klein-4b" },
    maxCount: 1,
    maxReferences: 4,
    aspectRatios: ["1:1", "3:4", "4:3", "16:9", "9:16"],
    resolutions: null,
    qualities: null,
  },

  // Video is still mocked until phase 3, so these carry no provider.
  {
    id: "fomi-motion-v2",
    label: "Fomi Motion v2",
    kind: "video",
    provider: null,
    maxCount: 8,
    maxReferences: 16,
    aspectRatios: ["16:9", "9:16", "1:1"],
    resolutions: ["1K", "2K", "4K"],
    qualities: { draft: "draft", standard: "standard", refined: "refined" },
  },
  {
    id: "fomi-cinematic",
    label: "Fomi Cinematic",
    kind: "video",
    provider: null,
    maxCount: 8,
    maxReferences: 16,
    aspectRatios: ["16:9", "9:16", "1:1"],
    resolutions: ["1K", "2K", "4K"],
    qualities: { draft: "draft", standard: "standard", refined: "refined" },
  },
];

/** Upper bound on takes per generation, whatever the model. */
export const MAX_TAKES = 8;

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

/** Display name for a node's model; ids the catalog doesn't know show as-is. */
export function modelLabel(id) {
  return getModel(id)?.label ?? id;
}
