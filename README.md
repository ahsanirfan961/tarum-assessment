# Fomi

A creative workspace for AI image and video generation, built for the Tarum
frontend assessment.

---

# Using Fomi

**In one line:** you describe what you want, Fomi makes a few versions, and
every version you keep working on stays attached to the one it came from — so
you never lose the good one.

> New here? A short walkthrough opens automatically the first time you visit
> each workspace. Press **?** in the top bar to see it again any time.

### The basics

| What you want to do | How |
|---|---|
| **Make something** | Type a description in the left panel, press **Generate**. You get several versions at once. |
| **Try again differently** | Click the version you like best, change a few words, press Generate again. The new ones appear *underneath* it — the original stays put. |
| **Remember what you changed** | Hover the line joining two versions. It shows the exact words that turned one into the other. |
| **Reuse a look** | Hover a version, click the **stack** icon. Your next generation borrows from it — it can even be from a different collection. |
| **See it big** | Hover a version, click the **expand** icon. |

### Reading the canvas

Everything is one picture of how your work grew. The **i** button in the
canvas's top-left corner explains the symbols at any time.

- **Boxes** are versions ("takes"). Click one to work from it.
- **Thin lines** mean *another attempt at the same thing*.
- Clicking a take **fades everything unrelated**, so a busy canvas stays readable.
- **Drag** to move around, **scroll** to zoom.

### For video, two extra things

Video is the same, plus a sense of *time*. With a clip selected you choose:

- **New take** — a different version of **this same moment**.
- **Continue** — the moment that comes **next**.

Continuations join up into one video, shown along **the cut** at the bottom:

- Each slot is one moment, numbered `01`, `02`, `03`…
- Press **play** to watch the whole thing start to finish.
- **Thick, film-strip lines** on the canvas mean "continues into", so you can
  see the story order at a glance.
- Under any slot, **"3 takes"** lets you swap that moment for a different
  version — the rest of the video stays as it is.
- **Download cut** saves the whole thing as one file. **Download beat** saves
  just the moment on screen.

> If a swap says *"cut becomes 2 beats"*, that version simply has nothing
> following it yet. Nothing is deleted — pick **Continue** to carry on from
> there.

---

# How it's built

## The idea

Every AI generation tool presents your work as a reverse-chronological feed.
That throws away the thing that actually matters when you iterate: which take
came from which, and what you changed to get there.

Fomi treats generation as **version control**. A collection is one lineage. Each
take knows its parent, and the edge between them carries the prompt that made
the change. Three generations deep, you can still read how you got there, and
branch again from any point.

The same idea drives both workspaces. Video adds one thing a tree cannot give
you by default: time. A take can be **regenerated** (an alternative for the
same moment) or **extended** (the next moment), and both stay children in the
same vertical tree rather than a second, horizontal timeline - no timeline, no
layers, no keyframes, because working with generated video is choosing between
takes and deciding what happens next.

## Model

```
Project        isolated; nothing crosses between projects
└── Collection one lineage
    └── Node   one take
        ├── parentId      structural, exactly one, defines tree layout
        ├── referenceIds  soft, may cross collections, dashed edges
        ├── prompt        what produced this take, shown on its incoming edge
        └── beat          video only: which moment this take occupies
```

**Beats and the cut.** A video node's `beat` says which moment it occupies. A
regenerated take repeats its parent's beat - time doesn't advance; an extended
take advances the beat by one - the next moment. The edge between them is
never stored, only derived from the two beats (`src/lib/video/cut.js`).

A collection's compiled video - its "cut" - is resolved by walking root to a
chosen leaf (`collection.cutLeafId`) and keeping the deepest node at each
beat:

```
A ①
└─ B ②
   ├─ C ③        path to C  → A,B,C        → plays A, B, C
   └─ B' ②       (regen of B - same beat)
      └─ C' ③    path to C' → A,B,B',C'    → beat ② holds B and B', keep deeper (B')
                                           → plays A, B', C'
```

Because a tree has exactly one root-to-leaf path, this always resolves to
exactly one clip per beat, however regenerations and extensions interleave -
`B'` shadows `B` without either being deleted, and `C` simply lives on a
different branch. The cut strip below the lineage is a read-out of this
resolution, not a place takes are manually ordered; picking a different take
for a beat just re-points `cutLeafId`.

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
    canvas/                   home grid, graph canvas, mobile lineage, the cut strip
    onboarding/               first-run walkthrough and its illustrations
    media/                    take viewer and the sequential cut player
    ui/                       button, icon button, select
  hooks/                      pan and zoom, media query, theme, guide-seen
  lib/
    layout/tidyTree.js        Reingold-Tilford layout and ancestor paths
    video/cut.js              beat model: cut resolution, per-beat alternates
    guide.js                  "walkthrough dismissed" as an external store
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
against WCAG AA in `globals.css`, and borders are held to WCAG 1.4.11's 3:1 for
non-text UI — a faint hairline border is a legibility bug, not a style, and it
is the one thing no amount of hue adjustment can fix for a colour-blind user.

**Onboarding reads from storage, not from an effect.** Whether the walkthrough
has been dismissed is exposed through `useSyncExternalStore` with a server
snapshot of "already seen" (`lib/guide.js`), the same shape as the theme. The
guide therefore never renders into the server HTML only to be torn down on
hydration, and there is no `setState` in a mount effect. The panel's slide
position lives in a component that only exists while it is open, so reopening
it starts from the beginning with no reset to coordinate.

## Still to do

- Part A of the assessment (implementing the supplied mockup) is a separate
  deliverable and is not built yet.
- The product thinking document is not written yet.
- Collection renaming in the UI, and reference edges drawn across collections,
  are stubbed or omitted.
- **Download cut** records real playback via `captureStream()`/`MediaRecorder`,
  so it takes as long as the cut runs and produces a `.webm`. Genuine
  server-side or `ffmpeg.wasm` concatenation would be faster and give an
  `.mp4`, at the cost of a heavy dependency.
