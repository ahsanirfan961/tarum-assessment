import "server-only";
import { and, eq, inArray, lt, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { nodes } from "@/lib/db/schema";
import { InputError } from "@/lib/data/collections";
import { query, toNode } from "@/lib/data/projects";
import { getModel } from "@/lib/models/catalog";
import { getProvider, providerForJob, ProviderError } from "@/lib/providers";
import { putMedia, readStoredMedia } from "@/lib/storage";
import {
  FAILED_PARENT,
  NO_LAST_FRAME,
  WAIT_TO_BRANCH,
  WAIT_TO_CONTINUE,
} from "@/lib/takes";
import { edgeRelation } from "./cut";
import { extractFrames, extractLastFrame } from "./ffmpeg";

/**
 * Video takes as background jobs. See docs/integration/phase-3-video.md.
 *
 * Generation splits in two. **Submit** (the generate route) starts one job
 * per take and writes the takes as `pending`. **Finish** (`refreshTakes`,
 * behind GET /api/generate/jobs) is driven by the client polling: it asks
 * the provider how each job is doing and, once one is done, stores the clip,
 * its poster and its last frame, and marks the take `completed`.
 *
 * Polling rather than webhooks, because a provider can't reach localhost. A
 * webhook would call the same `refreshTakes`.
 */

const MAX_FINALIZE_ATTEMPTS = 3;
// A claim this old belongs to a request that died mid-finish (a server
// restart, say); a later poll may take the job over.
const STALE_CLAIM_MS = 3 * 60_000;
const MAX_WALK = 64;

// ---------------------------------------------------------------------------
// Submit

/**
 * The image a new video take opens on, given what it builds on. This is what
 * makes lineage real for video: a child actually starts from its parent.
 *
 * - No parent: text-to-video, no frame.
 * - Continue: the parent's last frame, so the cut joins up at the boundary.
 * - New take: the parent's first frame, so it's the same moment played
 *   differently. A parent that is still rendering has no pixels yet, but it
 *   knows the frame it started on, so that is walked up to.
 */
export async function startFrameFor(parent, intent) {
  if (!parent) return null;
  if (parent.status === "failed") throw new InputError(FAILED_PARENT, 409);

  if (intent === "extend") {
    if (parent.status !== "completed") throw new InputError(WAIT_TO_CONTINUE, 409);
    return lastFrameOf(parent);
  }

  let node = parent;
  for (let depth = 0; depth < MAX_WALK; depth += 1) {
    if (node.status === "completed" && node.url) return node.url;
    if (!node.parentId) throw new InputError(WAIT_TO_BRANCH, 409);
    const up = await loadRow(node.parentId);
    if (!up) throw new InputError(WAIT_TO_BRANCH, 409);
    // A continuation started on its parent's last frame, which the server
    // required to exist before it was submitted.
    if (edgeRelation(up, node) === "extend") {
      if (up.status !== "completed") throw new InputError(WAIT_TO_BRANCH, 409);
      return lastFrameOf(up);
    }
    node = up;
  }
  throw new InputError(WAIT_TO_BRANCH, 409);
}

/**
 * Starts `count` jobs and returns their ids. Takes whose submit failed are
 * dropped; the call only fails when none went through, with the provider's
 * own reason(s).
 */
export async function submitVideoJobs({ model, settings, count, frameUrl, referenceUrls }) {
  const results = await getProvider().submitVideos({
    model,
    prompt: settings.prompt,
    count,
    aspectRatio: settings.aspectRatio,
    resolution: settings.resolution,
    duration: settings.durationSeconds,
    firstFrameUrl: frameUrl,
    referenceUrls,
  });
  const jobIds = results.filter((r) => r.jobId).map((r) => r.jobId);
  if (jobIds.length) return jobIds;

  const errors = results.map((r) => r.error).filter(Boolean);
  const reasons = [...new Set(errors.map((e) => e.message).filter(Boolean))];
  const status = errors.find((e) => e instanceof ProviderError)?.status ?? 502;
  throw new ProviderError(reasons.join("\n") || "No take could be submitted.", status);
}

/**
 * Sends a failed take's job again, in place: same id, same spot in the tree,
 * same settings, a fresh job. The take is claimed back to `pending` before
 * anything is submitted, so a double click can't pay for two jobs. If the
 * old job actually rendered and only storing it failed, that job is finished
 * again instead.
 */
export async function retryTake(nodeId) {
  const row = await loadRow(nodeId);
  if (!row) throw new InputError(`Take "${nodeId}" doesn't exist.`, 404);
  if (row.status !== "failed") throw new InputError("Only a failed take can be retried.", 409);

  // The render succeeded and only storing it failed: finish the same job
  // again rather than paying for a new render.
  if (row.providerJobId) {
    const job = await providerForJob(row.providerJobId)
      .getVideoJob(row.providerJobId)
      .catch(() => null);
    if (job?.status === "completed") {
      const requeued = await settle(
        nodeId,
        { status: "pending", error: null, finalizeAttempts: 0, claimedAt: null, submittedAt: new Date() },
        "failed"
      );
      if (!requeued) throw new InputError("This take is already being retried.", 409);
      return toNode(requeued);
    }
  }

  const model = getModel(row.model);
  if (!model || model.kind !== "video") {
    throw new InputError(`This take's model ("${row.model}") isn't available any more.`);
  }

  const parent = row.parentId ? await loadRow(row.parentId) : null;
  const intent = parent && edgeRelation(parent, row) === "extend" ? "extend" : "regen";
  const frameUrl = await startFrameFor(parent, intent);

  const references = row.referenceIds.length
    ? await query(() => db.select().from(nodes).where(inArray(nodes.id, row.referenceIds)))
    : [];
  const referenceUrls = row.referenceIds.map((id) => {
    const ref = references.find((r) => r.id === id);
    if (!ref || ref.status !== "completed" || !ref.url) {
      throw new InputError(`Reference "${id}" is no longer available, so this take can't be retried.`);
    }
    return ref.url;
  });

  const [claimed] = await query(() =>
    db
      .update(nodes)
      .set({
        status: "pending",
        error: null,
        providerJobId: null,
        finalizeAttempts: 0,
        claimedAt: null,
        cost: null,
        submittedAt: new Date(),
      })
      .where(and(eq(nodes.id, nodeId), eq(nodes.status, "failed")))
      .returning()
  );
  if (!claimed) throw new InputError("This take is already being retried.", 409);

  try {
    const [jobId] = await submitVideoJobs({
      model,
      settings: {
        prompt: row.prompt,
        aspectRatio: row.aspectRatio,
        resolution: row.resolution,
        durationSeconds: row.durationSeconds,
      },
      count: 1,
      frameUrl,
      referenceUrls,
    });
    const [updated] = await query(() =>
      db.update(nodes).set({ providerJobId: jobId }).where(eq(nodes.id, nodeId)).returning()
    );
    return toNode(updated);
  } catch (err) {
    await query(() =>
      db
        .update(nodes)
        .set({ status: "failed", error: err.message })
        .where(eq(nodes.id, nodeId))
    );
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Finish

/**
 * Brings each of these takes up to date with its job and returns them all, as
 * the client shapes them. Takes that aren't rendering come back unchanged.
 */
export async function refreshTakes(ids) {
  const rows = await query(() => db.select().from(nodes).where(inArray(nodes.id, ids)));
  const refreshed = await Promise.all(rows.map(refreshTake));
  return refreshed.map(toNode);
}

const isStale = (claimedAt) => !claimedAt || Date.now() - claimedAt.getTime() > STALE_CLAIM_MS;

async function refreshTake(row) {
  const claimable =
    row.status === "pending" || (row.status === "finalizing" && isStale(row.claimedAt));
  // No job id yet: a retry is between claiming the take and submitting.
  if (!claimable || !row.providerJobId) return row;

  const provider = providerForJob(row.providerJobId);
  let job;
  try {
    job = await provider.getVideoJob(row.providerJobId);
  } catch (err) {
    // Most likely transient (a timeout, a 5xx); the next poll asks again.
    console.warn(`[jobs] couldn't check ${row.id}:`, err.message);
    return row;
  }

  if (job.status === "failed") {
    return (await settle(row.id, { status: "failed", error: job.error })) ?? row;
  }
  if (job.status !== "completed") return row;

  // Claim it first. Only the request whose update lands goes on to download
  // and store, so two tabs polling the same take write it once.
  const [claimed] = await query(() =>
    db
      .update(nodes)
      .set({ status: "finalizing", claimedAt: new Date() })
      .where(
        and(
          eq(nodes.id, row.id),
          or(
            eq(nodes.status, "pending"),
            and(
              eq(nodes.status, "finalizing"),
              lt(nodes.claimedAt, new Date(Date.now() - STALE_CLAIM_MS))
            )
          )
        )
      )
      .returning()
  );
  if (!claimed) return (await loadRow(row.id)) ?? row;

  try {
    return await finalize(claimed, provider, job.cost);
  } catch (err) {
    console.error(`[jobs] couldn't finish ${row.id}:`, err);
    return release(claimed, err);
  }
}

/** Downloads the clip, extracts its poster and last frame, stores all three. */
async function finalize(row, provider, cost) {
  const video = await provider.downloadVideo(row.providerJobId);
  const { poster, lastFrame } = await extractFrames(video);

  const base = `videos/${row.collectionId}/${row.id}`;
  const [videoUrl, url, lastFrameUrl] = await Promise.all([
    putMedia(video, "video/mp4", `${base}.mp4`),
    putMedia(poster, "image/jpeg", `${base}-poster.jpg`),
    putMedia(lastFrame, "image/jpeg", `${base}-last.jpg`),
  ]);

  return (
    (await settle(
      row.id,
      {
        status: "completed",
        url,
        videoUrl,
        lastFrameUrl,
        cost: cost == null ? null : String(cost),
        error: null,
        claimedAt: null,
      },
      "finalizing"
    )) ?? (await loadRow(row.id))
  );
}

/**
 * Hands a take whose finish failed back to `pending`, so the next poll tries
 * again, or fails it for good after the third attempt.
 */
async function release(row, err) {
  const attempts = row.finalizeAttempts + 1;
  const givesUp = attempts >= MAX_FINALIZE_ATTEMPTS;
  const reason = String(err?.message ?? err).slice(0, 300);
  return (
    (await settle(
      row.id,
      {
        status: givesUp ? "failed" : "pending",
        finalizeAttempts: attempts,
        claimedAt: null,
        error: givesUp ? `The clip rendered, but storing it failed: ${reason}` : null,
      },
      "finalizing"
    )) ?? row
  );
}

/** Updates a take only while it is still in `from`; returns the row or null. */
async function settle(id, changes, from = ["pending", "finalizing"]) {
  const [row] = await query(() =>
    db
      .update(nodes)
      .set(changes)
      .where(
        and(eq(nodes.id, id), Array.isArray(from) ? inArray(nodes.status, from) : eq(nodes.status, from))
      )
      .returning()
  );
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Last frames for older takes

/**
 * A finished take's last frame. A stored clip without one (say, a take whose
 * frame upload was lost) has it extracted the first time someone continues
 * from it, and kept. Clips that aren't in our storage can't be read.
 */
async function lastFrameOf(row) {
  if (row.lastFrameUrl) return row.lastFrameUrl;
  if (!row.videoUrl) throw new InputError(NO_LAST_FRAME, 409);

  let video;
  try {
    video = await readVideo(row.videoUrl);
  } catch (err) {
    if (err instanceof InputError) throw err;
    console.warn(`[jobs] couldn't read ${row.id}'s clip:`, err.message);
    throw new InputError(NO_LAST_FRAME, 409);
  }

  let frame;
  try {
    frame = await extractLastFrame(video);
  } catch (err) {
    console.warn(`[jobs] couldn't extract ${row.id}'s last frame:`, err.message);
    throw new InputError(NO_LAST_FRAME, 409);
  }

  const lastFrameUrl = await putMedia(
    frame,
    "image/jpeg",
    `videos/${row.collectionId}/${row.id}-last.jpg`
  );
  await query(() => db.update(nodes).set({ lastFrameUrl }).where(eq(nodes.id, row.id)));
  return lastFrameUrl;
}

/** A clip's bytes, from our storage only. */
async function readVideo(videoUrl) {
  const stored = await readStoredMedia(videoUrl);
  if (!stored) throw new InputError(NO_LAST_FRAME, 409);
  return stored.buffer;
}

// ---------------------------------------------------------------------------

async function loadRow(id) {
  const [row] = await query(() => db.select().from(nodes).where(eq(nodes.id, id)).limit(1));
  return row ?? null;
}

