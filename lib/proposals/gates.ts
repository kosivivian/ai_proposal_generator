import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "@/lib/types/database";

export class GateError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Loads the current user + profile, throwing a GateError (401) if there is
 * no session. Route Handlers should catch GateError and map `.status`.
 */
export async function requireUser(supabase: SupabaseClient<Database>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new GateError("Not authenticated", 401);
  return user;
}

/**
 * The explicit role check that actually enforces the PRD's non-negotiable
 * "no proposal reaches a client without approval" constraint — RLS alone
 * lets a sales_rep write to their own proposal row (see build-plan finding
 * #1), so this check is the real gate for approve/reject.
 */
export async function requireRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  allowed: UserRole[],
) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !profile) throw new GateError("Profile not found", 403);
  if (!allowed.includes(profile.role)) throw new GateError("Forbidden", 403);
  return profile;
}
