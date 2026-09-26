import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Media storage on any S3-compatible store (MinIO locally).
 *
 * Objects are never linked to directly. Every stored file is addressed as
 * `/api/media/<key>`, which the media route streams back from the bucket. So
 * the bucket stays private, `next/image` sees a same-origin path, and stored
 * URLs carry no storage host: moving to S3 or R2 is an env change only.
 */

export const MEDIA_PREFIX = "/api/media/";

// Remote hosts whose images may be used as model inputs. Matches the seed
// photography allowed in next.config.mjs.
const REMOTE_INPUT_HOSTS = new Set(["picsum.photos", "fastly.picsum.photos"]);

const EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
};

export class StorageError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.name = "StorageError";
    this.status = status;
  }
}

let client = null;
let bucketReady = null;

function bucket() {
  return process.env.S3_BUCKET || "fomi-media";
}

function s3() {
  client ??= new S3Client({
    endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
    region: process.env.S3_REGION || "us-east-1",
    forcePathStyle: true, // MinIO serves buckets as paths, not subdomains
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || "fomi",
      secretAccessKey: process.env.S3_SECRET_KEY || "fomi-dev-secret",
    },
  });
  return client;
}

/** Turns a connection failure into something that says what to run. */
function unreachable(err) {
  const endpoint = process.env.S3_ENDPOINT || "http://localhost:9000";
  return new StorageError(
    `Media storage isn't reachable at ${endpoint}. Start it with \`docker compose up -d\`.\n(${err.message})`
  );
}

function isConnectionError(err) {
  const code = err?.code ?? err?.cause?.code;
  return (
    ["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EHOSTUNREACH", "ETIMEDOUT"].includes(code) ||
    err?.name === "TimeoutError"
  );
}

/**
 * Creates the bucket on first use, so Compose needs no separate init
 * container. Memoized for the life of the process; a failure clears the memo
 * so the next request retries once MinIO is up.
 */
export function ensureBucket() {
  bucketReady ??= (async () => {
    try {
      await s3().send(new HeadBucketCommand({ Bucket: bucket() }));
    } catch (err) {
      if (err?.$metadata?.httpStatusCode !== 404 && err?.name !== "NotFound") throw err;
      await s3().send(new CreateBucketCommand({ Bucket: bucket() }));
    }
  })().catch((err) => {
    bucketReady = null;
    throw isConnectionError(err) ? unreachable(err) : err;
  });
  return bucketReady;
}

/** Only generated media keys, with no way to climb out of them. */
export function isValidKey(key) {
  return (
    typeof key === "string" &&
    /^(images|videos)\/[A-Za-z0-9_\-./]+$/.test(key) &&
    !key.split("/").some((part) => part === "" || part === "." || part === "..")
  );
}

export function extensionFor(contentType) {
  return EXTENSIONS[contentType] ?? "bin";
}

/** Stores a buffer and returns the URL the app addresses it by. */
export async function putMedia(buffer, contentType, key) {
  if (!isValidKey(key)) throw new StorageError(`Invalid media key "${key}".`, 400);
  await ensureBucket();
  try {
    await s3().send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
  } catch (err) {
    throw isConnectionError(err) ? unreachable(err) : err;
  }
  return `${MEDIA_PREFIX}${key}`;
}

/**
 * Reads an object, optionally a byte range of it. Returns a web stream plus
 * the headers the media route needs to answer with 200 or 206.
 */
export async function getMedia(key, range) {
  if (!isValidKey(key)) throw new StorageError("Not found.", 404);
  try {
    const res = await s3().send(
      new GetObjectCommand({ Bucket: bucket(), Key: key, Range: range || undefined })
    );
    return {
      body: res.Body.transformToWebStream(),
      contentType: res.ContentType || "application/octet-stream",
      contentLength: res.ContentLength,
      contentRange: res.ContentRange ?? null,
    };
  } catch (err) {
    if (err?.name === "NoSuchKey" || err?.name === "NoSuchBucket") {
      throw new StorageError("Not found.", 404);
    }
    if (err?.name === "InvalidRange" || err?.$metadata?.httpStatusCode === 416) {
      throw new StorageError("Range not satisfiable.", 416);
    }
    throw isConnectionError(err) ? unreachable(err) : err;
  }
}

async function streamToBuffer(stream) {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

/**
 * Turns a node URL into something a model provider can read. OpenRouter
 * can't reach our storage, so stored media is inlined as a `data:` URL. Seed
 * photography is inlined too, rather than handed over as a URL, so a take
 * branched from a seed doesn't depend on the provider following picsum's
 * redirect. Anything else is refused, since these URLs come from the client.
 */
export async function readMediaAsDataUrl(url) {
  if (typeof url !== "string" || !url) {
    throw new StorageError("Missing input image URL.", 400);
  }

  if (url.startsWith(MEDIA_PREFIX)) {
    const key = decodeURIComponent(url.slice(MEDIA_PREFIX.length));
    const { body, contentType } = await getMedia(key);
    const buffer = await streamToBuffer(body);
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new StorageError("Input image URL isn't valid.", 400);
  }
  if (parsed.protocol !== "https:" || !REMOTE_INPUT_HOSTS.has(parsed.hostname)) {
    throw new StorageError(`Input images from ${parsed.hostname} aren't allowed.`, 400);
  }

  const res = await fetch(parsed, { signal: AbortSignal.timeout(15_000) });
  const finalHost = new URL(res.url).hostname;
  if (!res.ok || !REMOTE_INPUT_HOSTS.has(finalHost)) {
    throw new StorageError(`Couldn't fetch input image (${res.status}).`, 502);
  }
  const contentType = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}
