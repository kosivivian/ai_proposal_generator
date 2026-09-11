"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getProposalDocumentUrl } from "./actions";

export function DownloadPdfButton({ proposalId }: { proposalId: string }) {
  const [loading, setLoading] = useState(false);

  const download = async () => {
    setLoading(true);
    try {
      const result = await getProposalDocumentUrl(proposalId);
      if (result.error || !result.url) {
        toast.error(result.error ?? "Could not generate a download link");
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={download} disabled={loading}>
      {loading ? "Preparing..." : "Download PDF"}
    </Button>
  );
}
