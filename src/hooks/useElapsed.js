"use client";

import { useSyncExternalStore } from "react";

/**
 * Whole seconds since `since` (an ISO timestamp), ticking once a second, or
 * null before hydration and when there's nothing to count from. The clock is
 * an external store, so every counter on screen shares one render per tick.
 */
function subscribe(onTick) {
  const timer = setInterval(onTick, 1000);
  return () => clearInterval(timer);
}

const nowInSeconds = () => Math.floor(Date.now() / 1000);

export function useElapsed(since) {
  const now = useSyncExternalStore(subscribe, nowInSeconds, () => null);
  if (now == null || !since) return null;
  const start = Math.floor(Date.parse(since) / 1000);
  return Number.isNaN(start) ? null : Math.max(0, now - start);
}

/** 83 -> "1:23". */
export function formatElapsed(seconds) {
  if (seconds == null) return "";
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}
