import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProposalStateBadge } from "@/components/proposal-state-badge";
import { SECTION_LABELS, type SectionKey } from "@/lib/generation/sections";
import { getClientById } from "@/lib/clients/resolve";
import { SendToClientButton } from "./SendToClientButton";

export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // None of these depend on each other (events/errors/deliveries/sections
  // only need `id` from the route params) — fetch all five in parallel.
  const [{ data: proposal, error }, { data: events }, { data: errors }, { data: deliveries }, { data: sections }] =
    await Promise.all([
      supabase.from("proposals").select("*").eq("id", id).single(),
      supabase.from("proposal_events").select("*").eq("proposal_id", id).order("created_at", { ascending: false }),
      supabase.from("error_log").select("*").eq("proposal_id", id).eq("resolved", false).order("created_at", { ascending: false }),
      supabase.from("delivery_log").select("*").eq("proposal_id", id).order("attempted_at", { ascending: false }),
      supabase.from("proposal_sections").select("*").eq("proposal_id", id).order("order_index"),
    ]);
  if (error) console.error(`[ProposalDetailPage] proposals select failed for ${id}:`, error);
  if (!proposal) notFound();

  const client = await getClientById(supabase, proposal.client_id);
  if (!client) notFound();

  const actorIds = [...new Set((events ?? []).map((e) => e.actor_id).filter((v): v is string => !!v))];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] as { id: string; full_name: string }[] };
  const actorName = new Map((actors ?? []).map((a) => [a.id, a.full_name]));

  const canSend = proposal.state === "approved" || (proposal.state === "failed" && proposal.approved_at !== null);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Back to dashboard
        </Link>
        <div className="flex items-center gap-3 mt-1">
          <h1 className="text-2xl font-semibold">{client.company_name || client.client_name}</h1>
          <ProposalStateBadge state={proposal.state} />
        </div>
        {proposal.project_title && <p className="text-sm text-muted-foreground">{proposal.project_title}</p>}
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

      {deliveries && deliveries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery attempts</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {deliveries.map((d) => (
              <div key={d.id} className="flex justify-between border-b last:border-0 pb-2 last:pb-0">
                <span>{d.recipient_email}</span>
                <span className="capitalize">{d.status}</span>
                <span className="text-muted-foreground">{new Date(d.attempted_at).toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            {events?.map((e) => (
              <li key={e.id} className="flex justify-between border-b last:border-0 pb-2 last:pb-0">
                <div>
                  <span className="font-medium">
                    {e.from_state ? `${e.from_state} → ${e.to_state}` : `created as ${e.to_state}`}
                  </span>
                  {e.actor_id && <span className="text-muted-foreground"> by {actorName.get(e.actor_id) ?? "unknown"}</span>}
                  {e.note && <div className="text-muted-foreground">{e.note}</div>}
                </div>
                <span className="text-muted-foreground whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
