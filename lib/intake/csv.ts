import Papa from "papaparse";
import { intakeSchema, type IntakeInput } from "@/lib/intake/schema";
import { computeMissingFields } from "@/lib/intake/requiredFields";

export interface ValidRow {
  rowNumber: number;
  data: IntakeInput;
  missing_fields: string[];
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
 * Validates parsed CSV rows against the same intake schema used by the
 * single-form path (PRD: "Required-field validation happens at this
 * structural level — do not let a row silently become a draft proposal with
 * required fields blank"). Shared by both preflight (first pass) and
 * confirm (re-validation of a possibly-tampered round-tripped payload).
 */
export function validateRows(rows: Record<string, unknown>[]): PreflightResult {
  const validRows: ValidRow[] = [];
  const invalidRows: InvalidRow[] = [];

  rows.forEach((raw, index) => {
    const rowNumber = index + 2; // +1 for header row, +1 for 1-indexing
    const parsed = intakeSchema.safeParse(raw);
    if (!parsed.success) {
      invalidRows.push({
        rowNumber,
        raw,
        reasons: parsed.error.issues.map((i) => `${i.path.join(".") || "row"}: ${i.message}`),
      });
      return;
    }
    validRows.push({
      rowNumber,
      data: parsed.data,
      missing_fields: computeMissingFields(parsed.data),
    });
  });

  return { validRows, invalidRows };
}
