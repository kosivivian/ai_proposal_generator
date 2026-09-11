"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasGapMarker } from "@/lib/generation/sections";
import { requireRole, GateError } from "@/lib/proposals/gates";

/**
 * Manual edit path — sets updated_by to the rep's id, which is how the
 * schema's snapshot_section_version() trigger distinguishes manual_edit
 * from generation/regeneration in the version history.
 */
export async function updateSectionContent(
  proposalId: string,
  sectionId: string,
  content: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    await requireRole(supabase, user.id, ["sales_rep"]);
  } catch (err) {
    if (err instanceof GateError) return { error: "Only sales reps can edit proposal sections" };
    throw err;
  }

  if (content.trim().length === 0) {
    return { error: "A section can't be saved empty." };
  }

  const { data: current } = await supabase.from("proposal_sections").select("version").eq("id", sectionId).single();
  if (!current) return { error: "Section not found" };

  // Same state gate the regenerate route already enforces — without this,
  // RLS alone lets the creator edit a section after it's been approved or
  // sent, since RLS scopes *who* can write, not *when*.
  const { data: proposal } = await supabase.from("proposals").select("state").eq("id", proposalId).single();
  if (!proposal || !["generated", "in_review"].includes(proposal.state)) {
    return { error: "This proposal can no longer be edited." };
  }

  const { error } = await supabase
    .from("proposal_sections")
    .update({
      content,
      has_gap_marker: hasGapMarker(content),
      version: current.version + 1,
      updated_by: user.id,
    })
    .eq("id", sectionId);

  if (error) return { error: error.message };
  revalidatePath(`/proposals/${proposalId}/review`);
  return {};
}
