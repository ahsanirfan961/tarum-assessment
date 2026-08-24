import Image from "next/image";

export default function HistoryStrip({ history }) {
  const thumbnails = history.flatMap((gen) =>
    gen.items.map((item) => ({
      key: item.id,
      src: item.thumbnail || item.url,
    }))
  );

  return (
    <div className="flex items-stretch gap-3 overflow-x-auto rounded-2xl border border-border bg-surface p-3">
      <div className="flex shrink-0 flex-col justify-center gap-0.5 pr-3">
        <span className="text-sm font-semibold">History</span>
        <span className="text-xs text-foreground-muted">View all</span>
      </div>

      {thumbnails.length === 0 ? (
        <div className="flex flex-1 items-center px-2 text-sm text-foreground-muted">
          Your recent generations will appear here.
        </div>
      ) : (
        thumbnails.slice(0, 14).map((thumb) => (
          <div
            key={thumb.key}
            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-muted"
          >
            <Image src={thumb.src} alt="" fill sizes="64px" className="object-cover" />
          </div>
        ))
      )}
    </div>
  );
}
