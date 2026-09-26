import { ancestorPath } from "@/lib/layout/tidyTree";

/**
 * Video lineage resolution.
 *
 * A video node carries `beat`: which moment of the video it occupies. A
 * regenerated take repeats its parent's beat (an alternative for the same
 * moment); an extended take advances the beat by one (the next moment). The
 * edge between them is never stored, only derived from the two beats — see
 * `edgeRelation` and `src/lib/layout/tidyTree.js`.
 *
 * A collection's "cut" is the compiled video for one lineage: walk root to
 * a chosen leaf, group the path by beat, and keep the deepest node at each
 * beat. Because a tree has exactly one root-to-leaf path, this always
 * resolves to exactly one clip per beat, however regenerations and
 * extensions interleave along the way.
 */

export const beatOf = (node) => node?.beat ?? 1;

/** Map<parentId | null, Node[]>, children in seed/generation order. */
export function childrenIndex(nodes) {
  const map = new Map();
  for (const node of nodes) {
    const key = node.parentId ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(node);
  }
  return map;
}

/**
 * The compiled cut ending at `leafId`: one node per beat, ascending.
 *
 * `ancestorPath` returns the root-to-leaf walk leaf-first, so the first node
 * seen at a given beat is already the deepest one — a later, shallower node
 * at that same beat (a take that was since regenerated over) is shadowed.
 */
export function resolveCut(nodes, leafId) {
  if (!nodes?.length) return [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const leaf =
    (leafId != null && byId.get(leafId)) ||
    nodes.find((n) => !n.parentId) ||
    nodes[0];

  const path = ancestorPath(nodes, leaf.id);
  const byBeat = new Map();
  for (const id of path) {
    const node = byId.get(id);
    const beat = beatOf(node);
    if (!byBeat.has(beat)) byBeat.set(beat, node);
  }

  return [...byBeat.values()].sort((a, b) => beatOf(a) - beatOf(b));
}

/**
 * Every alternate take for one beat, given the node selected for the
 * previous beat (or `null` for beat 1, the root row). Descends through
 * same-beat children too, so a regen-of-a-regen still surfaces as an
 * alternate for this beat, and stops the instant a child's beat advances.
 */
export function takesAtBeat(nodes, prevBeatNodeId, beat) {
  if (!nodes?.length) return [];
  const index = childrenIndex(nodes);
  const result = [];

  const walk = (node) => {
    if (beatOf(node) !== beat) return;
    result.push(node);
    for (const child of index.get(node.id) ?? []) walk(child);
  };

  for (const child of index.get(prevBeatNodeId ?? null) ?? []) walk(child);
  return result;
}

/**
 * The id to point `cutLeafId` at when a user picks `nodeId` as a beat's
 * take: its own tip, found by descending through extension children only.
 * Never same-beat children — that would let a later regeneration silently
 * shadow the very take the user just chose. A take with no continuation of
 * its own is its own tip, which honestly shortens the cut.
 */
export function tipOf(nodes, nodeId) {
  if (!nodes?.length) return nodeId;
  const index = childrenIndex(nodes);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  let current = byId.get(nodeId);
  if (!current) return nodeId;

  for (;;) {
    const next = (index.get(current.id) ?? []).find(
      (child) => beatOf(child) > beatOf(current)
    );
    if (!next) return current.id;
    current = next;
  }
}

/**
 * Where a video collection's cut points once a generation lands. Shared by
 * the generate route, which writes it, and the store, which applies it, so
 * the two can't disagree.
 *
 * A fresh collection's cut starts at its first take. Extending always
 * advances the cut. Regenerating only moves it when the take being
 * regenerated was the cut's own tip - otherwise the new take just joins that
 * beat's alternates, since re-pointing the cut at a mid-lineage leaf would
 * silently truncate every later beat.
 */
export function nextCutLeafId({ intent, parentId, cutLeafId, newNodes }) {
  if (!newNodes?.length) return cutLeafId ?? null;
  if (parentId == null) return newNodes[0].id;
  const movesCut = intent === "extend" || parentId === cutLeafId;
  return movesCut ? newNodes[0].id : cutLeafId ?? null;
}

/** `child.beat` advances past `parent.beat` on an extension, never on a regen. */
export function edgeRelation(parent, child) {
  return beatOf(child) > beatOf(parent) ? "extend" : "regen";
}

export function cutDuration(clips) {
  return clips.reduce((sum, clip) => sum + (clip.durationSeconds ?? 0), 0);
}
