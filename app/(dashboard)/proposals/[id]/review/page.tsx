import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProposalStateBadge } from "@/components/proposal-state-badge";
import { getClientById } from "@/lib/clients/resolve";
import { SectionEditor } from "./SectionEditor";
import { SubmitForApprovalButton } from "./SubmitForApprovalButton";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Proposal + sections are independent of each other (sections only need
  // `id` from the route params), so fetch both in parallel instead of
  // waiting on the proposal first.
  const [{ data: proposalRow, error }, { data: sections }] = await Promise.all([
    supabase.from("proposals").select("*").eq("id", id).single(),
    supabase.from("proposal_sections").select("*").eq("proposal_id", id).order("order_index"),
  ]);
  if (error) console.error(`[ReviewPage] proposals select failed for ${id}:`, error);
  if (!proposalRow) notFound();

  // First load after generation: generated -> in_review. Idempotent no-op
  // on subsequent loads (compare-and-swap on state). Grab the updated row
  // straight from the update instead of re-fetching separately.
  let proposal = proposalRow;
  if (proposalRow.state === "generated") {
    const { data: updated } = await supabase
      .from("proposals")
      .update({ state: "in_review" })
      .eq("id", id)
      .eq("state", "generated")
      .select()
      .single();
    if (updated) proposal = updated;
  }

  const client = await getClientById(supabase, proposal.client_id);
  if (!client) notFound();

  const reviewable = proposal.state === "in_review" || proposal.state === "generated";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Back to dashboard
        </Link>
        <div className="flex items-center gap-3 mt-1">
          <h1 className="text-2xl font-semibold">{client.company_name || client.client_name}</h1>
          <ProposalStateBadge state={proposal.state} />
        </div>
        {proposal.claude_model && (
          <p className="text-xs text-muted-foreground mt-1">
            Generated with {proposal.claude_model} ({proposal.claude_input_tokens} in / {proposal.claude_output_tokens} out tokens)
          </p>
        )}
      </div>

      {proposal.rejection_notes && (
        <Alert variant="destructive">
          <AlertTitle>Sent back for revision</AlertTitle>
          <AlertDescription>{proposal.rejection_notes}</AlertDescription>
        </Alert>
      )}

      {!reviewable && (
        <Alert>
          <AlertTitle>Not editable</AlertTitle>
          <AlertDescription>
            This proposal is in state &ldquo;{proposal.state}&rdquo; and can&apos;t be edited from here.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {sections?.map((section) => (
          <SectionEditor key={section.id} proposalId={id} section={section} />
        ))}
      </div>

      {reviewable && (
        <div className="flex items-center gap-3 pt-2 border-t">
          <SubmitForApprovalButton proposalId={id} hasGaps={proposal.has_gaps} />
          {proposal.has_gaps && (
            <p className="text-sm text-muted-foreground">
              Resolve every highlighted [NEEDS INPUT] gap (edit or regenerate) before submitting.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
