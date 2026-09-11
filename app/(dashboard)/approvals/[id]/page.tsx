import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SECTION_LABELS, type SectionKey } from "@/lib/generation/sections";
import { getClientById } from "@/lib/clients/resolve";
import { getCurrentUserProfile } from "@/lib/supabase/session";
import { renderProposalHtml } from "@/lib/pdf/renderProposalHtml";
import { getProposalHistoryFeed, getLatestRejectionEvent } from "@/lib/proposals/history";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { ApprovalActions } from "./ApprovalActions";
import { PreviewDialog } from "@/components/PreviewDialog";

const SOURCE_LABELS: Record<string, string> = {
  generation: "generated",
  regeneration: "regenerated",
  manual_edit: "edited",
};

export default async function ApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { profile } = await getCurrentUserProfile();

  const [{ data: proposal, error }, { data: sections }] = await Promise.all([
    supabase.from("proposals").select("*").eq("id", id).single(),
    supabase.from("proposal_sections").select("*").eq("proposal_id", id).order("order_index"),
  ]);
  if (error) console.error(`[ApprovalDetailPage] proposals select failed for ${id}:`, error);
  if (!proposal) notFound();

  const client = await getClientById(supabase, proposal.client_id);
  if (!client) notFound();

  const [{ data: generatorProfile }, history, latestRejection] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", proposal.generated_by ?? proposal.created_by).single(),
    getProposalHistoryFeed(supabase, id),
    getLatestRejectionEvent(supabase, id),
  ]);
  const preparedByName = generatorProfile?.full_name ?? "The Team";
  const previewHtml = renderProposalHtml(proposal, client, sections ?? [], preparedByName);

  const changedSinceRejection: { sectionKey: string; source: string }[] = [];
  if (latestRejection && sections && sections.length > 0) {
    const { data: changedVersions } = await supabase
      .from("proposal_section_versions")
      .select("section_id, source, created_at")
      .in("section_id", sections.map((s) => s.id))
      .gt("created_at", latestRejection.created_at)
      .order("created_at", { ascending: false });

    const sectionKeyById = new Map(sections.map((s) => [s.id, s.section_key]));
    const seen = new Set<string>();
    for (const v of changedVersions ?? []) {
      const key = sectionKeyById.get(v.section_id);
      if (key && !seen.has(key)) {
        seen.add(key);
        changedSinceRejection.push({ sectionKey: key, source: v.source });
      }
    }
  }

  return (
    <div className="space-y-6">
      <RealtimeRefresh tables={["proposal_events", "delivery_log"]} filter={`proposal_id=eq.${id}`} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/approvals" className="text-sm text-muted-foreground hover:underline">
            ← Back to approvals
          </Link>
          <h1 className="text-2xl font-semibold mt-1">{client.company_name || client.client_name}</h1>
          {proposal.project_title && <p className="text-sm text-muted-foreground">{proposal.project_title}</p>}
        </div>
        <PreviewDialog html={previewHtml} />
      </div>

      {changedSinceRejection.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <span className="font-medium">Changed since rejection: </span>
          {changedSinceRejection
            .map((c) => `${SECTION_LABELS[c.sectionKey as SectionKey] ?? c.sectionKey} (${SOURCE_LABELS[c.source] ?? c.source})`)
            .join(", ")}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Intake</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div><span className="text-muted-foreground">Contact:</span> {client.client_name}</div>
          <div><span className="text-muted-foreground">Email:</span> {client.client_contact_email}</div>
          <div><span className="text-muted-foreground">Date of call:</span> {proposal.date_of_call || "—"}</div>
          <div><span className="text-muted-foreground">Budget:</span> {proposal.budget_range || "—"}</div>
          <div><span className="text-muted-foreground">Timeline:</span> {proposal.timeline || "—"}</div>
          <div className="col-span-2"><span className="text-muted-foreground">Client&apos;s needs:</span> {proposal.client_needs_summary || "—"}</div>
          <div className="col-span-2"><span className="text-muted-foreground">Goals and objectives:</span> {proposal.goals_and_objectives || "—"}</div>
          <div className="col-span-2"><span className="text-muted-foreground">Recommended services:</span> {proposal.recommended_services || "—"}</div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {sections?.map((section) => (
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

      {profile?.role === "approver" ? (
        <div className="pt-2 border-t">
          <ApprovalActions proposalId={id} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground pt-2 border-t">
          Viewing only — only approvers can approve or reject.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="text-sm flex justify-between gap-4">
                  <span className={h.isRejection ? "text-amber-600" : ""}>{h.description}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(h.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
