import { getResend } from "@/lib/email/client";
import { escapeHtml } from "@/lib/email/template";
import { BRAND_NAME, brandHeaderEmailHtml } from "@/lib/branding";

/**
 * Sent when an admin invites a new user (accounts are no longer
 * self-service — see app/(dashboard)/admin/users/actions.ts). Best-effort:
 * the caller decides how to handle a send failure (the account still
 * exists either way, so this must never roll that back).
 */
export async function sendWelcomeEmail(params: {
  toEmail: string;
  fullName: string;
  tempPassword: string;
}): Promise<{ id: string } | { error: string }> {
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login`;

  const { data, error } = await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.toEmail,
    subject: `Your ${BRAND_NAME} account`,
    html: `<!doctype html>
<html>
<body style="font-family: Georgia, serif; color: #1a1a1a; line-height: 1.6;">
  ${brandHeaderEmailHtml()}
  <p>Hi ${escapeHtml(params.fullName)},</p>
  <p>An account has been created for you on ${BRAND_NAME}'s proposal workspace.</p>
  <p>
    <strong>Email:</strong> ${escapeHtml(params.toEmail)}<br/>
    <strong>Temporary password:</strong> ${escapeHtml(params.tempPassword)}
  </p>
  <p>Sign in here: <a href="${loginUrl}">${loginUrl}</a></p>
  <p>Please change this temporary password as soon as you sign in (Account → Change password).</p>
</body>
</html>`,
  });

  if (error || !data) return { error: error?.message ?? "Resend returned no data" };
  return { id: data.id };
}
