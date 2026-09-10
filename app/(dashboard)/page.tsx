import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProposalStateBadge } from "@/components/proposal-state-badge";
import { proposalActionLink } from "@/lib/proposals/actionLink";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  const role = profile?.role ?? "sales_rep";

  const { data: proposals } = await supabase
    .from("proposals")
    .select("id, client_name, project_title, state, has_gaps, created_at")
    .order("created_at", { ascending: false });

  const proposalIds = proposals?.map((p) => p.id) ?? [];

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

  const fileCountByProposal = new Map<string, number>();
  for (const m of materials ?? []) fileCountByProposal.set(m.proposal_id, (fileCountByProposal.get(m.proposal_id) ?? 0) + 1);

  const gapCountByProposal = new Map<string, number>();
  for (const s of gapSections ?? []) gapCountByProposal.set(s.proposal_id, (gapCountByProposal.get(s.proposal_id) ?? 0) + 1);

  const latestErrorByProposal = new Map<string, { step: string; message: string }>();
  for (const e of unresolvedErrors ?? []) {
    if (e.proposal_id && !latestErrorByProposal.has(e.proposal_id)) {
      latestErrorByProposal.set(e.proposal_id, { step: e.step, message: e.message });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Proposals</h1>
          <p className="text-sm text-muted-foreground">
            {role === "sales_rep" ? "Your proposals" : "All proposals across the team"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/proposals/import">Bulk import</Link>} />
          <Button render={<Link href="/proposals/new">New proposal</Link>} />
        </div>
      </div>

      {!proposals || proposals.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">
          No proposals yet. Create one to get started.
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Gaps</TableHead>
                <TableHead>Files</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proposals.map((p) => {
                const action = proposalActionLink(p.id, p.state, role);
                const error = latestErrorByProposal.get(p.id);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.client_name}</div>
                      {p.project_title && <div className="text-xs text-muted-foreground">{p.project_title}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <ProposalStateBadge state={p.state} />
                        {error && (
                          <span className="text-xs text-destructive">
                            {error.step.replace("_", " ")}: {error.message}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{p.has_gaps ? `${gapCountByProposal.get(p.id) ?? 0} gap(s)` : "—"}</TableCell>
                    <TableCell>{fileCountByProposal.get(p.id) ?? 0}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(p.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="secondary" size="sm" render={<Link href={action.href}>{action.label}</Link>} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
