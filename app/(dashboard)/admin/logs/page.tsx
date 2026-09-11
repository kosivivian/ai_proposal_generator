import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/session";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClientsByIds } from "@/lib/clients/resolve";
import { describeTransition, describeError } from "@/lib/proposals/describeEvent";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { ResolveErrorButton } from "./ResolveErrorButton";

const FEED_LIMIT = 150;

export default async function AdminLogsPage() {
  const { user, profile } = await getCurrentUserProfile();
  if (!user) redirect("/login");
  if (profile?.role !== "admin") redirect("/");

  const supabase = await createClient();

  const [{ data: unresolvedErrors }, { data: allErrors }, { data: events }] = await Promise.all([
    supabase.from("error_log").select("*").eq("resolved", false).order("created_at", { ascending: false }),
    supabase.from("error_log").select("*").order("created_at", { ascending: false }).limit(FEED_LIMIT),
    supabase
      .from("proposal_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(FEED_LIMIT),
  ]);

  const proposalIds = [
    ...new Set([
      ...(allErrors ?? []).map((e) => e.proposal_id).filter((id): id is string => !!id),
      ...(events ?? []).map((e) => e.proposal_id),
    ]),
  ];
  const { data: proposals } = proposalIds.length
    ? await supabase.from("proposals").select("id, client_id").in("id", proposalIds)
    : { data: [] as { id: string; client_id: string }[] };
  const proposalById = new Map((proposals ?? []).map((p) => [p.id, p]));
  const clientsById = await getClientsByIds(supabase, (proposals ?? []).map((p) => p.client_id));

  const actorIds = [...new Set((events ?? []).map((e) => e.actor_id).filter((id): id is string => !!id))];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameByActorId = new Map((actors ?? []).map((a) => [a.id, a.full_name]));

  function clientLabelFor(proposalId: string | null) {
    if (!proposalId) return null;
    const proposal = proposalById.get(proposalId);
    if (!proposal) return null;
    const client = clientsById.get(proposal.client_id);
    return client?.company_name || client?.client_name || null;
  }

  type FeedEntry = { id: string; createdAt: string; content: React.ReactNode };

  const feed: FeedEntry[] = [
    ...(events ?? []).map((e) => {
      const label = clientLabelFor(e.proposal_id);
      const sentence = describeTransition(e, e.actor_id ? nameByActorId.get(e.actor_id) ?? null : null);
      return {
        id: `event-${e.id}`,
        createdAt: e.created_at,
        content: (
          <span>
            {label && (
              <Link href={`/proposals/${e.proposal_id}`} className="font-medium hover:underline">
                {label}
              </Link>
            )}
            {label && ": "}
            {sentence}
          </span>
        ),
      };
    }),
    ...(allErrors ?? []).map((e) => {
      const label = clientLabelFor(e.proposal_id);
      return {
        id: `error-${e.id}`,
        createdAt: e.created_at,
        content: (
          <span className={e.resolved ? "text-muted-foreground" : "text-destructive"}>
            {label && (
              <Link href={`/proposals/${e.proposal_id}`} className="font-medium hover:underline">
                {label}
              </Link>
            )}
            {label && ": "}
            {describeError(e)}
            {e.resolved && <span className="text-muted-foreground"> (resolved)</span>}
          </span>
        ),
      };
    }),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, FEED_LIMIT);

  return (
    <div className="space-y-8">
      <RealtimeRefresh tables={["proposal_events", "error_log"]} />
      <div>
        <h1 className="text-2xl font-semibold">Logs</h1>
        <p className="text-sm text-muted-foreground">All activity across the system, including resolved errors.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-destructive">
            Unresolved errors {unresolvedErrors && unresolvedErrors.length > 0 ? `(${unresolvedErrors.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!unresolvedErrors || unresolvedErrors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No unresolved errors.</p>
          ) : (
            <div className="rounded-lg border shadow-sm overflow-x-auto">
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
                  {unresolvedErrors.map((e) => {
                    const label = clientLabelFor(e.proposal_id);
                    return (
                      <TableRow key={e.id}>
                        <TableCell>
                          {e.proposal_id ? (
                            <Link href={`/proposals/${e.proposal_id}`} className="hover:underline">
                              {label || e.proposal_id}
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
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Activity</h2>
        {feed.length === 0 ? (
          <div className="rounded-lg border shadow-sm p-8 text-center text-muted-foreground text-sm">No activity yet.</div>
        ) : (
          <div className="rounded-lg border shadow-sm divide-y">
            {feed.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="text-sm">{entry.content}</div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(entry.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
