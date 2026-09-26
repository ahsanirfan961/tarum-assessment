# Phase 2: Postgres persistence

**Goal:** projects, collections and takes live in Postgres. A reload shows
everything that was generated, and the server resolves a take's parent and
references by id instead of trusting URLs sent by the client.

Phase 3 depends on this. Video jobs finish minutes after they're submitted,
so their state has to live somewhere that outlasts the request and the
browser tab.

## 1. Compose: add Postgres

```yaml
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: fomi
      POSTGRES_PASSWORD: fomi
      POSTGRES_DB: fomi
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fomi"]
      interval: 5s
      retries: 10
```

## 2. Tooling: Drizzle ORM + `pg`

We use Drizzle rather than Prisma. It's a thin layer over SQL, works fine in
plain JavaScript (this repo has no TypeScript), has no separate engine binary,
and its migrations are plain SQL files that can be read in review.

- Dependencies: `drizzle-orm`, `pg`; dev dependency: `drizzle-kit`
- `drizzle.config.js` at the repo root
- `src/lib/db/schema.js`, `src/lib/db/client.js` (one pooled client, reused
  across hot reloads through `globalThis`)
- Migrations in `drizzle/`, committed
- Scripts: `db:generate`, `db:migrate`, `db:seed`

## 3. Schema

```
projects
  id            text pk              "prj_hearth"
  name          text not null
  client        text
  created_at    timestamptz default now()

collections
  id            text pk
  project_id    text not null  -> projects.id on delete cascade
  kind          text not null        'image' | 'video'
  name          text not null
  cut_leaf_id   text                 video only, -> nodes.id, set later
  created_at    timestamptz default now()
  index (project_id, created_at desc)

nodes
  id              text pk
  collection_id   text not null -> collections.id on delete cascade
  parent_id       text          -> nodes.id
  reference_ids   text[] not null default '{}'
  prompt          text not null
  model           text not null
  aspect_ratio    text not null
  quality         text
  resolution      text
  url             text                 image, or video poster
  video_url       text                 video only
  last_frame_url  text                 video only, used by phase 3 "continue"
  duration_seconds real                video only
  beat            int                  video only
  status          text not null default 'completed'
                                       'pending' | 'completed' | 'failed'
  error           text
  provider_job_id text
  cost            numeric(10,5)
  created_at      timestamptz default now()
  index (collection_id)
```

Notes on the choices:

- **References are an array, not a join table.** They're soft links (see the
  seed notes). Nothing queries "who references X", and a node is always
  loaded with its collection. An array keeps reads to one query.
- **Nothing enforces that `parent_id` is in the same collection.** The store
  already guarantees it, and a cross-row check would need a trigger. The route
  checks it on insert instead.
- **`status`, `error`, `provider_job_id` and `last_frame_url` are added now**,
  even though only phase 3 fills them, so phase 3 doesn't need a migration
  that touches every row.
- **Ids stay app-generated text** (`image_<batch>_<i>`, `col_<batch>`), so the
  seed ids and existing client code keep working.

## 4. Seed

`npm run db:seed` inserts `PROJECTS` and `COLLECTIONS` from
[seed.js](../../src/lib/mock/seed.js) as they are. The picsum and sample-clip
URLs are stored unchanged. It uses upserts, so running it twice is harmless.
`seed.js` is kept as the seed source and stops being read at runtime.

## 5. Read layer

[projects.js](../../src/lib/data/projects.js) was written to be the only file
that changes, and it is. Its three functions keep their names and return
shapes, but become `async` and query Drizzle:

- `listProjects()`: projects, a collection count, and a cover from the most
  recent collection's first completed node.
- `getProject(id)`
- `getProjectCollections(id)`: collections with their nodes, loaded with two
  queries and grouped in JS.

Callers (`projects/page.js`, the project `layout.js`, `generateMetadata`) add
`await`. Those pages also get `export const dynamic = "force-dynamic"`, since
the data now changes on every generation.

## 6. Writes

| Action | Today | After phase 2 |
|---|---|---|
| Generate | store only | the route inserts the collection (if new) and the nodes in one transaction, then returns them |
| Rename collection | store only | `PATCH /api/collections/[id]` `{ name }` |
| Pick a cut take | store only | `PATCH /api/collections/[id]` `{ cutLeafId }` |
| Cut moves on generate | store only | the route updates `cut_leaf_id` in the same transaction |

The store stays the source of truth for the UI. Renames and cut picks update
it immediately, then send the PATCH; if the PATCH fails, the store rolls back
and shows the error. Generation isn't optimistic: it already waits for the
response.

The generate request **stops sending** `parentUrl`, `referenceUrls` and
`parentBeat`. The route now loads the parent and references by id, which
also checks that:

- the parent exists and belongs to the active collection;
- every reference is in the same **project** (projects are isolated by design).

The request gains `projectId` and `collectionId`, which are needed to insert
rows.

The logic for when the cut moves currently sits in
`workspaceStore.generate`. It moves to a shared function in
`src/lib/video/cut.js`, so the server writes the same decision the client
applies.

## 7. Mock provider still works

With `GENERATION_PROVIDER=mock`, the route still writes to Postgres; only the
media comes from picsum. So after this phase Docker is required to run the
app, but an OpenRouter key still isn't.

## Done when

- [ ] `docker compose up -d && npm run db:migrate && npm run db:seed` gives the same home screen as today.
- [ ] Generating, then reloading, keeps the new collection and takes.
- [ ] Branching deeper after a reload still sends the right parent image.
- [ ] Rename and cut swaps survive a reload.
- [ ] A forged `parentId` from another project gets a 400.
- [ ] `npm run build` passes; there are no DB calls in client components.
