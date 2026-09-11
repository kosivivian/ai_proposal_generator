"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AuthActionState {
  error?: string;
}

export async function signIn(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  // Deactivated accounts pass password auth fine (Supabase auth knows
  // nothing about is_active — that's an app-level flag on profiles) so it
  // has to be checked here, right after sign-in, and reversed immediately
  // if it fails.
  const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).single();
  if (profile && !profile.is_active) {
    await supabase.auth.signOut();
    return { error: "This account has been deactivated. Contact an admin." };
  }

  redirect("/");
}
