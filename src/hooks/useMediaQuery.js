"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribes to a media query as the external store it actually is.
 *
 * The server snapshot is always false, so the phone layout renders first and
 * the graph canvas never mounts on a small screen just to be discarded.
 */
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query]
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
