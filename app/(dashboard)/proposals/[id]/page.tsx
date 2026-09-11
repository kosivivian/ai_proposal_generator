import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProposalStateBadge } from "@/components/proposal-state-badge";
import { SECTION_LABELS, type SectionKey } from "@/lib/generation/sections";
import { getClientById } from "@/lib/clients/resolve";
import { getProposalHistoryFeed } from "@/lib/proposals/history";
import { getCurrentUserProfile } from "@/lib/supabase/session";
import { renderProposalHtml } from "@/lib/pdf/renderProposalHtml";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { PreviewDialog } from "@/components/PreviewDialog";
import { SendToClientButton } from "./SendToClientButton";
import { DownloadPdfButton } from "./DownloadPdfButton";

export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { profile } = await getCurrentUserProfile();

  const [{ data: proposal, error }, { data: errors }, { data: sections }, history] = await Promise.all([
    supabase.from("proposals").select("*").eq("id", id).single(),
    supabase.from("error_log").select("*").eq("proposal_id", id).eq("resolved", false).order("created_at", { ascending: false }),
    supabase.from("proposal_sections").select("*").eq("proposal_id", id).order("order_index"),
    getProposalHistoryFeed(supabase, id),
  ]);
  if (error) console.error(`[ProposalDetailPage] proposals select failed for ${id}:`, error);
  if (!proposal) notFound();

  const client = await getClientById(supabase, proposal.client_id);
  if (!client) notFound();

  // Send-to-client is a sales_rep-only workflow action (enforced server-side
  // in the route too) — without this role check, an approver or admin
  // landing here on an `approved` proposal would see the button rendered,
  // even though clicking it would just 403.
  const canSend =
    profile?.role === "sales_rep" &&
    (proposal.state === "approved" || (proposal.state === "failed" && proposal.approved_at !== null));
  const historyDesc = [...history].reverse();

  // The live preview (same renderProposalHtml() used for the real PDF) has
  // no state restriction — approvers in particular should be able to see
  // exactly what the client received at any point after it's sent, not
  // just while a decision is pending.
  const { data: generatorProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", proposal.generated_by ?? proposal.created_by)
    .single();
  const previewHtml =
    sections && sections.length > 0
      ? renderProposalHtml(proposal, client, sections, generatorProfile?.full_name ?? "The Team")
      : null;

  return (
    <div className="space-y-6">
      <RealtimeRefresh tables={["proposals", "proposal_events", "delivery_log", "error_log"]} filter={`proposal_id=eq.${id}`} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/proposals" className="text-sm text-muted-foreground hover:underline">
            ← Back to proposals
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-semibold">{client.company_name || client.client_name}</h1>
            <ProposalStateBadge state={proposal.state} />
          </div>
          {proposal.project_title && <p className="text-sm text-muted-foreground">{proposal.project_title}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          {previewHtml && <PreviewDialog html={previewHtml} />}
          {proposal.document_url && <DownloadPdfButton proposalId={id} />}
        </div>
      </div>

      {errors && errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>Unresolved errors</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {errors.map((e) => (
                <li key={e.id}>
                  <span className="font-medium capitalize">{e.step.replace(/_/g, " ")}:</span> {e.message}{" "}
                  <span className="text-xs">({new Date(e.created_at).toLocaleString()})</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {canSend && (
        <div>
          <SendToClientButton proposalId={id} label={proposal.state === "failed" ? "Retry send to client" : "Send to client"} />
        </div>
      )}

      {sections && sections.length > 0 && (
        <div className="space-y-4">
          {sections.map((section) => (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {SECTION_LABELS[section.section_key as SectionKey] ?? section.section_key}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap leading-relaxed">{section.content}</CardContent>
            </Card>
          ))}
        </div>
      )}

      {proposal.document_url && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>Document generated {proposal.document_generated_at && new Date(proposal.document_generated_at).toLocaleString()}</div>
            {proposal.email_sent_at && <div>Emailed to {client.client_contact_email} at {new Date(proposal.email_sent_at).toLocaleString()}</div>}
            {proposal.email_opened_at ? (
              <div className="text-emerald-600">Opened {new Date(proposal.email_opened_at).toLocaleString()}</div>
            ) : proposal.email_sent_at ? (
              <div className="text-muted-foreground">Not yet opened</div>
            ) : null}
            {proposal.email_clicked_at && (
              <div className="text-emerald-600">Clicked the proposal link {new Date(proposal.email_clicked_at).toLocaleString()}</div>
            )}
            {proposal.reminder_sent_at && (
              <div className="text-amber-700 dark:text-amber-400">
                Follow-up reminder sent {new Date(proposal.reminder_sent_at).toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent>
          {historyDesc.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ol className="space-y-3 text-sm">
              {historyDesc.map((h) => (
                <li key={h.id} className="flex justify-between gap-4 border-b last:border-0 pb-2 last:pb-0">
                  <span className={h.isRejection ? "text-amber-600" : ""}>{h.description}</span>
                  <span className="text-muted-foreground whitespace-nowrap">{new Date(h.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
