"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/he";

export function ThemeToggle() {
  // Default to false on SSR; sync with the actual class on mount.
  // The inline script in root layout sets the class before hydration,
  // so the icon settles to the right state on the first useEffect tick.
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    // Cookie is what the server reads on next page load (no flash).
    document.cookie = `theme=${next ? "dark" : "light"}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // localStorage may be unavailable (private mode, restricted iframe).
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? t.theme.switchToLight : t.theme.switchToDark}
      title={isDark ? t.theme.switchToLight : t.theme.switchToDark}
    >
      {/* Render a stable placeholder until mounted, otherwise the icon
          flips on first render and looks twitchy on slow connections. */}
      {mounted ? (
        isDark ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )
      ) : (
        <span className="h-4 w-4" />
      )}
    </Button>
  );
}
