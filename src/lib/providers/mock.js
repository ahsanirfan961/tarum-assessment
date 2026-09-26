import { SAMPLE_VIDEOS } from "@/lib/mock/seed";

/**
 * The mocked backend: stand-in photography and sample clips after a short
 * delay. It returns URLs rather than bytes, so nothing is written to storage
 * and the app runs with no API key and no Docker.
 */

const IMAGE_LATENCY_MS = 900;
const VIDEO_LATENCY_MS = 1600;

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

export async function generateVideos({ count }) {
  await wait(VIDEO_LATENCY_MS);
  const seed = batchSeed();
  return Array.from({ length: count }, (_, i) => ({
    url: `https://picsum.photos/seed/${seed}${i}/640/640`,
    videoUrl: SAMPLE_VIDEOS[(seed.charCodeAt(0) + i) % SAMPLE_VIDEOS.length],
    durationSeconds: 4 + (i % 3) * 2,
    cost: null,
  }));
}
