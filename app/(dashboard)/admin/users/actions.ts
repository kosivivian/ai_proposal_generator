"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { UserRole } from "@/lib/types/database";

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
