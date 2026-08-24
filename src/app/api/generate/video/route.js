import { NextResponse } from "next/server";
import { pickThumbnails } from "@/lib/mock/assets";

// Mocked generation endpoint. Swap for a real model call later —
// the response shape is what the workspace UI already expects.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { prompt = "", count = 2, aspectRatio = "16:9", model = "Fomi Motion" } =
    body;

  if (!prompt.trim()) {
    return NextResponse.json(
      { error: "Prompt is required." },
      { status: 400 }
    );
  }

  await new Promise((resolve) => setTimeout(resolve, 1400));

  const seed = Math.floor(Math.random() * 1000);
  const items = pickThumbnails(count, seed).map((thumbnail, i) => ({
    id: `vid_${Date.now()}_${i}`,
    thumbnail,
    url: null,
    durationSeconds: 4 + (i % 3) * 2,
    aspectRatio,
  }));

  return NextResponse.json({
    id: `gen_${Date.now()}`,
    type: "video",
    prompt,
    model,
    aspectRatio,
    createdAt: new Date().toISOString(),
    items,
  });
}
