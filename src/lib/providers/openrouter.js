import { readMediaAsDataUrl } from "@/lib/storage";
import { ProviderError } from "./errors";

/**
 * Real image generation through OpenRouter's Images API.
 * https://openrouter.ai/docs/api/api-reference/images/generate-an-image
 */

const IMAGES_ENDPOINT = "https://openrouter.ai/api/v1/images";
const TIMEOUT_MS = 120_000;

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

async function requestImages(body) {
  let res;
  try {
    res = await fetch(IMAGES_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        "X-Title": "Fomi",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if (err?.name === "TimeoutError") {
      throw new ProviderError(`The model didn't respond within ${TIMEOUT_MS / 1000} s.`, 504);
    }
    throw new ProviderError(`Couldn't reach OpenRouter (${err.message}).`, 502);
  }

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
