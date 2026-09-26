import { createStore } from "zustand";
import { isRendering } from "@/lib/takes";
import { nextCutLeafId, tipOf } from "@/lib/video/cut";

const POLL_MS = 5_000;

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
 *
 * Video takes come back from the generate route still rendering. While any
 * take is, the store polls the jobs route and merges finished takes in (see
 * `startPolling`).
 */
export function createWorkspaceStore({ project, collections }) {
  return createStore((set, get) => {
    // Polling lives outside store state: it's machinery, nothing renders it.
    // One request at a time, so an older response can never land after a
    // newer one and put a finished take back to rendering.
    let pollTimer = null;
    let pollInFlight = false;
    let pollActive = false;

    const onVisibility = () => {
      if (document.visibilityState === "visible") schedulePoll(0);
    };

    function schedulePoll(delay) {
      if (!pollActive || pollTimer || pollInFlight) return;
      pollTimer = setTimeout(pollOnce, delay);
    }

    async function pollOnce() {
      pollTimer = null;
      const ids = renderingIds(get().collections);
      // Nothing left to wait for: stop until the next submit or retry. A
      // hidden tab stops too, and the visibility listener picks it back up.
      if (!ids.length || document.visibilityState === "hidden") return;

      pollInFlight = true;
      try {
        const res = await fetch(`/api/generate/jobs?ids=${ids.map(encodeURIComponent).join(",")}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          set((s) => ({ collections: mergeNodes(s.collections, data.nodes) }));
        }
      } catch {
        // Offline or the server restarting: the next tick asks again.
      } finally {
        pollInFlight = false;
      }
      schedulePoll(POLL_MS);
    }

    return {
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
      isGenerating: false, // only while a submit is in flight, not while video renders
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
        duration,
        intent = "regen",
      }) => {
        const { project, selectedNodeId, referenceIds, activeCollectionId, findNode } = get();
        const parent = selectedNodeId ? findNode(selectedNodeId) : null;
        const isExtend = kind === "video" && intent === "extend" && Boolean(parent);
        set({ isGenerating: true, error: null });

        try {
          // Only ids travel: the server loads the parent and references from
          // the database, and checks they belong to this collection and project.
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
              duration,
              projectId: project.id,
              collectionId: parent?.collection.id ?? null,
              parentId: selectedNodeId,
              referenceIds,
              intent,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Generation failed.");
          // Video takes arrive still rendering. The first poll runs on a timer,
          // after the takes below are in the store.
          if (data.nodes.some(isRendering)) get().startPolling();

          // Continuing a lineage: append as children of the selected node.
          if (selectedNodeId && activeCollectionId) {
            set((s) => ({
              collections: s.collections.map((c) => {
                if (c.id !== activeCollectionId) return c;
                const nodes = [...c.nodes, ...data.nodes];
                if (kind !== "video") return { ...c, nodes };
                // The same rule the server just wrote (see `nextCutLeafId`).
                const cutLeafId = nextCutLeafId({
                  intent,
                  parentId: selectedNodeId,
                  cutLeafId: c.cutLeafId,
                  newNodes: data.nodes,
                });
                return { ...c, nodes, cutLeafId };
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
            ...(kind === "video"
              ? {
                  cutLeafId: nextCutLeafId({
                    intent,
                    parentId: null,
                    cutLeafId: null,
                    newNodes: data.nodes,
                  }),
                }
              : {}),
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

      /**
       * Renames a collection. Applied immediately, then saved; if saving fails
       * the old name comes back and the error shows in the composer.
       */
      renameCollection: (collectionId, name) => {
        const trimmed = name.trim();
        const current = get().collections.find((c) => c.id === collectionId);
        if (!current || !trimmed || trimmed === current.name) return;
        return patchCollection(set, get, collectionId, "name", trimmed);
      },

      // --- Video cut ----------------------------------------------------

      /**
       * Picks `nodeId` as a beat's take for the cut. Points `cutLeafId` at its
       * tip (see `tipOf`) rather than at `nodeId` itself, so choosing a take
       * that was later extended keeps the rest of the cut intact instead of
       * truncating it back to the beat being swapped. Saved the same way as a
       * rename.
       */
      setCutTake: (collectionId, nodeId) => {
        const current = get().collections.find((c) => c.id === collectionId);
        if (!current) return;
        const cutLeafId = tipOf(current.nodes, nodeId);
        if (cutLeafId === current.cutLeafId) return;
        return patchCollection(set, get, collectionId, "cutLeafId", cutLeafId);
      },

      // --- Rendering takes ------------------------------------------------

      /**
       * Polls the jobs route every few seconds while any take is rendering, and
       * merges what comes back. Called on mount (so a reload picks up takes
       * still rendering), after a submit, and after a retry. Stops by itself
       * when nothing is left and pauses while the tab is hidden.
       */
      startPolling: () => {
        if (!pollActive) {
          pollActive = true;
          document.addEventListener("visibilitychange", onVisibility);
        }
        schedulePoll(0);
      },

      stopPolling: () => {
        pollActive = false;
        clearTimeout(pollTimer);
        pollTimer = null;
        document.removeEventListener("visibilitychange", onVisibility);
      },

      /** Sends a failed take's job again; it comes back rendering, in place. */
      retryNode: async (nodeId) => {
        set({ error: null });
        try {
          const res = await fetch(`/api/generate/jobs/${encodeURIComponent(nodeId)}/retry`, {
            method: "POST",
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "Couldn't retry this take.");
          set((s) => ({ collections: mergeNodes(s.collections, [data.node]) }));
          get().startPolling();
        } catch (err) {
          set({ error: err.message });
        }
      },
    };
  });
}

/** Ids of every take whose job is still rendering, across the project. */
function renderingIds(collections) {
  return collections.flatMap((c) => c.nodes.filter(isRendering).map((n) => n.id));
}

/** Replaces takes by id, wherever they live, leaving everything else as is. */
function mergeNodes(collections, updated) {
  if (!updated?.length) return collections;
  const byId = new Map(updated.map((n) => [n.id, n]));
  return collections.map((c) =>
    c.nodes.some((n) => byId.has(n.id))
      ? { ...c, nodes: c.nodes.map((n) => byId.get(n.id) ?? n) }
      : c
  );
}

/**
 * Optimistic write of one collection field: set it, PATCH it, and restore the
 * previous value if the server refuses. The rollback only applies while the
 * field still holds this call's value, so it never clobbers a later change.
 */
async function patchCollection(set, get, collectionId, field, value) {
  const previous = get().collections.find((c) => c.id === collectionId)?.[field];
  const apply = (from, to) =>
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id === collectionId && (from === undefined || c[field] === from)
          ? { ...c, [field]: to }
          : c
      ),
    }));

  apply(undefined, value);
  set({ error: null });
  try {
    const res = await fetch(`/api/collections/${encodeURIComponent(collectionId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Couldn't save that change.");
    }
  } catch (err) {
    apply(value, previous);
    set({ error: err.message });
  }
}
