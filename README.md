# Proposal Generator

AI-assisted client proposal drafting, review, internal approval, and delivery. See `AI_Proposal_App_PRD.md` for the full spec and `proposal_app_schema.sql` for the database schema.

## Setup

1. **Supabase project.** Run `proposal_app_schema.sql` in the Supabase SQL editor if you haven't already. Then create the two storage buckets if the SQL at the bottom of the schema didn't already run: `proposal-materials` and `proposal-documents` (both private).
2. **Environment variables.** Copy `.env.example` to `.env` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase project settings → API.
   - `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`) — proposal generation/regeneration.
   - `OPENAI_API_KEY` — Whisper transcription of call recordings.
   - `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — client email delivery. `RESEND_FROM_EMAIL` must be a verified sender/domain in your Resend account.
   - `RESEND_WEBHOOK_SECRET` — Resend dashboard → Webhooks → point an endpoint at `/api/webhooks/resend` (enable the `email.opened` and `email.clicked` events) → copy its signing secret here.
   - `CRON_SECRET` — any random string; also set it as an env var on the Vercel project itself. Vercel automatically sends it as `Authorization: Bearer <value>` when it triggers the cron job defined in `vercel.json`.
   - `NEXT_PUBLIC_APP_URL` — base URL of this app (`http://localhost:3000` locally).
3. **Install and run:**
   ```
   npm install
   npm run dev
   ```
4. **Create your first admin.** Accounts are no longer self-service — there's no signup form. Create your own account directly in the Supabase dashboard (Authentication → Users → Add user), which fires the same trigger the app's invite flow uses, then promote yourself once in the SQL editor:
   ```sql
   update profiles set role = 'admin' where email = 'you@example.com';
   ```
   From then on, every other account is created from `/admin/users` → "Invite a user" — it emails the new person a temporary password (which they should change at `/account` after signing in).

## Notes on the build

- The Supabase database types in `lib/types/database.ts` are hand-written to mirror `proposal_app_schema.sql` exactly (no `supabase gen types` access in the environment this was built in). If the schema changes, update this file to match.
- PDF export (`lib/pdf/exportPdf.ts`) uses `puppeteer-core` + `@sparticuz/chromium` for serverless-compatible Chromium. This is the highest infra-risk piece of the stack (cold-start size, memory ceiling on lower Vercel tiers) — if it proves unreliable in production, `@react-pdf/renderer` is a documented fallback that avoids the native-binary dependency entirely.
- See the six "load-bearing findings" documented across `lib/proposals/gates.ts`, the `approve`/`reject` routes, and `lib/zip/matchAndImport.ts` for places where the PRD and schema needed reconciling in app code rather than schema changes (e.g. RLS alone does not stop a sales rep from approving their own proposal — the explicit role check in the approve/reject routes is what actually enforces that).
- **The 2-day reminder cron will not fire on its own in local dev.** `vercel.json` schedules `/api/cron/send-reminders` to run daily, but Vercel Cron only actually triggers once this is deployed to Vercel with that config picked up (and Vercel's free/Hobby tier caps cron jobs at once per day — the schedule is already set to once daily for that reason). To test the logic locally, hit the route directly: `curl -X GET http://localhost:3000/api/cron/send-reminders -H "Authorization: Bearer $CRON_SECRET"`.
- Engagement tracking (`email_opened_at`/`email_clicked_at`) depends on Resend's open/click tracking being enabled for your sending domain, and on the recipient's mail client actually loading tracking pixels/rewriting links (some corporate mail filters strip both) — treat it as a helpful signal, not a guarantee.

## Testing the core flow end-to-end

1. Create a proposal (single form or bulk import).
2. Attach a text file and/or short audio clip on the materials screen; wait for processing to finish (or click "Continue without files").
3. Click "Generate proposal".
4. On the review screen, resolve any `[NEEDS INPUT: ...]` gaps (edit or regenerate), then "Submit for approval".
5. Sign in as (or promote yourself to) an `approver`/`admin` and approve or reject from `/approvals`.
6. Once approved, use "Send to client" on the proposal detail page to export the PDF and send the email.
