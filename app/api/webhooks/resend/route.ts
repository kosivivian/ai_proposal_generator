import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

interface ResendWebhookPayload {
  type: string;
  data: { email_id?: string };
}

/**
 * Resend signs webhook deliveries with Svix — verify against the raw body
 * (not the pre-parsed JSON) before trusting anything in it. No user
 * session exists here; the signature is what secures this route, not auth
 * (this path is already excluded from proxy.ts's auth-redirect matcher,
 * same as every other /api/** route).
 */
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });

  const rawBody = await req.text();
  const svixHeaders = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let payload: ResendWebhookPayload;
  try {
    payload = new Webhook(secret).verify(rawBody, svixHeaders) as unknown as ResendWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const emailId = payload.data?.email_id;
  if (!emailId) return NextResponse.json({ ok: true }); // nothing to correlate against

  const service = createServiceRoleClient();

  if (payload.type === "email.opened") {
    // First-open only: `.is()` guards against a later open overwriting the
    // original timestamp.
    await service
      .from("proposals")
      .update({ email_opened_at: new Date().toISOString() })
      .eq("email_provider_id", emailId)
      .is("email_opened_at", null);
  } else if (payload.type === "email.clicked") {
    await service
      .from("proposals")
      .update({ email_clicked_at: new Date().toISOString() })
      .eq("email_provider_id", emailId)
      .is("email_clicked_at", null);
  }

  return NextResponse.json({ ok: true });
}
