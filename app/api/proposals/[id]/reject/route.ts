import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole, GateError } from "@/lib/proposals/gates";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  try {
    const user = await requireUser(supabase);
    await requireRole(supabase, user.id, ["approver", "admin"]);

    const body = await req.json().catch(() => ({}));
    const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
    if (!notes) {
      return NextResponse.json({ error: "Rejection notes are required" }, { status: 400 });
    }

    const { data: updated } = await supabase
      .from("proposals")
      .update({ state: "in_review", rejection_notes: notes })
      .eq("id", id)
      .eq("state", "pending_approval")
      .select()
      .single();

    if (!updated) return NextResponse.json({ error: "Proposal is not pending_approval" }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GateError) return NextResponse.json({ error: err.message }, { status: err.status });
    const message = err instanceof Error ? err.message : "Reject failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
