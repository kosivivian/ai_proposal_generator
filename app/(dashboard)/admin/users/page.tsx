import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/session";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserRoleSelect } from "./UserRoleSelect";
import { InviteUserForm } from "./InviteUserForm";

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

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles?.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{p.email}</TableCell>
                <TableCell>
                  <UserRoleSelect userId={p.id} role={p.role} isSelf={p.id === user.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
