"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { intakeSchema, toProposalInsertFields } from "@/lib/intake/schema";
import { clientSchema } from "@/lib/clients/schema";
import { computeMissingFields } from "@/lib/intake/requiredFields";
import { findClientByEmail, createClientRecord } from "@/lib/clients/resolve";
import { findExactDuplicateProposal } from "@/lib/intake/duplicate";
import type { Tables } from "@/lib/types/database";

export interface CreateProposalState {
  error?: string;
  fieldErrors?: Record<string, string>;
  /** New-client path found a matching client by email — rep must confirm before continuing. */
  existingClient?: Tables<"clients">;
  /** Hard block, no override — an identical proposal already exists for this client. */
  exactDuplicateProposalId?: string;
}

export async function searchClients(
  query: string,
): Promise<Pick<Tables<"clients">, "id" | "client_name" | "company_name" | "client_contact_email">[]> {
  const q = query.trim();
  if (!q) return [];

  const supabase = await createClient();
  // clients_select RLS is open to every authenticated user, so the normal
  // session client is enough here — no service-role client needed.
  const { data } = await supabase
    .from("clients")
    .select("id, client_name, company_name, client_contact_email")
    .or(`client_name.ilike.%${q}%,company_name.ilike.%${q}%,client_contact_email.ilike.%${q}%`)
    .limit(10);

  return data ?? [];
}

export async function createProposal(
  _prevState: CreateProposalState,
  formData: FormData,
): Promise<CreateProposalState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = intakeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { error: "Please fix the highlighted fields", fieldErrors };
  }

  const mode = formData.get("mode") === "existing" ? "existing" : "new";
  const confirmedClientId = String(formData.get("client_id") ?? "").trim() || null;

  let clientId: string;

  if (mode === "existing") {
    if (!confirmedClientId) return { error: "Select a client" };
    clientId = confirmedClientId;
  } else {
    const clientParsed = clientSchema.safeParse(Object.fromEntries(formData));
    if (!clientParsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of clientParsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      return { error: "Please fix the highlighted fields", fieldErrors };
    }

    if (confirmedClientId) {
      // Rep already saw the "this client exists" notice and chose to
      // continue with it (see below) — no need to look up again.
      clientId = confirmedClientId;
    } else {
      const existing = await findClientByEmail(clientParsed.data.client_contact_email);
      if (existing) {
        // Not a warning to override — this is the resolution. The form
        // re-renders showing the real client and resubmits with client_id
        // set, landing in the confirmedClientId branch above.
        return { existingClient: existing };
      }
      const created = await createClientRecord(clientParsed.data, user.id);
      clientId = created.id;
    }
  }

  // Hard block, no override — an identical proposal already exists for
  // this exact client.
  const duplicate = await findExactDuplicateProposal(clientId, parsed.data);
  if (duplicate) return { exactDuplicateProposalId: duplicate.proposalId };

  const missing_fields = computeMissingFields(parsed.data);

  const { data, error } = await supabase
    .from("proposals")
    .insert({ ...toProposalInsertFields(parsed.data), client_id: clientId, created_by: user.id, missing_fields })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to create proposal" };

  redirect(`/proposals/${data.id}/materials`);
}
