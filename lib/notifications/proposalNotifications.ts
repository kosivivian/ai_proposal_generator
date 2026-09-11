import { createServiceRoleClient } from "@/lib/supabase/service";
import { getResend } from "@/lib/email/client";
import { escapeHtml } from "@/lib/email/template";

/**
 * Best-effort workflow-transition emails — approvers get notified when
 * something needs their review, reps get notified of the outcome. Must
 * never throw or block the state transition that triggered it; a failed
 * notification is logged to the console only, same posture as
 * notifyAdminsOfError.
 */

async function getClientLabel(service: ReturnType<typeof createServiceRoleClient>, clientId: string): Promise<string> {
  const { data } = await service.from("clients").select("client_name, company_name").eq("id", clientId).single();
  return data ? data.company_name || data.client_name : "a client";
}

export async function notifyApproversOfPendingProposal(proposalId: string): Promise<void> {
  try {
    const service = createServiceRoleClient();

    const [{ data: approvers }, { data: proposal }] = await Promise.all([
      service.from("profiles").select("email").eq("role", "approver"),
      service.from("proposals").select("client_id").eq("id", proposalId).single(),
    ]);
    if (!approvers || approvers.length === 0 || !proposal) return;

    const clientLabel = await getClientLabel(service, proposal.client_id);
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/approvals/${proposalId}`;

    await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: approvers.map((a) => a.email),
      subject: `New proposal awaiting approval: ${clientLabel}`,
      html: `
        <p>A proposal for <strong>${escapeHtml(clientLabel)}</strong> has been submitted and needs your review.</p>
        <p><a href="${url}">Review it here</a></p>
      `,
    });
  } catch (err) {
    console.error("[notifyApproversOfPendingProposal] failed to send notification:", err);
  }
}

export async function notifyRepOfDecision(
  proposalId: string,
  decision: "approved" | "rejected",
  rejectionNotes?: string,
): Promise<void> {
  try {
    const service = createServiceRoleClient();

    const { data: proposal } = await service
      .from("proposals")
      .select("client_id, created_by")
      .eq("id", proposalId)
      .single();
    if (!proposal) return;

    const [{ data: rep }, clientLabel] = await Promise.all([
      service.from("profiles").select("email").eq("id", proposal.created_by).single(),
      getClientLabel(service, proposal.client_id),
    ]);
    if (!rep?.email) return;

    const isApproved = decision === "approved";
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/proposals/${proposalId}${isApproved ? "" : "/review"}`;
    const subject = isApproved
      ? `Approved: proposal for ${clientLabel}`
      : `Sent back for revision: proposal for ${clientLabel}`;
    const html = isApproved
      ? `
        <p>Your proposal for <strong>${escapeHtml(clientLabel)}</strong> has been approved.</p>
        <p>You can now send it to the client.</p>
        <p><a href="${url}">View proposal</a></p>
      `
      : `
        <p>Your proposal for <strong>${escapeHtml(clientLabel)}</strong> was sent back for revision.</p>
        ${rejectionNotes ? `<p><strong>Notes:</strong> ${escapeHtml(rejectionNotes)}</p>` : ""}
        <p><a href="${url}">Go to the review screen</a></p>
      `;

    await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: rep.email,
      subject,
      html,
    });
  } catch (err) {
    console.error("[notifyRepOfDecision] failed to send notification:", err);
  }
}
