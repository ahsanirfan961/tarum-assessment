# Phase 3: Real video generation

**Goal:** "New take" and "Continue" on the video workspace call a real model.
Takes appear in the tree right away as pending cards, fill in when their clip
is ready, and survive a reload while they are still rendering.

## Why video needs a different flow

OpenRouter video is asynchronous. `POST /api/v1/videos` returns a job id with
`202`, and the clip is ready after tens of seconds to several minutes. We
can't hold the Next request open that long, so generation splits into
**submit** and **finish**:

```
composer ──POST /api/generate/video──▶ route ──POST /videos (×count)──▶ OpenRouter
   ◀── pending nodes (already in DB) ──┘

store ──GET /api/generate/jobs?ids=…──▶ route ──GET /videos/{id}──▶ OpenRouter
                                          │  completed?
                                          ├─ download /videos/{id}/content
                                          ├─ ffmpeg: poster + last frame
                                          ├─ upload 3 objects to MinIO
                                          └─ update node → completed
   ◀── updated nodes ─────────────────────┘
```

Polling rather than webhooks: OpenRouter can't reach `localhost`. Webhooks
(`callback_url`, HMAC-signed) come with deployment, and they would call the
same "finish" function this phase builds.

## 1. Spike first (half a day)

Before building, check three things with a throwaway script against
`bytedance/seedance-2.0-mini`, because the plan depends on them:

1. **Is a `data:` URL accepted in `frame_images`?** The image API documents
   base64 input; the video docs only show URLs. If not, we need a URL that
   OpenRouter can reach. Options: a short-lived tunnel for dev, or temporarily
   using the public picsum/OpenRouter URL where there is one.
2. **Can `frame_images` and `input_references` be combined?** Seedance
   documents first/last-frame mode and reference mode separately. If they
   can't be combined, frame images win (they carry the lineage) and references
   are dropped for that request with a notice in the composer.
3. **What does `return_last_frame` return?** If it gives us a last-frame
   image, we skip extracting it with ffmpeg.

Record the answers at the bottom of this doc.

## 2. Catalog entry

```js
{
  id: "draft-video",
  label: "Draft (Seedance 2.0 Mini)",
  kind: "video",
  provider: { slug: "bytedance/seedance-2.0-mini" },
  maxCount: 2,                     // one job per take; cost guard
  defaultCount: 1,
  aspectRatios: ["16:9", "9:16", "1:1"],
  resolutions: ["480p", "720p"],   // default 480p
  durations: [4, 5, 6, 8, 10],     // default 4
  frameImages: ["first_frame", "last_frame"],
  generateAudio: false,
}
```

The composer gets a **duration** field for video (the mock picked one at
random). Counts for video become `1, 2`, with 1 as the default.

## 3. How lineage maps to model inputs

| Composer state | Request |
|---|---|
| Nothing selected (new collection) | text-to-video |
| Take selected, **New take** | `frame_images: [{ first_frame: parent.url }]`. Same moment, same starting image, different motion |
| Take selected, **Continue** | `frame_images: [{ first_frame: parent.last_frame_url }]`. Starts exactly where the parent ended |
| References staged | `input_references` (subject to spike question 2) |

Images from the image workspace can be references here too, since they're in
the same project.

"Continue" is the reason we store `last_frame_url`. Without it, extended beats
wouldn't join up, and the cut would jump at every boundary.

## 4. Provider adapter

`openrouter.js` gains:

- `submitVideo({ model, prompt, aspectRatio, resolution, duration, frameImages, references })`
  → `{ jobId }`
- `getVideoJob(jobId)` → `{ status, cost, error }`
- `downloadVideo(jobId)` → `Buffer` (`GET /videos/{id}/content?index=0` with the key)

`mock.js` does the same with a fake job that finishes after a few seconds and
returns one of the sample clips. That way the whole pending → completed flow
can be tested without spending anything.

## 5. Submit: `POST /api/generate/video`

1. Validate against the catalog (duration, resolution, ratio, count).
2. Load the parent and references from the DB (phase 2). For **Continue**, the
   parent must be `completed` and have a `last_frame_url`. Otherwise 409:
   "Wait for this take to finish before continuing it."
3. Submit `count` jobs with `Promise.allSettled`.
4. In one transaction, insert a node per submitted job with `status:
   'pending'`, `provider_job_id`, `beat`, `duration_seconds`, and `url` /
   `video_url` set to `null`. Update `cut_leaf_id` with the same rule as today.
5. Return the nodes right away. If every submit failed, return 502 with the
   provider's message.

## 6. Finish: `GET /api/generate/jobs?ids=a,b,c`

For each id that is still `pending`:

1. `getVideoJob`. If it's still running, return the node unchanged.
2. `failed` → set `status: 'failed'` and `error`.
3. `completed` → **claim it first**: `UPDATE nodes SET status='finalizing'
   WHERE id=$1 AND status='pending'`. Only the request that updates a row
   continues. Two tabs polling the same take would otherwise both download,
   upload and write it.
4. Download the mp4 and write it to a temp file.
5. Run ffmpeg (`ffmpeg-static`, so nothing has to be installed on the host):
   - poster: `-ss 0 -i in.mp4 -frames:v 1 poster.jpg`
   - last frame: `-sseof -0.2 -i in.mp4 -update 1 -frames:v 1 last.jpg`
     (skipped if `return_last_frame` covers it)
6. Upload to MinIO: `videos/<collectionId>/<nodeId>.mp4`, `…-poster.jpg`,
   `…-last.jpg`.
7. Update the node: `completed`, `url`, `video_url`, `last_frame_url`, `cost`.
   On any error in 4–6, set it back to `pending` so the next poll retries,
   and after 3 attempts mark it `failed`.

The `status` column gains `'finalizing'` as a fourth value. The client treats
it the same as `pending`.

The media route from phase 1 already handles `Range`, so the lightbox and
the cut player can seek.

## 7. Client changes

**Store (`workspaceStore`)**
- `isGenerating` now only covers the submit request (about a second), not
  the render. The composer frees up right away, and you can queue another
  generation while one renders.
- New `pollPending()`: while any node is `pending`/`finalizing`, it calls the
  jobs route every 5 s with those ids and merges the results in. It starts
  after a submit **and on store creation**, so a reload picks up takes that
  were still rendering. It stops when none are left, and pauses while the tab
  is hidden (`visibilitychange`).
- New `retryNode(id)`: sends the same request again for a failed take.

**Canvas**
- `GraphNode`: a **pending** state (no image yet; a quiet placeholder with
  elapsed time, and the shimmer is off under reduced motion) and a **failed**
  state (the error and a Retry button). A pending take can be selected for
  "New take" but not for "Continue".
- `CollectionCard` / `HomeGrid`: a collection whose first node is pending
  shows the pending card that's already there instead of an empty cover.

**Cut**
- `resolveCut` doesn't change: a pending node is still a real node at its
  beat.
- `CutStrip` shows a pending beat as a "rendering" slot.
- The cut player plays completed beats and stops at the first one that isn't
  ready, saying so. "Download cut" is disabled until every beat is ready.

## Done when

- [ ] Spike answers are recorded below.
- [ ] With the mock provider, pending → completed works end to end with no cost.
- [ ] With OpenRouter, a fresh prompt shows a pending card, then a playable clip.
- [ ] Reloading mid-render keeps the pending card, and it completes.
- [ ] "Continue" produces a clip that visibly starts on the parent's last frame.
- [ ] "New take" produces a clip that starts on the parent's first frame.
- [ ] Two tabs polling the same job produce exactly one set of MinIO objects.
- [ ] A failed job shows its reason, and Retry works.
- [ ] Cut playback and download behave correctly with a pending beat in the middle.

## Spike results

_To be filled in._
