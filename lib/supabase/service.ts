import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * Service-role client — bypasses RLS entirely. Use ONLY for writes RLS
 * structurally can't allow the acting user to make directly:
 *   - error_log / delivery_log inserts (no client insert policy exists)
 *   - an admin changing another user's profiles.role
 *   - webhook / background contexts with no live user session
 * Never use this for reads, and never as a general-purpose shortcut around RLS.
 */
export function createServiceRoleClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
