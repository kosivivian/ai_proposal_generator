import Papa from "papaparse";
import { intakeSchema, type IntakeInput } from "@/lib/intake/schema";
import { clientSchema, type ClientInput } from "@/lib/clients/schema";
import { computeMissingFields } from "@/lib/intake/requiredFields";
import type { ExactDuplicateFlag } from "@/lib/intake/duplicate";

export interface ValidRow {
  rowNumber: number;
  client: ClientInput;
  data: IntakeInput;
  missing_fields: string[];
  /** Populated by client-resolution in the preflight route — informational, not a warning. */
  clientStatus?: { existed: boolean; clientName: string; companyName: string | null };
  /** Populated by flagExactDuplicates() in the preflight route — excluded, no override. */
  exactDuplicate?: ExactDuplicateFlag;
}

export interface InvalidRow {
  rowNumber: number;
  raw: Record<string, unknown>;
  reasons: string[];
}

export interface PreflightResult {
  validRows: ValidRow[];
  invalidRows: InvalidRow[];
}

/** Parses a raw CSV string into header-keyed row objects. */
export function parseCsv(csvText: string): Record<string, unknown>[] {
  const result = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return result.data;
}

/**
 * Validates parsed CSV rows against the client schema (client_name,
 * company_name, client_contact_email) and the proposal-specific intake
 * schema, both re-used from the single-form path. Shared by both preflight
 * (first pass) and confirm (re-validation of a possibly-tampered
 * round-tripped payload).
 */
export function validateRows(rows: Record<string, unknown>[]): PreflightResult {
  const validRows: ValidRow[] = [];
  const invalidRows: InvalidRow[] = [];

  rows.forEach((raw, index) => {
    const rowNumber = index + 2; // +1 for header row, +1 for 1-indexing
    const client = clientSchema.safeParse(raw);
    const data = intakeSchema.safeParse(raw);

    if (!client.success || !data.success) {
      const reasons = [
        ...(client.success ? [] : client.error.issues.map((i) => `${i.path.join(".") || "row"}: ${i.message}`)),
        ...(data.success ? [] : data.error.issues.map((i) => `${i.path.join(".") || "row"}: ${i.message}`)),
      ];
      invalidRows.push({ rowNumber, raw, reasons });
      return;
    }

    validRows.push({
      rowNumber,
      client: client.data,
      data: data.data,
      missing_fields: computeMissingFields(data.data),
    });
  });

  return { validRows, invalidRows };
}
