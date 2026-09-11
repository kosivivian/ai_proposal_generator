import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/session";
import { getClientsByIds } from "@/lib/clients/resolve";
import { Button } from "@/components/ui/button";
import { ProposalsTable } from "./ProposalsTable";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { profile } = await getCurrentUserProfile();
  const role = profile?.role ?? "sales_rep";

  const { data: rawProposals } = await supabase
    .from("proposals")
    .select("id, client_id, project_title, state, has_gaps, created_at")
    .order("created_at", { ascending: false });

  const clientsById = await getClientsByIds(supabase, (rawProposals ?? []).map((p) => p.client_id));
  const proposals = (rawProposals ?? []).map((p) => {
    const client = clientsById.get(p.client_id);
    return { ...p, client_name: client?.client_name ?? "", company_name: client?.company_name ?? null };
  });

  const proposalIds = proposals.map((p) => p.id);

  const [{ data: materials }, { data: gapSections }, { data: unresolvedErrors }] = await Promise.all([
    proposalIds.length
      ? supabase.from("proposal_materials").select("proposal_id").in("proposal_id", proposalIds)
      : Promise.resolve({ data: [] as { proposal_id: string }[] }),
    proposalIds.length
      ? supabase
          .from("proposal_sections")
          .select("proposal_id")
          .eq("has_gap_marker", true)
          .in("proposal_id", proposalIds)
      : Promise.resolve({ data: [] as { proposal_id: string }[] }),
    proposalIds.length
      ? supabase
          .from("error_log")
          .select("proposal_id, step, message, created_at")
          .eq("resolved", false)
          .in("proposal_id", proposalIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { proposal_id: string | null; step: string; message: string; created_at: string }[] }),
  ]);

  // Plain objects, not Maps — Maps aren't serializable across the
  // server/client boundary when passed as props to ProposalsTable.
  const fileCountByProposal: Record<string, number> = {};
  for (const m of materials ?? []) fileCountByProposal[m.proposal_id] = (fileCountByProposal[m.proposal_id] ?? 0) + 1;

  const gapCountByProposal: Record<string, number> = {};
  for (const s of gapSections ?? []) gapCountByProposal[s.proposal_id] = (gapCountByProposal[s.proposal_id] ?? 0) + 1;

  const latestErrorByProposal: Record<string, { step: string; message: string }> = {};
  for (const e of unresolvedErrors ?? []) {
    if (e.proposal_id && !latestErrorByProposal[e.proposal_id]) {
      latestErrorByProposal[e.proposal_id] = { step: e.step, message: e.message };
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Proposals</h1>
          <p className="text-sm text-muted-foreground">
            {role === "sales_rep"
              ? "Your proposals"
              : role === "admin"
                ? "All proposals across the team (view only)"
                : "All proposals across the team"}
          </p>
        </div>
        {role !== "admin" && (
          <div className="flex gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href="/proposals/import">Bulk import</Link>} />
            <Button nativeButton={false} render={<Link href="/proposals/new">New proposal</Link>} />
          </div>
        )}
      </div>

      {proposals.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          No proposals yet. Create one to get started.
        </div>
      ) : (
        <ProposalsTable
          proposals={proposals}
          role={role}
          fileCountByProposal={fileCountByProposal}
          gapCountByProposal={gapCountByProposal}
          latestErrorByProposal={latestErrorByProposal}
        />
      )}
    </div>
  );
}
