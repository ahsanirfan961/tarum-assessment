const STOP_WORDS = new Set([
  "a", "an", "the", "of", "on", "in", "at", "with", "and", "to", "from",
  "into", "onto", "over", "under", "for", "by", "is", "are",
]);

/**
 * Derives a short collection name from the prompt that started it.
 *
 * Naming every batch by hand is friction on the most frequent action in the
 * app, so this runs automatically and the name stays editable afterwards.
 */
export function nameFromPrompt(prompt) {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  if (!words.length) return "Untitled";

  return words
    .slice(0, 3)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
