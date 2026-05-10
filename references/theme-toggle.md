# Dark Mode Toggle Recipe

Class-based dark mode (no extra dependencies) + a no-flash hydration script.

## Why class-based, not media-query-only

- Lets users override the OS preference (some users want dark mode in a light-themed OS)
- Choice persists across sessions via localStorage
- All shadcn components already work because their CSS variables have `.dark` overrides

## The CSS — `src/app/globals.css`

Already in the template. The dark variables live under `.dark`:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222 47% 11%;
    /* ...all the light tokens... */
  }
  .dark {
    --background: 222 47% 7%;
    --foreground: 210 40% 98%;
    /* ...all the dark tokens... */
  }
}
```

Tailwind config:

```ts
// tailwind.config.ts
const config: Config = {
  darkMode: ["class"],  // <-- this enables the .dark class
  // ...
};
```

## The no-flash inline script — `src/app/layout.tsx`

This is the critical bit. Without it, dark-mode users see a white flash on every page load before React hydrates.

```tsx
// Runs synchronously in <head> BEFORE React hydrates
const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem("theme");
    var systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (stored === "dark" || (!stored && systemDark)) {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="...">{children}</body>
    </html>
  );
}
```

Why this works:
- The script runs synchronously, before React hydrates
- It checks localStorage first (user's explicit choice), then falls back to OS preference
- It sets the `dark` class on `<html>` if needed
- The CSS variables under `.dark` take effect immediately, BEFORE the first paint
- `suppressHydrationWarning` on `<html>` prevents React from complaining about the className mismatch (server says no dark, client may say dark)

## The toggle component — `src/components/layout/theme-toggle.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n/he";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Sync with the actual class set by the inline script
    setIsDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Private mode etc. — ignore
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
      {/* Render placeholder until mounted to avoid icon flip on first render */}
      {mounted ? (
        isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
      ) : (
        <span className="h-4 w-4" />
      )}
    </Button>
  );
}
```

Why the `mounted` flag? Because on first render, `isDark` is `false` (SSR default), but the inline script may have set the class to `dark`. Without the flag, the icon shows the wrong state for one frame, then flips. With it, we render an empty placeholder until we've checked the actual class.

## Wire into the topbar

```tsx
// src/components/layout/topbar.tsx
import { ThemeToggle } from "@/components/layout/theme-toggle";

<header>
  <h1>{...}</h1>
  <div className="flex items-center gap-1">
    <ThemeToggle />
    <DropdownMenu> {/* user menu */} </DropdownMenu>
  </div>
</header>
```

## i18n strings — `src/i18n/he.ts`

```ts
theme: {
  switchToDark: "עבור למצב כהה",
  switchToLight: "עבור למצב בהיר",
},
```

## Smoke test

1. Open the app in light mode
2. Click the toggle → instantly switches to dark
3. Refresh the page → still dark (localStorage persists)
4. Toggle back to light
5. Refresh → still light
6. Clear localStorage, refresh → respects OS preference
7. Disable JavaScript, set OS to dark, reload → page is dark on first paint (the inline script ran before any JS)

## Don't extend without thinking

- **Don't add a "system" tri-state** unless asked. The 2-state toggle + automatic OS-fallback-on-first-visit covers 99% of users.
- **Don't store theme in cookies / DB** unless you need server-side rendering of the correct theme. The current setup has the inline script handle it before paint, so cookies aren't needed.
- **Don't animate the transition between light and dark.** It looks jarring across an entire page; users perceive instant as "responsive."
