"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { GitBranch, Play } from "@phosphor-icons/react";

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

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3), ease: [0.16, 1, 0.3, 1] }}
    >
      <button
        type="button"
        onClick={() => onOpen(collection.id)}
        /* Keeps the visible title inside the accessible name so voice control
           still matches what the user can read on screen. */
        aria-label={`Open ${name} lineage, ${nodes.length} ${
          nodes.length === 1 ? "take" : "takes"
        }`}
        className="group w-full text-left"
      >
        <div className="relative aspect-[4/5] w-full">
          {/* Two resting cards behind the cover imply the batch without
              scattering it. They spread a little further on hover. */}
          <span
            aria-hidden
            className="absolute inset-x-3 top-2 h-full rounded-[var(--r-panel)] border border-border bg-surface-2 transition-transform duration-300 ease-out group-hover:-translate-y-1.5 group-hover:rotate-[1.2deg]"
          />
          <span
            aria-hidden
            className="absolute inset-x-1.5 top-1 h-full rounded-[var(--r-panel)] border border-border bg-surface transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:-rotate-[0.8deg]"
          />
          <div className="relative h-full w-full overflow-hidden rounded-[var(--r-panel)] border border-border bg-surface-2 shadow-[var(--shadow-panel)] transition-shadow duration-300 group-hover:shadow-[var(--shadow-lift)]">
            {cover && (
              <Image
                src={cover.url}
                alt=""
                fill
                sizes="(min-width: 1280px) 20vw, (min-width: 768px) 30vw, 45vw"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
              />
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
          <h3 className="truncate text-[13px] font-semibold tracking-tight transition-colors group-hover:text-accent">
            {name}
          </h3>
          <p className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span>
              {nodes.length} {nodes.length === 1 ? "take" : "takes"}
            </span>
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
