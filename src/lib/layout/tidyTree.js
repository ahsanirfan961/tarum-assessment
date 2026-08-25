import { hierarchy, tree as d3Tree } from "d3-hierarchy";

export const NODE_W = 176;
export const NODE_H = 176;
/** Vertical room between rows, sized to fit an edge label without collision. */
const ROW_GAP = 104;
const COL_GAP = 36;
const PADDING = 72;

/**
 * Lays a collection's nodes out as a Reingold-Tilford tidy tree.
 *
 * Root-row nodes (a generation batch) have no parent, so they are gathered
 * under a synthetic root that is measured but never drawn. That keeps sibling
 * spacing correct across the whole batch without inventing a real node.
 *
 * Returns absolute positions, so panning and zooming stay a pure transform on
 * the container and never require re-running layout.
 */
export function layoutLineage(nodes) {
  if (!nodes?.length) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const VIRTUAL_ROOT = "__root__";
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const root = hierarchy(
    { id: VIRTUAL_ROOT },
    (d) =>
      d.id === VIRTUAL_ROOT
        ? nodes.filter((n) => !n.parentId)
        : nodes.filter((n) => n.parentId === d.id)
  );

  d3Tree().nodeSize([NODE_W + COL_GAP, NODE_H + ROW_GAP])(root);

  const placed = root
    .descendants()
    .filter((d) => d.data.id !== VIRTUAL_ROOT)
    .map((d) => ({
      ...byId.get(d.data.id),
      // Depth 1 in the synthetic tree is the real root row, so pull one level up.
      x: d.x,
      y: (d.depth - 1) * (NODE_H + ROW_GAP),
      depth: d.depth - 1,
    }));

  if (!placed.length) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  // Normalise into a positive coordinate space with padding on every side.
  const minX = Math.min(...placed.map((n) => n.x));
  const maxX = Math.max(...placed.map((n) => n.x));
  const maxY = Math.max(...placed.map((n) => n.y));
  const offsetX = PADDING - minX + NODE_W / 2;

  const positioned = placed.map((n) => ({
    ...n,
    x: n.x + offsetX,
    y: n.y + PADDING,
  }));

  const positionById = new Map(positioned.map((n) => [n.id, n]));

  const edges = positioned
    .filter((n) => n.parentId && positionById.has(n.parentId))
    .map((child) => {
      const parent = positionById.get(child.parentId);
      const from = { x: parent.x, y: parent.y + NODE_H };
      const to = { x: child.x, y: child.y };
      const bend = (to.y - from.y) / 2;
      return {
        id: `${parent.id}-${child.id}`,
        parentId: parent.id,
        childId: child.id,
        prompt: child.prompt,
        path: `M ${from.x} ${from.y} C ${from.x} ${from.y + bend}, ${to.x} ${
          to.y - bend
        }, ${to.x} ${to.y}`,
        label: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
      };
    });

  return {
    nodes: positioned,
    edges,
    width: maxX - minX + NODE_W + PADDING * 2,
    height: maxY + NODE_H + PADDING * 2,
  };
}

/**
 * Ids of a node plus every ancestor up to its root. Drives focus mode, which
 * dims everything outside the selected node's lineage so deep trees stay
 * readable.
 */
export function ancestorPath(nodes, nodeId) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const path = [];
  let current = byId.get(nodeId);
  while (current) {
    path.push(current.id);
    current = current.parentId ? byId.get(current.parentId) : null;
  }
  return path;
}
