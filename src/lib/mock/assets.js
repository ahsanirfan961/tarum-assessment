// Deterministic local placeholder assets used by the mock generation API.
// Swap these for real model output once the generation backend is wired up.
const MOCK_THUMBNAILS = Array.from(
  { length: 12 },
  (_, i) => `/mock/gen-${i + 1}.jpg`
);

export function pickThumbnails(count, seed = 0) {
  const result = [];
  for (let i = 0; i < count; i += 1) {
    result.push(MOCK_THUMBNAILS[(seed + i) % MOCK_THUMBNAILS.length]);
  }
  return result;
}
