import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MaterialsManager } from "./MaterialsManager";

export default async function MaterialsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: proposal } = await supabase.from("proposals").select("*").eq("id", id).single();
  if (!proposal) notFound();

  const { data: materials } = await supabase
    .from("proposal_materials")
    .select("*")
    .eq("proposal_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="text-2xl font-semibold mt-1">{proposal.client_name}</h1>
        <p className="text-sm text-muted-foreground">
          Attach call recordings, intake forms, and old proposals. Generation unlocks once everything finishes processing.
        </p>
      </div>
      <MaterialsManager proposalId={id} initialState={proposal.state} initialMaterials={materials ?? []} />
    </div>
  );
}
