"use client";

import { useRealtimeRefresh, type RealtimeWatch } from "@/lib/hooks/useRealtimeRefresh";

/** Renders nothing — just wires up realtime auto-refresh for the page it's dropped into. */
export function RealtimeRefresh({ tables, filter }: { tables: string[]; filter?: string }) {
  const watches: RealtimeWatch[] = tables.map((table) => ({ table, filter }));
  useRealtimeRefresh(watches);
  return null;
}
