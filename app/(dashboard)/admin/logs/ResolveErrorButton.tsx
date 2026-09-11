"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resolveError } from "./actions";

export function ResolveErrorButton({ errorId }: { errorId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const resolve = async () => {
    setBusy(true);
    try {
      const result = await resolveError(errorId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={resolve} disabled={busy}>
      {busy ? "Resolving..." : "Mark resolved"}
    </Button>
  );
}
