import { SECTION_KEYS, SECTION_LABELS, type SectionKey } from "@/lib/generation/sections";
import type { Tables } from "@/lib/types/database";

type ProposalRow = Tables<"proposals">;
type MaterialSummary = Pick<Tables<"proposal_materials">, "material_type" | "file_name" | "processed_content">;

export const GENERATION_SYSTEM_PROMPT = `You are drafting a first-draft client proposal for a sales team.

Output format (strict):
- Wrap each section's content in an XML tag matching its section key exactly, e.g. <pricing>...</pricing>.
- Produce all of these sections, in this order: ${SECTION_KEYS.join(", ")}.
- Write plain prose inside each tag (no markdown headers, no nested XML) — the content is inserted directly into a formatted document.
- Do not add any text outside the tags.

Content rules:
- Base every claim strictly on the structured intake fields and the supporting materials provided below. Never invent facts, numbers, dates, or commitments that aren't supported by the input.
- If you cannot support part of a section from the given inputs, do not guess — insert an inline marker instead: [NEEDS INPUT: <short description of what's missing>]. Keep the rest of that section's supported content intact around the marker.
- Material tagged "REFERENCE MATERIAL — OLD PROPOSAL" is background context only, not authoritative content for this new proposal — do not copy pricing, scope, or commitments from it directly.
- Be concise and client-ready; this draft will be reviewed and edited by a human before it ever reaches a client.`;

function formatIntake(proposal: ProposalRow): string {
  const lines = [
    `Client name: ${proposal.client_name}`,
    proposal.client_contact_name && `Client contact: ${proposal.client_contact_name}`,
    proposal.project_title && `Project title: ${proposal.project_title}`,
    proposal.project_scope && `Project scope (as given by the rep): ${proposal.project_scope}`,
    proposal.budget_range && `Budget range: ${proposal.budget_range}`,
    proposal.timeline && `Desired timeline: ${proposal.timeline}`,
    proposal.industry && `Industry: ${proposal.industry}`,
    proposal.additional_notes && `Additional notes: ${proposal.additional_notes}`,
  ].filter(Boolean);

  if (proposal.missing_fields.length > 0) {
    lines.push(
      `Note: the following intake fields were left blank by the rep — expect to need [NEEDS INPUT: ...] markers related to them: ${proposal.missing_fields.join(", ")}`,
    );
  }

  return lines.join("\n");
}

function formatMaterials(materials: MaterialSummary[]): string {
  if (materials.length === 0) return "(No supporting materials were attached.)";

  return materials
    .map((m) => {
      const label =
        m.material_type === "old_proposal"
          ? "REFERENCE MATERIAL — OLD PROPOSAL, NOT AUTHORITATIVE FOR THIS DRAFT"
          : m.material_type === "call_recording"
            ? "CALL TRANSCRIPT"
            : m.material_type === "intake_form"
              ? "INTAKE FORM"
              : "SUPPORTING DOCUMENT";
      return `--- ${label}: ${m.file_name} ---\n${m.processed_content ?? "(no extracted content)"}`;
    })
    .join("\n\n");
}

export function buildGenerationPrompt(proposal: ProposalRow, materials: MaterialSummary[]): string {
  return [
    "## Structured intake",
    formatIntake(proposal),
    "",
    "## Supporting materials",
    formatMaterials(materials),
  ].join("\n");
}

export function buildRegenerationSystemPrompt(sectionKey: SectionKey): string {
  return `You are revising a single section ("${SECTION_LABELS[sectionKey]}") of a client proposal.

Output format (strict): wrap your revised content in <${sectionKey}>...</${sectionKey}> and output nothing else.

Content rules:
- Stay consistent in tone and facts with the other current sections provided for context.
- Base every claim strictly on the structured intake fields, supporting materials, and current section content provided below. Never invent facts.
- If you cannot support part of the section, insert an inline marker: [NEEDS INPUT: <short description of what's missing>].
- Material tagged "REFERENCE MATERIAL — OLD PROPOSAL" is background context only, not authoritative.`;
}

export function buildRegenerationPrompt(
  sectionKey: SectionKey,
  proposal: ProposalRow,
  materials: MaterialSummary[],
  otherSections: { section_key: string; content: string }[],
  repNote?: string,
): string {
  const otherSectionsText = otherSections
    .filter((s) => s.section_key !== sectionKey)
    .map((s) => `--- ${SECTION_LABELS[s.section_key as SectionKey] ?? s.section_key} ---\n${s.content}`)
    .join("\n\n");

  return [
    "## Structured intake",
    formatIntake(proposal),
    "",
    "## Supporting materials",
    formatMaterials(materials),
    "",
    "## Other current sections (for tone/fact consistency — do not repeat verbatim)",
    otherSectionsText || "(none)",
    repNote ? `\n## Rep's note for this revision\n${repNote}` : "",
  ].join("\n");
}
