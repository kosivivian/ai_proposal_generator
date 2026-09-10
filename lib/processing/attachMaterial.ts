import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MaterialType, Tables } from "@/lib/types/database";

const MATERIALS_BUCKET = "proposal-materials";

export function inferMaterialType(fileName: string): MaterialType {
  const lower = fileName.toLowerCase();
  if (/record|call/.test(lower)) return "call_recording";
  if (/old|past|previous/.test(lower)) return "old_proposal";
  if (/intake/.test(lower)) return "intake_form";
  return "other";
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

interface AttachMaterialInput {
  proposalId: string;
  userId: string;
  fileName: string;
  bytes: Uint8Array;
  mimeType: string | null;
  materialType?: MaterialType;
}

/**
 * Uploads a file to Supabase Storage under the required
 * `{proposal_id}/{filename}` convention and inserts the corresponding
 * proposal_materials row. Shared by the per-proposal attach screen and the
 * bulk-import zip matcher so upload/insert logic exists in exactly one place.
 */
export async function attachMaterial(
  supabase: SupabaseClient<Database>,
  input: AttachMaterialInput,
): Promise<Tables<"proposal_materials">> {
  const safeName = sanitizeFileName(input.fileName);
  let storagePath = `${input.proposalId}/${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(MATERIALS_BUCKET)
    .upload(storagePath, input.bytes, {
      contentType: input.mimeType ?? undefined,
      upsert: false,
    });

  if (uploadError) {
    // Collision-safe retry with a short random suffix.
    const suffix = Math.random().toString(36).slice(2, 8);
    const dotIndex = safeName.lastIndexOf(".");
    const uniqueName =
      dotIndex === -1
        ? `${safeName}-${suffix}`
        : `${safeName.slice(0, dotIndex)}-${suffix}${safeName.slice(dotIndex)}`;
    storagePath = `${input.proposalId}/${uniqueName}`;

    const { error: retryError } = await supabase.storage
      .from(MATERIALS_BUCKET)
      .upload(storagePath, input.bytes, {
        contentType: input.mimeType ?? undefined,
        upsert: false,
      });
    if (retryError) throw new Error(`Upload failed for ${input.fileName}: ${retryError.message}`);
  }

  const { data, error } = await supabase
    .from("proposal_materials")
    .insert({
      proposal_id: input.proposalId,
      material_type: input.materialType ?? inferMaterialType(input.fileName),
      file_name: input.fileName,
      storage_path: storagePath,
      mime_type: input.mimeType,
      status: "uploaded",
      uploaded_by: input.userId,
    })
    .select()
    .single();

  if (error || !data) throw new Error(`Failed to record material ${input.fileName}: ${error?.message}`);
  return data;
}
