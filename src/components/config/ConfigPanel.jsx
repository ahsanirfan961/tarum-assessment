"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CaretDown, SlidersHorizontal } from "@phosphor-icons/react";
import { useWorkspace } from "@/lib/store/WorkspaceProvider";
import { useResizablePanel } from "@/hooks/useResizablePanel";
import IconButton from "@/components/ui/IconButton";
import ConfigForm from "./ConfigForm";

const MIN_W = 272;
const MAX_W = 520;

/**
 * Desktop composer. Collapses to nothing so the graph canvas can take the full
 * width, which matters on a 13 inch screen where three fixed columns do not
 * fit, and its width is user-adjustable via the drag handle on its edge.
 */
export default function ConfigPanel({ kind }) {
  const collapsed = useWorkspace((s) => s.configCollapsed);
  const toggleConfig = useWorkspace((s) => s.toggleConfig);
  const width = useWorkspace((s) => s.configWidth);
  const setConfigWidth = useWorkspace((s) => s.setConfigWidth);

  const { isResizing, handleProps } = useResizablePanel({
    width,
    onChange: setConfigWidth,
    min: MIN_W,
    max: MAX_W,
  });

  return (
    <>
      <aside
        aria-label="Generation settings"
        style={{ width: collapsed ? 0 : width }}
        /* Width transitions in CSS when the collapse toggle changes it, but
           not while the handle is actively dragging it — animating through a
           300ms easing on every pointermove would make the drag feel laggy
           and lag a frame behind the cursor. No overflow-hidden here: that
           lives on the inner wrapper instead, so the drag handle (a sibling
           positioned on this element's own right edge) never gets clipped. */
        className={`relative hidden shrink-0 lg:block ${
          isResizing ? "" : "transition-[width] duration-300 ease-out"
        }`}
      >
        <div
          className={`h-full overflow-hidden border-border bg-bg ${
            collapsed ? "" : "border-r"
          }`}
        >
          <div style={{ width }} className="flex h-full flex-col">
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
        </div>

        {!collapsed && (
          <div
            {...handleProps}
            aria-label="Resize composer"
            /* translate-x-1/2, not negative: right-0 already anchors this
               box's right edge to the panel's right edge, so it needs to
               shift right by half its own width to end up centered ON that
               edge — shifting left instead just moves the whole hit area,
               and the visible line inside it, off the actual border. */
            className="group absolute inset-y-0 right-0 z-10 w-2.5 translate-x-1/2 cursor-col-resize touch-none select-none focus-visible:outline-none"
          >
            <div
              className={`mx-auto h-full w-px transition-colors ${
                isResizing
                  ? "bg-accent"
                  : "bg-transparent group-hover:bg-accent group-focus-visible:bg-accent"
              }`}
            />
          </div>
        )}
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
