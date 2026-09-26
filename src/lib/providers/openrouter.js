import { readMediaAsDataUrl } from "@/lib/storage";
import { ProviderError } from "./errors";

/**
 * Real generation through OpenRouter.
 *
 * Images are synchronous: one request, the pixels come back in the response.
 * https://openrouter.ai/docs/api/api-reference/images/generate-an-image
 *
 * Video is a job: submitting returns an id straight away, and the clip is
 * ready tens of seconds to minutes later. src/lib/video/jobs.js polls it.
 * https://openrouter.ai/docs/guides/overview/multimodal/video-generation
 */

const IMAGES_ENDPOINT = "https://openrouter.ai/api/v1/images";
const VIDEOS_ENDPOINT = "https://openrouter.ai/api/v1/videos";
const TIMEOUT_MS = 120_000;
const JOB_REQUEST_TIMEOUT_MS = 30_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;

export const name = "openrouter";

function apiKey() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new ProviderError(
      "OPENROUTER_API_KEY isn't set. Add it to .env.local, or set GENERATION_PROVIDER=mock.",
      500
    );
  }
  return key;
}

/** The reason OpenRouter gives, plus any moderation reasons it attaches. */
function errorMessage(data, status) {
  const error = data?.error;
  const lines = [error?.message || `OpenRouter returned ${status}.`];
  const reasons = error?.metadata?.reasons;
  if (Array.isArray(reasons) && reasons.length) lines.push(`Flagged for: ${reasons.join(", ")}`);
  return lines.join("\n");
}

/** A fetch to OpenRouter, with its failures turned into ProviderErrors. */
async function call(url, { method = "GET", body, timeout = TIMEOUT_MS } = {}) {
  try {
    return await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
        "X-Title": "Fomi",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeout),
    });
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if (err?.name === "TimeoutError") {
      throw new ProviderError(`OpenRouter didn't respond within ${timeout / 1000} s.`, 504);
    }
    throw new ProviderError(`Couldn't reach OpenRouter (${err.message}).`, 502);
  }
}

async function requestImages(body) {
  const res = await call(IMAGES_ENDPOINT, { method: "POST", body });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ProviderError(errorMessage(data, res.status), res.status);

  const images = (data?.data ?? []).filter((item) => item?.b64_json);
  if (!images.length) throw new ProviderError("The model returned no images.", 502);

  // Cost is billed per request; spread it across the images it produced.
  const cost = typeof data.usage?.cost === "number" ? data.usage.cost / images.length : null;
  return images.map((item) => ({
    buffer: Buffer.from(item.b64_json, "base64"),
    contentType: item.media_type || "image/png",
    cost,
  }));
}

/**
 * Generates `count` takes. `inputUrls` is the parent take first, then any
 * staged references; they're what make a child take follow its parent.
 *
 * A model that accepts `n >= count` gets one request. Otherwise the batch
 * fans out into one request per take, and takes that fail are dropped: the
 * call only fails if none succeed, with the provider's own reason(s).
 */
export async function generateImages({ model, prompt, count, aspectRatio, quality, resolution, inputUrls }) {
  const inputs = await Promise.all(inputUrls.map(readMediaAsDataUrl));

  const body = {
    model: model.provider.slug,
    prompt,
    aspect_ratio: aspectRatio,
    ...(model.qualities && quality ? { quality: model.qualities[quality] } : {}),
    ...(model.resolutions && resolution ? { resolution } : {}),
    ...(inputs.length
      ? { input_references: inputs.map((url) => ({ type: "image_url", image_url: { url } })) }
      : {}),
  };

  if (count <= model.maxCount) {
    return requestImages({ ...body, n: count });
  }

  const settled = await Promise.allSettled(
    Array.from({ length: count }, () => requestImages({ ...body, n: 1 }))
  );
  const results = settled.filter((s) => s.status === "fulfilled").flatMap((s) => s.value);
  if (results.length) return results;

  const reasons = [...new Set(settled.map((s) => s.reason?.message).filter(Boolean))];
  const status = settled.find((s) => s.reason instanceof ProviderError)?.reason.status ?? 502;
  throw new ProviderError(reasons.join("\n") || "Every take failed.", status);
}

/**
 * Submits `count` video jobs, one per take. `firstFrameUrl` is the image the
 * clip must open on (the parent's first frame for a new take, its last frame
 * for a continuation); references steer the look without pinning a frame.
 * Both are inlined as data: URLs, since OpenRouter can't reach our storage.
 *
 * Returns one settled result per take, `{ jobId }` or `{ error }`, so a batch
 * where only some submits fail still keeps the ones that went through.
 */
export async function submitVideos({
  model,
  prompt,
  count,
  aspectRatio,
  resolution,
  duration,
  firstFrameUrl,
  referenceUrls,
}) {
  const [firstFrame, ...references] = await Promise.all(
    [firstFrameUrl, ...referenceUrls].map((url) => (url ? readMediaAsDataUrl(url) : null))
  );

  const body = {
    model: model.provider.slug,
    prompt,
    aspect_ratio: aspectRatio,
    resolution,
    duration,
    generate_audio: Boolean(model.generateAudio),
    ...(firstFrame
      ? {
          frame_images: [
            { type: "image_url", image_url: { url: firstFrame }, frame_type: "first_frame" },
          ],
        }
      : {}),
    ...(references.length
      ? {
          input_references: references.map((url) => ({ type: "image_url", image_url: { url } })),
        }
      : {}),
  };

  const settled = await Promise.allSettled(
    Array.from({ length: count }, async () => {
      const res = await call(VIDEOS_ENDPOINT, { method: "POST", body, timeout: TIMEOUT_MS });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new ProviderError(errorMessage(data, res.status), res.status);
      if (!data?.id) throw new ProviderError("OpenRouter accepted the video but returned no job id.");
      return { jobId: data.id };
    })
  );
  return settled.map((s) => (s.status === "fulfilled" ? s.value : { error: s.reason }));
}

/**
 * Where a job is: `pending`/`in_progress` (still rendering), `completed`, or
 * `failed` with the provider's reason. `cost` arrives with completion.
 */
export async function getVideoJob(jobId) {
  const res = await call(`${VIDEOS_ENDPOINT}/${encodeURIComponent(jobId)}`, {
    timeout: JOB_REQUEST_TIMEOUT_MS,
  });
  const data = await res.json().catch(() => null);
  if (res.status === 404) {
    return { status: "failed", error: "OpenRouter no longer has this job.", cost: null };
  }
  if (!res.ok) throw new ProviderError(errorMessage(data, res.status), res.status);
  return {
    status: data?.status ?? "pending",
    error: data?.status === "failed" ? jobError(data) : null,
    cost: typeof data?.usage?.cost === "number" ? data.usage.cost : null,
  };
}

function jobError(data) {
  const error = data?.error;
  const message = typeof error === "string" ? error : error?.message;
  return message || "The model couldn't render this take.";
}

/** The finished clip's bytes. */
export async function downloadVideo(jobId) {
  const res = await call(`${VIDEOS_ENDPOINT}/${encodeURIComponent(jobId)}/content?index=0`, {
    timeout: DOWNLOAD_TIMEOUT_MS,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ProviderError(errorMessage(data, res.status), res.status);
  }
  return Buffer.from(await res.arrayBuffer());
}
