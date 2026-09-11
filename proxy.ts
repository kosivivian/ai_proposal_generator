import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Excludes /api/**: those routes do their own auth via requireUser() and
  // return JSON errors — redirecting an expired-session fetch() call to the
  // /login HTML page would break client-side error handling, and running
  // getUser() here too just doubles the auth network round-trip for no
  // benefit.
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
