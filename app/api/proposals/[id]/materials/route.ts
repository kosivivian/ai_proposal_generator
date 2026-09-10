import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, GateError } from "@/lib/proposals/gates";
import { attachMaterial } from "@/lib/processing/attachMaterial";
import type { MaterialType } from "@/lib/types/database";

const VALID_MATERIAL_TYPES: MaterialType[] = ["intake_form", "call_recording", "old_proposal", "other"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  try {
    const user = await requireUser(supabase);

    const formData = await req.formData();
    const file = formData.get("file");
    const materialTypeRaw = formData.get("material_type");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    const materialType =
      typeof materialTypeRaw === "string" && VALID_MATERIAL_TYPES.includes(materialTypeRaw as MaterialType)
        ? (materialTypeRaw as MaterialType)
        : undefined;

    // RLS scopes this select to proposals the user can act on.
    const { data: proposal } = await supabase.from("proposals").select("id").eq("id", id).single();
    if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const material = await attachMaterial(supabase, {
      proposalId: id,
      userId: user.id,
      fileName: file.name,
      bytes,
      mimeType: file.type || null,
      materialType,
    });

    return NextResponse.json({ material });
  } catch (err) {
    if (err instanceof GateError) return NextResponse.json({ error: err.message }, { status: err.status });
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
