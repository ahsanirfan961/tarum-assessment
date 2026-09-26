import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

/**
 * Frame extraction for finished clips, with the ffmpeg binary from
 * `ffmpeg-static`, so nothing has to be installed on the host. Every call
 * works in its own temp directory and removes it afterwards.
 */

const TIMEOUT_MS = 60_000;

function run(args) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("ffmpeg-static has no binary for this platform."));
      return;
    }
    execFile(
      ffmpegPath,
      ["-hide_banner", "-loglevel", "error", "-y", ...args],
      { timeout: TIMEOUT_MS, windowsHide: true },
      (err, _stdout, stderr) => {
        if (err) reject(new Error(`ffmpeg failed: ${stderr?.trim() || err.message}`));
        else resolve();
      }
    );
  });
}

async function inTempDir(work) {
  const dir = await mkdtemp(path.join(tmpdir(), "fomi-video-"));
  try {
    return await work(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** The frame a clip opens on, as a JPEG buffer. */
function posterArgs(input, output) {
  return ["-ss", "0", "-i", input, "-frames:v", "1", "-q:v", "3", output];
}

/**
 * The frame a clip ends on, as a JPEG buffer. Seeks to just before the end
 * and keeps overwriting one image, so the last decoded frame wins.
 */
function lastFrameArgs(input, output) {
  return ["-sseof", "-0.2", "-i", input, "-update", "1", "-frames:v", "1", "-q:v", "3", output];
}

/** Poster and last frame of an mp4, both as JPEG buffers. */
export function extractFrames(video) {
  return inTempDir(async (dir) => {
    const input = path.join(dir, "in.mp4");
    const poster = path.join(dir, "poster.jpg");
    const last = path.join(dir, "last.jpg");
    await writeFile(input, video);
    await run(posterArgs(input, poster));
    await run(lastFrameArgs(input, last));
    return { poster: await readFile(poster), lastFrame: await readFile(last) };
  });
}

/** Only the last frame, for takes stored before last frames were kept. */
export function extractLastFrame(video) {
  return inTempDir(async (dir) => {
    const input = path.join(dir, "in.mp4");
    const last = path.join(dir, "last.jpg");
    await writeFile(input, video);
    await run(lastFrameArgs(input, last));
    return readFile(last);
  });
}

/**
 * Renders a stand-in clip for the mock provider, `seconds` long at `width` x
 * `height`. Given a start frame it opens exactly on that image and slowly
 * pushes in, so a mock "Continue" visibly starts where its parent ended.
 * Without one (text-to-video) it's a drifting gradient in `colors`.
 */
export function renderMockClip({ seconds, width, height, startFrame, colors }) {
  const fps = 24;
  const frames = Math.round(seconds * fps);
  return inTempDir(async (dir) => {
    const output = path.join(dir, "out.mp4");
    const encode = ["-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];

    if (startFrame) {
      const input = path.join(dir, "frame.img");
      await writeFile(input, startFrame);
      // Scaled up first so the push-in stays sharp; zoom is exactly 1 on the
      // first frame.
      const filter = [
        `scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase`,
        `crop=${width * 2}:${height * 2}`,
        `zoompan=z='1+0.18*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`,
      ].join(",");
      await run(["-loop", "1", "-i", input, "-vf", filter, "-frames:v", String(frames), ...encode, output]);
    } else {
      const source = `gradients=s=${width}x${height}:d=${seconds}:r=${fps}:speed=0.015:n=3:${colors
        .map((c, i) => `c${i}=0x${c}`)
        .join(":")}`;
      await run(["-f", "lavfi", "-i", source, ...encode, output]);
    }
    return readFile(output);
  });
}
