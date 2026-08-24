# Fomi Frontend

Frontend assessment for Tarum — a responsive AI content generation web app
built with Next.js. Bootstrapped around two workspaces:

- **Image Generation Workspace** — `/workspace/image`
- **Video Generation Workspace** — `/workspace/video`

## Stack

- Next.js (App Router, JavaScript)
- Tailwind CSS
- Route handlers as a mocked generation backend (`/api/generate/image`,
  `/api/generate/video`)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to the
image workspace.

## Project structure

```
src/
  app/
    workspace/
      layout.js        shared top nav shell
      image/page.js     image generation workspace route
      video/page.js     video generation workspace route
    api/generate/       mocked generation route handlers
  components/
    nav/                top navigation
    workspace/           prompt panel, results grid, history strip, shell
  hooks/
    useGeneration.js     client-side hook driving the mock generation flow
  lib/
    constants.js         shared option lists (models, ratios, counts)
    mock/                mocked API response data
public/mock/              placeholder generation thumbnails
design-ref/                reference mockup exported from the assessment brief
```

This is an early scaffold — visual design, interactions, and product-thinking
scope for Part B are still to be finalized.
