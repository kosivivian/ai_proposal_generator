import { Badge } from "@/components/ui/badge";
import type { MaterialStatus } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const STYLES: Record<MaterialStatus, string> = {
  uploaded: "bg-muted text-muted-foreground",
  processing: "bg-foreground/10 text-foreground animate-pulse",
  processed: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
};

export function MaterialStatusBadge({ status }: { status: MaterialStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium capitalize border-transparent", STYLES[status])}>
      {status}
    </Badge>
  );
}
