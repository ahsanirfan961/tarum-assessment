import { NextResponse } from "next/server";
import { nameFromPrompt } from "@/lib/naming";

const KINDS = {
  image: { latencyMs: 900, defaultModel: "Fomi Core v3" },
  video: { latencyMs: 1600, defaultModel: "Fomi Motion v2" },
};

/**
 * Mocked generation endpoint.
 *
 * The response is already shaped the way the lineage graph consumes it: every
 * returned node carries the `parentId` it was generated from and the
 * `referenceIds` that informed it, so swapping in a real model provider is a
 * change of source, not of schema.
 */
export async function POST(request, { params }) {
  const { kind } = await params;
  const config = KINDS[kind];

  if (!config) {
    return NextResponse.json({ error: `Unknown kind "${kind}".` }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const {
    prompt = "",
    count = 4,
    aspectRatio = kind === "video" ? "16:9" : "1:1",
    model = config.defaultModel,
    parentId = null,
    referenceIds = [],
  } = body;

  if (!prompt.trim()) {
    return NextResponse.json({ error: "A prompt is required." }, { status: 400 });
  }

  const safeCount = Math.min(Math.max(Number(count) || 1, 1), 8);
  await new Promise((resolve) => setTimeout(resolve, config.latencyMs));

  const batch = Date.now().toString(36);
  const nodes = Array.from({ length: safeCount }, (_, i) => ({
    id: `${kind}_${batch}_${i}`,
    parentId,
    referenceIds,
    prompt: prompt.trim(),
    model,
    aspectRatio,
    url: `https://picsum.photos/seed/${batch}${i}/640/640`,
    ...(kind === "video" ? { durationSeconds: 4 + (i % 3) * 2 } : {}),
  }));

  return NextResponse.json({
    collectionId: `col_${batch}`,
    name: nameFromPrompt(prompt),
    kind,
    nodes,
  });
}
