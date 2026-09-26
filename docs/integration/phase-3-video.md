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

- [x] Spike answers are recorded below.
- [x] With the mock provider, pending → completed works end to end with no cost.
- [x] With OpenRouter, a fresh prompt shows a pending card, then a playable clip.
- [x] Reloading mid-render keeps the pending card, and it completes.
- [x] "Continue" produces a clip that visibly starts on the parent's last frame.
- [x] "New take" produces a clip that starts on the parent's first frame.
- [x] Two tabs polling the same job produce exactly one set of MinIO objects.
- [x] A failed job shows its reason, and Retry works.
- [x] Cut playback and download behave correctly with a pending beat in the middle.

How they were checked: the mock flow with a script against the API and in
the browser; six simultaneous polls at the moment a job completed gave one
`completed` and five `finalizing`; a real continuation's first frame against
its parent's stored last frame scored 44 dB PSNR (the same picture); the
mock's scored 54 dB.

## Spike results

Run on 2026-09-26 against `bytedance/seedance-2.0-mini`, one 4 s 480p 16:9
clip with no audio. It rendered in about 100 s and cost $0.142. Output was
864×496 H.264 at 24 fps, 4.04 s, 1.2 MB.

1. **A `data:` URL in `frame_images` works.** The request was accepted, and
   the clip's first frame is the image that was sent. No tunnel is needed.
2. **`frame_images` and `input_references` can be combined.** The request
   with both was accepted and rendered. Nothing is dropped, so the composer
   needs no notice. (How strongly the reference steers the result wasn't
   measured.)
3. **`return_last_frame` gives us nothing to read.** Passed as a provider
   passthrough option, the job completes with a single output
   (`index=1` is "out of range"). The last frame is extracted with ffmpeg.

## As built

Where the implementation differs from, or adds to, the plan above:

- **Catalog.** `draft-video` (Seedance 2.0 Mini) and the planned fallback
  `fast-video` (Seedance 2.0 Fast) replace the old mock video models. Every
  entry now lists the `counts` it offers (`1, 2` for video, default 1) and
  the route rejects anything else, instead of clamping. `maxCount` keeps its
  phase 1 meaning (the `n` of one request), which is 1 for video. At most 4
  references per video take. Takes from the retired mock models keep their
  ids and still get a readable label.
- **Composer.** A **Length** field sits beside Takes and Ratio for video.
  When the selected take can't be built on yet (Continue from a take that is
  still rendering, or anything from a failed one) the composer says why and
  disables Generate. The rule lives in `src/lib/takes.js` and the server
  refuses with the same words (409).
- **New take from a pending take.** A take that is still rendering has no
  pixels, but it knows the frame it started on: its parent's first frame, or
  its parent's last frame if it was a continuation. `startFrameFor` in
  `src/lib/video/jobs.js` walks up to that frame. Only a pending *root* (a
  fresh prompt, no start frame) can't be branched from until it finishes.
- **Provider adapter.** It is `submitVideos({ count, ... })` rather than one
  `submitVideo` per take, so the start frame and references are read and
  inlined once per batch. It returns one `{ jobId }` or `{ error }` per take.
  The provider for a job is picked from its id (`mock_...` or not), not from
  `GENERATION_PROVIDER`, so switching providers mid-render doesn't strand a
  take.
- **The mock renders locally.** The planned "return one of the sample
  clips" no longer works: Google's sample bucket answers 403 now. Instead the
  mock's job id encodes the request, and on completion ffmpeg renders a clip
  that opens on the take's start frame and slowly pushes in (a drifting
  gradient for a fresh prompt). New take and Continue therefore behave
  visibly like the real thing, at no cost and with no network. `[fail]` in a
  prompt makes the mock job fail.
- **Schema.** Migration `0001_video_jobs` adds three columns to `nodes`:
  `submitted_at` (the pending card's elapsed time; `created_at` is the
  take's place in the tree and a retry mustn't move it), `claimed_at`, and
  `finalize_attempts`. `status` needed no migration for `'finalizing'`.
- **Stale claims.** A take left `finalizing` for over three minutes (the
  request that claimed it died, say in a server restart) can be claimed by
  the next poll. Storage keys are fixed per take, so even a takeover writes
  the same three objects.
- **Retry.** `POST /api/generate/jobs/[nodeId]/retry` resubmits in place:
  same id, same spot in the tree, same settings, a new job. It claims the
  take back to `pending` before submitting, so a double click can't pay for
  two jobs. If the old job did render and only storing it failed, it is
  finished again rather than resubmitted.
- **Older takes and Continue.** Takes from before this phase have no stored
  last frame. The first Continue from one extracts it from the clip and
  keeps it. This can't help the seed's clips, which are no longer
  reachable, so continuing a seed take is refused with a pointer to New take.
- **Polling.** One request at a time, so an older response can never land
  after a newer one and put a finished take back to rendering. It starts
  from `WorkspaceProvider`'s mount effect rather than store creation, so it
  is cleaned up on unmount. The lightbox and composer now subscribe to the
  store's collections, so an open cut player picks up a beat the moment it
  finishes, and the composer's "wait" notice clears by itself.
- **Not handled yet.** A job that never finishes on the provider's side
  stays pending (there is no timeout), and jobs submitted just before a
  failed database write are orphaned. Both belong with webhooks and
  deployment.
