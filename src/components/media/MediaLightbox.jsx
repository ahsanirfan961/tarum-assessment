"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  DownloadSimple,
  FilmSlate,
  HourglassMedium,
  Pause,
  Play,
  SpeakerHigh,
  SpeakerSlash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useWorkspace } from "@/lib/store/WorkspaceProvider";
import IconButton from "@/components/ui/IconButton";
import { downloadAsset, downloadBlob } from "@/lib/download";
import { modelLabel } from "@/lib/models/catalog";
import { isFailed, isReady } from "@/lib/takes";
import { beatOf, cutDuration, resolveCut } from "@/lib/video/cut";

/**
 * Full-size viewer, in two modes that share one chrome (`LightboxFrame`):
 *
 * - A single take: images render large with a download button; videos get a
 *   real, playable <video> plus its own download button.
 * - A compiled cut: the resolved sequence for one lineage, played straight
 *   through as one video with a segment rail (`CutPlayer`).
 *
 * Reads viewer state directly from the store rather than taking props, so
 * one instance mounted at the shell level serves every surface that opens a
 * take or a cut (the graph, the mobile lineage, the cut strip) without each
 * of them needing to render their own copy.
 */
export default function MediaLightbox() {
  const viewerNodeId = useWorkspace((s) => s.viewerNodeId);
  const viewerCutLeafId = useWorkspace((s) => s.viewerCutLeafId);
  const viewerCutStart = useWorkspace((s) => s.viewerCutStart);
  const closeViewer = useWorkspace((s) => s.closeViewer);
  const findNode = useWorkspace((s) => s.findNode);
  // Subscribed so a take that finishes rendering while it is open (a cut
  // waiting on a beat) shows up; `findNode` alone never changes.
  useWorkspace((s) => s.collections);

  // Only a finished take has anything to show full size.
  const found = viewerNodeId ? findNode(viewerNodeId) : null;
  const single = found && isReady(found.node) ? found : null;
  const cutSource = viewerCutLeafId ? findNode(viewerCutLeafId) : null;
  const cutClips = cutSource
    ? resolveCut(cutSource.collection.nodes, viewerCutLeafId)
    : null;

  return (
    <AnimatePresence>
      {single && (
        <LightboxPanel
          key={single.node.id}
          node={single.node}
          collection={single.collection}
          onClose={closeViewer}
        />
      )}
      {cutClips && cutClips.length > 0 && (
        <CutPlayer
          key={viewerCutLeafId}
          collection={cutSource.collection}
          clips={cutClips}
          startIndex={viewerCutStart}
          onClose={closeViewer}
        />
      )}
    </AnimatePresence>
  );
}

/**
 * The backdrop, dialog wrapper, header and Escape/focus handling shared by
 * both viewer modes. `title`/`meta` sit on the left of the header, `actions`
 * (e.g. a download button) sit right of the close button; `footer` sits
 * below the media area.
 */
function LightboxFrame({ ariaLabel, onClose, title, meta, actions, footer, children }) {
  const reduce = useReducedMotion();
  const closeButtonRef = useRef(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col">
      <motion.button
        type="button"
        aria-label="Close viewer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/80"
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex h-full w-full flex-col overscroll-contain p-3 sm:p-6"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 pb-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-white">{title}</p>
            <p className="truncate text-[11px] text-white/60">{meta}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <IconButton
              ref={closeButtonRef}
              label="Close viewer"
              onClick={onClose}
              className="text-white hover:bg-white/15 hover:text-white"
            >
              <X size={18} weight="bold" />
            </IconButton>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          {children}
        </div>

        {footer}
      </motion.div>
    </div>
  );
}

function DownloadButton({ downloading, onClick, label = "Download", unavailable = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={downloading || unavailable}
      className="flex h-9 items-center gap-2 rounded-full bg-white px-3.5 text-[13px] font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-60"
    >
      <DownloadSimple size={15} weight="bold" aria-hidden />
      {downloading ? "Downloading…" : label}
    </button>
  );
}

/**
 * Compiling the full cut into one file is a secondary, slower action next to
 * downloading the beat on screen, so it gets a quieter outline treatment
 * rather than competing with the primary white pill.
 */
function CompileCutButton({ compiling, disabledReason, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={Boolean(disabledReason) || compiling}
      title={disabledReason ?? undefined}
      className="flex h-9 items-center gap-2 rounded-full border border-white/30 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-40"
    >
      <FilmSlate size={15} weight="bold" aria-hidden />
      {compiling ? "Compiling…" : "Download cut"}
    </button>
  );
}

function LightboxPanel({ node, collection, onClose }) {
  const [downloading, setDownloading] = useState(false);
  const isVideo = Boolean(node.videoUrl);

  async function handleDownload() {
    setDownloading(true);
    // Stored takes keep their real extension in the URL (often .png); seed
    // photography has none and is JPEG.
    const ext = isVideo ? "mp4" : (node.url.match(/\.(png|jpe?g|webp)$/)?.[1] ?? "jpg");
    await downloadAsset(isVideo ? node.videoUrl : node.url, `${node.id}.${ext}`);
    setDownloading(false);
  }

  return (
    <LightboxFrame
      ariaLabel={`${isVideo ? "Video" : "Image"} viewer: ${node.prompt}`}
      onClose={onClose}
      title={collection.name}
      meta={`${modelLabel(node.model)} · ${node.aspectRatio}${
        isVideo ? ` · ${node.durationSeconds}s` : ""
      }`}
      actions={<DownloadButton downloading={downloading} onClick={handleDownload} />}
      footer={
        <p className="mt-3 line-clamp-2 shrink-0 text-center text-[12px] leading-relaxed text-white/70">
          {node.prompt}
        </p>
      }
    >
      {isVideo ? (
        <video
          src={node.videoUrl}
          poster={node.url}
          controls
          playsInline
          className="max-h-full max-w-full rounded-[var(--r-panel)] shadow-[var(--shadow-lift)]"
        />
      ) : (
        <div className="relative h-full w-full">
          <Image
            src={node.url}
            alt={node.prompt}
            fill
            sizes="90vw"
            className="object-contain"
            priority
          />
        </div>
      )}
    </LightboxFrame>
  );
}

/**
 * Plays a compiled cut straight through: one <video> per segment (keyed on
 * clip id, so React remounts rather than mutating `src` in place), advancing
 * on `ended`. A brief fade masks the poster/black flash that reset causes;
 * reduced motion gets a hard cut instead, never a suppressed auto-advance -
 * that's the feature, and pause/stop stay available throughout.
 *
 * A beat still rendering (or failed) keeps its place in the rail but has no
 * clip, so playback stops there and says so. If it finishes while the player
 * is open, it starts playing from that beat.
 */
function CutPlayer({ collection, clips, startIndex, onClose }) {
  const reduce = useReducedMotion();
  const videoRef = useRef(null);
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(startIndex, 0), clips.length - 1)
  );
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [fading, setFading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [compiling, setCompiling] = useState(false);

  // There's no way to concatenate separately-generated files into one
  // without a heavy dependency like ffmpeg.wasm, so "download the cut" is
  // implemented honestly instead: record the actual playback through
  // captureStream()/MediaRecorder as the segments auto-advance, which
  // produces one real merged file at the cost of taking as long as the cut
  // does to play. Unsupported browsers (no captureStream) get a disabled
  // button rather than a silent failure.
  const canCompile =
    typeof window !== "undefined" &&
    typeof HTMLMediaElement !== "undefined" &&
    typeof HTMLMediaElement.prototype.captureStream === "function";
  const compileRef = useRef({ active: false, recorder: null, chunks: [], pendingStart: null });

  useEffect(() => {
    return () => {
      const recorder = compileRef.current.recorder;
      if (recorder && recorder.state !== "inactive") {
        // Closing mid-compile: detach onstop first so this discards the
        // partial recording instead of silently downloading a truncated
        // file the user never asked to keep.
        recorder.onstop = null;
        recorder.ondataavailable = null;
        recorder.stop();
      }
      compileRef.current = { active: false, recorder: null, chunks: [], pendingStart: null };
    };
  }, []);

  const clip = clips[index];
  const total = cutDuration(clips);
  const clipReady = isReady(clip);
  const allReady = clips.every(isReady);

  const goTo = useCallback(
    (next) => {
      if (compileRef.current.active) return;
      if (next < 0 || next >= clips.length || next === index) return;
      if (reduce) {
        setIndex(next);
        return;
      }
      setFading(true);
      setTimeout(() => {
        setIndex(next);
        setFading(false);
      }, 120);
    },
    [clips.length, index, reduce]
  );

  const togglePlay = useCallback(() => {
    // Pausing mid-recording would freeze the captured frame without
    // stopping the recorder, so playback controls are locked while a
    // compile is running.
    if (compileRef.current.active) return;
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video
        .play()
        .then(() => setNeedsGesture(false))
        .catch(() => setNeedsGesture(true));
    } else {
      video.pause();
    }
  }, []);

  // Auto-advances into the next segment; blocked autoplay falls back to a
  // tap-to-play overlay rather than leaving playback silently stalled.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video
      .play()
      .then(() => {
        setNeedsGesture(false);
        // A compile was waiting for playback to land back on beat one -
        // now that it's actually playing, captureStream() has a live track.
        if (compileRef.current.pendingStart) {
          const start = compileRef.current.pendingStart;
          compileRef.current.pendingStart = null;
          start();
        }
      })
      .catch(() => setNeedsGesture(true));
  }, [index, clipReady]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowRight") {
        goTo(index + 1);
      } else if (e.key === "ArrowLeft") {
        goTo(index - 1);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [goTo, index, togglePlay]);

  function handleEnded() {
    // The next beat has no clip yet: move onto it, so the player says why
    // it stopped, rather than looping or skipping past it.
    if (index < clips.length - 1 && !isReady(clips[index + 1])) {
      setPlaying(false);
      goTo(index + 1);
      return;
    }
    if (index < clips.length - 1) {
      // goTo() no-ops while a compile is active, which would strand
      // recording on beat one forever, so advance directly here instead.
      if (compileRef.current.active) {
        setIndex(index + 1);
      } else {
        goTo(index + 1);
      }
    } else {
      setPlaying(false);
      if (compileRef.current.active) {
        compileRef.current.recorder?.stop();
      }
    }
  }

  async function handleDownload() {
    setDownloading(true);
    await downloadAsset(clip.videoUrl, `${clip.id}.mp4`);
    setDownloading(false);
  }

  function handleDownloadCut() {
    const video = videoRef.current;
    if (!canCompile || !allReady || !video || compileRef.current.active || clips.length === 0) {
      return;
    }

    compileRef.current.active = true;
    compileRef.current.chunks = [];
    setCompiling(true);

    const startRecording = () => {
      // Read fresh: <video key={clip.id}> fully remounts on a segment
      // change, so by the time this runs (after a jump back to beat one)
      // the element captured above may already be a detached node.
      const liveVideo = videoRef.current;
      const stream = liveVideo.captureStream();
      const mimeType = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ].find((type) => MediaRecorder.isTypeSupported(type));

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data.size) compileRef.current.chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(compileRef.current.chunks, {
          type: recorder.mimeType || "video/webm",
        });
        downloadBlob(blob, `${collection.id}-cut.webm`);
        compileRef.current = { active: false, recorder: null, chunks: [], pendingStart: null };
        setCompiling(false);
      };
      recorder.start();
      compileRef.current.recorder = recorder;
    };

    if (index === 0) {
      video
        .play()
        .then(startRecording)
        .catch(() => {
          compileRef.current.active = false;
          setCompiling(false);
          setNeedsGesture(true);
        });
    } else {
      compileRef.current.pendingStart = startRecording;
      setIndex(0);
    }
  }

  return (
    <LightboxFrame
      ariaLabel={`Cut viewer: ${collection.name}, beat ${beatOf(clip)} of ${clips.length}`}
      onClose={onClose}
      title={collection.name}
      meta={`${clips.length} ${clips.length === 1 ? "beat" : "beats"} · ${total}s`}
      actions={
        <>
          <CompileCutButton
            compiling={compiling}
            disabledReason={
              !canCompile
                ? "This browser can't compile a single file for the cut"
                : !allReady
                  ? "Every beat has to finish rendering first"
                  : null
            }
            onClick={handleDownloadCut}
          />
          <DownloadButton
            downloading={downloading}
            unavailable={!clipReady}
            onClick={handleDownload}
            label={`Download beat ${index + 1}`}
          />
        </>
      }
      footer={
        <>
          <div
            role="group"
            aria-label="Beats"
            className="mt-3 flex shrink-0 items-stretch gap-1"
          >
            {clips.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => goTo(i)}
                disabled={compiling}
                aria-label={`Jump to beat ${i + 1}${isReady(c) ? "" : isFailed(c) ? " (failed)" : " (rendering)"}`}
                aria-current={i === index ? "true" : undefined}
                className={`film-cell relative h-2 overflow-hidden rounded-full transition-colors disabled:pointer-events-none ${
                  !isReady(c)
                    ? i === index
                      ? "border border-dashed border-white"
                      : "border border-dashed border-white/40 hover:border-white/70"
                    : i === index
                      ? "bg-white"
                      : "bg-white/25 hover:bg-white/40"
                }`}
                style={{ flexGrow: c.durationSeconds ?? 1 }}
              />
            ))}
          </div>
          {compiling && (
            <p
              aria-live="polite"
              className="mt-2 shrink-0 text-center text-[12px] font-medium leading-relaxed text-white"
            >
              Compiling the cut - playing it through once to record a single file…
            </p>
          )}
          <p
            aria-live="off"
            className="mt-2 line-clamp-2 shrink-0 text-center text-[12px] leading-relaxed text-white/70"
          >
            {clip.prompt}
          </p>
        </>
      }
    >
      <div
        className={`relative flex h-full w-full items-center justify-center ${
          reduce ? "" : "transition-opacity duration-150"
        } ${fading ? "opacity-0" : "opacity-100"}`}
      >
        {clipReady ? (
          <video
            ref={videoRef}
            key={clip.id}
            src={clip.videoUrl}
            poster={clip.url}
            preload="auto"
            playsInline
            muted={muted}
            onEnded={handleEnded}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            className="max-h-full max-w-full rounded-[var(--r-panel)] shadow-[var(--shadow-lift)]"
          />
        ) : (
          <NotReadyNotice clip={clip} beat={index + 1} />
        )}

        {needsGesture && clipReady && (
          <button
            type="button"
            onClick={togglePlay}
            aria-label="Play"
            className="absolute inset-0 grid place-items-center bg-black/40 text-white"
          >
            <Play size={40} weight="fill" aria-hidden />
            <span className="sr-only">Tap to play</span>
          </button>
        )}
      </div>

      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/50 p-1 backdrop-blur-sm">
        <IconButton
          label={playing ? "Pause" : "Play"}
          onClick={togglePlay}
          disabled={compiling || !clipReady}
          className="text-white hover:bg-white/15 hover:text-white disabled:opacity-40"
        >
          {playing ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
        </IconButton>
        <IconButton
          label={muted ? "Unmute" : "Mute"}
          onClick={() => setMuted((m) => !m)}
          disabled={compiling}
          className="text-white hover:bg-white/15 hover:text-white disabled:opacity-40"
        >
          {muted ? <SpeakerSlash size={16} weight="fill" /> : <SpeakerHigh size={16} weight="fill" />}
        </IconButton>
      </div>
    </LightboxFrame>
  );
}

/** Where the cut stops: a beat that has no clip yet, and why. */
function NotReadyNotice({ clip, beat }) {
  const failed = isFailed(clip);
  return (
    <div
      role="status"
      className="flex max-w-sm flex-col items-center gap-2 rounded-[var(--r-panel)] border border-dashed border-white/30 px-6 py-8 text-center text-white"
    >
      {failed ? (
        <WarningCircle size={22} weight="bold" aria-hidden />
      ) : (
        <HourglassMedium size={22} aria-hidden />
      )}
      <p className="text-[13px] font-medium">
        {failed ? `Beat ${beat} failed to render.` : `Beat ${beat} is still rendering.`}
      </p>
      <p className="text-[12px] leading-relaxed text-white/60">
        {failed
          ? "The cut stops here. Retry the take from the canvas, or pick another take for this beat."
          : "The cut plays up to here. It picks up from this beat as soon as the clip is ready."}
      </p>
    </div>
  );
}
