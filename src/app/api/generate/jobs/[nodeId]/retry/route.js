import { NextResponse } from "next/server";
import { DatabaseError } from "@/lib/db/client";
import { InputError } from "@/lib/data/collections";
import { ProviderError } from "@/lib/providers";
import { StorageError } from "@/lib/storage";
import { retryTake } from "@/lib/video/jobs";

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Sends a failed video take's job again, in place: same id and spot in the
 * tree, same settings, a new job. Returns the take, `pending` again.
 */
export async function POST(_request, { params }) {
  const { nodeId } = await params;
  if (!SAFE_ID.test(nodeId)) {
    return NextResponse.json({ error: "Invalid take id." }, { status: 400 });
  }

  try {
    const node = await retryTake(nodeId);
    return NextResponse.json({ node });
  } catch (err) {
    if (
      err instanceof InputError ||
      err instanceof DatabaseError ||
      err instanceof ProviderError ||
      err instanceof StorageError
    ) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[retry]", err);
    return NextResponse.json({ error: "Couldn't retry this take." }, { status: 500 });
  }
}
