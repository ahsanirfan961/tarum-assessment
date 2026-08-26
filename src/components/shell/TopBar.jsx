"use client";

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
            <span className="truncate px-1.5 text-sm text-text-muted" aria-current="page">
              {active.name}
            </span>
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
