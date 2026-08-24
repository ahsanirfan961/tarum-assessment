"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS = {
  image: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" className="h-5 w-5">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" />
      <circle cx="8.5" cy="9.5" r="1.5" stroke="currentColor" />
      <path d="m3 16 5-5 4 4 3-3 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  video: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" className="h-5 w-5">
      <rect x="3" y="6" width="13" height="12" rx="2" stroke="currentColor" />
      <path d="M16 10.5 21 8v8l-5-2.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export default function TopNav() {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-surface/80 px-4 py-3 backdrop-blur sm:px-6">
      <Link href="/workspace/image" className="text-xl font-black tracking-tight">
        F
      </Link>

      <nav className="hidden items-center gap-1 rounded-full border border-border bg-background p-1 sm:flex">
        {["image", "video"].map((key) => {
          const href = `/workspace/${key}`;
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={key}
              href={href}
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              {ICONS[key]}
              {key}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground-muted hover:text-foreground sm:flex"
        >
          Gallery
        </button>
        <button
          type="button"
          className="hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground-muted hover:text-foreground sm:flex"
        >
          Support
        </button>
        <div className="h-9 w-9 shrink-0 rounded-full bg-surface-muted" aria-hidden />
      </div>
    </header>
  );
}
