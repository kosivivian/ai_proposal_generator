import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, GateError } from "@/lib/proposals/gates";
import { withExternalCall } from "@/lib/errors/withExternalCall";
import { renderProposalHtml } from "@/lib/pdf/renderProposalHtml";
import { exportPdf } from "@/lib/pdf/exportPdf";
import { sendProposalEmail } from "@/lib/email/sendProposalEmail";

export const runtime = "nodejs";
export const maxDuration = 120;

const DOCUMENTS_BUCKET = "proposal-documents";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * The second hard gate (alongside submit-for-approval): only a proposal in
 * `approved` state can have export/email fire, checked server-side so a
 * direct API call can't bypass it. A prior partial failure (state=failed
 * with document_url already set from a successful export) is allowed to
 * retry just the remaining step — export and email are independent,
 * separately-tracked steps per PRD §9.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  try {
    await requireUser(supabase);

    const { data: proposal } = await supabase.from("proposals").select("*").eq("id", id).single();
    if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });

    const isFreshSend = proposal.state === "approved";
    const isRetry = proposal.state === "failed" && proposal.approved_at !== null;
    if (!isFreshSend && !isRetry) {
      return NextResponse.json({ error: "Proposal is not approved" }, { status: 409 });
    }

    const { data: generatorProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", proposal.generated_by ?? proposal.created_by)
      .single();
    const preparedByName = generatorProfile?.full_name ?? "The Team";

    let documentPath = proposal.document_url;

    // Step 1 — document export (skipped on retry if it already succeeded).
    if (!documentPath) {
      const { data: sections } = await supabase
        .from("proposal_sections")
        .select("section_key, order_index, content")
        .eq("proposal_id", id)
        .order("order_index");

      const exportResult = await withExternalCall(
        { proposalId: id, step: "document_export", onFailureState: "failed" },
        async () => {
          const html = renderProposalHtml(proposal, sections ?? [], preparedByName);
          const pdf = await exportPdf(html);
          const path = `${id}/proposal.pdf`;
          const { error: uploadError } = await supabase.storage
            .from(DOCUMENTS_BUCKET)
            .upload(path, pdf, { contentType: "application/pdf", upsert: true });
          if (uploadError) throw new Error(`Document upload failed: ${uploadError.message}`);
          return { path, pdf };
        },
      );

      if (!exportResult.ok) return NextResponse.json({ error: exportResult.error, step: "document_export" }, { status: 502 });

      documentPath = exportResult.data.path;
      await supabase
        .from("proposals")
        .update({ document_url: documentPath, document_generated_at: new Date().toISOString() })
        .eq("id", id);
    }

    // Step 2 — email delivery, tracked as an independent failure state.
    if (!proposal.client_contact_email) {
      const { createServiceRoleClient } = await import("@/lib/supabase/service");
      await createServiceRoleClient()
        .from("error_log")
        .insert({ proposal_id: id, step: "email_delivery", message: "No client_contact_email on file" });
      await supabase.from("proposals").update({ state: "failed" }).eq("id", id);
      return NextResponse.json({ error: "No client contact email on file", step: "email_delivery" }, { status: 400 });
    }

    const emailResult = await withExternalCall(
      { proposalId: id, step: "email_delivery", onFailureState: "failed" },
      async () => {
        const { data: signed, error: signError } = await supabase.storage
          .from(DOCUMENTS_BUCKET)
          .createSignedUrl(documentPath!, SIGNED_URL_TTL_SECONDS);
        if (signError || !signed) throw new Error(`Could not create document link: ${signError?.message}`);

        const { data: pdfFile, error: downloadError } = await supabase.storage
          .from(DOCUMENTS_BUCKET)
          .download(documentPath!);
        if (downloadError || !pdfFile) throw new Error(`Could not read exported document: ${downloadError?.message}`);
        const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());

        return sendProposalEmail(proposal, signed.signedUrl, preparedByName, pdfBuffer);
      },
    );

    if (!emailResult.ok) return NextResponse.json({ error: emailResult.error, step: "email_delivery" }, { status: 502 });

    await supabase
      .from("proposals")
      .update({
        email_sent_at: new Date().toISOString(),
        email_provider_id: emailResult.data.id,
        state: "sent",
      })
      .eq("id", id);

    // v1: provider-accepted is treated as confirmed delivery — close the
    // loop immediately. A Resend delivery/bounce webhook is a documented
    // stretch upgrade for stricter sent -> logged confirmation.
    await supabase.from("proposals").update({ state: "logged" }).eq("id", id).eq("state", "sent");

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GateError) return NextResponse.json({ error: err.message }, { status: err.status });
    const message = err instanceof Error ? err.message : "Send to client failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
