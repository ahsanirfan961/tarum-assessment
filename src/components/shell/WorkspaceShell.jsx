"use client";

import { useCallback, useState } from "react";
import { AnimatePresence } from "motion/react";
import Sidebar, { MobileNav } from "./Sidebar";
import TopBar from "./TopBar";
import SearchOverlay from "./SearchOverlay";
import ConfigPanel, { ConfigSheet } from "@/components/config/ConfigPanel";
import Canvas from "@/components/canvas/Canvas";
import { useWorkspace } from "@/lib/store/WorkspaceProvider";

export default function WorkspaceShell({ kind }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const projectId = useWorkspace((s) => s.project.id);
  const closeCollection = useWorkspace((s) => s.closeCollection);

  // Searching only makes sense against the whole project, so opening it steps
  // back out of whichever lineage is in focus.
  const openSearch = useCallback(() => {
    closeCollection();
    setSearchOpen(true);
  }, [closeCollection]);

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar projectId={projectId} onOpenSearch={openSearch} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="flex min-h-0 flex-1">
          <ConfigPanel kind={kind} />
          <Canvas filter={filter} />
        </div>
        <ConfigSheet kind={kind} />
        <MobileNav projectId={projectId} onOpenSearch={openSearch} />
      </div>

      <AnimatePresence>
        {searchOpen && (
          <SearchOverlay
            value={filter}
            onChange={setFilter}
            onClose={() => setSearchOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
