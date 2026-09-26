/**
 * Where a take is in its life, and what that allows. Shared by the client,
 * which uses it to explain a disabled composer, and the server, which refuses
 * the same requests with the same words.
 *
 * Image takes are always `completed`. A video take is `pending` while its job
 * renders, `finalizing` while one request stores the finished clip, then
 * `completed` or `failed`. The client treats `finalizing` as `pending`.
 */

export const isRendering = (node) => node?.status === "pending" || node?.status === "finalizing";
export const isFailed = (node) => node?.status === "failed";
/** Missing status means a take from before statuses existed: it's finished. */
export const isReady = (node) => Boolean(node) && (node.status ?? "completed") === "completed";

export const WAIT_TO_CONTINUE = "Wait for this take to finish before continuing it.";
export const WAIT_TO_BRANCH = "Wait for this take to finish before branching from it.";
export const FAILED_PARENT = "This take failed. Retry it, or branch from another take.";
export const NO_LAST_FRAME =
  "This take has no last frame to continue from. Try New take instead.";

/**
 * Why a generation can't build on `parent` yet, or null when it can.
 *
 * - "Continue" starts on the parent's last frame, so the parent must be
 *   finished.
 * - "New take" starts on the same image the parent started on. A pending
 *   take already knows that image (it came from its own parent), so it can be
 *   branched from, unless it is a root with nothing to start from.
 *
 * The server repeats these checks against the database, and can also fill in
 * a missing last frame for older takes, so this errs on the side of allowing.
 */
export function branchBlocker(parent, intent) {
  if (!parent) return null;
  if (isFailed(parent)) return FAILED_PARENT;
  if (intent === "extend") return isReady(parent) ? null : WAIT_TO_CONTINUE;
  if (isRendering(parent) && !parent.parentId) return WAIT_TO_BRANCH;
  return null;
}
