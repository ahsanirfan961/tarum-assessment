"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useWorkspace } from "@/lib/store/WorkspaceProvider";

/**
 * Search is scoped to the open project on purpose. Projects are isolated, so a
 * global result list would quietly break the guarantee the rest of the app makes.
 */
export default function SearchOverlay({ value, onChange, onClose }) {
  const inputRef = useRef(null);
  const projectName = useWorkspace((s) => s.project.name);
  const reduce = useReducedMotion();

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-center px-4 pt-[12vh]">
      <motion.button
        type="button"
        aria-label="Close search"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/40"
      />
      <motion.div
        role="dialog"
        aria-label={`Search ${projectName}`}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        /* The focus ring belongs on the whole card, not on the input row.
           On the row it drew a rounded rect around only the top section,
           colliding with the card's own border and cutting a hard edge
           across the panel just above the hint text. */
        className="relative h-fit w-full max-w-lg overflow-hidden overscroll-contain rounded-[var(--r-panel)] border border-border bg-surface shadow-[var(--shadow-lift)] ring-accent/35 focus-within:border-accent focus-within:ring-2"
      >
        <div className="flex items-center gap-2.5 px-3.5">
          <MagnifyingGlass size={17} aria-hidden className="shrink-0 text-text-muted" />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Search collections and prompts in ${projectName}…`}
            aria-label={`Search collections and prompts in ${projectName}`}
            className="h-12 w-full bg-transparent text-[14px] text-text outline-none placeholder:text-text-muted"
          />
        </div>
        <p className="border-t border-border px-3.5 py-2 text-[11px] text-text-muted">
          Results filter the canvas behind this. Press Escape to close.
        </p>
      </motion.div>
    </div>
  );
}
