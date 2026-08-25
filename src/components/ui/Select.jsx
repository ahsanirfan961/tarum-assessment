"use client";

import { useId } from "react";
import { CaretDown } from "@phosphor-icons/react";

/** Label sits above the control, never inside it as a placeholder. */
export default function Select({ label, value, onChange, options, className = "" }) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label
        htmlFor={id}
        className="text-[11px] font-medium tracking-wide text-text-muted"
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full cursor-pointer appearance-none rounded-[var(--r-control)] border border-border bg-surface pl-2.5 pr-7 text-[13px] font-medium text-text transition-colors hover:border-border-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
        >
          {options.map((opt) => (
            <option key={opt.value ?? opt} value={opt.value ?? opt}>
              {opt.label ?? opt}
            </option>
          ))}
        </select>
        <CaretDown
          size={12}
          weight="bold"
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted"
        />
      </div>
    </div>
  );
}
