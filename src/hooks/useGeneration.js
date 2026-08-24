"use client";

import { useCallback, useState } from "react";

/**
 * Drives the generate → append-to-history flow for a workspace.
 * `mode` selects which mocked API route to call ("image" | "video").
 */
export function useGeneration(mode) {
  const [history, setHistory] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const generate = useCallback(
    async (params) => {
      setIsGenerating(true);
      setError(null);
      try {
        const res = await fetch(`/api/generate/${mode}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Generation failed.");
        }
        setHistory((prev) => [data, ...prev]);
        return data;
      } catch (err) {
        setError(err.message);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [mode]
  );

  return { history, isGenerating, error, generate };
}
