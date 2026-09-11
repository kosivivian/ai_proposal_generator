import { createServiceRoleClient } from "@/lib/supabase/service";
import { getResend } from "@/lib/email/client";
import type { ErrorStep } from "@/lib/types/database";

interface NotifyAdminsInput {
  proposalId: string;
  step: ErrorStep;
  message: string;
}

/**
 * Best-effort admin alert for the first unresolved occurrence of a given
 * failure (see withExternalCall.ts for the throttling check). Must never
 * throw — a notification failure is logged to the console only, never
 * re-inserted into error_log (that would loop: a failed notification about
 * a failure would itself become a failure to notify about).
 */
export async function notifyAdminsOfError({ proposalId, step, message }: NotifyAdminsInput): Promise<void> {
  try {
    const service = createServiceRoleClient();

    const [{ data: admins }, { data: proposal }] = await Promise.all([
      service.from("profiles").select("email").eq("role", "admin"),
      service.from("proposals").select("client_id").eq("id", proposalId).single(),
    ]);

    if (!admins || admins.length === 0) return; // no one to notify

    const { data: client } = proposal
      ? await service.from("clients").select("client_name, company_name").eq("id", proposal.client_id).single()
      : { data: null };

    const clientLabel = client ? client.company_name || client.client_name : proposalId;
    const proposalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/proposals/${proposalId}`;

    await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: admins.map((a) => a.email),
      subject: `[Proposal error] ${step.replace(/_/g, " ")} failed for ${clientLabel}`,
      html: `
        <p>A workflow step failed and needs attention.</p>
        <p><strong>Client:</strong> ${clientLabel}</p>
        <p><strong>Step:</strong> ${step.replace(/_/g, " ")}</p>
        <p><strong>Message:</strong> ${message}</p>
        <p><a href="${proposalUrl}">View proposal</a></p>
      `,
    });
  } catch (err) {
    console.error("[notifyAdminsOfError] failed to send admin notification:", err);
  }
}
