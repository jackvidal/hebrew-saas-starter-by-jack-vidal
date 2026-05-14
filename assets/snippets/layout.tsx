import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { cookies } from "next/headers";
import { Toaster } from "@/components/ui/toaster";
import { t } from "@/i18n/he";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: t.app.name,
    template: `%s · ${t.app.name}`,
  },
  description: t.app.tagline,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Server-side theme detection — reads a cookie set by ThemeToggle.
  // First-time visitors get light mode; once they toggle, the cookie
  // ensures the correct class is on <html> from the server on every
  // subsequent request → no flash, no inline script, no React warning.
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value;
  const isDark = theme === "dark";

  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable}${isDark ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
