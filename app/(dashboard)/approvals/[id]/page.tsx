import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SECTION_LABELS, type SectionKey } from "@/lib/generation/sections";
import { ApprovalActions } from "./ApprovalActions";

export default async function ApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: proposal } = await supabase.from("proposals").select("*").eq("id", id).single();
  if (!proposal) notFound();

  const { data: sections } = await supabase
    .from("proposal_sections")
    .select("*")
    .eq("proposal_id", id)
    .order("order_index");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/approvals" className="text-sm text-muted-foreground hover:underline">
          ← Back to approvals
        </Link>
        <h1 className="text-2xl font-semibold mt-1">{proposal.client_name}</h1>
        {proposal.project_title && <p className="text-sm text-muted-foreground">{proposal.project_title}</p>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Intake</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div><span className="text-muted-foreground">Contact:</span> {proposal.client_contact_name || "—"}</div>
          <div><span className="text-muted-foreground">Email:</span> {proposal.client_contact_email || "—"}</div>
          <div><span className="text-muted-foreground">Budget:</span> {proposal.budget_range || "—"}</div>
          <div><span className="text-muted-foreground">Timeline:</span> {proposal.timeline || "—"}</div>
          <div><span className="text-muted-foreground">Industry:</span> {proposal.industry || "—"}</div>
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

      <div className="pt-2 border-t">
        <ApprovalActions proposalId={id} />
      </div>
    </div>
  );
}
