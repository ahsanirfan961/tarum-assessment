"use client";

import Image from "next/image";
import { FilmStrip, WarningCircle } from "@phosphor-icons/react";
import { isFailed } from "@/lib/takes";

/**
 * A take's picture wherever one is shown small: the image, or a video's
 * poster. A video take that is still rendering has no picture yet, and one
 * that failed never will, so those get a placeholder of the same size instead
 * of a broken image. Takes `next/image` props (`fill`, `width`, `sizes`...).
 */
export default function TakeImage({ node, alt = "", fill, className = "", iconSize = 14, ...rest }) {
  if (node?.url) {
    return <Image src={node.url} alt={alt} fill={fill} className={className} {...rest} />;
  }

  const failed = isFailed(node);
  return (
    <span
      aria-hidden
      className={`${fill ? "absolute inset-0" : ""} grid place-items-center text-text-muted ${
        failed ? "bg-surface-2" : "take-rendering"
      } ${className}`}
    >
      {failed ? (
        <WarningCircle size={iconSize} weight="bold" />
      ) : (
        <FilmStrip size={iconSize} className="opacity-60" />
      )}
    </span>
  );
}
