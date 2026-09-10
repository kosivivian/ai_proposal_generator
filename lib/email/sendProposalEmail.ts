import { Resend } from "resend";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { buildEmailHtml, buildEmailSubject } from "@/lib/email/template";
import type { Json, Tables } from "@/lib/types/database";

type ProposalRow = Tables<"proposals">;

const MAX_ATTACHMENT_BYTES = 8_000_000;

let resendClient: Resend | null = null;
function getResend(): Resend {
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

/**
 * Sends the client-facing proposal email and records the attempt in
 * delivery_log (no client insert policy exists on that table, so the
 * service-role client is used throughout — this also means it's safe to
 * call from contexts with no live user session).
 */
export async function sendProposalEmail(
  proposal: ProposalRow,
  proposalLink: string,
  preparedByName: string,
  pdfBuffer: Buffer,
): Promise<{ id: string }> {
  if (!proposal.client_contact_email) {
    throw new Error("No client_contact_email on file for this proposal");
  }

  const service = createServiceRoleClient();
  const { data: logRow, error: logError } = await service
    .from("delivery_log")
    .insert({
      proposal_id: proposal.id,
      recipient_email: proposal.client_contact_email,
      status: "pending",
    })
    .select()
    .single();
  if (logError || !logRow) throw new Error(`Failed to create delivery_log row: ${logError?.message}`);

  try {
    const { data, error } = await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: proposal.client_contact_email,
      subject: buildEmailSubject(proposal),
      html: buildEmailHtml(proposal, proposalLink, preparedByName),
      attachments:
        pdfBuffer.byteLength < MAX_ATTACHMENT_BYTES
          ? [{ filename: "proposal.pdf", content: pdfBuffer }]
          : undefined,
    });

    if (error || !data) {
      await service
        .from("delivery_log")
        .update({ status: "failed", provider_response: error as unknown as Json })
        .eq("id", logRow.id);
      throw new Error(error?.message ?? "Resend returned no data");
    }

    await service
      .from("delivery_log")
      .update({ status: "sent", provider_id: data.id, provider_response: data as unknown as Json })
      .eq("id", logRow.id);

    return { id: data.id };
  } catch (err) {
    await service.from("delivery_log").update({ status: "failed" }).eq("id", logRow.id);
    throw err;
  }
}
