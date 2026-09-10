import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export default async function ApprovalsPage() {
  const supabase = await createClient();

  const { data: proposals } = await supabase
    .from("proposals")
    .select("id, client_name, project_title, submitted_for_approval_at, created_by")
    .eq("state", "pending_approval")
    .order("submitted_for_approval_at", { ascending: true });

  const createdByIds = [...new Set((proposals ?? []).map((p) => p.created_by))];
  const { data: profiles } = createdByIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", createdByIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Approvals</h1>
        <p className="text-sm text-muted-foreground">Proposals awaiting internal sign-off before they can reach a client.</p>
      </div>

      {!proposals || proposals.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">Nothing pending approval.</div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Submitted by</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proposals.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.client_name}</div>
                    {p.project_title && <div className="text-xs text-muted-foreground">{p.project_title}</div>}
                  </TableCell>
                  <TableCell>{nameById.get(p.created_by) ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.submitted_for_approval_at ? new Date(p.submitted_for_approval_at).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" render={<Link href={`/approvals/${p.id}`}>Review</Link>} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
