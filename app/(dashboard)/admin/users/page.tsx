import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/session";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserRoleSelect } from "./UserRoleSelect";
import { InviteUserForm } from "./InviteUserForm";
import { DeactivateUserToggle } from "./DeactivateUserToggle";
import { cn } from "cn";

export default async function AdminUsersPage() {
  const { user, profile: callerProfile } = await getCurrentUserProfile();
  if (!user) redirect("/login");
  if (callerProfile?.role !== "admin") redirect("/");

  const supabase = await createClient();
  const { data: profiles } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">Create accounts and grant approver or admin access.</p>
      </div>

      <InviteUserForm />

      <div className="rounded-lg border shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles?.map((p) => (
              <TableRow key={p.id} className={cn(!p.is_active && "opacity-50")}>
                <TableCell>{p.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{p.email}</TableCell>
                <TableCell>
                  <UserRoleSelect userId={p.id} role={p.role} isSelf={p.id === user.id} />
                </TableCell>
                <TableCell className="text-sm">
                  {p.is_active ? "Active" : <span className="text-destructive">Deactivated</span>}
                </TableCell>
                <TableCell className="text-right">
                  <DeactivateUserToggle userId={p.id} isActive={p.is_active} isSelf={p.id === user.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
