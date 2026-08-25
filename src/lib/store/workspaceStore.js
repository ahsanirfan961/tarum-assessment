import { createStore } from "zustand";

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
    referenceIds: [], // staged references for the next generation
    sidebarCollapsed: false,
    configCollapsed: false,
    isGenerating: false,
    error: null,

    // --- Navigation -------------------------------------------------------

    openCollection: (collectionId) =>
      set({ activeCollectionId: collectionId, selectedNodeId: null }),

    closeCollection: () => set({ activeCollectionId: null, selectedNodeId: null }),

    selectNode: (nodeId) =>
      set((s) => ({ selectedNodeId: s.selectedNodeId === nodeId ? null : nodeId })),

    setHoveredEdge: (edgeId) => set({ hoveredEdgeId: edgeId }),

    toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    toggleConfig: () => set((s) => ({ configCollapsed: !s.configCollapsed })),

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

    generate: async ({ kind, prompt, count, aspectRatio, model }) => {
      const { selectedNodeId, referenceIds, activeCollectionId } = get();
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
            parentId: selectedNodeId,
            referenceIds,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Generation failed.");

        // Continuing a lineage: append as children of the selected node.
        if (selectedNodeId && activeCollectionId) {
          set((s) => ({
            collections: s.collections.map((c) =>
              c.id === activeCollectionId
                ? { ...c, nodes: [...c.nodes, ...data.nodes] }
                : c
            ),
            selectedNodeId: null,
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
          ...(kind === "video" ? { assembly: [] } : {}),
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

    // --- Video assembly ---------------------------------------------------

    toggleInAssembly: (collectionId, nodeId) =>
      set((s) => ({
        collections: s.collections.map((c) => {
          if (c.id !== collectionId) return c;
          const assembly = c.assembly ?? [];
          return {
            ...c,
            assembly: assembly.includes(nodeId)
              ? assembly.filter((id) => id !== nodeId)
              : [...assembly, nodeId],
          };
        }),
      })),

    reorderAssembly: (collectionId, from, to) =>
      set((s) => ({
        collections: s.collections.map((c) => {
          if (c.id !== collectionId) return c;
          const assembly = [...(c.assembly ?? [])];
          const [moved] = assembly.splice(from, 1);
          assembly.splice(to, 0, moved);
          return { ...c, assembly };
        }),
      })),
  }));
}
