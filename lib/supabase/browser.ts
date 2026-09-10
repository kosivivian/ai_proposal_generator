import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

/**
 * Anon-key, user-session client for Client Components. Used only for
 * Supabase Realtime subscriptions (live material/proposal status) — never
 * for writes; writes always go through a Server Action or Route Handler.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
