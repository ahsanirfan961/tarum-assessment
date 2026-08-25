"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import Sidebar, { MobileNav } from "./Sidebar";
import TopBar from "./TopBar";
import SearchOverlay from "./SearchOverlay";
import ConfigPanel, { ConfigSheet } from "@/components/config/ConfigPanel";
import Canvas from "@/components/canvas/Canvas";
import { useWorkspace } from "@/lib/store/WorkspaceProvider";

export default function WorkspaceShell({ kind }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const projectId = useWorkspace((s) => s.project.id);
  const activeCollectionId = useWorkspace((s) => s.activeCollectionId);
  const openCollection = useWorkspace((s) => s.openCollection);
  const closeCollection = useWorkspace((s) => s.closeCollection);

  const filter = searchParams.get("q") ?? "";
  const [searchOpen, setSearchOpen] = useState(() => searchParams.has("q"));

  // Guards against the two sync effects below fighting each other.
  //
  // Set by the URL -> store effect right before it pushes a change into the
  // store, and consumed by the store -> URL effect on whatever render picks
  // that change up — telling it "this store update came from the URL, don't
  // write it straight back". Without this, a store-driven change genuinely
  // made elsewhere (a card click) and a URL-driven change picked up here look
  // identical to the second effect, and it would bounce every deep link
  // straight back out of the address bar. A plain "have I run yet" boolean
  // does not survive this: React StrictMode's dev-only double-invoke replays
  // both effects against the same pre-update render twice on mount, which
  // consumes a one-shot boolean before the real state change ever lands. This
  // flag is set and cleared in the same alternating pattern on every replay,
  // so it converges correctly regardless of how many times StrictMode fires.
  const suppressNextUrlWrite = useRef(false);

  // URL -> store. Runs when the "collection" param changes (a shared link, a
  // page load, or the browser back/forward buttons), and opens or closes
  // whichever lineage the URL names. Skipped when the store already agrees.
  useEffect(() => {
    const urlCollectionId = searchParams.get("collection");
    if (urlCollectionId === (activeCollectionId ?? null)) return;
    suppressNextUrlWrite.current = true;
    if (urlCollectionId) openCollection(urlCollectionId);
    else closeCollection();
    // Only the URL param should trigger this direction of the sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("collection")]);

  // Store -> URL. Runs when opening a lineage from anywhere in the app (a
  // collection card, the breadcrumb, closing back out), and makes that state
  // the shareable, refresh-proof link.
  useEffect(() => {
    if (suppressNextUrlWrite.current) {
      suppressNextUrlWrite.current = false;
      return;
    }

    const params = new URLSearchParams(searchParams);
    if (activeCollectionId) params.set("collection", activeCollectionId);
    else params.delete("collection");

    const next = params.toString();
    if (next === searchParams.toString()) return;
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    // Only the store's own state should trigger this direction of the sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCollectionId]);

  const setFilter = useCallback(
    (value) => {
      const params = new URLSearchParams(searchParams);
      if (value) params.set("q", value);
      else params.delete("q");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, pathname, router]
  );

  // Searching only makes sense against the whole project, so opening it steps
  // back out of whichever lineage is in focus.
  const openSearch = useCallback(() => {
    closeCollection();
    setSearchOpen(true);
  }, [closeCollection]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setFilter("");
  }, [setFilter]);

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
          <SearchOverlay value={filter} onChange={setFilter} onClose={closeSearch} />
        )}
      </AnimatePresence>
    </div>
  );
}
