"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  getGuideSeen,
  getGuideSeenOnServer,
  subscribeGuideSeen,
} from "@/lib/guide";

/** Whether this workspace's walkthrough has already been dismissed. */
export function useGuideSeen(kind) {
  const getSnapshot = useCallback(() => getGuideSeen(kind), [kind]);
  return useSyncExternalStore(
    subscribeGuideSeen,
    getSnapshot,
    getGuideSeenOnServer
  );
}
