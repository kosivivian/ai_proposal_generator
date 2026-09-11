"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PASSWORD_POLICY_HINT } from "@/lib/auth/password";
import { changePassword, type ChangePasswordState } from "./actions";

const initialState: ChangePasswordState = {};

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, initialState);

  return (
    <form action={action} className="space-y-4 max-w-sm">
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" required autoComplete="new-password" />
        <p className="text-xs text-muted-foreground">{PASSWORD_POLICY_HINT}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm_password">Confirm new password</Label>
        <Input id="confirm_password" name="confirm_password" type="password" required autoComplete="new-password" />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-600">{state.success}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Updating..." : "Update password"}
      </Button>
    </form>
  );
}
