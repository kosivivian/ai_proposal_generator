import { Resend } from "resend";

let resendClient: Resend | null = null;

/** Shared Resend client — used for both client-facing proposal emails and internal admin notifications. */
export function getResend(): Resend {
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}
