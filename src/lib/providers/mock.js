import { readMediaAsDataUrl } from "@/lib/storage";
import { clipSize, renderMockClip } from "@/lib/video/ffmpeg";
import { ProviderError } from "./errors";

/**
 * The mocked backend: stand-in media at no cost.
 *
 * Images come back as picsum URLs it doesn't own, so nothing is stored.
 *
 * Video runs as a fake job that "renders" for a few seconds. Its clip is made
 * locally with ffmpeg: a slow push-in that opens on the take's start frame
 * (so New take and Continue behave visibly like the real thing), or a
 * drifting gradient for a fresh prompt. It then goes through the same finish
 * path as a real clip (frames, storage, database), so the whole pending →
 * completed flow can be tried without a key, the network, or spending.
 *
 * Put `[fail]` in a video prompt to get a job that fails, for trying the
 * failed state and Retry.
 */

const IMAGE_LATENCY_MS = 900;
const SUBMIT_LATENCY_MS = 400;
const RENDER_MS = 8_000;

// Muted takes on the app's own palette, picked per prompt.
const PALETTES = [
  ["3b2a20", "e8735a", "9e8c7d"],
  ["1f1a17", "b84a32", "f3ede8"],
  ["262019", "8c7968", "fceae5"],
  ["14100e", "e8735a", "6e5f51"],
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const batchSeed = () => Date.now().toString(36);

export const name = "mock";

export async function generateImages({ count }) {
  await wait(IMAGE_LATENCY_MS);
  const seed = batchSeed();
  return Array.from({ length: count }, (_, i) => ({
    url: `https://picsum.photos/seed/${seed}${i}/640/640`,
    cost: null,
  }));
}

// A job id carries everything the mock needs to finish it later, so nothing
// is held in memory and a job outlives a server restart like a real one.
function encodeJob(job) {
  return `mock_${Buffer.from(JSON.stringify(job)).toString("base64url")}`;
}

function decodeJob(jobId) {
  try {
    return JSON.parse(Buffer.from(jobId.slice("mock_".length), "base64url").toString());
  } catch {
    throw new ProviderError(`Unknown mock job "${jobId}".`, 404);
  }
}

function hash(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export async function submitVideos({ prompt, count, aspectRatio, resolution, duration, firstFrameUrl }) {
  await wait(SUBMIT_LATENCY_MS);
  const [width, height] = clipSize(aspectRatio, resolution);
  const submittedAt = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    jobId: encodeJob({
      at: submittedAt,
      seconds: duration,
      width,
      height,
      frame: firstFrameUrl ?? null,
      palette: (hash(prompt) + i) % PALETTES.length,
      fails: prompt.includes("[fail]"),
      nonce: Math.random().toString(36).slice(2, 8),
    }),
  }));
}

export async function getVideoJob(jobId) {
  const job = decodeJob(jobId);
  if (Date.now() - job.at < RENDER_MS) {
    return { status: "in_progress", error: null, cost: null };
  }
  return job.fails
    ? { status: "failed", error: "The mock was asked to fail this take ([fail] in the prompt).", cost: null }
    : { status: "completed", error: null, cost: null };
}

export async function downloadVideo(jobId) {
  const job = decodeJob(jobId);
  const startFrame = job.frame
    ? Buffer.from((await readMediaAsDataUrl(job.frame)).split(",")[1], "base64")
    : null;
  return renderMockClip({
    seconds: job.seconds,
    width: job.width,
    height: job.height,
    startFrame,
    colors: PALETTES[job.palette],
  });
}
