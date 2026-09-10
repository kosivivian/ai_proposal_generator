"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function SendToClientButton({ proposalId, label }: { proposalId: string; label: string }) {
  const router = useRouter();
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/send-to-client`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        toast.error(`${body.step ? `[${body.step}] ` : ""}${body.error}`);
        router.refresh();
        return;
      }
      toast.success("Sent to client");
      router.refresh();
    } finally {
      setSending(false);
    }
  };

  return (
    <Button onClick={send} disabled={sending}>
      {sending ? "Sending..." : label}
    </Button>
  );
}
