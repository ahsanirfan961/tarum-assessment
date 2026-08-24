import { NextResponse } from "next/server";
import { pickThumbnails } from "@/lib/mock/assets";

// Mocked generation endpoint. Swap for a real model call later —
// the response shape is what the workspace UI already expects.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { prompt = "", count = 4, aspectRatio = "1:1", model = "Fomi Core" } =
    body;

  if (!prompt.trim()) {
    return NextResponse.json(
      { error: "Prompt is required." },
      { status: 400 }
    );
  }

  await new Promise((resolve) => setTimeout(resolve, 900));

  const seed = Math.floor(Math.random() * 1000);
  const items = pickThumbnails(count, seed).map((url, i) => ({
    id: `img_${Date.now()}_${i}`,
    url,
    aspectRatio,
  }));

  return NextResponse.json({
    id: `gen_${Date.now()}`,
    type: "image",
    prompt,
    model,
    aspectRatio,
    createdAt: new Date().toISOString(),
    items,
  });
}
