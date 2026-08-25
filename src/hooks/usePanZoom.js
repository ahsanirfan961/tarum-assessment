"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMotionValue } from "motion/react";

const MIN_SCALE = 0.25;
const MAX_SCALE = 2;

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

/**
 * Pan and zoom for the lineage canvas.
 *
 * Position and scale live in motion values rather than React state, so dragging
 * and pinching never re-render the tree. Layout is computed once in absolute
 * coordinates and this only moves the container that holds it.
 */
export function usePanZoom({ contentWidth, contentHeight }) {
  const viewportRef = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const panState = useRef(null);

  const fit = useCallback(() => {
    const el = viewportRef.current;
    if (!el || !contentWidth || !contentHeight) return;
    const { width, height } = el.getBoundingClientRect();
    const next = clamp(
      Math.min(width / contentWidth, height / contentHeight, 1),
      MIN_SCALE,
      MAX_SCALE
    );
    scale.set(next);
    x.set((width - contentWidth * next) / 2);
    y.set((height - contentHeight * next) / 2);
  }, [contentWidth, contentHeight, scale, x, y]);

  const zoomBy = useCallback(
    (factor, origin) => {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = origin?.x ?? rect.width / 2;
      const py = origin?.y ?? rect.height / 2;

      const current = scale.get();
      const next = clamp(current * factor, MIN_SCALE, MAX_SCALE);
      if (next === current) return;

      // Keep the point under the cursor anchored while scaling.
      const ratio = next / current;
      x.set(px - (px - x.get()) * ratio);
      y.set(py - (py - y.get()) * ratio);
      scale.set(next);
    },
    [scale, x, y]
  );

  // Non-passive so ctrl/cmd + wheel can zoom instead of zooming the browser.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      } else {
        x.set(x.get() - e.deltaX);
        y.set(y.get() - e.deltaY);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomBy, x, y]);

  const onPointerDown = useCallback(
    (e) => {
      // Only drag from the canvas backdrop, never from a node.
      if (e.target.closest("[data-graph-node]")) return;
      const el = viewportRef.current;
      el?.setPointerCapture?.(e.pointerId);
      panState.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: x.get(),
        originY: y.get(),
      };
    },
    [x, y]
  );

  const onPointerMove = useCallback(
    (e) => {
      const pan = panState.current;
      if (!pan || pan.pointerId !== e.pointerId) return;
      x.set(pan.originX + (e.clientX - pan.startX));
      y.set(pan.originY + (e.clientY - pan.startY));
    },
    [x, y]
  );

  const onPointerUp = useCallback((e) => {
    if (panState.current?.pointerId !== e.pointerId) return;
    viewportRef.current?.releasePointerCapture?.(e.pointerId);
    panState.current = null;
  }, []);

  useEffect(() => {
    fit();
  }, [fit]);

  return {
    viewportRef,
    x,
    y,
    scale,
    fit,
    zoomIn: () => zoomBy(1.25),
    zoomOut: () => zoomBy(1 / 1.25),
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
