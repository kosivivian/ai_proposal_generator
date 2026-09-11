import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole, GateError } from "@/lib/proposals/gates";
import { notifyApproversOfPendingProposal } from "@/lib/notifications/proposalNotifications";

/**
 * The hard gate from PRD §6/§8: has_gaps is re-read fresh from the DB here,
 * never trusted from client state, so a direct API call is blocked exactly
 * like the UI button — this is not a UI-only suggestion.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  try {
    const user = await requireUser(supabase);
    await requireRole(supabase, user.id, ["sales_rep"]);

    const { data: proposal } = await supabase
      .from("proposals")
      .select("state, has_gaps")
      .eq("id", id)
      .single();
    if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });

    if (proposal.state !== "in_review") {
      return NextResponse.json({ error: "Proposal is not in_review" }, { status: 409 });
    }

    if (proposal.has_gaps) {
      const { data: gapped } = await supabase
        .from("proposal_sections")
        .select("section_key")
        .eq("proposal_id", id)
        .eq("has_gap_marker", true);
      return NextResponse.json(
        { error: "Cannot submit: unresolved gaps", sections: gapped?.map((s) => s.section_key) ?? [] },
        { status: 400 },
      );
    }

    const { data: updated } = await supabase
      .from("proposals")
      .update({ state: "pending_approval", submitted_for_approval_at: new Date().toISOString() })
      .eq("id", id)
      .eq("state", "in_review")
      .select()
      .single();

    if (!updated) return NextResponse.json({ error: "Proposal state changed concurrently" }, { status: 409 });

    await notifyApproversOfPendingProposal(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GateError) return NextResponse.json({ error: err.message }, { status: err.status });
    const message = err instanceof Error ? err.message : "Submit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
