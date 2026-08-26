"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Info, X } from "@phosphor-icons/react";
import IconButton from "@/components/ui/IconButton";

/**
 * A short reference for the canvas's own visual language, since neither an
 * edge's line style nor a node's badges are self-explanatory at a glance.
 * Self-contained: manages its own open state, closes on Escape or an
 * outside click, and never touches pan/zoom (it renders as a sibling of the
 * pannable viewport, not inside its transform layer).
 */
export default function CanvasGuide({ isVideo }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} data-no-pan className="relative">
      <IconButton
        label={open ? "Close canvas guide" : "How to read this canvas"}
        size="sm"
        active={open}
        onClick={() => setOpen((v) => !v)}
        className="border border-border bg-surface/95 shadow-[var(--shadow-panel)] backdrop-blur"
      >
        <Info size={15} weight="bold" />
      </IconButton>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="How to read this canvas"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-full z-10 mt-2 w-72 rounded-[var(--r-panel)] border border-border bg-surface p-3 shadow-[var(--shadow-lift)]"
          >
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <h2 className="text-[12px] font-semibold text-text">Reading the canvas</h2>
              <IconButton label="Close" size="sm" onClick={() => setOpen(false)}>
                <X size={13} weight="bold" />
              </IconButton>
            </div>

            <GuideSection title="Edges">
              <GuideRow
                swatch={
                  <svg width={32} height={12} viewBox="0 0 32 12" aria-hidden>
                    <path d="M2 6h28" stroke="var(--border-strong)" strokeWidth={2} />
                  </svg>
                }
                label="New take"
                detail="An alternative for this same moment"
              />
              {isVideo && (
                <GuideRow
                  swatch={
                    <svg width={32} height={12} viewBox="0 0 32 12" aria-hidden>
                      <path d="M2 6h28" stroke="var(--text-muted)" strokeWidth={7} strokeLinecap="round" />
                      <path d="M2 6h28" stroke="var(--bg)" strokeWidth={3} strokeDasharray="3 4" />
                    </svg>
                  }
                  label="Continue"
                  detail="The next moment - advances the cut"
                />
              )}
              <GuideRow
                swatch={
                  <svg width={32} height={12} viewBox="0 0 32 12" aria-hidden>
                    <path
                      d="M2 6h28"
                      stroke="var(--accent)"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      opacity={0.7}
                    />
                  </svg>
                }
                label="Reference"
                detail="Informs a take without being its parent"
              />
            </GuideSection>

            <GuideSection title="Takes">
              <GuideRow
                swatch={
                  <span className="grid h-3 w-3 place-items-center rounded-[3px] border-2 border-accent shadow-[0_0_0_2px_var(--accent)]" />
                }
                label="Selected"
                detail="Click any take to branch from it"
              />
              <GuideRow
                swatch={<span className="h-3 w-3 rounded-[3px] border border-border opacity-30" />}
                label="Dimmed"
                detail="Outside the selected take's branch"
              />
              <GuideRow
                swatch={
                  <span className="rounded-full bg-accent-solid px-1.5 py-0.5 text-[8px] font-semibold tracking-wide text-on-accent-solid">
                    REF
                  </span>
                }
                label="Staged reference"
                detail="Will inform your next generation"
              />
              {isVideo && (
                <>
                  <GuideRow
                    swatch={
                      <span className="rounded bg-black/60 px-1 font-mono text-[8px] font-medium text-white">
                        01
                      </span>
                    }
                    label="Beat"
                    detail="Which moment this take occupies"
                  />
                  <GuideRow
                    swatch={<span className="h-3 w-1 rounded-full bg-text/85" />}
                    label="In the cut"
                    detail="Plays in the compiled video"
                  />
                </>
              )}
            </GuideSection>

            <GuideSection title="Moving around" last>
              <p className="text-[11px] leading-relaxed text-text-muted">
                Drag to pan, scroll to zoom, ⌘/Ctrl-scroll to zoom on the cursor.
              </p>
            </GuideSection>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GuideSection({ title, children, last = false }) {
  return (
    <div className={last ? "" : "mb-3"}>
      <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function GuideRow({ swatch, label, detail }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex w-8 shrink-0 items-center justify-center">{swatch}</span>
      <p className="text-[11px] leading-snug text-text">
        <span className="font-medium">{label}</span>{" "}
        <span className="text-text-muted">— {detail}</span>
      </p>
    </div>
  );
}
