"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const ARROW_STEP = 16;

/**
 * Drag-to-resize for a side panel's width, plus an Arrow-key equivalent on
 * whatever element spreads `handleProps` onto (a drag gesture needs a
 * keyboard alternative, same as any other drag interaction in this app).
 */
export function useResizablePanel({ width, onChange, min, max }) {
  const [isResizing, setIsResizing] = useState(false);
  const dragState = useRef(null);
  const stopDragRef = useRef(() => {});

  const onPointerMove = useCallback(
    (e) => {
      const drag = dragState.current;
      if (!drag) return;
      const next = Math.min(max, Math.max(min, drag.startWidth + (e.clientX - drag.startX)));
      onChange(next);
    },
    [min, max, onChange]
  );

  useEffect(() => {
    stopDragRef.current = () => {
      dragState.current = null;
      setIsResizing(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDragRef.current);
    };
    return () => stopDragRef.current();
  }, [onPointerMove]);

  const startDrag = useCallback(
    (e) => {
      dragState.current = { startX: e.clientX, startWidth: width };
      setIsResizing(true);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", stopDragRef.current);
    },
    [width, onPointerMove]
  );

  const handleProps = {
    role: "separator",
    "aria-orientation": "vertical",
    "aria-valuenow": Math.round(width),
    "aria-valuemin": min,
    "aria-valuemax": max,
    tabIndex: 0,
    onPointerDown: startDrag,
    onKeyDown: (e) => {
      if (e.key === "ArrowLeft") onChange(Math.max(min, width - ARROW_STEP));
      else if (e.key === "ArrowRight") onChange(Math.min(max, width + ARROW_STEP));
    },
  };

  return { isResizing, handleProps };
}
