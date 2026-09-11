"use server";

import { createClient } from "@/lib/supabase/server";
import { isStrongPassword, PASSWORD_POLICY_HINT } from "@/lib/auth/password";

export interface ChangePasswordState {
  error?: string;
  success?: string;
}

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (password !== confirmPassword) return { error: "Passwords don't match" };
  if (!isStrongPassword(password)) return { error: PASSWORD_POLICY_HINT };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  return { success: "Password updated." };
}
