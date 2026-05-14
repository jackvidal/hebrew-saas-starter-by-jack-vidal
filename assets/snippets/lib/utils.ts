import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const HEBREW_LOCALE = "he-IL";
const HEBREW_TZ = "Asia/Jerusalem";

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(HEBREW_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: HEBREW_TZ,
  }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(HEBREW_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: HEBREW_TZ,
  }).format(d);
}

export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = d.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat(HEBREW_LOCALE, { numeric: "auto" });

  const abs = Math.abs(diffMin);
  if (abs < 60) return rtf.format(diffMin, "minute");
  if (abs < 60 * 24) return rtf.format(Math.round(diffMin / 60), "hour");
  if (abs < 60 * 24 * 30) return rtf.format(Math.round(diffMin / 60 / 24), "day");
  return formatDate(d);
}

export function toDateTimeLocalValue(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}
