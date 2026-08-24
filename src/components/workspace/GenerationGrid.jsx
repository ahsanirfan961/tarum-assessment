import Image from "next/image";

export default function GenerationGrid({ mode, history, isGenerating }) {
  if (history.length === 0 && !isGenerating) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center">
        <p className="text-sm font-medium text-foreground">
          Nothing generated yet
        </p>
        <p className="max-w-xs text-sm text-foreground-muted">
          Describe what you want on the left and hit Generate to see{" "}
          {mode === "video" ? "clips" : "images"} appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
      {isGenerating && <GenerationSkeleton />}

      {history.map((gen) => (
        <article key={gen.id} className="flex flex-col gap-3 sm:flex-row">
          <div className="flex shrink-0 flex-col gap-2 rounded-2xl border border-border bg-surface p-4 text-sm sm:w-64">
            <p className="text-foreground">{gen.prompt}</p>
            <span className="w-fit rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-foreground-muted">
              {gen.model}
            </span>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
            {gen.items.map((item) => (
              <ResultCard key={item.id} mode={gen.type} item={item} />
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function ResultCard({ mode, item }) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl bg-surface-muted">
      <Image
        src={item.thumbnail || item.url}
        alt=""
        fill
        sizes="(min-width: 640px) 25vw, 50vw"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
      />
      {mode === "video" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-foreground">
            ▶
          </span>
        </div>
      )}
    </div>
  );
}

function GenerationSkeleton() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="h-24 shrink-0 animate-pulse rounded-2xl bg-surface-muted sm:w-64" />
      <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-xl bg-surface-muted" />
        ))}
      </div>
    </div>
  );
}
