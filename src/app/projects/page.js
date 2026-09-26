import Image from "next/image";
import Link from "next/link";
import { Sparkle } from "@phosphor-icons/react/dist/ssr";
import { listProjects } from "@/lib/data/projects";
import ThemeToggle from "@/components/shell/ThemeToggle";

export const metadata = { title: "Projects · Fomi" };

// Covers and counts change with every generation.
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-[var(--r-control)] bg-accent-solid text-on-accent-solid"
          >
            <Sparkle size={17} weight="fill" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Fomi</span>
        </span>
        <ThemeToggle />
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-text-muted">
            Each project keeps its own collections, references and history.
            Nothing crosses between them.
          </p>

          <ul className="mt-8 grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/project/${project.id}/image`}
                  className="group block focus-visible:outline-none"
                >
                  {/* Keyboard focus gets its own ring on top of the hover
                      shadow, so a focused card reads as more prominent than a
                      merely-hovered one rather than identical to it. */}
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--r-panel)] border border-border bg-surface-2 shadow-[var(--shadow-panel)] ring-2 ring-transparent ring-offset-2 ring-offset-bg transition-[box-shadow] duration-300 group-hover:shadow-[var(--shadow-lift)] group-focus-visible:shadow-[var(--shadow-lift)] group-focus-visible:ring-accent">
                    {project.cover ? (
                      <Image
                        src={project.cover}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                      />
                    ) : (
                      <span className="grid h-full place-items-center text-[12px] text-text-muted">
                        Nothing generated yet
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <h2 className="text-[14px] font-semibold tracking-tight transition-colors group-hover:text-accent">
                      {project.name}
                    </h2>
                    <p className="mt-0.5 text-[12px] text-text-muted">
                      {project.client} · {project.collectionCount}{" "}
                      {project.collectionCount === 1 ? "collection" : "collections"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
