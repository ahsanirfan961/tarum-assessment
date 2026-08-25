"use client";

import { motion, useReducedMotion } from "motion/react";
import { useWorkspace } from "@/lib/store/WorkspaceProvider";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import HomeGrid from "./HomeGrid";
import GraphCanvas from "./GraphCanvas";
import MobileLineage from "./MobileLineage";
import AssemblyStrip from "./AssemblyStrip";

/**
 * The canvas has exactly two states: everything in the project, or one lineage
 * in full focus. Only ever one at a time, because the point of opening a
 * lineage is that nothing else competes for attention.
 *
 * The swap is enter-only, keyed on the view. Waiting for an outgoing view to
 * animate away before the new one appears would put roughly half a second
 * between the click and the work, which is too slow for the most repeated
 * action in the app.
 */
export default function Canvas({ filter }) {
  const activeCollectionId = useWorkspace((s) => s.activeCollectionId);
  const collections = useWorkspace((s) => s.collections);
  const reduce = useReducedMotion();
  const isWide = useMediaQuery("(min-width: 768px)");

  const active = collections.find((c) => c.id === activeCollectionId) ?? null;

  return (
    <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <motion.div
        key={active?.id ?? "home"}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: active ? 0.985 : 1.01 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={
          reduce ? { duration: 0.12 } : { duration: 0.3, ease: [0.16, 1, 0.3, 1] }
        }
        className="flex min-h-0 flex-1 flex-col"
      >
        {active ? (
          <>
            {isWide ? (
              <GraphCanvas collection={active} />
            ) : (
              <div className="min-h-0 flex-1">
                <MobileLineage collection={active} />
              </div>
            )}
            {active.kind === "video" && <AssemblyStrip collection={active} />}
          </>
        ) : (
          <HomeGrid filter={filter} />
        )}
      </motion.div>
    </main>
  );
}
