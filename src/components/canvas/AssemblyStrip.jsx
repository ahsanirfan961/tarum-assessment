"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CaretLeft, CaretRight, FilmSlate, X } from "@phosphor-icons/react";
import { useWorkspace } from "@/lib/store/WorkspaceProvider";
import IconButton from "@/components/ui/IconButton";

/**
 * Ordering the takes you kept.
 *
 * Deliberately not a timeline: no layers, no keyframes, no scrubbing. Working
 * with generated video is choosing between takes and putting them in order, so
 * that is the only thing this does.
 */
export default function AssemblyStrip({ collection }) {
  const toggleInAssembly = useWorkspace((s) => s.toggleInAssembly);
  const reorderAssembly = useWorkspace((s) => s.reorderAssembly);
  const openViewer = useWorkspace((s) => s.openViewer);
  const reduce = useReducedMotion();

  const assembly = collection.assembly ?? [];
  const clips = assembly
    .map((id) => collection.nodes.find((n) => n.id === id))
    .filter(Boolean);
  const total = clips.reduce((sum, c) => sum + (c.durationSeconds ?? 0), 0);

  return (
    <section
      aria-label="Assembly"
      className="shrink-0 border-t border-border bg-surface"
    >
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-text-muted">
          <FilmSlate size={13} weight="bold" aria-hidden />
          ASSEMBLY
        </h2>
        <span className="font-mono text-[11px] text-text-muted">
          {clips.length} {clips.length === 1 ? "clip" : "clips"} · {total}s
        </span>
      </div>

      {clips.length === 0 ? (
        <p className="px-3 pb-3 text-[12px] text-text-muted">
          Pick takes from the lineage above to build a cut.
        </p>
      ) : (
        <ul className="flex items-stretch gap-2 overflow-x-auto px-3 pb-3">
          <AnimatePresence initial={false} mode="popLayout">
            {clips.map((clip, i) => (
              <motion.li
                key={clip.id}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="group relative shrink-0"
              >
                <button
                  type="button"
                  onClick={() => openViewer(clip.id)}
                  aria-label={`Open clip ${i + 1} in the viewer`}
                  title={`Open clip ${i + 1} in the viewer`}
                  className="relative block h-16 w-28 overflow-hidden rounded-[var(--r-control)] border border-border"
                >
                  <Image
                    src={clip.url}
                    alt=""
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                  <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/65 px-1 font-mono text-[9px] text-white">
                    {clip.durationSeconds}s
                  </span>
                  <span className="pointer-events-none absolute left-1 top-1 grid h-4 w-4 place-items-center rounded bg-black/65 font-mono text-[9px] text-white">
                    {i + 1}
                  </span>
                </button>

                <div className="mt-1 flex items-center justify-center gap-0.5">
                  <IconButton
                    label={`Move clip ${i + 1} earlier`}
                    size="sm"
                    disabled={i === 0}
                    onClick={() => reorderAssembly(collection.id, i, i - 1)}
                    className="h-6 w-6 disabled:opacity-30"
                  >
                    <CaretLeft size={11} weight="bold" />
                  </IconButton>
                  <IconButton
                    label={`Remove clip ${i + 1}`}
                    size="sm"
                    onClick={() => toggleInAssembly(collection.id, clip.id)}
                    className="h-6 w-6"
                  >
                    <X size={11} weight="bold" />
                  </IconButton>
                  <IconButton
                    label={`Move clip ${i + 1} later`}
                    size="sm"
                    disabled={i === clips.length - 1}
                    onClick={() => reorderAssembly(collection.id, i, i + 1)}
                    className="h-6 w-6 disabled:opacity-30"
                  >
                    <CaretRight size={11} weight="bold" />
                  </IconButton>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
