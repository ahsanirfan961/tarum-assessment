"use client";

import Image from "next/image";
import { ArrowsOut, CaretRight, GitBranch, Play, Stack } from "@phosphor-icons/react";
import { useWorkspace } from "@/lib/store/WorkspaceProvider";
import { ancestorPath } from "@/lib/layout/tidyTree";
import IconButton from "@/components/ui/IconButton";

/**
 * Phone rendering of a lineage.
 *
 * A pan-and-zoom node graph is the wrong shape for a thumb, so the same tree is
 * re-cut as one vertical path: where this take came from, what sits beside it,
 * and what came out of it. Nothing is hidden, the geometry just changes.
 */
export default function MobileLineage({ collection }) {
  const selectedNodeId = useWorkspace((s) => s.selectedNodeId);
  const referenceIds = useWorkspace((s) => s.referenceIds);
  const selectNode = useWorkspace((s) => s.selectNode);
  const toggleReference = useWorkspace((s) => s.toggleReference);
  const openViewer = useWorkspace((s) => s.openViewer);

  const nodes = collection.nodes;
  const roots = nodes.filter((n) => !n.parentId);
  const current = nodes.find((n) => n.id === selectedNodeId) ?? roots[0];
  if (!current) return null;

  const ancestors = ancestorPath(nodes, current.id)
    .slice(1)
    .reverse()
    .map((id) => nodes.find((n) => n.id === id))
    .filter(Boolean);

  const siblings = nodes.filter(
    (n) => n.parentId === current.parentId && n.id !== current.id
  );
  const children = nodes.filter((n) => n.parentId === current.id);
  const isReference = referenceIds.includes(current.id);

  return (
    <div className="h-full overflow-y-auto p-4">
      {ancestors.length > 0 && (
        <nav aria-label="Lineage" className="mb-4">
          <ol className="flex flex-wrap items-center gap-1.5">
            {ancestors.map((node) => (
              <li key={node.id} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => selectNode(node.id)}
                  aria-label="Go to earlier take"
                  title="Go to earlier take"
                  className="block h-9 w-9 overflow-hidden rounded-md border border-border"
                >
                  <Image
                    src={node.url}
                    alt=""
                    width={36}
                    height={36}
                    className="h-full w-full object-cover"
                  />
                </button>
                <CaretRight size={11} weight="bold" aria-hidden className="text-text-muted" />
              </li>
            ))}
            <li aria-current="step" className="text-[11px] font-medium text-accent">
              This take
            </li>
          </ol>
        </nav>
      )}

      <div className="overflow-hidden rounded-[var(--r-panel)] border border-accent bg-surface-2">
        <div className="relative aspect-square w-full">
          <Image
            src={current.url}
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
          {current.durationSeconds && (
            <span className="pointer-events-none absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
              <Play size={10} weight="fill" aria-hidden />
              {current.durationSeconds}s
            </span>
          )}
          <IconButton
            label="Open full size"
            onClick={() => openViewer(current.id)}
            className="absolute right-2.5 top-2.5 bg-black/60 text-white hover:bg-black/75 hover:text-white"
          >
            <ArrowsOut size={16} />
          </IconButton>
        </div>
        <div className="space-y-2.5 p-3">
          <p className="text-[12px] leading-relaxed text-text">{current.prompt}</p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-text-muted">{current.model}</span>
            <button
              type="button"
              onClick={() => toggleReference(current.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                isReference
                  ? "border-accent bg-accent-tint text-accent"
                  : "border-border text-text-muted"
              }`}
            >
              <Stack size={12} weight={isReference ? "fill" : "regular"} aria-hidden />
              {isReference ? "Referenced" : "Reference"}
            </button>
          </div>
        </div>
      </div>

      <NodeRow
        title={siblings.length ? "Other takes from this prompt" : null}
        nodes={siblings}
        onSelect={selectNode}
      />

      <NodeRow
        title={children.length ? "Variants from this take" : null}
        nodes={children}
        onSelect={selectNode}
        icon
      />

      {!children.length && (
        <p className="mt-5 flex items-start gap-2 rounded-[var(--r-panel)] border border-dashed border-border p-3 text-[12px] leading-relaxed text-text-muted">
          <GitBranch size={14} aria-hidden className="mt-0.5 shrink-0" />
          This is the end of the branch. Describe a change in the composer to
          generate variants from it.
        </p>
      )}
    </div>
  );
}

function NodeRow({ title, nodes, onSelect, icon = false }) {
  if (!title || !nodes.length) return null;
  return (
    <section className="mt-5">
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-text-muted">
        {icon && <GitBranch size={12} weight="bold" aria-hidden />}
        {title}
      </h3>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1">
        {nodes.map((node) => (
          <li key={node.id} className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => onSelect(node.id)}
              aria-label={`Take from prompt: ${node.prompt}`}
              title={node.prompt}
              className="block h-24 w-24 overflow-hidden rounded-[var(--r-control)] border border-border transition-colors active:border-accent"
            >
              <Image
                src={node.url}
                alt=""
                width={96}
                height={96}
                className="h-full w-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
