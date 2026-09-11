import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getClientById } from "@/lib/clients/resolve";
import { MaterialsManager } from "./MaterialsManager";

export default async function MaterialsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Independent queries (materials only needs `id` from the route params) —
  // run them in parallel instead of waiting on the proposal first.
  const [{ data: proposal, error }, { data: materials }] = await Promise.all([
    supabase.from("proposals").select("*").eq("id", id).single(),
    supabase.from("proposal_materials").select("*").eq("proposal_id", id).order("created_at", { ascending: true }),
  ]);
  if (error) console.error(`[MaterialsPage] proposals select failed for ${id}:`, error);
  if (!proposal) notFound();

  const client = await getClientById(supabase, proposal.client_id);
  if (!client) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="text-2xl font-semibold mt-1">{client.company_name || client.client_name}</h1>
        <p className="text-sm text-muted-foreground">
          Attach call recordings, intake forms, and old proposals. Generation unlocks once everything finishes processing.
        </p>
      </div>
      <MaterialsManager proposalId={id} initialState={proposal.state} initialMaterials={materials ?? []} />
    </div>
  );
}
