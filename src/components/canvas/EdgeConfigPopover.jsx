"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { X } from "@phosphor-icons/react";

const TOOLTIP_EXCERPT = 72;
const POPOVER_EXCERPT = 180;

const QUALITY_LABEL = {
  draft: "Draft, fastest",
  standard: "Standard",
  refined: "Refined, slowest",
};

/**
 * The floating widget on a lineage edge: a compact prompt preview that
 * expands, in place, into the full generation config on click.
 *
 * Both states render inside one component (rather than swapping a tooltip
 * for a separate popover) so clicking reads as that same card growing, not
 * one thing closing and a different thing opening in its spot.
 *
 * Tagged data-no-pan: this sits inside the pannable canvas layer, and without
 * opting out, a click here would first be caught by the canvas's own drag
 * handling — which calls setPointerCapture on pointerdown — and the button's
 * click would never arrive.
 */
export default function EdgeConfigPopover({
  node,
  position,
  width,
  inverseScale,
  expanded,
  onExpand,
  onClose,
  onPointerEnter,
  onPointerLeave,
}) {
  const reduce = useReducedMotion();
  const [showFull, setShowFull] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!expanded) return;
    panelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded, onClose]);

  const isLong = node.prompt.length > POPOVER_EXCERPT;
  const shownPrompt =
    showFull || !isLong ? node.prompt : `${node.prompt.slice(0, POPOVER_EXCERPT).trimEnd()}…`;

  const rows = [
    { label: "Model", value: node.model },
    { label: "Quality", value: QUALITY_LABEL[node.quality] ?? node.quality },
    { label: "Resolution", value: node.resolution },
    { label: "Aspect ratio", value: node.aspectRatio },
    ...(node.durationSeconds ? [{ label: "Duration", value: `${node.durationSeconds}s` }] : []),
  ].filter((row) => row.value);

  return (
    <motion.div
      data-no-pan
      style={{ position: "absolute", left: position.x, top: position.y, width, scale: inverseScale }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className="-translate-x-1/2 -translate-y-full pb-3"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {expanded ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Generation config"
          tabIndex={-1}
          className="w-full rounded-[var(--r-panel)] border border-accent/40 bg-surface p-3 text-left shadow-[var(--shadow-lift)] outline-none"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-text">
              {shownPrompt}{" "}
              {isLong && (
                <button
                  type="button"
                  onClick={() => setShowFull((v) => !v)}
                  className="font-semibold text-accent hover:underline"
                >
                  {showFull ? "Show less" : "Show more"}
                </button>
              )}
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close config"
              title="Close config"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              <X size={13} weight="bold" />
            </button>
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border pt-2.5">
            {rows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-2">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  {row.label}
                </dt>
                <dd className="truncate text-[12px] font-medium text-text">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <button
          type="button"
          onClick={onExpand}
          className="block w-full rounded-[var(--r-control)] border border-border bg-surface px-2.5 py-1.5 text-left shadow-[var(--shadow-lift)] transition-colors hover:border-accent"
        >
          <p className="text-[11px] leading-snug text-text">
            {node.prompt.length > TOOLTIP_EXCERPT
              ? `${node.prompt.slice(0, TOOLTIP_EXCERPT).trimEnd()}…`
              : node.prompt}
          </p>
          <p className="mt-1 text-[10px] font-semibold text-accent">Click to view full config</p>
        </button>
      )}
    </motion.div>
  );
}
