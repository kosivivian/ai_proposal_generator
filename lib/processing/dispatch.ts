import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { withExternalCall } from "@/lib/errors/withExternalCall";
import { extractText } from "@/lib/processing/extractText";
import { transcribeAudio } from "@/lib/processing/transcribe";

const MATERIALS_BUCKET = "proposal-materials";

/**
 * Processes one uploaded material: downloads it, extracts text or
 * transcribes it depending on material_type, and writes the result back.
 * Uses a compare-and-swap status update as an idempotency/race guard — only
 * one caller can ever pick up a given `uploaded`/`failed` row.
 */
export async function processMaterial(
  supabase: SupabaseClient<Database>,
  materialId: string,
): Promise<void> {
  const { data: material } = await supabase
    .from("proposal_materials")
    .update({ status: "processing" })
    .eq("id", materialId)
    .in("status", ["uploaded", "failed"])
    .select()
    .single();

  if (!material) return; // already processing/processed — no-op

  const result = await withExternalCall(
    {
      proposalId: material.proposal_id,
      materialId,
      step: material.material_type === "call_recording" ? "transcription" : "file_processing",
    },
    async () => {
      const { data: file, error } = await supabase.storage
        .from(MATERIALS_BUCKET)
        .download(material.storage_path);
      if (error || !file) throw new Error(`Could not download ${material.storage_path}: ${error?.message ?? "not found"}`);
      const bytes = new Uint8Array(await file.arrayBuffer());

      return material.material_type === "call_recording"
        ? transcribeAudio(bytes, material.mime_type, material.file_name)
        : extractText(bytes, material.mime_type, material.file_name);
    },
  );

  if (result.ok) {
    await supabase
      .from("proposal_materials")
      .update({
        status: "processed",
        processed_content: result.data,
        processed_at: new Date().toISOString(),
      })
      .eq("id", materialId); // fires trg_materials_ready once all materials are processed
  } else {
    // withExternalCall already wrote error_log; no proposal-level state
    // change here — see build-plan finding #3 (one failed file shouldn't
    // block/fail the whole proposal).
    await supabase.from("proposal_materials").update({ status: "failed" }).eq("id", materialId);
  }
}
