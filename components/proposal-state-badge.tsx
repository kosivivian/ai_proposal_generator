import { Badge } from "@/components/ui/badge";
import type { ProposalState } from "@/lib/types/database";
import { cn } from "@/lib/utils";

// Neutral (foreground/muted) for ordinary workflow progress, functional
// color reserved for states that actually need attention (amber), failed
// outright (red), or completed successfully (emerald) — kept deliberately
// non-monochrome per the modern theme refresh.
const STATE_STYLES: Record<ProposalState, string> = {
  draft: "bg-muted text-muted-foreground",
  materials_ready: "bg-foreground/10 text-foreground",
  generating: "bg-foreground/10 text-foreground animate-pulse",
  generated: "bg-foreground/10 text-foreground",
  in_review: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
  pending_approval: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  approved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300",
  sent: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300",
  logged: "bg-foreground text-background",
  failed: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
};

const STATE_LABELS: Record<ProposalState, string> = {
  draft: "Draft",
  materials_ready: "Materials Ready",
  generating: "Generating…",
  generated: "Generated",
  in_review: "In Review",
  pending_approval: "Pending Approval",
  rejected: "Rejected",
  approved: "Approved",
  sent: "Sent",
  logged: "Logged",
  failed: "Failed",
};

export function ProposalStateBadge({ state }: { state: ProposalState }) {
  return (
    <Badge className={cn("font-medium border-transparent", STATE_STYLES[state])} variant="outline">
      {STATE_LABELS[state]}
    </Badge>
  );
}
