"use client";

import Image from "next/image";
import { memo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowsOut, FilmSlate, Play, Stack } from "@phosphor-icons/react";
import { NODE_H, NODE_W } from "@/lib/layout/tidyTree";
import { modelLabel } from "@/lib/models/catalog";

/**
 * One take in the lineage.
 *
 * Click selects it, which makes it the branch parent and loads its prompt into
 * the composer. The stack button stages it as a reference instead, which is the
 * only action that may reach across collections.
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
  onFocusChange,
  index,
}) {
  const reduce = useReducedMotion();
  const hasBeat = typeof node.beat === "number";

  // Mouse users can click through the edge tooltip to a config popover for
  // this same detail; that popover isn't reachable by keyboard, so the node's
  // own accessible name carries the full config instead, not just the prompt.
  const configSummary = [modelLabel(node.model), node.quality, node.resolution]
    .filter(Boolean)
    .join(" · ");

  // The beat pill is otherwise invisible to a screen reader, and "in the
  // cut" has no other affordance a keyboard user would encounter.
  const accessibleName = `${hasBeat ? `Beat ${node.beat}. ` : ""}Take from prompt: ${
    node.prompt
  }. ${configSummary}.${inCut ? " In the current cut." : ""}`;

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
          <Image
            src={node.url}
            alt=""
            fill
            sizes="176px"
            className="object-cover"
            draggable={false}
          />

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

          {isReference && (
            <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-accent-solid px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-on-accent-solid">
              REF
            </span>
          )}
        </button>

        <div className="pointer-events-none absolute bottom-2 right-2 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
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

          {onUseTake && (
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

          {onPlayCut && (
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
        </div>
      </div>
    </motion.div>
  );
}

export default memo(GraphNode);
