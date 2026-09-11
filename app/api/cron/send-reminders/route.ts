import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getResend } from "@/lib/email/client";
import { withExternalCall } from "@/lib/errors/withExternalCall";
import { buildReminderEmailHtml, buildReminderEmailSubject } from "@/lib/email/template";
import { getClientsByIds } from "@/lib/clients/resolve";

export const runtime = "nodejs";
export const maxDuration = 120;

const DOCUMENTS_BUCKET = "proposal-documents";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30;
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Vercel Cron hits this on a schedule (see vercel.json) via GET — it will
 * NOT fire on its own in local dev; test it by calling this route directly
 * with the secret (GET or POST both work here, for convenience). Not
 * filtered by `state`: the workflow state machine stays exactly as-is
 * (sent -> logged stays terminal); engagement tracking is an independent
 * layer on top via email_opened_at/email_clicked_at.
 */
export async function GET(req: Request) {
  return handleReminderSweep(req);
}

export async function POST(req: Request) {
  return handleReminderSweep(req);
}

async function handleReminderSweep(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceRoleClient();
  const cutoff = new Date(Date.now() - TWO_DAYS_MS).toISOString();

  const { data: candidates, error } = await service
    .from("proposals")
    .select("*")
    .not("email_sent_at", "is", null)
    .lte("email_sent_at", cutoff)
    .is("email_opened_at", null)
    .is("email_clicked_at", null)
    .is("reminder_sent_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const clientsById = await getClientsByIds(service, (candidates ?? []).map((p) => p.client_id));

  const results = await Promise.all(
    (candidates ?? []).map(async (proposal) => {
      const client = clientsById.get(proposal.client_id);
      if (!client || !proposal.document_url) {
        return { proposalId: proposal.id, ok: false, error: "Missing client or document" };
      }

      const result = await withExternalCall({ proposalId: proposal.id, step: "email_delivery" }, async () => {
        const { data: generatorProfile } = await service
          .from("profiles")
          .select("full_name")
          .eq("id", proposal.generated_by ?? proposal.created_by)
          .single();
        const preparedByName = generatorProfile?.full_name ?? "The Team";

        const { data: signed, error: signError } = await service.storage
          .from(DOCUMENTS_BUCKET)
          .createSignedUrl(proposal.document_url!, SIGNED_URL_TTL_SECONDS);
        if (signError || !signed) throw new Error(`Could not create document link: ${signError?.message}`);

        const { error: sendError } = await getResend().emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: client.client_contact_email,
          subject: buildReminderEmailSubject(client),
          html: buildReminderEmailHtml(client, signed.signedUrl, preparedByName),
        });
        if (sendError) throw new Error(sendError.message);
      });

      if (result.ok) {
        await service.from("proposals").update({ reminder_sent_at: new Date().toISOString() }).eq("id", proposal.id);
      }
      return { proposalId: proposal.id, ok: result.ok, error: result.ok ? undefined : result.error };
    }),
  );

  return NextResponse.json({ checked: candidates?.length ?? 0, results });
}
