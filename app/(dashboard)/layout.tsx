import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/session";
import { Button } from "@/components/ui/button";
import { signOut } from "./actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getCurrentUserProfile();
  if (!user) redirect("/login");

  const isApproverOrAdmin = profile?.role === "approver" || profile?.role === "admin";
  const isAdmin = profile?.role === "admin";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold">
              Proposal Generator
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground">Dashboard</Link>
              {isApproverOrAdmin && (
                <Link href="/approvals" className="hover:text-foreground">Approvals</Link>
              )}
              {isAdmin && <Link href="/admin/users" className="hover:text-foreground">Users</Link>}
              {isAdmin && <Link href="/admin/errors" className="hover:text-foreground">Errors</Link>}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/account" className="text-muted-foreground hover:text-foreground">
              {profile?.full_name} <span className="capitalize">({profile?.role.replace("_", " ")})</span>
            </Link>
            <form action={signOut}>
              <Button variant="ghost" size="sm" type="submit">Sign out</Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
