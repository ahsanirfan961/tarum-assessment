"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useStore } from "zustand";
import { createWorkspaceStore } from "./workspaceStore";

const WorkspaceContext = createContext(null);

/**
 * Holds one store instance per project. Server components fetch the project's
 * data and hand it in, so there is no client fetch waterfall on first paint.
 */
export function WorkspaceProvider({ project, collections, children }) {
  const [store] = useState(() => createWorkspaceStore({ project, collections }));

  // Takes still rendering when the page loaded (a reload mid-render) are
  // picked up here; the store stops polling by itself once none are left.
  useEffect(() => {
    const { startPolling, stopPolling } = store.getState();
    startPolling();
    return stopPolling;
  }, [store]);
  return (
    <WorkspaceContext.Provider value={store}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace(selector) {
  const store = useContext(WorkspaceContext);
  if (!store) {
    throw new Error("useWorkspace must be used inside a WorkspaceProvider.");
  }
  return useStore(store, selector);
}
