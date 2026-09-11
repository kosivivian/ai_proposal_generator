"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inviteUser, type InviteUserState } from "./actions";

const initialState: InviteUserState = {};

export function InviteUserForm() {
  const [state, action, pending] = useActionState(inviteUser, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Invite a user</CardTitle>
        <CardDescription>
          Creates the account with a random temporary password and emails it to them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" name="full_name" required autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <Select name="role" defaultValue="sales_rep">
              <SelectTrigger id="role" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales_rep">Sales rep</SelectItem>
                <SelectItem value="approver">Approver</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Creating..." : "Create account"}
          </Button>
        </form>
        {state.error && <p className="text-sm text-destructive mt-3">{state.error}</p>}
        {state.success && <p className="text-sm text-emerald-600 mt-3">{state.success}</p>}
      </CardContent>
    </Card>
  );
}
