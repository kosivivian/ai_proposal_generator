import type { IntakeInput } from "@/lib/intake/schema";

/**
 * "Important but not blocking" fields — Layer 1 (structural) gap detection
 * from PRD §6. `client_name` is excluded: it's DB NOT NULL and enforced at
 * form/CSV validation time, so it can never reach here missing.
 */
const IMPORTANT_FIELDS: (keyof IntakeInput)[] = [
  "client_contact_name",
  "client_contact_email",
  "project_title",
  "project_scope",
  "budget_range",
  "timeline",
];

/** Reused verbatim by both the single-form and CSV bulk-import paths. */
export function computeMissingFields(intake: Partial<IntakeInput>): string[] {
  return IMPORTANT_FIELDS.filter((field) => !intake[field]?.toString().trim());
}
