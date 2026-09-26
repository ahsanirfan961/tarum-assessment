# Phase 1: Real image generation + MinIO

**Goal:** pressing Generate on the image workspace calls a real model, the
results are stored in MinIO, and they show up in the lineage exactly as mock
takes do today. Branching from a take sends that take's image to the model.

**Still true after this phase:** generated takes live in browser memory and are
lost on reload (the files stay in MinIO). Phase 2 fixes that.

## 1. Docker Compose with MinIO

`docker-compose.yml` at the repo root. As built, the image is
`cgr.dev/chainguard/minio` pinned by digest and there is no healthcheck,
because `minio/minio` has since been removed from Docker Hub (see the
[README](README.md#a-note-on-the-minio-image)). The original sketch:

```yaml
services:
  minio:
    # Last official community image; see docs/integration/README.md.
    # Confirm the exact final tag on Docker Hub when implementing.
    image: minio/minio:RELEASE.2025-09-07T16-13-09Z
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${S3_ACCESS_KEY:-fomi}
      MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY:-fomi-dev-secret}
    ports:
      - "9000:9000"   # S3 API
      - "9001:9001"   # web console, for browsing objects while debugging
    volumes:
      - minio-data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      retries: 10

volumes:
  minio-data:
```

We don't need a separate `minio/mc` container to create the bucket. The
storage module creates it on first use (see below), so one fewer moving part.

## 2. Storage module: `src/lib/storage.js`

Uses `@aws-sdk/client-s3` rather than the `minio` package, so moving to real S3
or R2 later is only an env change.

- The client uses `forcePathStyle: true`, which MinIO needs.
- `ensureBucket()` runs `HeadBucket`, then `CreateBucket` if it's missing.
  It's memoized for the life of the process.
- `putMedia(buffer, contentType, key)` returns `/api/media/<key>`.
- `getMedia(key, range?)` returns a stream plus headers.
- `readMediaAsDataUrl(url)` turns any node URL into something OpenRouter can
  read:
  - `/api/media/...` → read from MinIO → `data:<type>;base64,...`
  - `https://...` (seed images) → return the URL as is

Key layout: `images/<collectionId>/<nodeId>.<ext>`. That keeps the bucket
browsable by collection and makes cleanup easy later.

## 3. Media route: `src/app/api/media/[...key]/route.js`

A `GET` handler that streams the object from MinIO with its `Content-Type`
and `Cache-Control: private, max-age=31536000, immutable` (keys never get
reused). It passes `Range` through and answers with `206`, which isn't needed
for images but phase 3 needs it for video seeking, so it's built once here.

The key is validated as `images/...` or `videos/...` with no `..`, so the
route can't be used to read arbitrary keys.

## 4. Model catalog: `src/lib/models/catalog.js`

This one file replaces `IMAGE_MODELS` / `VIDEO_MODELS` in
[ConfigForm.jsx](../../src/components/config/ConfigForm.jsx):

```js
export const MODELS = [
  {
    id: "draft-image",               // stable id stored on nodes
    label: "Draft (GPT Image 2)",    // shown in the composer
    kind: "image",
    provider: { slug: "openai/gpt-image-2" },
    maxCount: 10,                    // n per request; 1 means fan out
    maxReferences: 16,
    aspectRatios: ["1:1", "3:4", "4:3", "16:9", "9:16"],
    resolutions: null,               // null hides the field
    qualities: { draft: "low", standard: "medium", refined: "high" },
  },
  // flux.2-klein-4b as the fallback entry
];
```

- The composer takes the aspect-ratio, resolution and quality options from
  the selected model, and hides fields the model doesn't support.
- If a selected node carries a model id that isn't in the catalog (all the
  seed takes say "Fomi Core v3"), the composer falls back to the default
  model instead of showing an empty select.
- Default quality for testing is `draft`, which maps to `low`.

## 5. Provider adapter: `src/lib/providers/`

```
providers/
  index.js        getProvider() reads GENERATION_PROVIDER
  mock.js         the current mock logic, moved out of the route
  openrouter.js   real calls
```

Both implement one function:

```js
generateImages({ model, prompt, count, aspectRatio, quality, resolution, inputs })
  -> [{ buffer, contentType }]  // or, for the mock, [{ url }]
```

`openrouter.js`:

1. Builds `input_references` from `inputs` (parent first, then references), each
   as `{ type: "image_url", image_url: { url } }`.
2. If `count <= model.maxCount`, sends one `POST /api/v1/images` with `n: count`.
   Otherwise it makes `count` requests with `Promise.allSettled`.
3. Decodes each `b64_json` into a buffer. Takes that failed are dropped; the call
   only fails outright if **no** take succeeded. The error message is the one
   OpenRouter returns (for example a content refusal), so the user sees why.
4. Returns `usage.cost` so it can go on the nodes.

Timeout: 120 s with `AbortSignal.timeout`. Image generation is synchronous
but can be slow at higher qualities.

## 6. Generate route changes

[route.js](../../src/app/api/generate/[kind]/route.js) keeps its request and
response shape. Two additions to the request:

- `parentUrl`: the selected take's `url`
- `referenceUrls`: the staged references' `url`s

In this phase the client sends these, because the server has nowhere to look
up a node by id. Phase 2 removes them and resolves `parentId` / `referenceIds`
from the database.

Flow for `kind === "image"`:

1. Validate. `prompt` is required, `count` is clamped to the model's limits, and
   `aspectRatio` must be one the model supports (400 otherwise).
2. `inputs = [parentUrl, ...referenceUrls].map(readMediaAsDataUrl)`
3. `results = await provider.generateImages(...)`
4. For each result: `putMedia` → node `{ id, parentId, referenceIds, prompt,
   model, aspectRatio, quality, resolution, url, cost }`
5. Return `{ collectionId, name, kind, nodes }` exactly as today.

`kind === "video"` keeps using the mock until phase 3.

## 7. Client changes

- `workspaceStore.generate` sends `parentUrl` and `referenceUrls` alongside the
  ids. Nothing else in the store changes.
- `ConfigForm` reads options from the catalog (see step 4).
- The error the store already shows now carries real provider messages. It
  needs to show several lines instead of one.

## 8. Housekeeping

- `.gitignore`: add `!.env.example`, and commit `.env.example` (variables are
  listed in the [README](README.md)).
- New dependency: `@aws-sdk/client-s3`.
- Top-level README: a "Running with real generation" section (compose up, copy
  the env file, set the key, set `GENERATION_PROVIDER=openrouter`).

## Done when

- [ ] `docker compose up -d` starts MinIO, and the bucket appears after the first generation.
- [ ] With `GENERATION_PROVIDER=mock`, the app behaves exactly as it does today.
- [ ] With `openrouter`, a fresh prompt creates a collection with real images.
- [ ] Branching from a take produces children that visibly follow the parent.
- [ ] Branching from a seed (picsum) take works too.
- [ ] A staged reference from another collection visibly influences the result.
- [ ] Lightbox and download work on generated images.
- [ ] A refused prompt shows OpenRouter's reason in the composer.
- [ ] `OPENROUTER_API_KEY` doesn't appear in any client bundle (`grep` the `.next/static` output).
