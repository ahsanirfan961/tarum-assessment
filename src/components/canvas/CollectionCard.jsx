"use client";

import { motion, useReducedMotion } from "motion/react";
import { GitBranch, Play } from "@phosphor-icons/react";
import TakeImage from "@/components/media/TakeImage";
import { isRendering } from "@/lib/takes";

/** Deepest chain in the lineage, used to hint that a tree lives inside. */
function lineageDepth(nodes) {
  const childrenOf = new Map();
  for (const n of nodes) {
    const key = n.parentId ?? "__root__";
    childrenOf.set(key, [...(childrenOf.get(key) ?? []), n]);
  }
  const walk = (id) =>
    1 + Math.max(0, ...(childrenOf.get(id) ?? []).map((c) => walk(c.id)));
  return Math.max(0, ...(childrenOf.get("__root__") ?? []).map((n) => walk(n.id)));
}

export default function CollectionCard({ collection, onOpen, index }) {
  const reduce = useReducedMotion();
  const { name, nodes, kind } = collection;
  const cover = nodes[0];
  const depth = lineageDepth(nodes);
  const isVideo = kind === "video";
  const renderingCount = nodes.filter(isRendering).length;

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3), ease: [0.16, 1, 0.3, 1] }}
      /* collection-card: hooks the hover/focus rules in globals.css — the
         neighbour push, and raising this card above its siblings so the fan
         opening below can spill into the grid gap without the next card in
         DOM order painting over it (overflow follows document order, not
         visual bounds). Kept in one place there rather than split with
         Tailwind utilities here, since both rules key off the same trigger. */
      className="collection-card relative"
    >
      <button
        type="button"
        onClick={() => onOpen(collection.id)}
        /* Keeps the visible title inside the accessible name so voice control
           still matches what the user can read on screen. */
        aria-label={`Open ${name} lineage, ${nodes.length} ${
          nodes.length === 1 ? "take" : "takes"
        }${renderingCount ? `, ${renderingCount} rendering` : ""}`}
        className="group w-full text-left"
      >
        {/* A fanned hand of cards: the two behind pivot from the bottom edge
            and splay left/right, the way a held hand of cards fans, with the
            cover straight on top. Rotation alone makes the resting fan — no
            sideways shift — because a rotated card this tall already reaches
            surprisingly far sideways from a bottom pivot (roughly height ×
            sin(angle)); stacking a translate on top of that at rest is what
            was pushing neighbouring cards into each other in the grid. On
            hover the fan opens further (more rotation, a touch of translate)
            like a hand of cards spreading, and the whole stack scales up
            together — the z-10 above is what lets that opening motion cross
            into the gap between cards without vanishing behind the next one. */}
        <div className="relative aspect-[4/5] w-full transition-transform duration-300 ease-out group-hover:scale-[1.04] group-focus-within:scale-[1.04]">
          {nodes.length > 1 && (
            <FannedCard
              node={nodes[1]}
              className="-rotate-[6deg] group-hover:-translate-x-[6%] group-hover:-rotate-[11deg] group-focus-within:-translate-x-[6%] group-focus-within:-rotate-[11deg]"
            />
          )}
          {nodes.length > 2 && (
            <FannedCard
              node={nodes[2]}
              className="rotate-[6deg] group-hover:translate-x-[6%] group-hover:rotate-[11deg] group-focus-within:translate-x-[6%] group-focus-within:rotate-[11deg]"
            />
          )}

          <div className="relative h-full w-full overflow-hidden rounded-[var(--r-panel)] border border-border bg-surface-2 shadow-[var(--shadow-lift)]">
            {/* A collection that starts with a clip still rendering keeps its
                shimmering first take as the cover, rather than an empty box. */}
            {cover && (
              <TakeImage
                node={cover}
                fill
                iconSize={22}
                sizes="(min-width: 1280px) 20vw, (min-width: 768px) 30vw, 45vw"
                className="object-cover"
              />
            )}
            {isVideo && cover && isRendering(cover) && (
              <span className="absolute inset-x-0 bottom-3 text-center text-[11px] font-medium text-text-muted">
                Rendering
              </span>
            )}
            {isVideo && (
              <span
                aria-hidden
                className="absolute left-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm"
              >
                <Play size={12} weight="fill" />
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-1">
          <h3 className="truncate text-[13px] font-semibold tracking-tight transition-colors group-hover:text-accent group-focus-within:text-accent">
            {name}
          </h3>
          <p className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span>
              {nodes.length} {nodes.length === 1 ? "take" : "takes"}
            </span>
            {renderingCount > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>{renderingCount} rendering</span>
              </>
            )}
            {depth > 1 && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <GitBranch size={11} weight="bold" aria-hidden />
                  {depth} deep
                </span>
              </>
            )}
          </p>
        </div>
      </button>
    </motion.li>
  );
}

/** One card in the fan behind the cover. Rotation pivots from the bottom
 *  edge, matching how a real card tilts when held and splayed. */
function FannedCard({ node, className }) {
  return (
    <div
      aria-hidden
      className={`absolute inset-0 origin-bottom overflow-hidden rounded-[var(--r-panel)] border border-border shadow-[var(--shadow-panel)] transition-transform duration-300 ease-out ${className}`}
    >
      <TakeImage
        node={node}
        fill
        iconSize={18}
        sizes="(min-width: 1280px) 20vw, (min-width: 768px) 30vw, 45vw"
        className="object-cover"
      />
    </div>
  );
}
