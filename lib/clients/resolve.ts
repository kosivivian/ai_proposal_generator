import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { ClientInput } from "@/lib/clients/schema";
import type { Database, Tables } from "@/lib/types/database";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Deliberately uses the service-role client: `clients_select` RLS is open
 * to every authenticated user already, but this also runs from contexts
 * (bulk import confirm) that need it regardless — kept consistent with the
 * one lookup function rather than branching per caller.
 */
export async function findClientByEmail(email: string): Promise<Tables<"clients"> | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const service = createServiceRoleClient();
  const { data } = await service
    .from("clients")
    .select("*")
    .ilike("client_contact_email", normalized)
    .maybeSingle();

  return data ?? null;
}

export async function createClientRecord(input: ClientInput, createdBy: string): Promise<Tables<"clients">> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("clients")
    .insert({
      client_name: input.client_name,
      company_name: input.company_name || null,
      client_contact_email: input.client_contact_email,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create client");
  return data;
}

/** For the single-form flow: reuses an existing client by email, or creates a new one. */
export async function resolveOrCreateClient(
  input: ClientInput,
  createdBy: string,
): Promise<{ client: Tables<"clients">; existed: boolean }> {
  const existing = await findClientByEmail(input.client_contact_email);
  if (existing) return { client: existing, existed: true };
  return { client: await createClientRecord(input, createdBy), existed: false };
}

/**
 * Read-only batched lookup — used by the CSV preflight step, which must
 * write nothing to the DB (a dry run the rep reviews before confirming).
 */
export async function findClientsByEmailsBatch(emails: string[]): Promise<Map<string, Tables<"clients">>> {
  const normalized = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
  const resolved = new Map<string, Tables<"clients">>();
  if (normalized.length === 0) return resolved;

  const service = createServiceRoleClient();
  const { data } = await service
    .from("clients")
    .select("*")
    .or(normalized.map((email) => `client_contact_email.ilike.${email}`).join(","));

  for (const client of data ?? []) resolved.set(normalizeEmail(client.client_contact_email), client);
  return resolved;
}

/**
 * Bulk CSV path: resolves many rows' clients in two queries total (not
 * N+1) — one batched lookup for emails that already exist, one batched
 * insert for the rest.
 */
export async function resolveOrCreateClientsBatch(
  rows: ClientInput[],
  createdBy: string,
): Promise<Map<string, Tables<"clients">>> {
  const byEmail = new Map<string, ClientInput>();
  for (const row of rows) byEmail.set(normalizeEmail(row.client_contact_email), row);
  const emails = [...byEmail.keys()];
  if (emails.length === 0) return new Map();

  const resolved = await findClientsByEmailsBatch(emails);
  const missing = emails.filter((email) => !resolved.has(email));
  if (missing.length > 0) {
    const service = createServiceRoleClient();
    const { data: created, error } = await service
      .from("clients")
      .insert(
        missing.map((email) => {
          const row = byEmail.get(email)!;
          return {
            client_name: row.client_name,
            company_name: row.company_name || null,
            client_contact_email: row.client_contact_email,
            created_by: createdBy,
          };
        }),
      )
      .select();
    if (error) throw new Error(`Failed to create clients: ${error.message}`);
    for (const client of created ?? []) resolved.set(normalizeEmail(client.client_contact_email), client);
  }

  return resolved;
}

export async function getClientById(
  supabase: SupabaseClient<Database>,
  clientId: string,
): Promise<Tables<"clients"> | null> {
  const { data } = await supabase.from("clients").select("*").eq("id", clientId).single();
  return data ?? null;
}

export async function getClientsByIds(
  supabase: SupabaseClient<Database>,
  clientIds: string[],
): Promise<Map<string, Tables<"clients">>> {
  const ids = [...new Set(clientIds)];
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from("clients").select("*").in("id", ids);
  return new Map((data ?? []).map((c) => [c.id, c]));
}
