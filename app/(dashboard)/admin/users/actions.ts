"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { generateTempPassword } from "@/lib/auth/password";
import { sendWelcomeEmail } from "@/lib/email/welcomeEmail";
import type { UserRole } from "@/lib/types/database";

export interface InviteUserState {
  error?: string;
  success?: string;
}

/**
 * Accounts are admin-created only (no public signup — see
 * app/(auth)/login). Creates the auth user directly via the admin API,
 * which fires the existing handle_new_user() trigger to create the
 * profiles row (defaulting to sales_rep), then applies the requested role
 * the same way setUserRole() below does, then emails the temp password.
 */
export async function inviteUser(
  _prevState: InviteUserState,
  formData: FormData,
): Promise<InviteUserState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (callerProfile?.role !== "admin") return { error: "Forbidden" };

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "sales_rep") as UserRole;

  if (!fullName) return { error: "Full name is required" };
  if (!email) return { error: "Email is required" };

  const tempPassword = generateTempPassword();
  const service = createServiceRoleClient();

  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) return { error: createError?.message ?? "Failed to create account" };

  if (role !== "sales_rep") {
    const { error: roleError } = await service.from("profiles").update({ role }).eq("id", created.user.id);
    if (roleError) return { error: `Account created, but failed to set role: ${roleError.message}` };
  }

  const emailResult = await sendWelcomeEmail({ toEmail: email, fullName, tempPassword });
  if ("error" in emailResult) {
    return { error: `Account created, but the welcome email failed to send: ${emailResult.error}` };
  }

  revalidatePath("/admin/users");
  return { success: `Account created for ${email} — welcome email sent.` };
}

/**
 * Admin role changes must go through the service-role client — RLS's
 * profiles_update_own policy only allows `id = auth.uid()`, so there's no
 * RLS path for an admin to update someone else's role directly.
 */
export async function setUserRole(targetUserId: string, role: UserRole): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (callerProfile?.role !== "admin") return { error: "Forbidden" };

  const service = createServiceRoleClient();
  const { error } = await service.from("profiles").update({ role }).eq("id", targetUserId);
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return {};
}
