"use client";

import { useId } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, CaretDown } from "@phosphor-icons/react";

/**
 * Custom listbox rather than a native <select>. A native control can't be
 * restyled beyond its trigger — the open panel is OS-rendered, so it's the
 * one piece of chrome in the app that can't match the rest of the design.
 * Radix supplies the WAI-ARIA listbox behavior (roving focus, typeahead,
 * Escape/Enter handling) so only the visual layer here is custom.
 *
 * Label sits above the control, never inside it as a placeholder.
 */
export default function Select({ label, value, onChange, options, className = "" }) {
  const labelId = useId();
  const valueId = useId();

  const normalized = options.map((opt) => ({
    value: opt.value ?? opt,
    label: opt.label ?? opt,
  }));

  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange}>
      <div className={`flex flex-col gap-1.5 ${className}`}>
        <SelectPrimitive.Trigger
          /* References both the caption and the current value, so the
             accessible name reads "Model, Fomi Core v3" rather than losing
             the selected value the way a plain aria-label override would. */
          aria-labelledby={`${labelId} ${valueId}`}
          className="group flex h-10 w-full items-center justify-between gap-2 rounded-[var(--r-control)] border border-border bg-surface pl-3.5 pr-3 text-[13px] font-medium text-text outline-none transition-colors hover:border-border-strong focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/35 data-[state=open]:border-accent data-[state=open]:ring-2 data-[state=open]:ring-accent/20"
        >
          {/* The visible label lives here rather than floating above a native
              control's box, since the trigger IS the labelled field now. */}
          <span className="flex min-w-0 flex-1 flex-col items-start">
            <span id={labelId} className="text-[10px] font-medium leading-none text-text-muted">
              {label}
            </span>
            <SelectPrimitive.Value id={valueId} className="mt-0.5 truncate leading-none" />
          </span>
          <SelectPrimitive.Icon asChild>
            <CaretDown
              size={12}
              weight="bold"
              aria-hidden
              className="shrink-0 text-text-muted transition-transform duration-150 group-data-[state=open]:rotate-180"
            />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={6}
            className="z-50 overflow-hidden rounded-[var(--r-panel)] border border-border bg-surface shadow-[var(--shadow-lift)] [animation:select-in_140ms_ease-out] data-[state=closed]:[animation:select-out_100ms_ease-in]"
            style={{ width: "var(--radix-select-trigger-width)" }}
          >
            <SelectPrimitive.Viewport className="p-1.5">
              {normalized.map((opt) => (
                <SelectPrimitive.Item
                  key={opt.value}
                  value={opt.value}
                  className="relative flex cursor-pointer select-none items-center justify-between gap-2 rounded-[6px] px-3 py-2 text-[13px] text-text outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-accent-tint data-[highlighted]:text-accent"
                >
                  <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator>
                    <Check size={13} weight="bold" aria-hidden />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </div>
    </SelectPrimitive.Root>
  );
}
