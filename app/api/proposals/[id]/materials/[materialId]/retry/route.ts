import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, GateError } from "@/lib/proposals/gates";
import { processMaterial } from "@/lib/processing/dispatch";

/**
 * Retrying a failed material is the same operation as first-time processing
 * — processMaterial's `in('status', ['uploaded','failed'])` guard makes it
 * safe to call again on a failed row.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; materialId: string }> },
) {
  const { materialId } = await params;
  const supabase = await createClient();

  try {
    await requireUser(supabase);
    await processMaterial(supabase, materialId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GateError) return NextResponse.json({ error: err.message }, { status: err.status });
    const message = err instanceof Error ? err.message : "Retry failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
