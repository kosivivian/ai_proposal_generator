import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/session";
import { getClientsByIds } from "@/lib/clients/resolve";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";

interface MetricCard {
  label: string;
  value: number;
}

interface TodoItem {
  key: string;
  title: string;
  subtitle?: string;
  href: string;
}

export default async function OverviewPage() {
  const supabase = await createClient();
  const { profile } = await getCurrentUserProfile();
  const role = profile?.role ?? "sales_rep";

  const [totalCount, needsAttentionCount, sentCount] = await Promise.all([
    supabase.from("proposals").select("*", { count: "exact", head: true }).then((r) => r.count ?? 0),
    supabase
      .from("proposals")
      .select("*", { count: "exact", head: true })
      .or("has_gaps.eq.true,state.eq.failed,and(state.eq.in_review,rejection_notes.not.is.null)")
      .then((r) => r.count ?? 0),
    supabase
      .from("proposals")
      .select("*", { count: "exact", head: true })
      .in("state", ["sent", "logged"])
      .then((r) => r.count ?? 0),
  ]);

  const metrics: MetricCard[] = [
    { label: "Total proposals", value: totalCount },
    { label: "Needs attention", value: needsAttentionCount },
    { label: "Total sent", value: sentCount },
  ];

  const todos: TodoItem[] = [];

  if (role === "sales_rep") {
    const pendingApprovalCount = await supabase
      .from("proposals")
      .select("*", { count: "exact", head: true })
      .eq("state", "pending_approval")
      .then((r) => r.count ?? 0);
    metrics.push({ label: "Pending approval", value: pendingApprovalCount });

    const { data: mine } = await supabase
      .from("proposals")
      .select("id, client_id, project_title, state, has_gaps, rejection_notes")
      .in("state", ["draft", "materials_ready", "in_review", "approved"])
      .order("created_at", { ascending: false });

    const proposals = mine ?? [];
    const clientsById = await getClientsByIds(supabase, proposals.map((p) => p.client_id));

    const rejectedIds = proposals.filter((p) => p.state === "in_review" && p.rejection_notes).map((p) => p.id);
    const latestRejectorByProposal = new Map<string, string>();
    if (rejectedIds.length) {
      const { data: events } = await supabase
        .from("proposal_events")
        .select("proposal_id, actor_id, created_at")
        .in("proposal_id", rejectedIds)
        .eq("to_state", "in_review")
        .not("note", "is", null)
        .order("created_at", { ascending: false });

      const actorIds = new Set<string>();
      for (const e of events ?? []) {
        if (!latestRejectorByProposal.has(e.proposal_id) && e.actor_id) {
          latestRejectorByProposal.set(e.proposal_id, e.actor_id);
          actorIds.add(e.actor_id);
        }
      }
      if (actorIds.size) {
        const { data: actors } = await supabase.from("profiles").select("id, full_name").in("id", [...actorIds]);
        const nameById = new Map((actors ?? []).map((a) => [a.id, a.full_name]));
        for (const [proposalId, actorId] of latestRejectorByProposal) {
          latestRejectorByProposal.set(proposalId, nameById.get(actorId) ?? "the approver");
        }
      }
    }

    for (const p of proposals) {
      const client = clientsById.get(p.client_id);
      const label = client?.company_name || client?.client_name || p.project_title || "Untitled";
      if (p.state === "draft") {
        todos.push({ key: p.id, title: `Attach materials — ${label}`, href: `/proposals/${p.id}/materials` });
      } else if (p.state === "materials_ready") {
        todos.push({ key: p.id, title: `Ready to generate — ${label}`, href: `/proposals/${p.id}/materials` });
      } else if (p.state === "in_review" && p.rejection_notes) {
        const rejector = latestRejectorByProposal.get(p.id) ?? "the approver";
        todos.push({
          key: p.id,
          title: `Sent back for revision — ${label}`,
          subtitle: `By ${rejector}`,
          href: `/proposals/${p.id}/review`,
        });
      } else if (p.state === "in_review" && p.has_gaps) {
        todos.push({ key: p.id, title: `Gaps to resolve — ${label}`, href: `/proposals/${p.id}/review` });
      } else if (p.state === "approved") {
        todos.push({ key: p.id, title: `Approved — ready to send — ${label}`, href: `/proposals/${p.id}` });
      }
    }
  } else if (role === "approver") {
    const pendingCount = await supabase
      .from("proposals")
      .select("*", { count: "exact", head: true })
      .eq("state", "pending_approval")
      .then((r) => r.count ?? 0);
    metrics.push({ label: "Awaiting your decision", value: pendingCount });

    const { data: pending } = await supabase
      .from("proposals")
      .select("id, client_id, project_title, submitted_for_approval_at")
      .eq("state", "pending_approval")
      .order("submitted_for_approval_at", { ascending: true });

    const proposals = pending ?? [];
    const clientsById = await getClientsByIds(supabase, proposals.map((p) => p.client_id));
    for (const p of proposals) {
      const client = clientsById.get(p.client_id);
      const label = client?.company_name || client?.client_name || p.project_title || "Untitled";
      todos.push({ key: p.id, title: `Review — ${label}`, href: `/approvals/${p.id}` });
    }
  } else if (role === "admin") {
    const unresolvedCount = await supabase
      .from("error_log")
      .select("*", { count: "exact", head: true })
      .eq("resolved", false)
      .then((r) => r.count ?? 0);
    metrics.push({ label: "Unresolved errors", value: unresolvedCount });
  }

  return (
    <div className="space-y-8">
      <RealtimeRefresh tables={["proposals", "error_log", "proposal_events"]} />
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-normal text-muted-foreground">{m.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{m.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {role === "admin" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attention needed</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics[metrics.length - 1].value > 0 ? (
              <Link href="/admin/logs" className="text-sm text-primary hover:underline">
                {metrics[metrics.length - 1].value} unresolved error(s) — view logs
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">No unresolved errors.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <h2 className="text-lg font-medium">To do</h2>
          {todos.length === 0 ? (
            <div className="rounded-lg border shadow-sm p-8 text-center text-muted-foreground text-sm">
              Nothing needs your attention right now.
            </div>
          ) : (
            <div className="rounded-lg border shadow-sm divide-y">
              {todos.map((t) => (
                <Link
                  key={t.key}
                  href={t.href}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium">{t.title}</div>
                    {t.subtitle && <div className="text-xs text-muted-foreground">{t.subtitle}</div>}
                  </div>
                  <span className="text-sm text-muted-foreground">→</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
