"use client";

import { useRef, useState } from "react";
import { CaretRight, Question, X } from "@phosphor-icons/react";
import { useWorkspace } from "@/lib/store/WorkspaceProvider";
import IconButton from "@/components/ui/IconButton";
import ThemeToggle from "./ThemeToggle";

export default function TopBar({ onOpenGuide }) {
  const project = useWorkspace((s) => s.project);
  const activeCollectionId = useWorkspace((s) => s.activeCollectionId);
  const collections = useWorkspace((s) => s.collections);
  const closeCollection = useWorkspace((s) => s.closeCollection);

  const active = collections.find((c) => c.id === activeCollectionId) ?? null;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3 sm:px-4">
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5">
        <button
          type="button"
          onClick={closeCollection}
          disabled={!active}
          className="truncate rounded-[var(--r-control)] px-1.5 py-1 text-sm font-semibold tracking-tight transition-colors enabled:hover:bg-surface-2 disabled:cursor-default"
        >
          {project.name}
        </button>

        {active && (
          <>
            <CaretRight size={13} weight="bold" aria-hidden className="shrink-0 text-text-muted" />
            <CollectionName key={active.id} collection={active} />
            <IconButton label="Back to all work" size="sm" onClick={closeCollection}>
              <X size={14} weight="bold" />
            </IconButton>
          </>
        )}
      </nav>

      <div className="flex shrink-0 items-center gap-1">
        {onOpenGuide && (
          <IconButton label="How Fomi works" onClick={onOpenGuide}>
            <Question size={17} />
          </IconButton>
        )}
        <ThemeToggle />
        <span
          aria-hidden
          className="ml-1 grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-text-muted"
        >
          MA
        </span>
      </div>
    </header>
  );
}

/**
 * The active collection's name, renamed in place: click to edit, Enter or
 * blur to save, Escape to cancel. Names are generated from the first prompt,
 * so this is where a user fixes one that came out wrong.
 */
function CollectionName({ collection }) {
  const renameCollection = useWorkspace((s) => s.renameCollection);
  const [draft, setDraft] = useState(null); // null while not editing
  // Unmounting a focused input can fire blur, which must not save a cancel.
  const cancelled = useRef(false);

  if (draft === null) {
    return (
      <button
        type="button"
        onClick={() => {
          cancelled.current = false;
          setDraft(collection.name);
        }}
        title="Rename collection"
        aria-current="page"
        className="truncate rounded-[var(--r-control)] px-1.5 py-1 text-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
      >
        {collection.name}
      </button>
    );
  }

  const commit = () => {
    if (!cancelled.current) renameCollection(collection.id, draft);
    setDraft(null);
  };

  return (
    <input
      autoFocus
      value={draft}
      maxLength={120}
      aria-label="Collection name"
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          cancelled.current = true;
          setDraft(null);
        }
      }}
      className="min-w-0 max-w-64 rounded-[var(--r-control)] border border-border bg-surface px-1.5 py-0.5 text-sm text-text outline-none focus-visible:border-accent"
    />
  );
}
