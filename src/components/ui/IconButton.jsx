"use client";

/**
 * Icon-only control. `label` is required because there is no visible text for
 * a screen reader to read, and it doubles as the native tooltip.
 */
export default function IconButton({
  label,
  active = false,
  size = "md",
  className = "",
  children,
  ...props
}) {
  const dimensions = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={props.role === "switch" ? undefined : active || undefined}
      className={`inline-flex shrink-0 items-center justify-center rounded-[var(--r-control)] transition-colors duration-150 active:translate-y-px ${dimensions} ${
        active
          ? "bg-accent-tint text-accent"
          : "text-text-muted hover:bg-surface-2 hover:text-text"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
