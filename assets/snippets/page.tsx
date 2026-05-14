import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Sparkles, CalendarCheck, Users, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/i18n/he";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/30">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur-md sticky top-0 z-30">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2 font-semibold text-lg">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              L
            </span>
            <span>{t.app.name}</span>
          </div>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">{t.auth.login}</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">
                {t.auth.signup}
                <ArrowLeft className="ms-2 h-4 w-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-6 py-24 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            ניהול לידים מתקדם עם בינה מלאכותית
          </span>
          <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-6xl">
            CRM פשוט. חכם.
            <br />
            <span className="bg-gradient-to-l from-primary to-blue-400 bg-clip-text text-transparent">
              ובעברית מלאה.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            נהלו לידים, פגישות וניתוחי אתרים — הכל במקום אחד, עם אינטגרציה
            ל־Cal.com ויכולות AI מתקדמות.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/signup">התחילו בחינם</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">יש לי כבר חשבון</Link>
            </Button>
          </div>
        </section>

        <section className="container mx-auto px-6 pb-24">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Feature
              icon={<Users className="h-5 w-5" />}
              title="ניהול לידים"
              body="יצירה, עריכה, חיפוש וסינון לידים עם הערות פנימיות ומעקב סטטוס."
            />
            <Feature
              icon={<CalendarCheck className="h-5 w-5" />}
              title="פגישות"
              body="חיבור פגישות לכל ליד, תזמון, סטטוסים וסיכומי פגישה."
            />
            <Feature
              icon={<Sparkles className="h-5 w-5" />}
              title="ניתוח אתר עם AI"
              body="הזינו URL וקבלו ניתוח מקיף — נקודות חולשה, הזדמנויות, ושירותים מומלצים."
            />
            <Feature
              icon={<Webhook className="h-5 w-5" />}
              title="אוטומציה עם Cal.com"
              body="פגישה שנקבעת ב־Cal.com יוצרת ליד אוטומטית ומעדכנת את הסטטוס."
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} {t.app.name}
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm transition hover:shadow-md">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
