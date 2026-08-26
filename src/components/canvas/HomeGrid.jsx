"use client";

import { Images } from "@phosphor-icons/react";
import { useWorkspace } from "@/lib/store/WorkspaceProvider";
import CollectionCard from "./CollectionCard";

/**
 * Everything made in this project, in one grid.
 *
 * Deliberately a grid and not a free canvas: auto-layout means nothing to tidy,
 * it collapses cleanly on small screens, and it makes entering a lineage feel
 * like a real change of gear.
 */
export default function HomeGrid({ filter = "" }) {
  const collections = useWorkspace((s) => s.collections);
  const openCollection = useWorkspace((s) => s.openCollection);
  const isGenerating = useWorkspace((s) => s.isGenerating);

  const query = filter.trim().toLowerCase();
  const visible = query
    ? collections.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.nodes.some((n) => n.prompt.toLowerCase().includes(query))
      )
    : collections;

  if (!collections.length && !isGenerating) {
    return <EmptyState />;
  }

  if (!visible.length) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <p className="text-[13px] text-text-muted">
          Nothing in this project matches{" "}
          <span className="font-medium text-text">{filter}</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <ul className="grid grid-cols-2 gap-x-6 gap-y-10 p-4 sm:grid-cols-3 sm:gap-x-8 sm:p-6 lg:grid-cols-4 2xl:grid-cols-5">
        {isGenerating && <PendingCard />}
        {visible.map((collection, i) => (
          <CollectionCard
            key={collection.id}
            collection={collection}
            index={i}
            onOpen={openCollection}
          />
        ))}
      </ul>
    </div>
  );
}

function PendingCard() {
  return (
    <li aria-live="polite" aria-label="Generating a new collection">
      <div className="aspect-[4/5] w-full animate-pulse rounded-[var(--r-panel)] border border-border bg-surface-2" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-2/3 animate-pulse rounded bg-surface-2" />
        <div className="h-2.5 w-1/3 animate-pulse rounded bg-surface-2" />
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="max-w-xs text-center">
        <span
          aria-hidden
          className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-text-muted"
        >
          <Images size={22} />
        </span>
        <h2 className="text-[15px] font-semibold tracking-tight">
          This project is empty
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
          Describe a frame in the composer. Your first batch becomes a collection
          you can branch from.
        </p>
      </div>
    </div>
  );
}
