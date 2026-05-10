# Hebrew RTL Recipe — conventions that don't break

## Foundation — `src/app/layout.tsx`

```tsx
import { Heebo } from "next/font/google";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
});

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
```

Three things that matter:
- `lang="he"` for screen readers + browser hyphenation
- `dir="rtl"` for the entire app
- `suppressHydrationWarning` because the dark-mode init script modifies `<html>` before React hydrates

## Tailwind logical properties

The convention: **never** use `ml-`, `mr-`, `left-`, `right-`. Always use the logical equivalents:

| Don't use | Use |
|---|---|
| `ml-2` (margin-left) | `ms-2` (margin-start, RTL-aware) |
| `mr-2` (margin-right) | `me-2` (margin-end) |
| `pl-3` | `ps-3` |
| `pr-3` | `pe-3` |
| `left-0` | `start-0` |
| `right-0` | `end-0` |
| `border-l` | `border-s` |
| `rounded-tl-lg` | `rounded-ts-lg` |
| `text-left` | `text-start` |
| `text-right` | `text-end` |

In RTL, `start = right` and `end = left`. The components automatically flip — no media queries needed.

## Mixed Hebrew + Latin content

The biggest visual bug in RTL apps: emails and URLs render mirrored ("moc.elpmaxe@user" instead of "user@example.com") when embedded in Hebrew text.

Fix: wrap them in `<bdi>` (bidirectional isolate):

```tsx
// In a Hebrew table row showing an email:
<td dir="ltr">
  <bdi>{lead.email}</bdi>
</td>

// Or inline:
<a href={`mailto:${email}`} dir="ltr" className="...">
  <bdi>{email}</bdi>
</a>
```

`<bdi>` tells the browser "this content has its own direction, don't let surrounding RTL flow affect it." Works for emails, URLs, phone numbers, code snippets, anything with mixed scripts.

For convenience, `globals.css` defines a helper:

```css
@layer base {
  bdi,
  .ltr {
    direction: ltr;
    unicode-bidi: isolate;
  }
}
```

So you can also use `<span className="ltr">user@example.com</span>` if you don't want a `<bdi>` element.

## Hebrew dates and numbers

```ts
// src/lib/utils.ts
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

export function formatDateTime(date: Date | string | null | undefined): string { /* ... */ }

export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = d.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat(HEBREW_LOCALE, { numeric: "auto" });
  // returns "לפני 5 דקות", "מחר", etc.
  // ...
}
```

`Intl.DateTimeFormat` and `Intl.RelativeTimeFormat` natively handle Hebrew. You get "10.05.2026" and "לפני שעה" for free.

## i18n single source — `src/i18n/he.ts`

```ts
export const t = {
  app: { name: "JackCRM", tagline: "..." },
  nav: { dashboard: "דשבורד", leads: "לידים", ... },
  auth: { login: "התחברות", email: "אימייל", ... },
  leads: {
    title: "לידים",
    new: "ליד חדש",
    fields: { fullName: "שם מלא", email: "אימייל", ... },
    status: {
      NEW: "ליד חדש",
      MEETING_SCHEDULED: "נקבעה פגישה",
      // ...
    },
  },
  errors: { generic: "אירעה שגיאה. אנא נסו שוב.", ... },
  common: { loading: "טוען...", save: "שמירה", cancel: "ביטול", ... },
} as const;
```

Use everywhere:

```tsx
import { t } from "@/i18n/he";
<Button>{t.common.save}</Button>
<h1>{t.leads.title}</h1>
```

The `as const` gives you autocomplete on every key + compile-time error if you typo a path.

## Forms with mixed-direction fields

Email and URL fields should be LTR even in an RTL form. Set `dir="ltr"` + `text-start`:

```tsx
<Input
  type="email"
  name="email"
  dir="ltr"
  className="text-start"  // text-start in dir=ltr context = left-aligned
  defaultValue={lead?.email ?? ""}
/>
```

The label stays Hebrew (RTL-aligned), the input text flows LTR. Best of both.

## RTL-specific shadcn quirks

Most shadcn components work in RTL because they use logical properties internally. The few that need patches:

- **DropdownMenu** — the `ChevronLeft` icon for sub-menus needs to be `ChevronRight` in RTL (or just use the original `ChevronLeft` which now visually points "back" in RTL — semantically correct)
- **Sheet** — the slide direction defaults to "right" which means "from-end" in RTL = visually from the left. Usually what you want.
- **Dialog** — `start-[50%] translate-x-[50%]` instead of `left-[50%] -translate-x-[50%]` for centering
- **Toast** — viewport position uses `start-0` not `left-0`

The components in [assets/snippets/ui/](../assets/snippets/ui/) are already corrected.

## Don't fight cursor direction in inputs

When a user types in a Hebrew input, the cursor moves right-to-left. When they paste a URL, the URL flows LTR but the cursor "snaps" to the end of the URL (which is on the left). This is correct behavior — don't try to "fix" it. Users are accustomed to this.

## Test pass for any new screen

1. **Visual** — Hebrew text aligns to the right; tables read right-to-left
2. **No leakage** — no `ml-`/`mr-`/`left-`/`right-` in your new code (grep for them)
3. **Mixed content** — any embedded email/URL is inside `<bdi>` or `dir="ltr"`
4. **Dates** — show "10.05.2026" not "5/10/2026"
5. **Resize** — UI works at 320px wide (Hebrew labels can wrap awkwardly without testing)
