"use client";

import { useGeneration } from "@/hooks/useGeneration";
import HistoryStrip from "./HistoryStrip";
import PromptPanel from "./PromptPanel";
import GenerationGrid from "./GenerationGrid";
import { ASPECT_RATIOS, IMAGE_COUNT_OPTIONS, IMAGE_MODELS, VIDEO_MODELS } from "@/lib/constants";

export default function WorkspaceShell({ mode }) {
  const { history, isGenerating, error, generate } = useGeneration(mode);
  const models = mode === "video" ? VIDEO_MODELS : IMAGE_MODELS;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      <HistoryStrip history={history} />

      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        <aside className="w-full lg:w-80">
          <PromptPanel
            mode={mode}
            aspectRatios={ASPECT_RATIOS}
            models={models}
            countOptions={IMAGE_COUNT_OPTIONS}
            isGenerating={isGenerating}
            onGenerate={generate}
          />
        </aside>

        <section className="flex flex-1 flex-col gap-3">
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <GenerationGrid mode={mode} history={history} isGenerating={isGenerating} />
        </section>
      </div>
    </div>
  );
}
