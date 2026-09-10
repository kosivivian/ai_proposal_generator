import type { Tables } from "@/lib/types/database";

type ProposalRow = Tables<"proposals">;

/**
 * Content/structure adapted from the reference assets/client-email-template.md
 * (subject "Proposal for {{company_name}}", body with a {{proposal_link}}
 * merge field), remapped onto schema columns per the naming-source-of-truth
 * decision: company_name <- proposal.client_name, client_name (greeting) <-
 * proposal.client_contact_name (falls back to client_name).
 */
export function buildEmailSubject(proposal: ProposalRow): string {
  return `Proposal for ${proposal.client_name}`;
}

export function buildEmailHtml(proposal: ProposalRow, proposalLink: string, preparedByName: string): string {
  const greetingName = proposal.client_contact_name || proposal.client_name;
  return `<!doctype html>
<html>
<body style="font-family: Georgia, serif; color: #1a1a1a; line-height: 1.6;">
  <p>Hi ${escapeHtml(greetingName)},</p>
  <p>Thanks again for taking the time to speak with us. Based on our conversation, we have put together a customized proposal for your review.</p>
  <p>You can view the proposal here: <a href="${proposalLink}">${proposalLink}</a></p>
  <p>This document outlines the project scope, timeline, pricing details, and recommended approach.</p>
  <p>If you have any questions or would like to make adjustments, feel free to reach out. We are happy to iterate with you.</p>
  <p>Looking forward to hearing your thoughts.</p>
  <p>Best regards,<br/>${escapeHtml(preparedByName)}</p>
</body>
</html>`;
}

function escapeHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
