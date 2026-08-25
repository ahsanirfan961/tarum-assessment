"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderOpen,
  ImageSquare,
  MagnifyingGlass,
  SidebarSimple,
  Sparkle,
  SquaresFour,
  VideoCamera,
} from "@phosphor-icons/react";
import { useWorkspace } from "@/lib/store/WorkspaceProvider";
import IconButton from "@/components/ui/IconButton";

export default function Sidebar({ projectId, onOpenSearch }) {
  const pathname = usePathname();
  const collapsed = useWorkspace((s) => s.sidebarCollapsed);
  const toggleSidebar = useWorkspace((s) => s.toggleSidebar);
  const projectName = useWorkspace((s) => s.project.name);

  const appItems = [
    { key: "projects", label: "Projects", icon: SquaresFour, href: "/projects" },
    { key: "search", label: "Search", icon: MagnifyingGlass, onClick: onOpenSearch },
  ];

  const projectItems = [
    {
      key: "image",
      label: "Image",
      icon: ImageSquare,
      href: `/project/${projectId}/image`,
    },
    {
      key: "video",
      label: "Video",
      icon: VideoCamera,
      href: `/project/${projectId}/video`,
    },
  ];

  return (
    <nav
      aria-label="Primary"
      /* Width is a layout property, so it transitions in CSS rather than being
         driven frame by frame from JavaScript. */
      className={`relative hidden shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-300 ease-out md:flex ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      <div className="flex h-14 items-center gap-2 px-3">
        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-control)] bg-accent-solid text-on-accent-solid"
        >
          <Sparkle size={17} weight="fill" />
        </span>
        {!collapsed && (
          <span className="truncate text-[15px] font-semibold tracking-tight">Fomi</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3">
        {appItems.map((item) => (
          <SidebarItem
            key={item.key}
            item={item}
            collapsed={collapsed}
            active={item.href ? pathname === item.href : false}
          />
        ))}

        <div className="mt-5 mb-1 px-2">
          {collapsed ? (
            <div className="mx-auto h-px w-6 bg-border" />
          ) : (
            <p className="truncate text-[11px] font-medium text-text-muted">
              {projectName}
            </p>
          )}
        </div>

        {projectItems.map((item) => (
          <SidebarItem
            key={item.key}
            item={item}
            collapsed={collapsed}
            active={pathname === item.href}
          />
        ))}
      </div>

      <div className="border-t border-border p-3">
        <IconButton
          label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggleSidebar}
        >
          <SidebarSimple size={18} />
        </IconButton>
      </div>
    </nav>
  );
}

function SidebarItem({ item, collapsed, active }) {
  const Icon = item.icon;
  const className = `group flex h-9 items-center gap-2.5 rounded-[var(--r-control)] px-2 text-[13px] font-medium transition-colors ${
    active
      ? "bg-accent-tint text-accent"
      : "text-text-muted hover:bg-surface-2 hover:text-text"
  }`;

  const content = (
    <>
      <Icon
        size={18}
        weight={active ? "fill" : "regular"}
        aria-hidden
        className="shrink-0"
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </>
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        className={className}
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={item.onClick}
      className={className}
      title={collapsed ? item.label : undefined}
    >
      {content}
    </button>
  );
}

/** Compact-viewport replacement for the rail: a bottom tab bar. */
export function MobileNav({ projectId, onOpenSearch }) {
  const pathname = usePathname();
  const items = [
    { key: "projects", label: "Projects", icon: FolderOpen, href: "/projects" },
    { key: "image", label: "Image", icon: ImageSquare, href: `/project/${projectId}/image` },
    { key: "video", label: "Video", icon: VideoCamera, href: `/project/${projectId}/video` },
    { key: "search", label: "Search", icon: MagnifyingGlass, onClick: onOpenSearch },
  ];

  return (
    <nav
      aria-label="Primary"
      className="flex shrink-0 items-stretch border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {items.map(({ key, label, icon: Icon, href, onClick }) => {
        const active = href ? pathname === href : false;
        const inner = (
          <>
            <Icon size={20} weight={active ? "fill" : "regular"} aria-hidden />
            <span className="text-[10px] font-medium">{label}</span>
          </>
        );
        const className = `flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
          active ? "text-accent" : "text-text-muted"
        }`;

        return href ? (
          <Link
            key={key}
            href={href}
            className={className}
            aria-current={active ? "page" : undefined}
          >
            {inner}
          </Link>
        ) : (
          <button key={key} type="button" onClick={onClick} className={className}>
            {inner}
          </button>
        );
      })}
    </nav>
  );
}
