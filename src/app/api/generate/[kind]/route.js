import { NextResponse } from "next/server";
import { nameFromPrompt } from "@/lib/naming";
import { getModel } from "@/lib/models/catalog";
import { getProvider, ProviderError } from "@/lib/providers";
import { extensionFor, putMedia, StorageError } from "@/lib/storage";
import { DatabaseError } from "@/lib/db/client";
import {
  InputError,
  insertGeneration,
  resolveGenerationContext,
} from "@/lib/data/collections";
import { startFrameFor, submitVideoJobs } from "@/lib/video/jobs";

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
 * The parent and references are looked up by id, never taken from URLs the
 * client sends, which also checks they belong to this collection and
 * project. The parent's pixels go to the model, so a child take actually
 * follows it. Every take is written to Postgres before it is returned, with
 * the mock provider too.
 *
 * Images come back finished. Video only submits: each take is a job that
 * renders for minutes, so it is returned `pending` and the client polls
 * GET /api/generate/jobs until it completes (see src/lib/video/jobs.js).
 */
export async function POST(request, { params }) {
  const { kind } = await params;

  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: `Unknown kind "${kind}".` }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const {
    prompt = "",
    count,
    aspectRatio,
    model: modelId,
    quality = "draft",
    resolution = null,
    duration = null,
    parentId = null,
    referenceIds = [],
    projectId = null,
    collectionId: requestedCollectionId = null,
    intent = "regen",
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

  // Ids reach SQL parameters and storage keys, so they have to be plain.
  const isSafeId = (id) => typeof id === "string" && SAFE_ID.test(id);
  if (!isSafeId(projectId)) {
    return badRequest("A valid project id is required.");
  }
  for (const id of [requestedCollectionId, parentId]) {
    if (id != null && !isSafeId(id)) {
      return badRequest("Invalid collection or take id.");
    }
  }
  if (!Array.isArray(referenceIds) || !referenceIds.every(isSafeId)) {
    return badRequest("Invalid reference ids.");
  }

  const takeCount = count == null ? model.defaultCount : Number(count);
  if (!model.counts.includes(takeCount)) {
    return badRequest(`${model.label} makes ${model.counts.join(", ")} takes at a time, not ${count}.`);
  }
  if (model.resolutions && !model.resolutions.includes(resolution ?? model.resolutions[0])) {
    return badRequest(
      `${model.label} doesn't support ${resolution}. Use one of ${model.resolutions.join(", ")}.`
    );
  }
  const durationSeconds = model.durations ? Number(duration ?? model.durations[0]) : null;
  if (model.durations && !model.durations.includes(durationSeconds)) {
    return badRequest(
      `${model.label} renders ${model.durations.join(", ")} second clips, not ${duration}.`
    );
  }

  // Ids are primary keys now, so two batches in the same millisecond must
  // still differ.
  const batch = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const settings = {
    prompt: trimmed,
    model: model.id,
    aspectRatio,
    quality: model.qualities ? quality : null,
    resolution: model.resolutions ? resolution ?? model.resolutions[0] : null,
  };

  try {
    const { collection, parent, references } = await resolveGenerationContext({
      kind,
      projectId,
      collectionId: requestedCollectionId,
      parentId,
      referenceIds,
    });

    const collectionId = collection?.id ?? `col_${batch}`;
    let takes;

    if (kind === "image") {
      const inputUrls = [parent, ...references].filter(Boolean).map((node) => node.url);
      if (inputUrls.length > model.maxReferences) {
        return badRequest(
          `${model.label} accepts at most ${model.maxReferences} input images (the parent plus references), but this generation has ${inputUrls.length}.`
        );
      }
      takes = await generateImageNodes({ model, settings, takeCount, inputUrls, batch, collectionId });
    } else {
      // For video the parent is a frame to start on, not a reference.
      if (references.length > model.maxReferences) {
        return badRequest(
          `${model.label} accepts at most ${model.maxReferences} references, but this generation has ${references.length}.`
        );
      }
      takes = await submitVideoNodes({
        model,
        settings: { ...settings, durationSeconds },
        takeCount,
        batch,
        intent,
        parent,
        referenceUrls: references.map((ref) => ref.url),
      });
    }

    const saved = await insertGeneration({
      kind,
      intent,
      projectId,
      collectionId,
      isNewCollection: !collection,
      name: nameFromPrompt(trimmed),
      parentId: parent?.id ?? null,
      referenceIds: references.map((ref) => ref.id),
      takes,
    });

    return NextResponse.json({ collectionId, kind, ...saved });
  } catch (err) {
    if (
      err instanceof InputError ||
      err instanceof DatabaseError ||
      err instanceof ProviderError ||
      err instanceof StorageError
    ) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[generate]", err);
    return NextResponse.json({ error: "Generation failed unexpectedly." }, { status: 500 });
  }
}

async function generateImageNodes({ model, settings, takeCount, inputUrls, batch, collectionId }) {
  const provider = getProvider();
  const results = await provider.generateImages({
    model,
    prompt: settings.prompt,
    count: takeCount,
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

/**
 * Submits one job per take and shapes the takes as `pending` rows. Each opens
 * on the frame its lineage implies (see `startFrameFor`); a regenerated take
 * repeats its parent's beat and a continuation advances it.
 */
async function submitVideoNodes({ model, settings, takeCount, batch, intent, parent, referenceUrls }) {
  const frameUrl = await startFrameFor(parent, intent);
  const jobIds = await submitVideoJobs({ model, settings, count: takeCount, frameUrl, referenceUrls });

  const parentBeat = parent?.beat ?? null;
  const submittedAt = new Date();
  return jobIds.map((jobId, i) => ({
    id: `video_${batch}_${i}`,
    ...settings,
    url: null,
    beat: parentBeat == null ? 1 : intent === "extend" ? parentBeat + 1 : parentBeat,
    status: "pending",
    providerJobId: jobId,
    submittedAt,
    cost: null,
  }));
}

function badRequest(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}
