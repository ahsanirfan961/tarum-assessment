"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CaretDown, GitBranch, Sparkle, X } from "@phosphor-icons/react";
import { useWorkspace } from "@/lib/store/WorkspaceProvider";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import Select from "@/components/ui/Select";

const IMAGE_MODELS = ["Fomi Core v3", "Fomi Photoreal", "Fomi Ink"];
const VIDEO_MODELS = ["Fomi Motion v2", "Fomi Cinematic"];
const IMAGE_RATIOS = ["1:1", "4:5", "3:4", "16:9"];
const VIDEO_RATIOS = ["16:9", "9:16", "1:1"];
const COUNTS = ["1", "2", "4", "6"];
const QUALITY = [
  { value: "draft", label: "Draft, fastest" },
  { value: "standard", label: "Standard" },
  { value: "refined", label: "Refined, slowest" },
];
const RESOLUTIONS = ["1K", "2K", "4K"];

export default function ConfigForm({ kind }) {
  const promptId = useId();
  const reduce = useReducedMotion();

  const selectedNodeId = useWorkspace((s) => s.selectedNodeId);
  const referenceIds = useWorkspace((s) => s.referenceIds);
  const isGenerating = useWorkspace((s) => s.isGenerating);
  const error = useWorkspace((s) => s.error);
  const findNode = useWorkspace((s) => s.findNode);
  const selectNode = useWorkspace((s) => s.selectNode);
  const toggleReference = useWorkspace((s) => s.toggleReference);
  const generate = useWorkspace((s) => s.generate);

  const isVideo = kind === "video";
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(isVideo ? "2" : "4");
  const [aspectRatio, setAspectRatio] = useState(isVideo ? "16:9" : "1:1");
  const [model, setModel] = useState(isVideo ? VIDEO_MODELS[0] : IMAGE_MODELS[0]);
  const [quality, setQuality] = useState("standard");
  const [resolution, setResolution] = useState("2K");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [intent, setIntent] = useState("regen");

  const parent = selectedNodeId ? findNode(selectedNodeId) : null;

  // Which take + intent produced the selection the composer is showing right
  // now, so a chained "Continue" can be told apart from an ordinary click
  // onto some other take (both just change `selectedNodeId`). Set from
  // handleSubmit, an event handler, so it's safe to read during render.
  const [lastSubmit, setLastSubmit] = useState({ intent: null, beat: null });

  // Iterating means editing a few words of the previous prompt, never retyping
  // it, so selecting a take loads its prompt and settings ready to change.
  // Adjusted during render rather than in an effect, so the composer is already
  // filled on the frame the selection lands.
  const [loadedFrom, setLoadedFrom] = useState(null);
  if (parent && parent.node.id !== loadedFrom) {
    const continuingChain =
      isVideo &&
      lastSubmit.intent === "extend" &&
      lastSubmit.beat != null &&
      parent.node.beat === lastSubmit.beat + 1;
    setLoadedFrom(parent.node.id);
    setIntent(continuingChain ? "extend" : "regen");
    setPrompt(continuingChain ? "" : parent.node.prompt);
    setAspectRatio(parent.node.aspectRatio);
    setModel(parent.node.model);
    if (parent.node.quality) setQuality(parent.node.quality);
    if (parent.node.resolution) setResolution(parent.node.resolution);
  } else if (!parent && loadedFrom !== null) {
    setLoadedFrom(null);
    setIntent("regen");
  }

  // Only ever rewrites text the user hasn't typed over: leaves an edited
  // prompt alone when the operation is switched.
  function changeIntent(next) {
    setIntent(next);
    if (!parent) return;
    if (next === "extend" && prompt === parent.node.prompt) {
      setPrompt("");
    } else if (next === "regen" && prompt === "") {
      setPrompt(parent.node.prompt);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    setLastSubmit({ intent, beat: parent?.node.beat ?? null });
    await generate({
      kind,
      prompt,
      count: Number(count),
      aspectRatio,
      model,
      quality,
      resolution,
      intent,
    });
    setPrompt("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      {/* overscroll-contain: this panel scrolls independently of the page (or,
          in the mobile sheet, of the canvas behind it) and should never hand
          off an over-scroll to whatever is behind it. */}
      <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
        <AnimatePresence initial={false}>
          {parent && (
            <motion.div
              key="lineage"
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2.5 rounded-[var(--r-panel)] border border-accent/35 bg-accent-tint p-2">
                <Image
                  src={parent.node.url}
                  alt=""
                  width={36}
                  height={36}
                  className="h-9 w-9 shrink-0 rounded-md object-cover"
                />
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px] font-medium text-text">
                  <GitBranch size={13} weight="bold" aria-hidden className="shrink-0 text-accent" />
                  <span className="truncate">
                    {isVideo && intent === "extend"
                      ? "Continuing after this take"
                      : "Branching from this take"}
                  </span>
                </span>
                <IconButton
                  label="Stop branching, start a new collection"
                  size="sm"
                  onClick={() => selectNode(selectedNodeId)}
                >
                  <X size={13} weight="bold" />
                </IconButton>
              </div>

              {isVideo && (
                <fieldset className="mt-2 flex gap-1 rounded-[var(--r-control)] border border-border bg-surface-2 p-1">
                  <legend className="sr-only">Operation</legend>
                  {[
                    { value: "regen", label: "New take" },
                    { value: "extend", label: "Continue" },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`flex-1 cursor-pointer rounded-[calc(var(--r-control)-4px)] px-2 py-1.5 text-center text-[12px] font-medium transition-colors ${
                        intent === option.value
                          ? "bg-surface text-text shadow-[var(--shadow-panel)]"
                          : "text-text-muted hover:text-text"
                      }`}
                    >
                      <input
                        type="radio"
                        name="intent"
                        value={option.value}
                        checked={intent === option.value}
                        onChange={() => changeIntent(option.value)}
                        className="sr-only"
                      />
                      {option.label}
                    </label>
                  ))}
                </fieldset>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {referenceIds.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-text-muted">
              References ({referenceIds.length})
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {referenceIds.map((id) => {
                const ref = findNode(id);
                if (!ref) return null;
                return (
                  <li key={id} className="group relative">
                    <Image
                      src={ref.node.url}
                      alt={`Reference from ${ref.collection.name}`}
                      width={44}
                      height={44}
                      className="h-11 w-11 rounded-md border border-border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => toggleReference(id)}
                      aria-label={`Remove reference from ${ref.collection.name}`}
                      title={`Remove reference from ${ref.collection.name}`}
                      className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-text text-bg opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <X size={9} weight="bold" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor={promptId} className="sr-only">
            Prompt
          </label>
          <textarea
            id={promptId}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(e);
            }}
            rows={5}
            placeholder={
              parent && isVideo && intent === "extend"
                ? "Describe what happens next…"
                : parent
                  ? "What should change in this take…"
                  : isVideo
                    ? "Describe the shot, the motion, and the light…"
                    : "Describe the frame, the light, and the mood…"
            }
            className="w-full resize-none rounded-[var(--r-panel)] border border-border bg-surface p-3 text-[13px] leading-relaxed text-text transition-colors placeholder:text-text-muted hover:border-border-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select label="Takes" value={count} onChange={setCount} options={COUNTS} />
          <Select
            label="Ratio"
            value={aspectRatio}
            onChange={setAspectRatio}
            options={isVideo ? VIDEO_RATIOS : IMAGE_RATIOS}
          />
        </div>

        <Select
          label="Model"
          value={model}
          onChange={setModel}
          options={isVideo ? VIDEO_MODELS : IMAGE_MODELS}
        />

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            className="flex w-full items-center justify-between rounded-[var(--r-control)] px-1 py-2 text-[12px] font-medium text-text-muted transition-colors hover:text-text"
          >
            Advanced
            <CaretDown
              size={12}
              weight="bold"
              aria-hidden
              className={`transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`}
            />
          </button>

          <AnimatePresence initial={false}>
            {showAdvanced && (
              <motion.div
                initial={reduce ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Select
                    label="Quality"
                    value={quality}
                    onChange={setQuality}
                    options={QUALITY}
                  />
                  <Select
                    label="Resolution"
                    value={resolution}
                    onChange={setResolution}
                    options={RESOLUTIONS}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {error && (
          <p role="alert" className="text-[12px] font-medium text-accent-solid">
            {error}
          </p>
        )}
      </div>

      <div className="shrink-0 border-t border-border p-3">
        <Button
          type="submit"
          variant="primary"
          disabled={!prompt.trim() || isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Sparkle size={15} weight="fill" aria-hidden className="animate-pulse" />
              Generating
            </>
          ) : (
            <>
              <Sparkle size={15} weight="fill" aria-hidden />
              {parent && isVideo && intent === "extend"
                ? "Generate continuation"
                : parent
                  ? "Generate variants"
                  : "Generate"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
