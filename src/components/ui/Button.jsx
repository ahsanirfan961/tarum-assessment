"use client";

const VARIANTS = {
  primary:
    "bg-accent-solid text-on-accent-solid hover:bg-accent-solid-hover shadow-sm",
  secondary:
    "bg-surface text-text border border-border hover:border-border-strong hover:bg-surface-2",
  ghost: "text-text-muted hover:text-text hover:bg-surface-2",
};

const SIZES = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export default function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center rounded-[var(--r-control)] font-medium transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-45 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
}
