import { createHash } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { findClientsByEmailsBatch } from "@/lib/clients/resolve";
import type { IntakeInput } from "@/lib/intake/schema";
import type { Tables } from "@/lib/types/database";

const PROPOSAL_HASH_FIELDS = [
  "date_of_call",
  "client_needs_summary",
  "project_title",
  "project_scope",
  "budget_range",
  "timeline",
  "goals_and_objectives",
  "recommended_services",
  "additional_notes",
] as const;

type HashableFields = Record<(typeof PROPOSAL_HASH_FIELDS)[number], string | null | undefined>;

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Fingerprint of the proposal-specific fields only — client identity is no
 * longer part of this hash, since it's resolved via client_id now rather
 * than re-derived from re-typed fields. Used only to catch a literal
 * resubmission of the same content for the same client, which is now a
 * hard block (see findExactDuplicateProposal) — there's no longer a
 * "same email, different details" case to warn about, since a client
 * having multiple different proposals is the normal, expected case.
 */
export function computeProposalContentHash(fields: HashableFields): string {
  const normalized = PROPOSAL_HASH_FIELDS.map((key) => normalize(fields[key]));
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export interface ExactDuplicateMatch {
  proposalId: string;
}

/**
 * Single-form hard-block check: does this exact client already have a
 * proposal with identical content? Service-role client for the same
 * cross-rep-visibility reason as the client lookup itself.
 */
export async function findExactDuplicateProposal(
  clientId: string,
  data: IntakeInput,
): Promise<ExactDuplicateMatch | null> {
  const service = createServiceRoleClient();
  const { data: existing } = await service
    .from("proposals")
    .select(["id", ...PROPOSAL_HASH_FIELDS].join(", "))
    .eq("client_id", clientId)
    .returns<(Pick<Tables<"proposals">, "id"> & HashableFields)[]>();

  const targetHash = computeProposalContentHash(data);
  const match = (existing ?? []).find((row) => computeProposalContentHash(row) === targetHash);
  return match ? { proposalId: match.id } : null;
}

export interface DuplicateCheckRow {
  rowNumber: number;
  email: string; // normalized
  data: IntakeInput;
}

export type ExactDuplicateFlag =
  | { type: "existing_proposal"; proposalId: string }
  | { type: "csv_row"; rowNumber: number };

/**
 * Bulk CSV hard-block check — catches both (a) a row matching an already-
 * existing proposal for a client that exists in the DB, and (b) two rows
 * within the same CSV sharing an email and identical content, before
 * either client has even been created yet. One batched query, not N+1.
 */
export async function flagExactDuplicates(rows: DuplicateCheckRow[]): Promise<Map<number, ExactDuplicateFlag>> {
  const flags = new Map<number, ExactDuplicateFlag>();
  const emails = [...new Set(rows.map((r) => r.email).filter(Boolean))];

  const clientsByEmail = await findClientsByEmailsBatch(emails);
  const clientIds = [...clientsByEmail.values()].map((c) => c.id);

  const existingHashesByClientId = new Map<string, { hash: string; proposalId: string }[]>();
  if (clientIds.length > 0) {
    const service = createServiceRoleClient();
    const { data: existingProposals } = await service
      .from("proposals")
      .select(["id", "client_id", ...PROPOSAL_HASH_FIELDS].join(", "))
      .in("client_id", clientIds)
      .returns<(Pick<Tables<"proposals">, "id" | "client_id"> & HashableFields)[]>();

    for (const row of existingProposals ?? []) {
      const list = existingHashesByClientId.get(row.client_id) ?? [];
      list.push({ hash: computeProposalContentHash(row), proposalId: row.id });
      existingHashesByClientId.set(row.client_id, list);
    }
  }

  const seenInBatch = new Map<string, number>(); // `${email}::${hash}` -> first rowNumber

  for (const row of rows) {
    const hash = computeProposalContentHash(row.data);
    const client = clientsByEmail.get(row.email);

    if (client) {
      const match = existingHashesByClientId.get(client.id)?.find((h) => h.hash === hash);
      if (match) {
        flags.set(row.rowNumber, { type: "existing_proposal", proposalId: match.proposalId });
        continue;
      }
    }

    const key = `${row.email}::${hash}`;
    const firstRow = seenInBatch.get(key);
    if (firstRow !== undefined) {
      flags.set(row.rowNumber, { type: "csv_row", rowNumber: firstRow });
    } else {
      seenInBatch.set(key, row.rowNumber);
    }
  }

  return flags;
}
