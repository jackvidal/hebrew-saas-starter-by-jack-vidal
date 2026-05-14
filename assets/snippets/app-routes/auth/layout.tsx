import Link from "next/link";
import { t } from "@/i18n/he";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/40">
      <header className="container mx-auto px-6 py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-semibold text-lg"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            L
          </span>
          {t.app.name}
        </Link>
      </header>
      <main className="container mx-auto flex min-h-[calc(100vh-160px)] items-center justify-center px-6 pb-12">
        {children}
      </main>
    </div>
  );
}
