import { z } from "zod";

/**
 * Proposal-specific intake — client identity lives separately now
 * (lib/clients/schema.ts). Shared by the single-proposal form and the bulk
 * CSV import path (preflight AND confirm, per the build plan's note that a
 * tampered confirm payload must be re-validated server-side).
 */
export const intakeSchema = z.object({
  date_of_call: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), {
      message: "Must be a valid date",
    })
    .refine((v) => v === "" || v <= new Date().toISOString().slice(0, 10), {
      message: "Date of call can't be in the future",
    }),
  client_needs_summary: z.string().trim().optional().default(""),
  project_title: z.string().trim().optional().default(""),
  project_scope: z.string().trim().optional().default(""),
  budget_range: z.string().trim().optional().default(""),
  timeline: z.string().trim().optional().default(""),
  goals_and_objectives: z.string().trim().optional().default(""),
  recommended_services: z.string().trim().optional().default(""),
  additional_notes: z.string().trim().optional().default(""),
});

export type IntakeInput = z.infer<typeof intakeSchema>;

/** Normalizes empty strings to null to match nullable DB columns. */
export function toProposalInsertFields(intake: IntakeInput) {
  return {
    date_of_call: intake.date_of_call || null,
    client_needs_summary: intake.client_needs_summary || null,
    project_title: intake.project_title || null,
    project_scope: intake.project_scope || null,
    budget_range: intake.budget_range || null,
    timeline: intake.timeline || null,
    goals_and_objectives: intake.goals_and_objectives || null,
    recommended_services: intake.recommended_services || null,
    additional_notes: intake.additional_notes || null,
  };
}
