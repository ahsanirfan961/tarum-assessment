import { NextResponse } from "next/server";
import { DatabaseError } from "@/lib/db/client";
import { refreshTakes } from "@/lib/video/jobs";

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_IDS = 50;

/**
 * The "finish" half of video generation. The client polls this with the ids
 * of its rendering takes; each one still rendering is checked with its
 * provider, and any whose job has completed is stored and returned finished.
 * See src/lib/video/jobs.js.
 *
 * GET /api/generate/jobs?ids=a,b,c  ->  { nodes: [...] }
 */
export async function GET(request) {
  const raw = request.nextUrl.searchParams.get("ids") ?? "";
  const ids = [...new Set(raw.split(",").filter(Boolean))];

  if (!ids.length || ids.length > MAX_IDS || !ids.every((id) => SAFE_ID.test(id))) {
    return NextResponse.json(
      { error: `Pass up to ${MAX_IDS} take ids as ?ids=a,b,c.` },
      { status: 400 }
    );
  }

  try {
    const nodes = await refreshTakes(ids);
    return NextResponse.json({ nodes }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof DatabaseError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[jobs]", err);
    return NextResponse.json({ error: "Couldn't check on rendering takes." }, { status: 500 });
  }
}
