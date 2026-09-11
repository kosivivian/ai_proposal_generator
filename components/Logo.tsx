import { cn } from "cn";
import { BRAND_NAME } from "@/lib/branding";

export function Logo({ size = "default", className }: { size?: "default" | "sm"; className?: string }) {
  const mark = size === "sm" ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm";
  const wordmark = size === "sm" ? "text-sm" : "text-base";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md bg-foreground font-heading font-bold text-background",
          mark,
        )}
      >
        K
      </span>
      <span className={cn("font-heading font-semibold tracking-tight", wordmark)}>{BRAND_NAME}</span>
    </span>
  );
}
