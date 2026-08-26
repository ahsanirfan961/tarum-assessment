"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Sparkle, X } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { useGuideSeen } from "@/hooks/useGuideSeen";
import { markGuideSeen } from "@/lib/guide";
import { guideSlides } from "./guideContent";

/**
 * First-run walkthrough for a workspace.
 *
 * Opens by itself the first time someone lands on the image or video
 * workspace, and stays reopenable from the top bar afterwards. The two
 * workspaces track "seen" separately, because the video one teaches two extra
 * ideas — continuing a clip, and the cut — that the image one has no
 * equivalent for.
 */
export default function UsageGuide({ kind, manualOpen, onClose }) {
  const seen = useGuideSeen(kind);
  const open = manualOpen || !seen;

  const close = useCallback(() => {
    markGuideSeen(kind);
    onClose();
  }, [kind, onClose]);

  return (
    <AnimatePresence>
      {open && <GuidePanel key={`${kind}-guide`} kind={kind} onClose={close} />}
    </AnimatePresence>
  );
}

/**
 * The panel itself. Split out so that slide position is owned by a component
 * that only exists while the guide is open — reopening it mounts a fresh one
 * at slide zero, with no reset to coordinate.
 */
function GuidePanel({ kind, onClose }) {
  const slides = useMemo(() => guideSlides(kind), [kind]);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const reduce = useReducedMotion();
  const panelRef = useRef(null);

  const isLast = index === slides.length - 1;

  const go = useCallback(
    (next) => {
      if (next < 0 || next >= slides.length) return;
      setDirection(next > index ? 1 : -1);
      setIndex(next);
    },
    [index, slides.length]
  );

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        go(index + 1);
      } else if (e.key === "ArrowLeft") {
        go(index - 1);
      } else if (e.key === "Tab") {
        // Onboarding covers the whole workspace, so focus is kept inside it
        // rather than letting Tab wander into the canvas behind.
        const focusables = panelRef.current?.querySelectorAll(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables?.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, go, onClose]);

  const slide = slides[index];

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <motion.button
        type="button"
        aria-label="Close guide"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/55"
      />

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="usage-guide-title"
        tabIndex={-1}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md overflow-hidden rounded-[var(--r-panel)] border border-border bg-surface shadow-[var(--shadow-lift)] focus-visible:outline-none"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-text-muted">
            <Sparkle size={12} weight="fill" aria-hidden className="text-accent" />
            {kind === "video" ? "VIDEO WORKSPACE" : "IMAGE WORKSPACE"}
          </p>
          <IconButton label="Close guide" size="sm" onClick={onClose}>
            <X size={14} weight="bold" />
          </IconButton>
        </div>

        <div className="px-4 pb-1 pt-4">
          {/* The outgoing and incoming illustrations overlap rather than
              queueing (no mode="wait"), so the art changes in step with the
              heading below instead of trailing a full exit behind it. That
              needs them stacked, hence the fixed-ratio box. */}
          <div className="relative mb-4 aspect-[280/130] overflow-hidden rounded-[var(--r-control)] border border-border bg-bg p-3">
            <AnimatePresence initial={false}>
              <motion.div
                key={index}
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: direction * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: direction * -24 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 grid place-items-center p-3"
              >
                {slide.art}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* aria-live so the copy is announced on slide change: the heading
              never takes focus, so a screen reader would otherwise sit
              silent after Next. */}
          <div aria-live="polite" className="min-h-[92px]">
            <h2
              id="usage-guide-title"
              className="text-[15px] font-semibold tracking-tight text-text"
            >
              {slide.title}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
              {slide.body}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 pb-4 pt-2">
          <ol className="flex items-center gap-1.5" aria-label="Progress">
            {slides.map((s, i) => (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Step ${i + 1} of ${slides.length}: ${s.title}`}
                  aria-current={i === index ? "step" : undefined}
                  className={`block h-1.5 rounded-full transition-all duration-200 ${
                    i === index
                      ? "w-5 bg-accent-solid"
                      : "w-1.5 bg-border-strong hover:bg-text-muted"
                  }`}
                />
              </li>
            ))}
          </ol>

          <div className="flex items-center gap-1.5">
            {index > 0 && (
              <Button size="sm" variant="ghost" onClick={() => go(index - 1)}>
                <ArrowLeft size={13} weight="bold" aria-hidden />
                Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" variant="primary" onClick={onClose}>
                Start creating
              </Button>
            ) : (
              <Button size="sm" variant="primary" onClick={() => go(index + 1)}>
                Next
                <ArrowRight size={13} weight="bold" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
