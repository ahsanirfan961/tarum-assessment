"use client";

import { useState } from "react";

export default function PromptPanel({
  mode,
  aspectRatios,
  models,
  countOptions,
  isGenerating,
  onGenerate,
}) {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState(aspectRatios[0]);
  const [model, setModel] = useState(models[0]);
  const [count, setCount] = useState(countOptions[1] ?? countOptions[0]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const placeholder =
    mode === "video"
      ? "Describe the scene you want to bring to motion…"
      : "Describe your imagination to be converted to a piece of art…";

  async function handleSubmit(e) {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    await onGenerate({ prompt, aspectRatio, model, count });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex h-full flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-surface p-4"
    >
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={placeholder}
        rows={5}
        className="w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none placeholder:text-foreground-muted focus:border-accent"
      />

      <button
        type="submit"
        disabled={!prompt.trim() || isGenerating}
        className="flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isGenerating ? "Generating…" : "✦ Generate"}
      </button>

      <div className="grid grid-cols-2 gap-2">
        <Select
          label="# Images"
          value={count}
          onChange={(v) => setCount(Number(v))}
          options={countOptions}
        />
        <Select
          label="Ratio"
          value={aspectRatio}
          onChange={setAspectRatio}
          options={aspectRatios}
        />
      </div>

      <Select label="Model" value={model} onChange={setModel} options={models} fullWidth />

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium"
      >
        Advanced
        <span className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}>⌄</span>
      </button>

      {showAdvanced && (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3 text-xs text-foreground-muted">
          Seed, guidance and negative-prompt controls land here once the model
          backend is wired up.
        </div>
      )}

      <button
        type="button"
        className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium"
      >
        Styles
        <span>⌄</span>
      </button>
    </form>
  );
}

function Select({ label, value, onChange, options, fullWidth }) {
  return (
    <label className={`flex flex-col gap-1 text-xs text-foreground-muted ${fullWidth ? "col-span-2" : ""}`}>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-2 py-2 text-sm font-medium text-foreground outline-none focus:border-accent"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}
