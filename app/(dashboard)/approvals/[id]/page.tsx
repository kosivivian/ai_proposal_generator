import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SECTION_LABELS, type SectionKey } from "@/lib/generation/sections";
import { getClientById } from "@/lib/clients/resolve";
import { getCurrentUserProfile } from "@/lib/supabase/session";
import { ApprovalActions } from "./ApprovalActions";

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

  return (
    <div className="space-y-6">
      <div>
        <Link href="/approvals" className="text-sm text-muted-foreground hover:underline">
          ← Back to approvals
        </Link>
        <h1 className="text-2xl font-semibold mt-1">{client.company_name || client.client_name}</h1>
        {proposal.project_title && <p className="text-sm text-muted-foreground">{proposal.project_title}</p>}
      </div>

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
    </div>
  );
}
