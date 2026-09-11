import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { describeTransition, describeDelivery } from "./describeEvent";

export interface HistoryEntry {
  id: string;
  createdAt: string;
  description: string;
  isRejection: boolean;
  note: string | null;
}

/**
 * One chronological feed for a single proposal: state transitions
 * (proposal_events, now correctly attributed — see log_state_transition()
 * in proposal_app_schema.sql) merged with delivery attempts, both rendered
 * through the same describeEvent.ts sentences used on the admin Logs page.
 */
export async function getProposalHistoryFeed(
  supabase: SupabaseClient<Database>,
  proposalId: string,
): Promise<HistoryEntry[]> {
  const [{ data: events }, { data: deliveries }] = await Promise.all([
    supabase
      .from("proposal_events")
      .select("*")
      .eq("proposal_id", proposalId)
      .order("created_at", { ascending: true }),
    supabase
      .from("delivery_log")
      .select("*")
      .eq("proposal_id", proposalId)
      .order("attempted_at", { ascending: true }),
  ]);

  const actorIds = [...new Set((events ?? []).map((e) => e.actor_id).filter((id): id is string => !!id))];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map((actors ?? []).map((a) => [a.id, a.full_name]));

  const entries: HistoryEntry[] = [
    ...(events ?? []).map((e) => ({
      id: `event-${e.id}`,
      createdAt: e.created_at,
      description: describeTransition(e, e.actor_id ? nameById.get(e.actor_id) ?? null : null),
      isRejection: e.to_state === "in_review" && !!e.note,
      note: e.note,
    })),
    ...(deliveries ?? []).map((d) => ({
      id: `delivery-${d.id}`,
      createdAt: d.attempted_at,
      description: describeDelivery(d),
      isRejection: false,
      note: null,
    })),
  ];

  return entries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/** Latest rejection-with-note event for a proposal, or null if never rejected with feedback. */
export async function getLatestRejectionEvent(supabase: SupabaseClient<Database>, proposalId: string) {
  const { data } = await supabase
    .from("proposal_events")
    .select("*")
    .eq("proposal_id", proposalId)
    .eq("to_state", "in_review")
    .not("note", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
