"use server";

import { createClient } from "@/lib/supabase/server";
import type { MaterialType } from "@/lib/types/database";

/**
 * Handles the case the DB trigger can't: check_materials_ready() only fires
 * `after update of status on proposal_materials`, so a proposal with zero
 * attached files never transitions out of `draft` on its own. This mirrors
 * the trigger's own logic (zero outstanding files) as an explicit action
 * instead of a schema change.
 */
export async function advanceIfNoMaterials(proposalId: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("proposal_materials")
    .select("id", { count: "exact", head: true })
    .eq("proposal_id", proposalId);

  if (count && count > 0) {
    return { error: "This proposal has attached files — wait for them to finish processing instead." };
  }

  const { data, error } = await supabase
    .from("proposals")
    .update({ state: "materials_ready" })
    .eq("id", proposalId)
    .eq("state", "draft")
    .select()
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) {
    return { error: "Couldn't update this proposal — it may no longer be in draft state. Refresh and try again." };
  }
  return {};
}

export async function updateMaterialType(materialId: string, materialType: MaterialType): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("proposal_materials").update({ material_type: materialType }).eq("id", materialId);
  return error ? { error: error.message } : {};
}
