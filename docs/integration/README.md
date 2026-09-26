# Real generation: integration plan

Fomi currently runs on a mocked backend. The generation route returns picsum
photos and sample clips, and every generated take lives in browser memory. This
folder plans the move to real image and video models through
[OpenRouter](https://openrouter.ai), with local infrastructure in Docker
Compose.

The work is split into three phases. Each one can be shipped on its own and
leaves the app working:

| Phase | Adds | Doc |
|---|---|---|
| 1 | Real image generation, MinIO for media storage | [phase-1-images-minio.md](phase-1-images-minio.md) |
| 2 | Postgres, so projects, collections and takes survive a reload | [phase-2-postgres.md](phase-2-postgres.md) |
| 3 | Real video generation as background jobs | [phase-3-video.md](phase-3-video.md) |

Out of scope for now, to plan after phase 3: access control, rate limits,
spend caps, content-policy handling, webhooks and deployment.

## Why the change is small

The mock route was written to return nodes in exactly the shape the lineage
graph reads (`parentId`, `referenceIds`, `url`, `videoUrl`, `beat`). The UI
never talks to a model. It talks to `/api/generate/[kind]`. So most of this
work sits behind that route, and the client only changes where real
generation behaves differently from the mock. The main case is video taking
minutes instead of a second.

## Decisions that apply to every phase

### The parent's pixels go to the model

Today `parentId` only decides where a take sits in the tree. With a real model,
"branch from this take" only means something if the model actually sees that
take. So every generation made with a node selected sends the parent image as
an input (image-to-image, or first frame for video), plus any staged
references. Without this, a child take is just a new random image drawn under
its parent, and the lineage idea fails.

### Keep the mock provider

`GENERATION_PROVIDER=mock | openrouter` picks the provider. The mock stays the
default, so the app runs without an API key and without spending money. It is
also what reviewers get when they clone the repo without Docker or a key.

### Media is served through our own route, not directly from MinIO

Stored media is addressed as `/api/media/<key>`, and that route streams the
object from MinIO. This means:

- the bucket stays private, with no CORS or public-bucket policy to set up;
- `next/image` treats it as a same-origin path, so there is no
  `remotePatterns` entry and no issue with Next blocking optimization of
  private IPs;
- stored URLs don't contain `localhost:9000`, so moving to S3 or R2 later only
  changes env vars, not stored data.

### Inputs go to OpenRouter as base64, not URLs

OpenRouter can't reach `localhost:9000`, so a MinIO URL is no use as an
`input_references` or `frame_images` URL. The server reads the object from
MinIO and sends it as a `data:` URL. Public seed images (picsum) can be
passed as plain URLs.

### The app runs on the host; Compose runs the infrastructure

`npm run dev` keeps hot reload. `docker compose up -d` runs MinIO (phase 1)
and Postgres (phase 2). The app talks to them on `localhost`.

## Models for testing

The aim right now is a working pipeline, not quality, so these are the
cheapest models that still support everything the lineage needs (image
inputs, several takes, the aspect ratios in our UI). Capabilities below were
checked against `GET /api/v1/images/models` and `GET /api/v1/videos/models` on
2026-09-26. Prices are OpenRouter list prices at that date.

### Image: `openai/gpt-image-2` (with `quality: "low"`)

- About **$0.006–0.014 per image**. This was the cheapest in OpenRouter's own
  comparison (it bills per token, so longer prompts cost a little more).
- `n` from 1 to 10, so a 4-take batch is **one request**.
- Up to 16 `input_references`, which is plenty for a parent plus references.
- Aspect ratios: `1:1 3:2 2:3 4:3 3:4 16:9 9:16 21:9`. **No `4:5`**, which our
  UI currently offers.
- **No `resolution` parameter.** The resolution field is hidden for this model.

Fallback: `black-forest-labs/flux.2-klein-4b` (about $0.014 per image, up to
4 references). It only supports `n: 1`, so a batch becomes one request per
take. The provider adapter handles both cases.

### Video: `bytedance/seedance-2.0-mini` (480p, 4 s, no audio)

- About **$0.034 per second**, so roughly **$0.13 per 4-second clip** at
  480p. This was the cheapest video model listed.
- `first_frame` and `last_frame` frame images, plus `input_references`: it
  supports both "new take" (start from the parent) and "continue" (start from
  the parent's last frame).
- Durations 4–15 s. Resolutions `480p`, `720p`. Aspect ratios include `16:9`,
  `9:16`, `1:1`.
- It has a passthrough option called `return_last_frame`. We might use it
  instead of extracting the last frame ourselves (see phase 3).

Fallback: `bytedance/seedance-2.0-fast` (same capabilities, about $0.04 per
second).

### Rough testing budget

A session of 40 images and 15 clips costs about $0.50 for the images and $2
for the video. Video is where the money goes, so phase 3 defaults to one take
per video generation.

### Upgrading later

Swapping models means editing the catalog in `src/lib/models/catalog.js` (added
in phase 1). The composer reads each model's supported values from there, so
the UI adjusts on its own.

## A note on the MinIO image

MinIO stopped publishing community container images in October 2025. By
September 2026 the `minio/minio` repository is gone from Docker Hub
altogether, so the "pin the last official tag" plan no longer pulls. Compose
uses the maintained free build, `cgr.dev/chainguard/minio`, pinned by digest
since its free tier only publishes `latest`. That image has no shell or `mc`,
so the container has no healthcheck; the app reports a clear error if MinIO
isn't up yet. Since we use the S3 API, any S3-compatible store works with env
changes only.

## Environment variables

`.env*` is currently gitignored, which also hides `.env.example`. Phase 1
adds `!.env.example` to `.gitignore` and commits the example file.

```bash
# Generation
GENERATION_PROVIDER=mock            # mock | openrouter
OPENROUTER_API_KEY=                 # server-only, never NEXT_PUBLIC_

# Storage (phase 1)
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=fomi
S3_SECRET_KEY=fomi-dev-secret
S3_BUCKET=fomi-media

# Database (phase 2)
DATABASE_URL=postgres://fomi:fomi@localhost:5432/fomi
```
