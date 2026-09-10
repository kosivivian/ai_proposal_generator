import { Badge } from "@/components/ui/badge";
import type { MaterialStatus } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const STYLES: Record<MaterialStatus, string> = {
  uploaded: "bg-muted text-muted-foreground border-transparent",
  processing: "bg-blue-100 text-blue-800 border-transparent animate-pulse dark:bg-blue-950 dark:text-blue-300",
  processed: "bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-950 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 border-transparent dark:bg-red-950 dark:text-red-300",
};

export function MaterialStatusBadge({ status }: { status: MaterialStatus }) {
  return (
    <Badge variant="outline" className={cn("font-normal capitalize", STYLES[status])}>
      {status}
    </Badge>
  );
}
