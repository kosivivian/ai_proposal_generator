export const BRAND_NAME = "Koya Talent";
export const BRAND_TAGLINE = "AI-assisted client proposal drafting, review, and delivery";

/**
 * Table-based markup (not flex/inline-block) because this goes straight
 * into email HTML sent via Resend — table layout is the one thing every
 * mail client renders consistently.
 */
export function brandHeaderEmailHtml(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
  <tr>
    <td style="width:34px;height:34px;background:#111111;border-radius:8px;text-align:center;vertical-align:middle;">
      <span style="display:inline-block;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-weight:bold;font-size:17px;line-height:34px;">K</span>
    </td>
    <td style="padding-left:11px;font-family:Georgia,'Times New Roman',serif;font-weight:bold;font-size:17px;color:#111111;vertical-align:middle;">${BRAND_NAME}</td>
  </tr>
</table>`;
}

/** Same mark, styled for the full-page proposal document (Puppeteer/preview) rather than an email client. */
export function brandHeaderDocumentHtml(): string {
  return `<div style="display:flex;align-items:center;gap:11px;margin-bottom:28px;">
  <div style="width:34px;height:34px;background:#111111;border-radius:8px;display:flex;align-items:center;justify-content:center;">
    <span style="color:#ffffff;font-weight:bold;font-size:17px;">K</span>
  </div>
  <span style="font-weight:bold;font-size:17px;color:#111111;">${BRAND_NAME}</span>
</div>`;
}
