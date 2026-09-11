import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole, GateError } from "@/lib/proposals/gates";
import { notifyRepOfDecision } from "@/lib/notifications/proposalNotifications";

/**
 * The real enforcement of the PRD's non-negotiable approval constraint — RLS
 * alone lets a sales_rep update their own proposal row (see build-plan
 * finding #1), so this explicit role check is what actually stops
 * self-approval.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  try {
    const user = await requireUser(supabase);
    await requireRole(supabase, user.id, ["approver"]);

    const { data: updated } = await supabase
      .from("proposals")
      .update({ state: "approved", approved_by: user.id, approved_at: new Date().toISOString() })
      .eq("id", id)
      .eq("state", "pending_approval")
      .select()
      .single();

    if (!updated) return NextResponse.json({ error: "Proposal is not pending_approval" }, { status: 409 });

    await notifyRepOfDecision(id, "approved");
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GateError) return NextResponse.json({ error: err.message }, { status: err.status });
    const message = err instanceof Error ? err.message : "Approve failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
