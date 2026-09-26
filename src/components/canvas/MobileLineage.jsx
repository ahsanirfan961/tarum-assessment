"use client";

import { useMemo } from "react";
import {
  ArrowClockwise,
  ArrowsOut,
  CaretRight,
  GitBranch,
  Play,
  Stack,
} from "@phosphor-icons/react";
import { useWorkspace } from "@/lib/store/WorkspaceProvider";
import { formatElapsed, useElapsed } from "@/hooks/useElapsed";
import { ancestorPath } from "@/lib/layout/tidyTree";
import { modelLabel } from "@/lib/models/catalog";
import { isFailed, isReady, isRendering } from "@/lib/takes";
import { beatOf, resolveCut, takesAtBeat } from "@/lib/video/cut";
import IconButton from "@/components/ui/IconButton";
import TakeImage from "@/components/media/TakeImage";

/**
 * Phone rendering of a lineage.
 *
 * A pan-and-zoom node graph is the wrong shape for a thumb, so the same tree is
 * re-cut as one vertical path: where this take came from, what sits beside it,
 * and what came out of it. Nothing is hidden, the geometry just changes.
 *
 * For video, "beside it" splits into two different relations that a single
 * batch can now mix (a regeneration and an extension share a parent, but only
 * one of them advances the beat), so the sibling/children split below is
 * itself beat-aware for video collections. See src/lib/video/cut.js.
 */
export default function MobileLineage({ collection }) {
  const selectedNodeId = useWorkspace((s) => s.selectedNodeId);
  const referenceIds = useWorkspace((s) => s.referenceIds);
  const selectNode = useWorkspace((s) => s.selectNode);
  const toggleReference = useWorkspace((s) => s.toggleReference);
  const openViewer = useWorkspace((s) => s.openViewer);
  const retryNode = useWorkspace((s) => s.retryNode);

  const isVideo = collection.kind === "video";
  const nodes = collection.nodes;
  const roots = nodes.filter((n) => !n.parentId);
  const current = nodes.find((n) => n.id === selectedNodeId) ?? roots[0];

  const cutIds = useMemo(() => {
    if (!isVideo) return new Set();
    return new Set(resolveCut(nodes, collection.cutLeafId).map((n) => n.id));
  }, [isVideo, nodes, collection.cutLeafId]);

  if (!current) return null;

  const ancestorIds = ancestorPath(nodes, current.id).slice(1);
  const ancestors = [...ancestorIds]
    .reverse()
    .map((id) => nodes.find((n) => n.id === id))
    .filter(Boolean);

  // The nearest ancestor at an earlier beat than `current` - the node
  // `takesAtBeat` needs to find every alternate for this exact moment,
  // whether they're `current`'s siblings or its own same-beat children.
  const prevBeatId = isVideo
    ? ancestorIds.find((id) => {
        const a = nodes.find((n) => n.id === id);
        return a && beatOf(a) < beatOf(current);
      }) ?? null
    : null;

  const rawChildren = nodes.filter((n) => n.parentId === current.id);

  const thisMoment = isVideo
    ? takesAtBeat(nodes, prevBeatId, beatOf(current)).filter((n) => n.id !== current.id)
    : nodes.filter((n) => n.parentId === current.parentId && n.id !== current.id);

  const nextUp = isVideo
    ? rawChildren.filter((c) => beatOf(c) > beatOf(current))
    : rawChildren;

  const isReference = referenceIds.includes(current.id);
  const inCut = isVideo && cutIds.has(current.id);

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
                  <TakeImage
                    node={node}
                    width={36}
                    height={36}
                    iconSize={12}
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
          <TakeImage
            node={current}
            fill
            sizes="100vw"
            priority
            iconSize={28}
            className="object-cover"
          />
          <TakeStatus node={current} onRetry={retryNode} />
          {isVideo && (
            <span
              className={`pointer-events-none absolute left-2.5 top-2.5 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium backdrop-blur-sm ${
                inCut ? "bg-surface text-text" : "bg-black/60 text-white"
              }`}
            >
              {String(beatOf(current)).padStart(2, "0")}
              {inCut ? " · in cut" : ""}
            </span>
          )}
          {current.durationSeconds && (
            <span className="pointer-events-none absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
              <Play size={10} weight="fill" aria-hidden />
              {current.durationSeconds}s
            </span>
          )}
          {isReady(current) && (
            <IconButton
              label="Open full size"
              onClick={() => openViewer(current.id)}
              className="absolute right-2.5 top-2.5 bg-black/60 text-white hover:bg-black/75 hover:text-white"
            >
              <ArrowsOut size={16} />
            </IconButton>
          )}
        </div>
        <div className="space-y-2.5 p-3">
          <p className="text-[12px] leading-relaxed text-text">{current.prompt}</p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-text-muted">{modelLabel(current.model)}</span>
            <button
              type="button"
              onClick={() => toggleReference(current.id)}
              disabled={!isReady(current)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-40 ${
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
        title={
          thisMoment.length
            ? isVideo
              ? "Other takes of this moment"
              : "Other takes from this prompt"
            : null
        }
        nodes={thisMoment}
        onSelect={selectNode}
      />

      <NodeRow
        title={
          nextUp.length ? (isVideo ? "What happens next" : "Variants from this take") : null
        }
        nodes={nextUp}
        onSelect={selectNode}
        icon
      />

      {!nextUp.length && (
        <p className="mt-5 flex items-start gap-2 rounded-[var(--r-panel)] border border-dashed border-border p-3 text-[12px] leading-relaxed text-text-muted">
          <GitBranch size={14} aria-hidden className="mt-0.5 shrink-0" />
          {isVideo
            ? "Nothing follows this take yet. Describe what happens next in the composer."
            : "This is the end of the branch. Describe a change in the composer to generate variants from it."}
        </p>
      )}
    </div>
  );
}

/** Over the big preview: how long a take has rendered, or why it failed. */
function TakeStatus({ node, onRetry }) {
  const elapsed = useElapsed(isRendering(node) ? node.submittedAt : null);
  if (isRendering(node)) {
    return (
      <p className="absolute inset-x-0 bottom-10 text-center text-[12px] font-medium text-text-muted">
        {node.status === "finalizing" ? "Saving" : "Rendering"}
        <span className="ml-1.5 font-mono tabular-nums">{formatElapsed(elapsed)}</span>
      </p>
    );
  }
  if (!isFailed(node)) return null;
  return (
    <div className="absolute inset-x-4 bottom-4 flex flex-col items-center gap-2 text-center">
      <p className="text-[12px] leading-relaxed text-text-muted">
        <span className="font-semibold text-text">Failed. </span>
        {node.error ?? "The model couldn't render this take."}
      </p>
      <button
        type="button"
        onClick={() => onRetry(node.id)}
        className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[12px] font-semibold text-text shadow-[var(--shadow-panel)]"
      >
        <ArrowClockwise size={13} weight="bold" aria-hidden />
        Retry
      </button>
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
              <TakeImage
                node={node}
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
