"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export interface RealtimeWatch {
  table: string;
  filter?: string;
}

/**
 * Subscribes to Postgres changes on the given tables and calls
 * router.refresh() on any event, so server-rendered data stays current
 * without a manual reload. Generalized from the pattern in
 * MaterialsManager.tsx. Requires the target tables to be added to the
 * `supabase_realtime` publication (see migration notes).
 */
export function useRealtimeRefresh(watches: RealtimeWatch[]) {
  const router = useRouter();
  const key = watches.map((w) => `${w.table}:${w.filter ?? ""}`).join("|");

  useEffect(() => {
    if (watches.length === 0) return;
    const supabase = createClient();
    let channel = supabase.channel(`realtime-refresh-${key}`);
    for (const watch of watches) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: watch.table, ...(watch.filter ? { filter: watch.filter } : {}) },
        () => router.refresh(),
      );
    }
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, router]);
}
