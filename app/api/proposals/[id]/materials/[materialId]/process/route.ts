import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, GateError } from "@/lib/proposals/gates";
import { processMaterial } from "@/lib/processing/dispatch";

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
    const message = err instanceof Error ? err.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
