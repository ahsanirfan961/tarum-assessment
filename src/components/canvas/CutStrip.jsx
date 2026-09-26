"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CaretDown, FilmSlate, Play } from "@phosphor-icons/react";
import { useWorkspace } from "@/lib/store/WorkspaceProvider";
import { isFailed, isReady } from "@/lib/takes";
import { beatOf, cutDuration, resolveCut, takesAtBeat } from "@/lib/video/cut";
import IconButton from "@/components/ui/IconButton";
import TakeImage from "@/components/media/TakeImage";

/**
 * The compiled video for one lineage: one clip per beat, ascending, resolved
 * straight from the tree. Order comes entirely from beats, so unlike the
 * assembly strip this replaces, there is nothing left to hand-order — this
 * is a readout of the cut, not a place you assemble one.
 *
 * A beat whose take is still rendering keeps its slot, marked as such: the
 * cut already knows what goes there, it just can't play it yet.
 */
export default function CutStrip({ collection }) {
  const setCutTake = useWorkspace((s) => s.setCutTake);
  const openViewer = useWorkspace((s) => s.openViewer);
  const openCut = useWorkspace((s) => s.openCut);
  const reduce = useReducedMotion();
  const [expandedBeats, setExpandedBeats] = useState(() => new Set());

  const clips = useMemo(
    () => resolveCut(collection.nodes, collection.cutLeafId),
    [collection.nodes, collection.cutLeafId]
  );
  const total = cutDuration(clips);

  const toggleExpanded = (beat) =>
    setExpandedBeats((prev) => {
      const next = new Set(prev);
      if (next.has(beat)) {
        next.delete(beat);
      } else {
        next.add(beat);
      }
      return next;
    });

  return (
    <section aria-label="The cut" className="shrink-0 border-t border-border bg-surface">
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-text-muted">
          <FilmSlate size={13} weight="bold" aria-hidden />
          THE CUT
        </h2>
        <div className="flex items-center gap-1.5">
          {/* A swap that shortens the cut (an alternate take with no
              continuation of its own) should never read as a silent no-op. */}
          <span aria-live="polite" className="font-mono text-[11px] text-text-muted">
            {clips.length} {clips.length === 1 ? "beat" : "beats"} · {total}s
          </span>
          {clips.length > 0 && (
            <IconButton
              label="Play the cut"
              size="sm"
              onClick={() => openCut(collection.cutLeafId)}
            >
              <Play size={13} weight="fill" />
            </IconButton>
          )}
        </div>
      </div>

      {clips.length === 0 ? (
        <p className="px-3 pb-3 text-[12px] text-text-muted">
          Generate a first take to start the cut.
        </p>
      ) : (
        <ul className="flex items-start gap-2 overflow-x-auto px-3 pb-3">
          <AnimatePresence initial={false} mode="popLayout">
            {clips.map((clip, i) => {
              const beat = beatOf(clip);
              const prevId = i > 0 ? clips[i - 1].id : null;
              const takes = takesAtBeat(collection.nodes, prevId, beat);
              const hasAlternates = takes.length > 1;
              const isOpen = expandedBeats.has(beat);
              const panelId = `cut-beat-${beat}-takes`;
              const ready = isReady(clip);
              const slotState = ready ? "" : isFailed(clip) ? "Failed" : "Rendering";

              return (
                <motion.li
                  key={clip.id}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="w-28 shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => openViewer(clip.id)}
                    disabled={!ready}
                    aria-label={
                      ready ? `Open beat ${beat} in the viewer` : `Beat ${beat}: ${slotState.toLowerCase()}`
                    }
                    title={ready ? `Open beat ${beat} in the viewer` : `${slotState}`}
                    className="film-cell relative block h-16 w-28 overflow-hidden rounded-[var(--r-control)] border border-border disabled:cursor-default"
                  >
                    <TakeImage node={clip} fill sizes="112px" className="object-cover" />
                    {!ready && (
                      <span className="pointer-events-none absolute inset-x-0 bottom-1.5 z-[2] text-center text-[10px] font-medium text-text-muted">
                        {slotState}
                      </span>
                    )}
                    <span className="pointer-events-none absolute bottom-1 right-1 z-[2] rounded bg-black/65 px-1 font-mono text-[9px] text-white">
                      {clip.durationSeconds}s
                    </span>
                    <span className="pointer-events-none absolute left-1 top-1 z-[2] grid h-4 w-4 place-items-center rounded bg-black/65 font-mono text-[9px] text-white">
                      {String(beat).padStart(2, "0")}
                    </span>
                  </button>

                  {hasAlternates ? (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(beat)}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      className="mt-1 flex w-full items-center justify-center gap-1 rounded-[var(--r-control)] py-1 text-[11px] font-medium text-text-muted transition-colors hover:text-text"
                    >
                      {takes.length} takes
                      <CaretDown
                        size={10}
                        weight="bold"
                        aria-hidden
                        className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  ) : (
                    <p className="mt-1 text-center text-[11px] text-text-muted">1 take</p>
                  )}

                  <AnimatePresence initial={false}>
                    {hasAlternates && isOpen && (
                      <motion.div
                        id={panelId}
                        role="radiogroup"
                        aria-label={`Takes for beat ${beat}`}
                        initial={reduce ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="space-y-1 overflow-hidden"
                      >
                        {takes.map((take) => {
                          const isCurrent = take.id === clip.id;
                          // Some alternates have no continuation of their
                          // own, so choosing them honestly shortens the cut
                          // rather than silently doing nothing - surfaced
                          // here so that's never a surprise.
                          const resultingLength = resolveCut(
                            collection.nodes,
                            take.id
                          ).length;
                          return (
                            <button
                              key={take.id}
                              type="button"
                              role="radio"
                              aria-checked={isCurrent}
                              aria-label={`${take.prompt}. ${
                                isCurrent
                                  ? "Currently in the cut."
                                  : `Use this take: cut becomes ${resultingLength} ${
                                      resultingLength === 1 ? "beat" : "beats"
                                    }.`
                              }`}
                              title={take.prompt}
                              onClick={() => setCutTake(collection.id, take.id)}
                              className={`relative block h-10 w-full overflow-hidden rounded-[var(--r-control)] border transition-colors ${
                                isCurrent
                                  ? "border-text"
                                  : "border-border hover:border-border-strong"
                              }`}
                            >
                              <TakeImage
                                node={take}
                                fill
                                sizes="112px"
                                iconSize={11}
                                className="object-cover"
                              />
                              {!isCurrent && (
                                <span className="pointer-events-none absolute bottom-0.5 right-0.5 rounded bg-black/65 px-1 font-mono text-[8px] text-white">
                                  {resultingLength}b
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
