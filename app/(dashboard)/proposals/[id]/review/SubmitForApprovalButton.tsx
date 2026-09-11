"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function SubmitForApprovalButton({ proposalId, hasGaps }: { proposalId: string; hasGaps: boolean }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/submit-for-approval`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error, {
          description: body.sections?.length ? `Unresolved sections: ${body.sections.join(", ")}` : undefined,
        });
        return;
      }
      toast.success("Submitted for approval");
      router.push("/proposals");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Button onClick={submit} disabled={hasGaps || submitting} title={hasGaps ? "Resolve all [NEEDS INPUT] gaps before submitting" : undefined}>
      {submitting ? "Submitting..." : "Submit for approval"}
    </Button>
  );
}
