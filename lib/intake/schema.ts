import { z } from "zod";

/**
 * Shared intake validation — used by both the single-proposal form and the
 * bulk CSV import path (preflight AND confirm, per the build plan's note
 * that a tampered confirm payload must be re-validated server-side).
 *
 * Field names/keys match `proposals` table columns exactly — the schema is
 * the naming source of truth, not the reference asset field names.
 */
export const intakeSchema = z.object({
  client_name: z.string().trim().min(1, "Client name is required"),
  client_contact_name: z.string().trim().optional().default(""),
  client_contact_email: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => v === "" || z.string().email().safeParse(v).success, {
      message: "Must be a valid email",
    }),
  project_title: z.string().trim().optional().default(""),
  project_scope: z.string().trim().optional().default(""),
  budget_range: z.string().trim().optional().default(""),
  timeline: z.string().trim().optional().default(""),
  industry: z.string().trim().optional().default(""),
  additional_notes: z.string().trim().optional().default(""),
});

export type IntakeInput = z.infer<typeof intakeSchema>;

/** Normalizes empty strings to null to match nullable DB columns. */
export function toProposalInsertFields(intake: IntakeInput) {
  return {
    client_name: intake.client_name,
    client_contact_name: intake.client_contact_name || null,
    client_contact_email: intake.client_contact_email || null,
    project_title: intake.project_title || null,
    project_scope: intake.project_scope || null,
    budget_range: intake.budget_range || null,
    timeline: intake.timeline || null,
    industry: intake.industry || null,
    additional_notes: intake.additional_notes || null,
  };
}
