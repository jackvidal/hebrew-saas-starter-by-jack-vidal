// src/app/layout.tsx — root layout with RTL + theme init script

import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { t } from "@/i18n/he";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: t.app.name, template: `%s · ${t.app.name}` },
  description: t.app.tagline,
};

// Runs synchronously before React hydrates. Without this, dark-mode users
// see a white flash on first paint.
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
