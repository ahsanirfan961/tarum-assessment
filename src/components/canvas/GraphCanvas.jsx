"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import {
  ArrowsInSimple,
  GitBranch,
  Minus,
  Plus,
} from "@phosphor-icons/react";
import { useWorkspace } from "@/lib/store/WorkspaceProvider";
import { usePanZoom } from "@/hooks/usePanZoom";
import { ancestorPath, layoutLineage, NODE_H, NODE_W } from "@/lib/layout/tidyTree";
import IconButton from "@/components/ui/IconButton";
import GraphNode from "./GraphNode";

/**
 * The lineage canvas.
 *
 * Solid edges are structural: every take has exactly one parent, which is what
 * the tidy-tree layout is built from. Dashed edges are references, drawn only
 * while a node is selected so the canvas never turns into spaghetti.
 */
export default function GraphCanvas({ collection }) {
  const selectedNodeId = useWorkspace((s) => s.selectedNodeId);
  const hoveredEdgeId = useWorkspace((s) => s.hoveredEdgeId);
  const referenceIds = useWorkspace((s) => s.referenceIds);
  const selectNode = useWorkspace((s) => s.selectNode);
  const setHoveredEdge = useWorkspace((s) => s.setHoveredEdge);
  const toggleReference = useWorkspace((s) => s.toggleReference);
  const toggleInAssembly = useWorkspace((s) => s.toggleInAssembly);

  const isVideo = collection.kind === "video";
  const assembly = collection.assembly ?? [];

  const { nodes, edges, width, height } = useMemo(
    () => layoutLineage(collection.nodes),
    [collection.nodes]
  );

  const { viewportRef, x, y, scale, fit, zoomIn, zoomOut, handlers } = usePanZoom({
    contentWidth: width,
    contentHeight: height,
  });

  // Focus mode: with a node selected, keep its ancestors, itself and its direct
  // children lit, and drop everything else back. This is what keeps a tree
  // readable once it is three or four generations deep.
  const focus = useMemo(() => {
    if (!selectedNodeId) return null;
    const path = new Set(ancestorPath(collection.nodes, selectedNodeId));
    for (const n of collection.nodes) {
      if (n.parentId === selectedNodeId) path.add(n.id);
    }
    return path;
  }, [collection.nodes, selectedNodeId]);

  const positionById = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes]
  );

  // Reference edges for the selected node, split by whether the target is on
  // this canvas at all.
  const { localRefEdges, offCanvasRefCount } = useMemo(() => {
    if (!selectedNodeId) return { localRefEdges: [], offCanvasRefCount: 0 };
    const selected = collection.nodes.find((n) => n.id === selectedNodeId);
    if (!selected?.referenceIds?.length) {
      return { localRefEdges: [], offCanvasRefCount: 0 };
    }

    const target = positionById.get(selectedNodeId);
    const local = [];
    let offCanvas = 0;

    for (const refId of selected.referenceIds) {
      const source = positionById.get(refId);
      if (!source || !target) {
        offCanvas += 1;
        continue;
      }
      const from = { x: source.x, y: source.y + NODE_H / 2 };
      const to = { x: target.x, y: target.y + NODE_H / 2 };
      local.push({
        id: `ref-${refId}-${selectedNodeId}`,
        path: `M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${
          Math.min(from.y, to.y) - 80
        }, ${to.x} ${to.y}`,
      });
    }

    return { localRefEdges: local, offCanvasRefCount: offCanvas };
  }, [collection.nodes, selectedNodeId, positionById]);

  const hoveredEdge = edges.find((e) => e.id === hoveredEdgeId) ?? null;

  // Lets keyboard focus trigger the same edge tooltip pointer hover does, so
  // tabbing through the tree reveals each prompt without needing a mouse.
  const edgeIdByChild = useMemo(
    () => new Map(edges.map((e) => [e.childId, e.id])),
    [edges]
  );

  const litEdges = useMemo(() => {
    if (!focus) return new Set();
    return new Set(
      edges.filter((e) => focus.has(e.childId) && focus.has(e.parentId)).map((e) => e.id)
    );
  }, [edges, focus]);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        ref={viewportRef}
        {...handlers}
        className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
      >
        <motion.div
          style={{ x, y, scale, width, height, transformOrigin: "0 0" }}
          className="relative"
        >
          <svg
            width={width}
            height={height}
            className="pointer-events-none absolute inset-0 overflow-visible"
            aria-hidden
          >
            {edges.map((edge) => {
              const lit = litEdges.has(edge.id);
              const hovered = hoveredEdgeId === edge.id;
              return (
                <g key={edge.id}>
                  <path
                    d={edge.path}
                    fill="none"
                    stroke={lit || hovered ? "var(--accent)" : "var(--border-strong)"}
                    strokeWidth={lit || hovered ? 2 : 1.5}
                    className="transition-[stroke,stroke-width] duration-200"
                  />
                  <path
                    d={edge.path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={22}
                    className="pointer-events-auto cursor-help"
                    onPointerEnter={() => setHoveredEdge(edge.id)}
                    onPointerLeave={() => setHoveredEdge(null)}
                  />
                </g>
              );
            })}

            {localRefEdges.map((edge) => (
              <path
                key={edge.id}
                d={edge.path}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                opacity={0.7}
              />
            ))}
          </svg>

          {nodes.map((node, i) => (
            <div key={node.id} data-graph-node>
              <GraphNode
                node={node}
                index={i}
                selected={selectedNodeId === node.id}
                dimmed={Boolean(focus) && !focus.has(node.id)}
                isReference={referenceIds.includes(node.id)}
                inAssembly={isVideo && assembly.includes(node.id)}
                onSelect={selectNode}
                onToggleReference={toggleReference}
                onToggleAssembly={
                  isVideo ? (id) => toggleInAssembly(collection.id, id) : undefined
                }
                onFocusChange={(focused) =>
                  setHoveredEdge(focused ? edgeIdByChild.get(node.id) ?? null : null)
                }
              />
            </div>
          ))}

          {/* The prompt that produced the child, shown on its incoming edge. */}
          {hoveredEdge && (
            <div
              style={{
                position: "absolute",
                left: hoveredEdge.label.x,
                top: hoveredEdge.label.y,
                width: NODE_W + 88,
              }}
              className="pointer-events-none -translate-x-1/2 -translate-y-1/2"
            >
              <p className="rounded-[var(--r-control)] border border-border bg-surface px-2.5 py-1.5 text-[11px] leading-snug text-text shadow-[var(--shadow-lift)]">
                {hoveredEdge.prompt}
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {offCanvasRefCount > 0 && (
        <p className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-border bg-surface/90 px-2.5 py-1 text-[11px] font-medium text-text-muted backdrop-blur">
          <GitBranch size={12} weight="bold" aria-hidden className="text-accent" />
          {offCanvasRefCount} reference{offCanvasRefCount > 1 ? "s" : ""} from another
          collection
        </p>
      )}

      <div className="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-[var(--r-panel)] border border-border bg-surface/95 p-1 shadow-[var(--shadow-panel)] backdrop-blur">
        <IconButton label="Zoom out" size="sm" onClick={zoomOut}>
          <Minus size={14} weight="bold" />
        </IconButton>
        <IconButton label="Zoom in" size="sm" onClick={zoomIn}>
          <Plus size={14} weight="bold" />
        </IconButton>
        <IconButton label="Fit lineage to screen" size="sm" onClick={fit}>
          <ArrowsInSimple size={14} weight="bold" />
        </IconButton>
      </div>
    </div>
  );
}
