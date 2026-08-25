"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getServerTheme, getTheme, setTheme, subscribeTheme } from "@/lib/theme";

export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);

  const toggle = useCallback(() => {
    setTheme(getTheme() === "dark" ? "light" : "dark");
  }, []);

  return { theme, toggle };
}
