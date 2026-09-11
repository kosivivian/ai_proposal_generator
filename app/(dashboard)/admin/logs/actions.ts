"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/lib/supabase/session";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * error_log has no client-facing update policy (writes are meant to come
 * from server-side/service-role code paths only), so this goes through the
 * service-role client — gated here on the caller actually being admin.
 */
export async function resolveError(errorId: string): Promise<{ error?: string }> {
  const { profile } = await getCurrentUserProfile();
  if (profile?.role !== "admin") return { error: "Forbidden" };

  const service = createServiceRoleClient();
  const { error } = await service.from("error_log").update({ resolved: true }).eq("id", errorId);
  if (error) return { error: error.message };

  revalidatePath("/admin/logs");
  return {};
}
