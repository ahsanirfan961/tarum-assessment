import { NextResponse } from "next/server";
import { getMedia, isValidKey, StorageError } from "@/lib/storage";

/**
 * Streams stored media back from the bucket, so the bucket itself stays
 * private. Keys are never reused, which makes every response immutable.
 *
 * `Range` is passed straight through and answered with 206. Images don't need
 * it, but video seeking does, so it lives here from the start.
 */
export async function GET(request, { params }) {
  const { key: parts } = await params;
  const key = parts.join("/");

  if (!isValidKey(key)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const media = await getMedia(key, request.headers.get("range"));
    const headers = {
      "Content-Type": media.contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
    };
    if (media.contentLength != null) headers["Content-Length"] = String(media.contentLength);
    if (media.contentRange) headers["Content-Range"] = media.contentRange;

    return new Response(media.body, {
      status: media.contentRange ? 206 : 200,
      headers,
    });
  } catch (err) {
    const status = err instanceof StorageError ? err.status : 500;
    if (status >= 500) console.error("[media]", err);
    return NextResponse.json(
      { error: status >= 500 ? "Media storage is unavailable." : err.message },
      { status }
    );
  }
}
