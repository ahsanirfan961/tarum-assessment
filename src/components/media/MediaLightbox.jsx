"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DownloadSimple, X } from "@phosphor-icons/react";
import { useWorkspace } from "@/lib/store/WorkspaceProvider";
import IconButton from "@/components/ui/IconButton";
import { downloadAsset } from "@/lib/download";

/**
 * Full-size viewer for a single take. Images render large with a download
 * button; videos get a real, playable <video> element (the mocked backend
 * gives every video node an actual file, not just a poster) plus its own
 * download button.
 *
 * Reads `viewerNodeId` directly from the store rather than taking a node
 * prop, so one instance mounted at the shell level serves every surface that
 * shows a take (the graph, the mobile lineage, the assembly strip) without
 * each of them needing to render their own copy.
 */
export default function MediaLightbox() {
  const viewerNodeId = useWorkspace((s) => s.viewerNodeId);
  const closeViewer = useWorkspace((s) => s.closeViewer);
  const findNode = useWorkspace((s) => s.findNode);

  const found = viewerNodeId ? findNode(viewerNodeId) : null;

  return (
    <AnimatePresence>
      {found && (
        <LightboxPanel
          key={found.node.id}
          node={found.node}
          collection={found.collection}
          onClose={closeViewer}
        />
      )}
    </AnimatePresence>
  );
}

function LightboxPanel({ node, collection, onClose }) {
  const reduce = useReducedMotion();
  const closeButtonRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const isVideo = Boolean(node.videoUrl);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleDownload() {
    setDownloading(true);
    const ext = isVideo ? "mp4" : "jpg";
    await downloadAsset(isVideo ? node.videoUrl : node.url, `${node.id}.${ext}`);
    setDownloading(false);
  }

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
        aria-label={`${isVideo ? "Video" : "Image"} viewer: ${node.prompt}`}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex h-full w-full flex-col overscroll-contain p-3 sm:p-6"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 pb-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-white">{collection.name}</p>
            <p className="truncate text-[11px] text-white/60">
              {node.model} · {node.aspectRatio}
              {isVideo ? ` · ${node.durationSeconds}s` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="flex h-9 items-center gap-2 rounded-full bg-white px-3.5 text-[13px] font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-60"
            >
              <DownloadSimple size={15} weight="bold" aria-hidden />
              {downloading ? "Downloading…" : "Download"}
            </button>
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
        </div>

        <p className="mt-3 line-clamp-2 shrink-0 text-center text-[12px] leading-relaxed text-white/70">
          {node.prompt}
        </p>
      </motion.div>
    </div>
  );
}
