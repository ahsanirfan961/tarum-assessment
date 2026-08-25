"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "@/hooks/useTheme";
import IconButton from "@/components/ui/IconButton";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <IconButton
      label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
    >
      {isDark ? <Moon size={17} weight="fill" /> : <Sun size={17} />}
    </IconButton>
  );
}
