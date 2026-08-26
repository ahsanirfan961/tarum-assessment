import { createStore } from "zustand";
import { tipOf } from "@/lib/video/cut";

/**
 * Per-project workspace store.
 *
 * The one rule that keeps the "collection" and "lineage" ideas from colliding:
 *
 *   Generating with a node selected  -> children of that node, same collection.
 *   Generating with nothing selected -> a new collection, new root row.
 *
 * So a collection is always exactly one lineage, and the batch that started it
 * is simply its root row.
 */
export function createWorkspaceStore({ project, collections }) {
  return createStore((set, get) => ({
    project,
    collections,

    // View state
    activeCollectionId: null, // null renders the home grid, set renders the graph
    selectedNodeId: null,
    hoveredEdgeId: null,
    viewerNodeId: null, // set opens the full-size media viewer for that take
    viewerCutLeafId: null, // set opens the sequential cut player, mutually
    viewerCutStart: 0, // exclusive with viewerNodeId
    referenceIds: [], // staged references for the next generation
    sidebarCollapsed: false,
    configCollapsed: false,
    configWidth: 316, // user-resizable; drag handle lives on the panel's edge
    isGenerating: false,
    error: null,

    // --- Navigation -------------------------------------------------------

    openCollection: (collectionId) =>
      set({ activeCollectionId: collectionId, selectedNodeId: null }),

    closeCollection: () => set({ activeCollectionId: null, selectedNodeId: null }),

    selectNode: (nodeId) =>
      set((s) => ({ selectedNodeId: s.selectedNodeId === nodeId ? null : nodeId })),

    setHoveredEdge: (edgeId) => set({ hoveredEdgeId: edgeId }),

    openViewer: (nodeId) => set({ viewerNodeId: nodeId, viewerCutLeafId: null }),
    openCut: (leafId, startIndex = 0) =>
      set({ viewerCutLeafId: leafId, viewerCutStart: startIndex, viewerNodeId: null }),
    closeViewer: () =>
      set({ viewerNodeId: null, viewerCutLeafId: null, viewerCutStart: 0 }),

    toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    toggleConfig: () => set((s) => ({ configCollapsed: !s.configCollapsed })),
    setConfigWidth: (width) => set({ configWidth: width }),

    // --- References -------------------------------------------------------

    toggleReference: (nodeId) =>
      set((s) => ({
        referenceIds: s.referenceIds.includes(nodeId)
          ? s.referenceIds.filter((id) => id !== nodeId)
          : [...s.referenceIds, nodeId],
      })),

    clearReferences: () => set({ referenceIds: [] }),

    // --- Derived reads ----------------------------------------------------

    getActiveCollection: () => {
      const { collections, activeCollectionId } = get();
      return collections.find((c) => c.id === activeCollectionId) ?? null;
    },

    /** Node lookup across every collection, so cross-collection refs resolve. */
    findNode: (nodeId) => {
      for (const collection of get().collections) {
        const found = collection.nodes.find((n) => n.id === nodeId);
        if (found) return { node: found, collection };
      }
      return null;
    },

    // --- Generation -------------------------------------------------------

    generate: async ({
      kind,
      prompt,
      count,
      aspectRatio,
      model,
      quality,
      resolution,
      intent = "regen",
    }) => {
      const { selectedNodeId, referenceIds, activeCollectionId, findNode } = get();
      const parent = selectedNodeId ? findNode(selectedNodeId) : null;
      const isExtend = kind === "video" && intent === "extend" && Boolean(parent);
      set({ isGenerating: true, error: null });

      try {
        const res = await fetch(`/api/generate/${kind}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            count,
            aspectRatio,
            model,
            quality,
            resolution,
            parentId: selectedNodeId,
            referenceIds,
            intent,
            parentBeat: parent?.node.beat ?? null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Generation failed.");

        // Continuing a lineage: append as children of the selected node.
        if (selectedNodeId && activeCollectionId) {
          set((s) => ({
            collections: s.collections.map((c) => {
              if (c.id !== activeCollectionId) return c;
              const nodes = [...c.nodes, ...data.nodes];
              // Extending always advances the cut. Regenerating only moves it
              // when the take being regenerated was the cut's own tip -
              // otherwise the new take just joins that beat's alternates,
              // since re-pointing the cut at a mid-lineage leaf would
              // silently truncate every later beat.
              const movesCut =
                isExtend || (kind === "video" && selectedNodeId === c.cutLeafId);
              return {
                ...c,
                nodes,
                ...(movesCut ? { cutLeafId: data.nodes[0].id } : {}),
              };
            }),
            selectedNodeId: isExtend ? data.nodes[0].id : null,
            referenceIds: [],
          }));
          return data;
        }

        // Fresh intent: start a new collection at its root row.
        const collection = {
          id: data.collectionId,
          kind,
          name: data.name,
          nodes: data.nodes,
          ...(kind === "video" ? { cutLeafId: data.nodes[0]?.id ?? null } : {}),
        };
        set((s) => ({
          collections: [collection, ...s.collections],
          activeCollectionId: collection.id,
          selectedNodeId: null,
          referenceIds: [],
        }));
        return data;
      } catch (err) {
        set({ error: err.message });
        return null;
      } finally {
        set({ isGenerating: false });
      }
    },

    renameCollection: (collectionId, name) =>
      set((s) => ({
        collections: s.collections.map((c) =>
          c.id === collectionId ? { ...c, name } : c
        ),
      })),

    // --- Video cut ----------------------------------------------------

    /**
     * Picks `nodeId` as a beat's take for the cut. Points `cutLeafId` at its
     * tip (see `tipOf`) rather than at `nodeId` itself, so choosing a take
     * that was later extended keeps the rest of the cut intact instead of
     * truncating it back to the beat being swapped.
     */
    setCutTake: (collectionId, nodeId) =>
      set((s) => ({
        collections: s.collections.map((c) =>
          c.id === collectionId
            ? { ...c, cutLeafId: tipOf(c.nodes, nodeId) }
            : c
        ),
      })),
  }));
}
