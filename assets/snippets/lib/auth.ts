import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Profile } from "@prisma/client";

/**
 * Returns the current authenticated user's profile, or null.
 * Use in server components and route handlers.
 */
export async function getCurrentUser(): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Profile row should already exist (trigger creates it on signup), but
  // be defensive in case the trigger was skipped.
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

/**
 * Same as getCurrentUser, but redirects to /login if not authenticated.
 * Use in protected server components / route handlers.
 */
export async function requireUser(): Promise<Profile> {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login");
  return profile;
}
