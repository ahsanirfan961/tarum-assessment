import { NextResponse } from "next/server";
import { nameFromPrompt } from "@/lib/naming";
import { getModel, MAX_TAKES } from "@/lib/models/catalog";
import { getProvider, getVideoProvider, ProviderError } from "@/lib/providers";
import { extensionFor, putMedia, StorageError } from "@/lib/storage";

const KINDS = new Set(["image", "video"]);
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Generation endpoint.
 *
 * The response is shaped the way the lineage graph consumes it: every
 * returned node carries the `parentId` it was generated from and the
 * `referenceIds` that informed it. Which provider fills it in (the mock, or a
 * real model through OpenRouter) is decided by GENERATION_PROVIDER.
 *
 * Until nodes are persisted (phase 2), the client also sends `parentUrl` and
 * `referenceUrls`, since the server has nowhere to look a node up by id. The
 * parent's pixels go to the model, so a child take actually follows it.
 */
export async function POST(request, { params }) {
  const { kind } = await params;

  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: `Unknown kind "${kind}".` }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const {
    prompt = "",
    count = 4,
    aspectRatio,
    model: modelId,
    quality = "draft",
    resolution = null,
    parentId = null,
    parentUrl = null,
    referenceIds = [],
    referenceUrls = [],
    collectionId: requestedCollectionId = null,
    intent = "regen",
    parentBeat = null,
  } = body;

  const trimmed = typeof prompt === "string" ? prompt.trim() : "";
  if (!trimmed) return badRequest("A prompt is required.");

  if (intent !== "regen" && intent !== "extend") {
    return badRequest(`Unknown intent "${intent}".`);
  }

  const model = getModel(modelId);
  if (!model || model.kind !== kind) {
    return badRequest(`Unknown ${kind} model "${modelId}".`);
  }

  if (!model.aspectRatios.includes(aspectRatio)) {
    return badRequest(
      `${model.label} doesn't support ${aspectRatio}. Use one of ${model.aspectRatios.join(", ")}.`
    );
  }

  const inputUrls = [parentUrl, ...(Array.isArray(referenceUrls) ? referenceUrls : [])].filter(Boolean);
  if (inputUrls.length > model.maxReferences) {
    return badRequest(
      `${model.label} accepts at most ${model.maxReferences} input images (the parent plus references), but this generation has ${inputUrls.length}.`
    );
  }

  // Nodes are keyed in storage by collection, so ids that reach a key have
  // to be safe path segments.
  if (requestedCollectionId != null && !SAFE_ID.test(requestedCollectionId)) {
    return badRequest("Invalid collection id.");
  }

  const safeCount = Math.min(Math.max(Math.floor(Number(count)) || 1, 1), MAX_TAKES);
  const batch = Date.now().toString(36);
  const collectionId = requestedCollectionId ?? `col_${batch}`;
  const settings = {
    prompt: trimmed,
    model: model.id,
    aspectRatio,
    quality: model.qualities ? quality : null,
    resolution: model.resolutions ? resolution : null,
  };

  try {
    const nodes =
      kind === "image"
        ? await generateImageNodes({ model, settings, safeCount, inputUrls, batch, collectionId })
        : await generateVideoNodes({ settings, safeCount, batch, intent, parentBeat });

    return NextResponse.json({
      collectionId,
      name: nameFromPrompt(trimmed),
      kind,
      nodes: nodes.map((node) => ({ ...node, parentId, referenceIds })),
    });
  } catch (err) {
    if (err instanceof ProviderError || err instanceof StorageError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[generate]", err);
    return NextResponse.json({ error: "Generation failed unexpectedly." }, { status: 500 });
  }
}

async function generateImageNodes({ model, settings, safeCount, inputUrls, batch, collectionId }) {
  const provider = getProvider();
  const results = await provider.generateImages({
    model,
    prompt: settings.prompt,
    count: safeCount,
    aspectRatio: settings.aspectRatio,
    quality: settings.quality,
    resolution: settings.resolution,
    inputUrls,
  });

  return Promise.all(
    results.map(async (result, i) => {
      const id = `image_${batch}_${i}`;
      // The mock hands back URLs it doesn't own; real output is stored.
      const url =
        result.url ??
        (await putMedia(
          result.buffer,
          result.contentType,
          `images/${collectionId}/${id}.${extensionFor(result.contentType)}`
        ));
      return { id, ...settings, url, cost: result.cost ?? null };
    })
  );
}

async function generateVideoNodes({ settings, safeCount, batch, intent, parentBeat }) {
  const results = await getVideoProvider().generateVideos({ count: safeCount });
  return results.map((result, i) => ({
    id: `video_${batch}_${i}`,
    ...settings,
    url: result.url,
    videoUrl: result.videoUrl,
    durationSeconds: result.durationSeconds,
    beat: parentBeat == null ? 1 : intent === "extend" ? parentBeat + 1 : parentBeat,
    cost: result.cost ?? null,
  }));
}

function badRequest(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}
