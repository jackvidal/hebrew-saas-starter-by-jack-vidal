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

export type AuthState = {
  error?: string;
  success?: string;
};

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "אימייל או סיסמה שגויים" };

  redirect("/dashboard");
}

export async function signupAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
    },
  });
  if (error) return { error: error.message };

  // If email confirmation is OFF in Supabase project settings, the user is
  // already logged in here. If ON, they must verify their email first.
  if (data.session) redirect("/dashboard");
  return { success: "החשבון נוצר. אנא בדקו את האימייל לאישור." };
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
