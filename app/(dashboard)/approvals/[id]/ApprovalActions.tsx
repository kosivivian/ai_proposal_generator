"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ApprovalActions({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const approve = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/approve`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error);
        return;
      }
      toast.success("Approved");
      router.push("/approvals");
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!notes.trim()) {
      toast.error("Rejection notes are required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error);
        return;
      }
      toast.success("Sent back for revision");
      setOpen(false);
      router.push("/approvals");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Button onClick={approve} disabled={busy}>
        Approve
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button variant="destructive" disabled={busy}>
              Reject
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject proposal</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Explain what needs to change (required — the rep will see this)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={reject} disabled={busy}>
              Send back to rep
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
