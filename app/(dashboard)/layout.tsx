import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/session";
import { Button } from "@/components/ui/button";
import { signOut } from "./actions";
import { SidebarNav, type SidebarLink } from "./SidebarNav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getCurrentUserProfile();
  if (!user) redirect("/login");

  const isApproverOrAdmin = profile?.role === "approver" || profile?.role === "admin";
  const isAdmin = profile?.role === "admin";

  const links: SidebarLink[] = [
    { href: "/", label: "Overview", exact: true },
    { href: "/proposals", label: "Proposals" },
    ...(isApproverOrAdmin ? [{ href: "/approvals", label: "Approvals" }] : []),
    ...(isAdmin ? [{ href: "/admin/users", label: "Users" }] : []),
    ...(isAdmin ? [{ href: "/admin/logs", label: "Logs" }] : []),
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r bg-card">
        <div className="px-5 py-5 border-b">
          <Link href="/" className="font-semibold tracking-tight">
            Proposal Generator
          </Link>
        </div>
        <SidebarNav links={links} />
        <div className="mt-auto border-t px-3 py-4 space-y-2">
          <Link
            href="/account"
            className="block px-2 text-sm text-muted-foreground hover:text-foreground truncate"
          >
            {profile?.full_name}
            <span className="block text-xs capitalize">{profile?.role.replace("_", " ")}</span>
          </Link>
          <form action={signOut}>
            <Button variant="ghost" size="sm" type="submit" className="w-full justify-start px-2">
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden border-b bg-card">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold">
              Proposal Generator
            </Link>
            <form action={signOut}>
              <Button variant="ghost" size="sm" type="submit">Sign out</Button>
            </form>
          </div>
          <SidebarNav links={links} horizontal />
        </header>
        <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
