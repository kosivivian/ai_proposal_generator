import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/session";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getClientsByIds } from "@/lib/clients/resolve";
import { ResolveErrorButton } from "./ResolveErrorButton";

export default async function AdminErrorsPage() {
  const { user, profile } = await getCurrentUserProfile();
  if (!user) redirect("/login");
  if (profile?.role !== "admin") redirect("/");

  const supabase = await createClient();
  // RLS's error_log_select policy already grants admins full visibility
  // (is_approver_or_admin() bypass) — no service-role client needed here.
  const { data: errors } = await supabase
    .from("error_log")
    .select("*")
    .eq("resolved", false)
    .order("created_at", { ascending: false });

  const proposalIds = [...new Set((errors ?? []).map((e) => e.proposal_id).filter((id): id is string => !!id))];
  const { data: proposals } = proposalIds.length
    ? await supabase.from("proposals").select("id, client_id").in("id", proposalIds)
    : { data: [] as { id: string; client_id: string }[] };
  const proposalById = new Map((proposals ?? []).map((p) => [p.id, p]));
  const clientsById = await getClientsByIds(supabase, (proposals ?? []).map((p) => p.client_id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">System errors</h1>
        <p className="text-sm text-muted-foreground">Every unresolved failure across all proposals.</p>
      </div>

      {!errors || errors.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-muted-foreground">No unresolved errors.</div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Step</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>When</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errors.map((e) => {
                const proposal = e.proposal_id ? proposalById.get(e.proposal_id) : undefined;
                const client = proposal ? clientsById.get(proposal.client_id) : undefined;
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      {e.proposal_id ? (
                        <Link href={`/proposals/${e.proposal_id}`} className="hover:underline">
                          {client?.company_name || client?.client_name || e.proposal_id}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{e.step.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-sm max-w-md truncate" title={e.message}>
                      {e.message}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <ResolveErrorButton errorId={e.id} />
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
