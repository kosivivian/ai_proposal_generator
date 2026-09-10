import { Badge } from "@/components/ui/badge";
import type { ProposalState } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const STATE_STYLES: Record<ProposalState, string> = {
  draft: "bg-muted text-muted-foreground border-transparent",
  materials_ready: "bg-blue-100 text-blue-800 border-transparent dark:bg-blue-950 dark:text-blue-300",
  generating: "bg-blue-100 text-blue-800 border-transparent animate-pulse dark:bg-blue-950 dark:text-blue-300",
  generated: "bg-indigo-100 text-indigo-800 border-transparent dark:bg-indigo-950 dark:text-indigo-300",
  in_review: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300",
  pending_approval: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300",
  rejected: "bg-red-100 text-red-800 border-transparent dark:bg-red-950 dark:text-red-300",
  approved: "bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-950 dark:text-emerald-300",
  sent: "bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-950 dark:text-emerald-300",
  logged: "bg-slate-800 text-white border-transparent dark:bg-slate-200 dark:text-slate-900",
  failed: "bg-red-100 text-red-800 border-transparent dark:bg-red-950 dark:text-red-300",
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
    <Badge className={cn("font-normal", STATE_STYLES[state])} variant="outline">
      {STATE_LABELS[state]}
    </Badge>
  );
}
