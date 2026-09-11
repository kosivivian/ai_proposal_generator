"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setUserActive } from "./actions";

export function DeactivateUserToggle({
  userId,
  isActive,
  isSelf,
}: {
  userId: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      const result = await setUserActive(userId, !isActive);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(isActive ? "User deactivated" : "User reactivated");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="sm"
      variant={isActive ? "outline" : "secondary"}
      disabled={isSelf || busy}
      onClick={toggle}
    >
      {busy ? "Working..." : isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
