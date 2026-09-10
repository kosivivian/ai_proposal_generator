import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types/database";

const APPROVER_ONLY_PREFIXES = ["/approvals"];
const ADMIN_ONLY_PREFIXES = ["/admin"];
const PUBLIC_PATHS = ["/login"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Route-group gating is defense-in-depth only — the real enforcement lives
  // in each Route Handler / Server Action (see finding #1 in the build plan).
  if (user && (APPROVER_ONLY_PREFIXES.some((p) => path.startsWith(p)) || ADMIN_ONLY_PREFIXES.some((p) => path.startsWith(p)))) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const requiresAdmin = ADMIN_ONLY_PREFIXES.some((p) => path.startsWith(p));
    const allowed = requiresAdmin
      ? profile?.role === "admin"
      : profile?.role === "approver" || profile?.role === "admin";

    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
