import { NextResponse } from "next/server";
import { DatabaseError } from "@/lib/db/client";
import { InputError, updateCollection } from "@/lib/data/collections";

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_NAME = 120;

/**
 * Renames a collection (`{ name }`) or picks its cut (`{ cutLeafId }`), or
 * both. The store has already applied the change; this makes it stick, and
 * the store rolls back if it fails.
 */
export async function PATCH(request, { params }) {
  const { collectionId } = await params;
  if (!SAFE_ID.test(collectionId)) return badRequest("Invalid collection id.");

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Expected a JSON body.");

  const changes = {};
  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return badRequest("A collection needs a name.");
    if (name.length > MAX_NAME) {
      return badRequest(`Keep the name under ${MAX_NAME} characters.`);
    }
    changes.name = name;
  }
  if ("cutLeafId" in body) {
    if (typeof body.cutLeafId !== "string" || !SAFE_ID.test(body.cutLeafId)) {
      return badRequest("Invalid take id for the cut.");
    }
    changes.cutLeafId = body.cutLeafId;
  }
  if (!Object.keys(changes).length) return badRequest("Nothing to change.");

  try {
    return NextResponse.json(await updateCollection(collectionId, changes));
  } catch (err) {
    if (err instanceof InputError || err instanceof DatabaseError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[collections]", err);
    return NextResponse.json({ error: "Couldn't save that change." }, { status: 500 });
  }
}

function badRequest(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}
