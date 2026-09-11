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
 *
 * Everything below is wrapped in one try/catch and logs its own context on
 * failure — an earlier version let an unexpected shape crash uncaught deep
 * in a helper, producing an opaque 500 with no body and a minified stack
 * trace that couldn't be attributed to a specific line.
 */
export async function POST(req: Request) {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[resend webhook] RESEND_WEBHOOK_SECRET is not set");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    const rawBody = await req.text();
    const svixHeaders = {
      "svix-id": req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    };

    if (!svixHeaders["svix-id"] || !svixHeaders["svix-timestamp"] || !svixHeaders["svix-signature"]) {
      console.error("[resend webhook] missing svix-* headers on incoming request:", {
        headerKeys: [...req.headers.keys()],
      });
      return NextResponse.json({ error: "Missing signature headers" }, { status: 400 });
    }

    let payload: ResendWebhookPayload;
    try {
      // This version of the svix SDK's Webhook.verify() only validates and
      // throws on failure — it does NOT return the parsed payload (its own
      // type declaration says `undefined`). Parse the raw body ourselves
      // once verification confirms it's authentic.
      new Webhook(secret).verify(rawBody, svixHeaders);
      payload = JSON.parse(rawBody) as ResendWebhookPayload;
    } catch (verifyErr) {
      console.error("[resend webhook] signature verification or parsing failed:", verifyErr);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const emailId = payload?.data?.email_id;
    if (!emailId) {
      console.error("[resend webhook] no data.email_id in payload:", payload);
      return NextResponse.json({ ok: true }); // nothing to correlate against
    }

    const service = createServiceRoleClient();

    if (payload.type === "email.opened") {
      const { error } = await service
        .from("proposals")
        .update({ email_opened_at: new Date().toISOString() })
        .eq("email_provider_id", emailId)
        .is("email_opened_at", null);
      if (error) console.error("[resend webhook] failed to record email_opened_at:", error);
    } else if (payload.type === "email.clicked") {
      const { error } = await service
        .from("proposals")
        .update({ email_clicked_at: new Date().toISOString() })
        .eq("email_provider_id", emailId)
        .is("email_clicked_at", null);
      if (error) console.error("[resend webhook] failed to record email_clicked_at:", error);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[resend webhook] unhandled error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
