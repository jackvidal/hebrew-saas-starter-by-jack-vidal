# Auth Recipe — Supabase + Next.js App Router

The clean Supabase auth setup with Next.js 16: server/client/middleware split, the `getCurrentUser()` helper, and the route-group-based gate.

## The three Supabase clients

You need three different Supabase clients for three different Next.js execution contexts. The split looks redundant but each one handles cookies differently.

### 1. Browser client — `src/lib/supabase/client.ts`

```ts
"use client";
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

Use in `'use client'` components for live auth state, real-time subscriptions, etc. (Most of the time you won't need it — the server client covers most patterns.)

### 2. Server client — `src/lib/supabase/server.ts`

```ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore when middleware refreshes sessions.
          }
        },
      },
    },
  );
}
```

Use in server components, route handlers, and server actions. The `try/catch` around `setAll` is needed because Next.js disallows cookie writes in some server-component contexts.

### 3. Middleware client — `src/lib/supabase/middleware.ts`

This one's special — it lives inside the Edge runtime middleware, refreshes the session cookie on every request, and does the auth-gate redirect:

```ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/leads", "/meetings", "/settings"];
const AUTH_PAGES = ["/login", "/signup"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[],
        ) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
  const isAuthPage = AUTH_PAGES.some((p) => path === p);

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
```

Then `src/middleware.ts` (the entry point Next.js looks for):

```ts
import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

⚠️ The `api/webhooks` exclusion is important — webhooks have no Supabase session, they auth via HMAC. If middleware ran on them, every webhook would 307 to `/login`.

## The `getCurrentUser` helper — `src/lib/auth.ts`

```ts
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Profile } from "@prisma/client";

export async function getCurrentUser(): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Defensive: trigger should have created the profile, but upsert just in case
  let profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile) {
    profile = await prisma.profile.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email ?? "",
        fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
      },
      update: {},
    });
  }
  return profile;
}

export async function requireUser(): Promise<Profile> {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login");
  return profile;
}
```

Use `requireUser()` in protected server components / route handlers — it redirects unauthenticated users.

Use `getCurrentUser()` when you want to check auth without redirecting (e.g., a page that renders different content for logged-in vs anon).

## Auth server actions — `src/app/(auth)/actions.ts`

```ts
"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().trim().email("כתובת אימייל לא תקינה"),
  password: z.string().min(6, "סיסמה חייבת להיות באורך 6 תווים לפחות"),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(1, "שם מלא הוא שדה חובה").max(100),
});

export type AuthState = { error?: string; success?: string };

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "אימייל או סיסמה שגויים" };

  redirect("/dashboard");
}

export async function signupAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });
  if (error) return { error: error.message };

  // Email confirmation OFF: data.session is set, user is logged in
  // Email confirmation ON: must verify email first
  if (data.session) redirect("/dashboard");
  return { success: "החשבון נוצר. אנא בדקו את האימייל לאישור." };
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

Use with `useActionState` in client components for form state.

## Common gotchas

### "User stays logged in after logout"
- Make sure `signOut()` is awaited before the redirect
- Ensure cookies are being cleared by the middleware refresh on the next request

### "Redirect loop on /dashboard"
- Middleware sees user not logged in, redirects to `/login`
- `/login` page loads, but middleware sees no session, redirects again
- Cause: cookies aren't being written. Check that the middleware's `setAll` is actually setting them on the response.

### "Profile is null in getCurrentUser even though user exists"
- The auth trigger didn't run (maybe the SQL wasn't applied)
- The `getCurrentUser` upsert defends against this — it creates the missing profile

### "Auth works locally but breaks on Vercel"
- Almost always missing Supabase Site URL / Redirect URLs allowlist
- Add `https://your-app.vercel.app` to Site URL + `https://your-app.vercel.app/**` to Redirect URLs
