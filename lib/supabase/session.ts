import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/database";

/**
 * The dashboard layout and most pages under it each need the current user's
 * profile (role, name). Without memoization, layout.tsx + page.tsx (and any
 * further-nested page) each fire their own auth.getUser() + profiles select
 * — two extra network round-trips per navigation, on top of the same
 * getUser() call middleware already made. React's cache() dedupes calls to
 * this function within a single request, so it only actually hits Supabase
 * once per render regardless of how many components call it.
 */
export const getCurrentUserProfile = cache(async (): Promise<{
  user: { id: string; email?: string } | null;
  profile: Tables<"profiles"> | null;
}> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  // A deactivated account can still hold a valid session cookie (Supabase
  // auth has no notion of is_active — that's an app-level flag on
  // profiles), so it's enforced here, on every request, not just at
  // sign-in: this is the one place every dashboard page's auth check
  // (layout.tsx's `if (!user) redirect("/login")`) already runs through.
  if (profile && !profile.is_active) {
    await supabase.auth.signOut();
    return { user: null, profile: null };
  }

  return { user, profile };
});
