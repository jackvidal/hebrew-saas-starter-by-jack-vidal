"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  CheckSquare,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/he";

const items = [
  { href: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
  { href: "/leads", label: t.nav.leads, icon: Users },
  { href: "/meetings", label: t.nav.meetings, icon: CalendarDays },
  { href: "/tasks", label: t.nav.tasks, icon: CheckSquare },
  { href: "/settings", label: t.nav.settings, icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-s border-border bg-card md:block">
      <div className="flex h-16 items-center gap-2 px-6 font-semibold">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          L
        </span>
        {t.app.name}
      </div>
      <nav className="mt-4 px-3">
        <ul className="space-y-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
