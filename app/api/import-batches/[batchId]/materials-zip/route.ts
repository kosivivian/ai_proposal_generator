import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireRole, GateError } from "@/lib/proposals/gates";
import { matchAndImportZip } from "@/lib/zip/matchAndImport";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const supabase = await createClient();

  try {
    const user = await requireUser(supabase);
    await requireRole(supabase, user.id, ["sales_rep"]);

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing zip file" }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await matchAndImportZip(supabase, batchId, user.id, bytes);

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof GateError) return NextResponse.json({ error: err.message }, { status: err.status });
    const message = err instanceof Error ? err.message : "Zip import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
