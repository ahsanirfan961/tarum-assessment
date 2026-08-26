"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useTransform } from "motion/react";
import {
  ArrowsInSimple,
  GitBranch,
  Minus,
  Plus,
} from "@phosphor-icons/react";
import { useWorkspace } from "@/lib/store/WorkspaceProvider";
import { usePanZoom } from "@/hooks/usePanZoom";
import { ancestorPath, layoutLineage, NODE_H } from "@/lib/layout/tidyTree";
import IconButton from "@/components/ui/IconButton";
import GraphNode from "./GraphNode";
import EdgeConfigPopover from "./EdgeConfigPopover";

const EDGE_WIDGET_W = 260;

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
  const openViewer = useWorkspace((s) => s.openViewer);

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

  // Counter-scales the pinned config popover against canvas zoom, so its text
  // stays a constant, readable size whether the tree is fit to the screen at
  // 25% or zoomed in on one branch at 150%. The popover's position still
  // tracks pan/zoom normally, since it's positioned inside the same
  // transformed layer as everything else — only its own scale is corrected.
  const inverseScale = useTransform(scale, (s) => 1 / s);

  // Pinned by clicking a hover tooltip's "View full config". Local to this
  // canvas: nothing outside the graph needs to know a popover is open.
  const [pinnedEdgeId, setPinnedEdgeId] = useState(null);

  // Hiding the tooltip on a short delay, cancelled if the pointer lands back
  // on either the edge or the tooltip itself, is what lets the mouse actually
  // cross the gap between them to reach "View full config" — hiding the
  // instant the pointer leaves the thin edge path would close it mid-travel.
  const hideTimeout = useRef(null);
  const cancelHide = useCallback(() => {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
  }, []);
  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimeout.current = setTimeout(() => setHoveredEdge(null), 200);
  }, [cancelHide, setHoveredEdge]);
  useEffect(() => cancelHide, [cancelHide]);

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

  // One widget, two states: pinned wins over merely hovered, so clicking to
  // expand never gets undercut by the mouse drifting off a different edge.
  const activeEdgeId = pinnedEdgeId ?? hoveredEdgeId;
  const activeEdge = activeEdgeId ? edges.find((e) => e.id === activeEdgeId) ?? null : null;
  const activeNode = activeEdge
    ? collection.nodes.find((n) => n.id === activeEdge.childId) ?? null
    : null;
  const isExpanded = Boolean(pinnedEdgeId);

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

  // Clicking the canvas backdrop dismisses a pinned popover the same way it
  // would dismiss any other floating panel; clicking a node or the popover
  // itself (both opt out via data-no-pan / data-graph-node) leaves it open.
  const onViewportPointerDown = (e) => {
    if (!e.target.closest("[data-graph-node], [data-no-pan]")) {
      setPinnedEdgeId(null);
    }
    handlers.onPointerDown(e);
  };

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        ref={viewportRef}
        {...handlers}
        onPointerDown={onViewportPointerDown}
        /* select-none: without it, dragging to pan also drags a text/image
           selection across every node the pointer crosses, same as selecting
           text on a page. */
        className="h-full w-full select-none touch-none cursor-grab active:cursor-grabbing"
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
                    onPointerEnter={() => {
                      cancelHide();
                      setHoveredEdge(edge.id);
                    }}
                    onPointerLeave={scheduleHide}
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
                onOpenViewer={openViewer}
                onFocusChange={(focused) =>
                  setHoveredEdge(focused ? edgeIdByChild.get(node.id) ?? null : null)
                }
              />
            </div>
          ))}

          {/* The prompt that produced the child, on its incoming edge: a
              compact preview by default, expanding in place into the full
              config on click. */}
          {activeNode && (
            <EdgeConfigPopover
              key={activeEdge.id}
              node={activeNode}
              position={activeEdge.label}
              width={EDGE_WIDGET_W}
              inverseScale={inverseScale}
              expanded={isExpanded}
              onExpand={() => {
                cancelHide();
                setPinnedEdgeId(activeEdge.id);
              }}
              onClose={() => setPinnedEdgeId(null)}
              onPointerEnter={cancelHide}
              onPointerLeave={isExpanded ? undefined : scheduleHide}
            />
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
