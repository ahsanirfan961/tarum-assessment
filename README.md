# Fomi

A creative workspace for AI image and video generation, built for the Tarum
frontend assessment.

## The idea

Every AI generation tool presents your work as a reverse-chronological feed.
That throws away the thing that actually matters when you iterate: which take
came from which, and what you changed to get there.

Fomi treats generation as **version control**. A collection is one lineage. Each
take knows its parent, and the edge between them carries the prompt that made
the change. Three generations deep, you can still read how you got there, and
branch again from any point.

The same idea drives both workspaces. Video adds one thing a tree cannot give
you: an assembly strip for putting chosen takes in order. No timeline, no
layers, no keyframes, because working with generated video is choosing between
takes and sequencing them.

## Model

```
Project        isolated; nothing crosses between projects
└── Collection one lineage
    └── Node   one take
        ├── parentId      structural, exactly one, defines tree layout
        ├── referenceIds  soft, may cross collections, dashed edges
        └── prompt        what produced this take, shown on its incoming edge
```

The rule that keeps "collection" and "lineage" from colliding:

- Generate with a take selected → children of it, same collection.
- Generate with nothing selected → a new collection, new root row.

References are deliberately kept separate from parentage. Referencing an image
from another collection would make the structure a DAG, which cannot be laid
out as a tree, so references render as dashed edges when a node is selected and
as a count when they point outside the current canvas.

## Stack

- Next.js (App Router, JavaScript)
- Tailwind CSS v4 with CSS-variable tokens
- Motion for entrances and transitions
- Zustand for per-project workspace state
- d3-hierarchy for tidy-tree layout
- Route handlers as a mocked generation backend

## Running it

```bash
npm install
npm run dev
```

Opens on the most recent project, matching the brief's returning user.

## Structure

```
src/
  app/
    projects/                 project index
    project/[projectId]/
      layout.js               fetches project data, provides the store
      image|video/page.js     the two workspaces
    api/generate/[kind]/      mocked generation, shaped for the lineage graph
  components/
    shell/                    sidebar, top bar, search, theme toggle
    config/                   composer (shared form, panel and mobile sheet)
    canvas/                   home grid, graph canvas, mobile lineage, assembly
    ui/                       button, icon button, select
  hooks/                      pan and zoom, media query, theme
  lib/
    layout/tidyTree.js        Reingold-Tilford layout and ancestor paths
    store/                    per-project Zustand store
    data/                     server-side read layer
    mock/                     seed data
```

## Notes on the implementation

**Responsiveness is a change of shape, not a scale.** Below 768px the graph is
replaced by a vertical lineage view: ancestors as a breadcrumb, siblings and
variants as scroll-snap rows. Same data, a geometry that suits a thumb. The
composer becomes a bottom sheet and the sidebar a tab bar.

**Pan and zoom never re-render.** Position and scale live in Motion values, and
layout is computed once into absolute coordinates, so dragging only moves a
transform on the container.

**Layout properties transition in CSS, not JS.** The sidebar and composer
collapse via CSS width transitions rather than animated inline styles, which
avoids a reflow per frame. Collapsing both gives the canvas 47% more width,
which matters on a 13 inch screen.

**Focus mode.** Selecting a take keeps its ancestors, itself and its direct
children lit and drops the rest back, which is what keeps a deep tree readable.

**Theme.** Light and dark are defined as tokens and stamped on `<html>` before
paint, so there is no flash. Contrast for the accent and muted text is verified
against WCAG AA in `globals.css`.

## Still to do

- Part A of the assessment (implementing the supplied mockup) is a separate
  deliverable and is not built yet.
- The product thinking document is not written yet.
- Full-size take viewer, collection renaming in the UI, and reference edges
  drawn across collections are stubbed or omitted.
