"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CaretDown, SlidersHorizontal } from "@phosphor-icons/react";
import { useWorkspace } from "@/lib/store/WorkspaceProvider";
import IconButton from "@/components/ui/IconButton";
import ConfigForm from "./ConfigForm";

const PANEL_W = 316;

/**
 * Desktop composer. Collapses to nothing so the graph canvas can take the full
 * width, which matters on a 13 inch screen where three fixed columns do not fit.
 */
export default function ConfigPanel({ kind }) {
  const collapsed = useWorkspace((s) => s.configCollapsed);
  const toggleConfig = useWorkspace((s) => s.toggleConfig);

  return (
    <>
      <aside
        aria-label="Generation settings"
        /* Width transitions in CSS for the same reason as the sidebar: it is a
           layout property, and animating it from JS costs a reflow per frame. */
        className={`hidden shrink-0 overflow-hidden border-r border-border bg-bg transition-[width] duration-300 ease-out lg:block ${
          collapsed ? "w-0 border-r-0" : "w-[316px]"
        }`}
      >
        <div style={{ width: PANEL_W }} className="flex h-full flex-col">
          <div className="flex h-11 shrink-0 items-center justify-between pl-4 pr-2">
            <span className="text-[11px] font-semibold tracking-wide text-text-muted">
              COMPOSE
            </span>
            <IconButton label="Collapse composer" size="sm" onClick={toggleConfig}>
              <SlidersHorizontal size={15} />
            </IconButton>
          </div>
          <div className="min-h-0 flex-1">
            <ConfigForm kind={kind} />
          </div>
        </div>
      </aside>

      {collapsed && (
        <div className="hidden shrink-0 items-start border-r border-border bg-bg p-2 lg:flex">
          <IconButton label="Open composer" onClick={toggleConfig}>
            <SlidersHorizontal size={17} />
          </IconButton>
        </div>
      )}
    </>
  );
}

/**
 * Compact-viewport composer: a bottom sheet that rests as a single tap target
 * and expands over the canvas, rather than a side panel squeezed to nothing.
 */
export function ConfigSheet({ kind }) {
  const [open, setOpen] = useState(false);
  const isGenerating = useWorkspace((s) => s.isGenerating);
  const reduce = useReducedMotion();

  return (
    <div className="lg:hidden">
      <AnimatePresence>
        {open && (
          <>
            <motion.button
              key="scrim"
              type="button"
              aria-label="Close composer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-30 cursor-default bg-black/40"
            />
            <motion.div
              key="sheet"
              role="dialog"
              aria-label="Generation settings"
              initial={reduce ? { opacity: 0 } : { y: "100%" }}
              animate={reduce ? { opacity: 1 } : { y: 0 }}
              exit={reduce ? { opacity: 0 } : { y: "100%" }}
              transition={reduce ? { duration: 0.15 } : { duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              /* overscroll-contain keeps an over-scroll at the top/bottom of the
                 sheet from bubbling into a page scroll behind it. */
              className="fixed inset-x-0 bottom-0 z-40 flex h-[78dvh] flex-col overscroll-contain rounded-t-2xl border-t border-border bg-bg"
            >
              <div className="flex h-11 shrink-0 items-center justify-between pl-4 pr-2">
                <span className="text-[11px] font-semibold tracking-wide text-text-muted">
                  COMPOSE
                </span>
                <IconButton label="Close composer" size="sm" onClick={() => setOpen(false)}>
                  <CaretDown size={16} weight="bold" />
                </IconButton>
              </div>
              <div className="min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]">
                <ConfigForm kind={kind} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 border-t border-border bg-surface px-4 py-3 text-left text-[13px] text-text-muted"
        >
          <SlidersHorizontal size={16} aria-hidden className="shrink-0" />
          {isGenerating ? "Generating your take" : "Describe your next take"}
        </button>
      )}
    </div>
  );
}
