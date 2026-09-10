"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UserRole } from "@/lib/types/database";
import { setUserRole } from "./actions";

export function UserRoleSelect({ userId, role, isSelf }: { userId: string; role: UserRole; isSelf: boolean }) {
  const router = useRouter();

  return (
    <Select
      defaultValue={role}
      disabled={isSelf}
      onValueChange={async (value) => {
        const result = await setUserRole(userId, value as UserRole);
        if (result.error) toast.error(result.error);
        else {
          toast.success("Role updated");
          router.refresh();
        }
      }}
    >
      <SelectTrigger className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="sales_rep">Sales rep</SelectItem>
        <SelectItem value="approver">Approver</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
      </SelectContent>
    </Select>
  );
}
