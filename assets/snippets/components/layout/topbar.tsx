"use client";

import { LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { logoutAction } from "@/app/(auth)/actions";
import { t } from "@/i18n/he";

export function Topbar({
  fullName,
  email,
}: {
  fullName: string | null;
  email: string;
}) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm">
      <h1 className="text-base font-medium text-muted-foreground">
        {t.dashboard.welcome}
        {fullName ? `, ${fullName}` : ""}
      </h1>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <UserIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{fullName ?? "—"}</span>
              <span className="text-xs text-muted-foreground" dir="ltr">
                {email}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <form action={logoutAction}>
            <DropdownMenuItem asChild>
              <button
                type="submit"
                className="flex w-full cursor-pointer items-center gap-2 text-destructive"
              >
                <LogOut className="h-4 w-4" />
                {t.nav.logout}
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
