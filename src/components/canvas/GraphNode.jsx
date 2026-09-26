"use client";

import Image from "next/image";
import { memo } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowClockwise,
  ArrowsOut,
  FilmSlate,
  Play,
  Stack,
  WarningCircle,
} from "@phosphor-icons/react";
import { formatElapsed, useElapsed } from "@/hooks/useElapsed";
import { NODE_H, NODE_W } from "@/lib/layout/tidyTree";
import { modelLabel } from "@/lib/models/catalog";
import { isFailed, isRendering } from "@/lib/takes";

/**
 * One take in the lineage.
 *
 * Click selects it, which makes it the branch parent and loads its prompt into
 * the composer. The stack button stages it as a reference instead, which is the
 * only action that may reach across collections.
 *
 * A video take whose job is still rendering is a real node from the moment
 * it's submitted: it sits at its beat, can be branched from with "New take",
 * and can hold a place in the cut. It just has nothing to show or reference
 * yet. A failed take shows why, and offers Retry.
 */
function GraphNode({
  node,
  selected,
  dimmed,
  isReference,
  inCut,
  onSelect,
  onToggleReference,
  onUseTake,
  onPlayCut,
  onOpenViewer,
  onRetry,
  onFocusChange,
  index,
}) {
  const reduce = useReducedMotion();
  const hasBeat = typeof node.beat === "number";
  const rendering = isRendering(node);
  const failed = isFailed(node);
  const ready = !rendering && !failed;

  // Mouse users can click through the edge tooltip to a config popover for
  // this same detail; that popover isn't reachable by keyboard, so the node's
  // own accessible name carries the full config instead, not just the prompt.
  const configSummary = [modelLabel(node.model), node.quality, node.resolution]
    .filter(Boolean)
    .join(" · ");

  // The beat pill is otherwise invisible to a screen reader, and "in the
  // cut" has no other affordance a keyboard user would encounter.
  const accessibleName = `${hasBeat ? `Beat ${node.beat}. ` : ""}${
    rendering ? "Still rendering. " : failed ? `Failed: ${(node.error ?? "unknown error").replace(/\.$/, "")}. ` : ""
  }Take from prompt: ${node.prompt}. ${configSummary}.${inCut ? " In the current cut." : ""}`;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.34,
        delay: reduce ? 0 : Math.min(index * 0.025, 0.35),
        ease: [0.16, 1, 0.3, 1],
      }}
      style={{
        position: "absolute",
        left: node.x - NODE_W / 2,
        top: node.y,
        width: NODE_W,
        height: NODE_H,
      }}
      className="group"
    >
      {/* Motion owns the entrance opacity on the element above. Focus dimming
          is a lasting state rather than an entrance, so it lives on this inner
          layer where the two never fight over the same property. */}
      <div
        className={`h-full w-full transition-opacity duration-300 ${
          dimmed ? "opacity-30" : "opacity-100"
        }`}
      >
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          aria-pressed={selected}
          aria-label={accessibleName}
          title={`${node.prompt}\n\n${configSummary}`}
          className={`relative block h-full w-full overflow-hidden rounded-[var(--r-panel)] border bg-surface-2 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 ${
            selected
              ? "border-accent shadow-[var(--shadow-lift),0_0_0_2px_var(--accent)]"
              : "border-border shadow-[var(--shadow-panel)] hover:border-border-strong"
          }`}
        >
          {ready ? (
            <Image
              src={node.url}
              alt=""
              fill
              sizes="176px"
              className="object-cover"
              draggable={false}
            />
          ) : rendering ? (
            <RenderingFace node={node} />
          ) : (
            <FailedFace node={node} />
          )}

          {/* In-cut state owns the tile's left edge, kept clear of every
              other badge corner (duration bottom-left, REF top-right, beat
              top-left) and never accent, which is reserved for selection and
              references. */}
          {inCut && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 flex w-1 flex-col"
            >
              <span className="flex-1 bg-text/85" />
              <span className="h-1.5 bg-surface-2" />
              <span className="flex-1 bg-text/85" />
              <span className="h-1.5 bg-surface-2" />
              <span className="flex-1 bg-text/85" />
            </span>
          )}

          {hasBeat && (
            <span
              className={`pointer-events-none absolute left-2 top-2 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium backdrop-blur-sm transition-colors ${
                inCut ? "bg-surface text-text" : "bg-black/60 text-white"
              }`}
            >
              {String(node.beat).padStart(2, "0")}
            </span>
          )}

          {node.durationSeconds && (
            <span className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
              <Play size={8} weight="fill" aria-hidden />
              {node.durationSeconds}s
            </span>
          )}

          {isReference && ready && (
            <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-accent-solid px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-on-accent-solid">
              REF
            </span>
          )}
        </button>

        {/* Retry sits outside the tile's own button (buttons can't nest), and
            stays visible: a failed take has nothing else to offer. */}
        {failed && onRetry && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRetry(node.id);
            }}
            className="absolute bottom-2 left-1/2 flex h-7 -translate-x-1/2 items-center gap-1.5 rounded-md bg-surface px-2.5 text-[11px] font-semibold text-text shadow-[var(--shadow-panel)] transition-colors hover:bg-accent-tint hover:text-accent"
          >
            <ArrowClockwise size={12} weight="bold" aria-hidden />
            Retry
          </button>
        )}

        <div className="pointer-events-none absolute bottom-2 right-2 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
          {/* Nothing to reference or open full size until it has a picture. */}
          {ready && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleReference(node.id);
              }}
              aria-label={isReference ? "Remove as reference" : "Use as reference"}
              title={isReference ? "Remove as reference" : "Use as reference"}
              className="grid h-7 w-7 place-items-center rounded-md bg-surface/95 text-text shadow-[var(--shadow-panel)] backdrop-blur-sm transition-colors hover:bg-surface"
            >
              <Stack size={13} weight={isReference ? "fill" : "regular"} />
            </button>
          )}

          {onUseTake && !failed && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUseTake(node.id);
              }}
              disabled={inCut}
              aria-pressed={inCut}
              aria-label={inCut ? "Already in the cut" : "Use this take in the cut"}
              title={inCut ? "Already in the cut" : "Use this take in the cut"}
              className={`grid h-7 w-7 place-items-center rounded-md shadow-[var(--shadow-panel)] backdrop-blur-sm transition-colors disabled:cursor-default ${
                inCut
                  ? "bg-text text-surface"
                  : "bg-surface/95 text-text hover:bg-surface"
              }`}
            >
              <FilmSlate size={13} weight={inCut ? "fill" : "regular"} />
            </button>
          )}

          {onPlayCut && !failed && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPlayCut(node.id);
              }}
              aria-label="Play the cut to this take"
              title="Play the cut to this take"
              className="grid h-7 w-7 place-items-center rounded-md bg-surface/95 text-text shadow-[var(--shadow-panel)] backdrop-blur-sm transition-colors hover:bg-surface"
            >
              <Play size={13} weight="fill" />
            </button>
          )}

          {ready && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenViewer(node.id);
              }}
              aria-label="Open full size"
              title="Open full size"
              className="grid h-7 w-7 place-items-center rounded-md bg-surface/95 text-text shadow-[var(--shadow-panel)] backdrop-blur-sm transition-colors hover:bg-surface"
            >
              <ArrowsOut size={13} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/** No picture yet: an empty frame with a slow sweep, and how long it's been. */
function RenderingFace({ node }) {
  const elapsed = useElapsed(node.submittedAt);
  return (
    <span className="take-rendering absolute inset-0 flex flex-col items-center justify-center gap-1">
      <span className="text-[11px] font-medium text-text-muted">
        {node.status === "finalizing" ? "Saving" : "Rendering"}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-text-muted" aria-hidden>
        {formatElapsed(elapsed)}
      </span>
    </span>
  );
}

/** Why the job failed, above the Retry button that sits over this face. */
function FailedFace({ node }) {
  return (
    <span className="absolute inset-0 flex flex-col items-center gap-1 bg-surface-2 px-3 pb-11 pt-7 text-center">
      <span className="flex items-center gap-1 text-[11px] font-semibold text-text">
        <WarningCircle size={12} weight="bold" aria-hidden className="text-accent-solid" />
        Failed
      </span>
      <span className="line-clamp-3 text-[10px] leading-snug text-text-muted">
        {node.error ?? "The model couldn't render this take."}
      </span>
    </span>
  );
}

export default memo(GraphNode);
