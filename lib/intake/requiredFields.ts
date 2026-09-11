import type { IntakeInput } from "@/lib/intake/schema";

/**
 * "Important but not blocking" fields — Layer 1 (structural) gap detection
 * from PRD §6, scoped to proposal-specific fields only now. Client identity
 * fields (company_name/client_contact_email) moved to `clients` and are
 * mandatory-and-resolved at the client-resolution step, not an optional gap.
 */
const IMPORTANT_FIELDS: (keyof IntakeInput)[] = [
  "client_needs_summary",
  "project_title",
  "project_scope",
  "budget_range",
  "timeline",
  "goals_and_objectives",
  "recommended_services",
];

/** Reused verbatim by both the single-form and CSV bulk-import paths. */
export function computeMissingFields(intake: Partial<IntakeInput>): string[] {
  return IMPORTANT_FIELDS.filter((field) => !intake[field]?.toString().trim());
}
