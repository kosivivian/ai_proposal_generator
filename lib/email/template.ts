import type { Tables } from "@/lib/types/database";

type ClientRow = Tables<"clients">;

/**
 * Content/structure adapted from the reference assets/client-email-template.md
 * (subject "Proposal for {{company_name}}", greeting "Hi {{client_name}}",
 * body with a {{proposal_link}} merge field) — these map onto the client's
 * own company_name/client_name columns (client identity lives in `clients`
 * now, not directly on `proposals`).
 */
export function buildEmailSubject(client: ClientRow): string {
  return `Proposal for ${client.company_name || client.client_name}`;
}

export function buildEmailHtml(client: ClientRow, proposalLink: string, preparedByName: string): string {
  return `<!doctype html>
<html>
<body style="font-family: Georgia, serif; color: #1a1a1a; line-height: 1.6;">
  <p>Hi ${escapeHtml(client.client_name)},</p>
  <p>Thanks again for taking the time to speak with us. Based on our conversation, we have put together a customized proposal for your review.</p>
  <p>You can view the proposal here: <a href="${proposalLink}">${proposalLink}</a></p>
  <p>This document outlines the project scope, timeline, pricing details, and recommended approach.</p>
  <p>If you have any questions or would like to make adjustments, feel free to reach out. We are happy to iterate with you.</p>
  <p>Looking forward to hearing your thoughts.</p>
  <p>Best regards,<br/>${escapeHtml(preparedByName)}</p>
</body>
</html>`;
}

export function buildReminderEmailSubject(client: ClientRow): string {
  return `Following up: proposal for ${client.company_name || client.client_name}`;
}

export function buildReminderEmailHtml(client: ClientRow, proposalLink: string, preparedByName: string): string {
  return `<!doctype html>
<html>
<body style="font-family: Georgia, serif; color: #1a1a1a; line-height: 1.6;">
  <p>Hi ${escapeHtml(client.client_name)},</p>
  <p>Just following up on the proposal we sent a couple of days ago, in case it got buried in your inbox.</p>
  <p>You can view it here: <a href="${proposalLink}">${proposalLink}</a></p>
  <p>Happy to answer any questions or make adjustments — let us know your thoughts whenever you get a chance.</p>
  <p>Best regards,<br/>${escapeHtml(preparedByName)}</p>
</body>
</html>`;
}

export function escapeHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
