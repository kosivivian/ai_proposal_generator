"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { intakeSchema, toProposalInsertFields } from "@/lib/intake/schema";
import { computeMissingFields } from "@/lib/intake/requiredFields";

export interface CreateProposalState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createProposal(
  _prevState: CreateProposalState,
  formData: FormData,
): Promise<CreateProposalState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = intakeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { error: "Please fix the highlighted fields", fieldErrors };
  }

  const missing_fields = computeMissingFields(parsed.data);

  const { data, error } = await supabase
    .from("proposals")
    .insert({ ...toProposalInsertFields(parsed.data), created_by: user.id, missing_fields })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to create proposal" };

  redirect(`/proposals/${data.id}/materials`);
}
