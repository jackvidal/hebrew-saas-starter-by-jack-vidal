"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

type View = "list" | "board";

export function ViewToggle({ current }: { current: View }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const switchTo = (next: View) => {
    const search = new URLSearchParams(params.toString());
    if (next === "list") search.delete("view");
    else search.set("view", "board");
    router.replace(`${pathname}?${search.toString()}`);
  };

  return (
    <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-sm">
      <button
        type="button"
        onClick={() => switchTo("list")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded px-2.5 py-1 transition",
          current === "list"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <List className="h-3.5 w-3.5" />
        טבלה
      </button>
      <button
        type="button"
        onClick={() => switchTo("board")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded px-2.5 py-1 transition",
          current === "board"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        לוח
      </button>
    </div>
  );
}
