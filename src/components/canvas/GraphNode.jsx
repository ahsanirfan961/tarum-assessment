"use client";

import Image from "next/image";
import { memo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { FilmSlate, Play, Stack } from "@phosphor-icons/react";
import { NODE_H, NODE_W } from "@/lib/layout/tidyTree";

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
  inAssembly,
  onSelect,
  onToggleReference,
  onToggleAssembly,
  index,
}) {
  const reduce = useReducedMotion();

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
          aria-pressed={selected}
          aria-label={`Take from prompt: ${node.prompt}`}
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

          {onToggleAssembly && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleAssembly(node.id);
              }}
              aria-label={inAssembly ? "Remove from the cut" : "Add to the cut"}
              title={inAssembly ? "Remove from the cut" : "Add to the cut"}
              className={`grid h-7 w-7 place-items-center rounded-md shadow-[var(--shadow-panel)] backdrop-blur-sm transition-colors ${
                inAssembly
                  ? "bg-accent-solid text-on-accent-solid"
                  : "bg-surface/95 text-text hover:bg-surface"
              }`}
            >
              <FilmSlate size={13} weight={inAssembly ? "fill" : "regular"} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default memo(GraphNode);
