"use server";

import { createClient } from "@/lib/supabase/server";

const DOCUMENTS_BUCKET = "proposal-documents";
const SIGNED_URL_TTL_SECONDS = 60 * 5;

/**
 * Signed URLs aren't persisted (the one used in the client-facing email is
 * generated fresh at send time and never stored) — this mints a new
 * short-lived one on demand. No explicit role check needed: the proposals
 * select below and documents_storage_access below it are both RLS-gated on
 * the session client (own proposals for sales_rep, all for approver/admin),
 * so a proposal/document this user can't see simply won't resolve.
 */
export async function getProposalDocumentUrl(proposalId: string): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: proposal } = await supabase.from("proposals").select("document_url").eq("id", proposalId).single();
  if (!proposal?.document_url) return { error: "No document has been generated for this proposal yet" };

  const { data: signed, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(proposal.document_url, SIGNED_URL_TTL_SECONDS);
  if (error || !signed) return { error: error?.message ?? "Could not create a download link" };

  return { url: signed.signedUrl };
}
