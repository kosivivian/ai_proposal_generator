import type { Tables } from "@/lib/types/database";
import type { SectionKey } from "@/lib/generation/sections";

type ProposalRow = Tables<"proposals">;
type ClientRow = Tables<"clients">;
type SectionRow = Pick<Tables<"proposal_sections">, "section_key" | "order_index" | "content">;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function paragraphs(content: string): string {
  return content
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" });

/**
 * Final document layout — reconciles the PRD's 9 proposal_sections keys
 * (explicit ground truth) with the reference template's simpler visual
 * grouping (Proposed Solution containing Recommended Approach + Scope).
 */
export function renderProposalHtml(
  proposal: ProposalRow,
  client: ClientRow,
  sections: SectionRow[],
  preparedByName: string,
): string {
  const byKey = new Map(sections.map((s) => [s.section_key, s.content]));
  const section = (key: SectionKey) => paragraphs(byKey.get(key) ?? "");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; margin: 0; padding: 56px; line-height: 1.55; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  .meta { color: #555; font-size: 13px; margin-bottom: 40px; }
  .meta div { margin-bottom: 2px; }
  h2 { font-size: 18px; border-bottom: 1px solid #ccc; padding-bottom: 6px; margin-top: 36px; }
  h3 { font-size: 15px; margin-top: 20px; margin-bottom: 6px; color: #333; }
  p { font-size: 13px; margin: 0 0 12px; }
  .footer { margin-top: 48px; font-size: 13px; }
</style>
</head>
<body>
  <h1>Proposal for ${escapeHtml(client.company_name || client.client_name)}</h1>
  <div class="meta">
    ${proposal.project_title ? `<div>${escapeHtml(proposal.project_title)}</div>` : ""}
    <div>Prepared by ${escapeHtml(preparedByName)}</div>
    <div>${DATE_FORMATTER.format(new Date(proposal.generated_at ?? proposal.created_at))}</div>
  </div>

  <h2>1. Introduction</h2>
  ${section("introduction")}

  <h2>2. Executive Summary</h2>
  ${section("executive_summary")}

  <h2>3. Understanding Your Needs</h2>
  ${section("client_needs_summary")}

  <h2>4. Proposed Solution</h2>
  <h3>Recommended Approach</h3>
  ${section("recommended_approach")}
  <h3>Project Scope</h3>
  ${section("scope")}

  <h2>5. Deliverables</h2>
  ${section("deliverables")}

  <h2>6. Timeline</h2>
  ${section("timeline")}

  <h2>7. Pricing</h2>
  ${section("pricing")}

  <h2>8. Next Steps</h2>
  ${section("next_steps")}

  <div class="footer">
    <p>Looking forward to working together.</p>
    <p>Warm regards,<br/>${escapeHtml(preparedByName)}</p>
  </div>
</body>
</html>`;
}
