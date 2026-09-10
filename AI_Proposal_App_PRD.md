# AI Proposal Application — Product Requirements Document

**Status:** Ready for build
**Companion file:** `proposal_app_schema.sql` (full Supabase schema — run this before building any app logic)

---

## 1. Purpose

Sales reps currently write client proposals manually after discovery calls, pulling from notes, old proposals, and templates. This is slow and inconsistent. This application lets a rep submit structured intake data (plus supporting materials like call recordings and old proposals), generates a first-draft proposal using the Claude API, and takes that draft through human review, section-level revision, internal approval, and client delivery — with every step logged for auditability and debugging.

**Non-negotiable constraint:** no proposal reaches a client without an explicit internal approval step, enforced server-side.

---

## 2. Users & Roles

Three roles, stored on `profiles.role`:

- **sales_rep** — creates proposals (single or bulk), uploads materials, triggers generation, edits/regenerates sections, submits for approval.
- **approver** — reviews proposals in `pending_approval`, approves or rejects with notes. Can see all proposals, not just their own.
- **admin** — full visibility, same as approver plus user/role management.

A rep can only see and act on their own proposals. Approvers/admins can see everything (needed once a proposal enters `pending_approval`, since the creator may not be the approver).

---

## 3. Core Concept: Proposal State Machine

Every proposal is a row in `proposals` with a single `state` value. State transitions are the backbone of the whole app — every transition is auto-logged to `proposal_events` via a DB trigger (see schema), so the audit trail is never something the app code has to remember to write.

```
draft
  → materials_ready   (auto, once all attached files finish processing)
    → generating       (on explicit "Generate" click — never automatic)
      → generated
        → in_review     (rep edits / regenerates individual sections)
          → pending_approval  (rep submits internally)
            → approved → sent → logged   (terminal success path)
            → rejected → back to in_review (with approver's notes attached)
failed        (terminal, at any step — reason lives in error_log)
```

Key rule baked into this: **generation is always an explicit user action**, never auto-fired when materials finish processing. This avoids burning Claude API calls on rows that get abandoned, re-uploaded, or contain bad data. `materials_ready` just means the "Generate" button becomes clickable.

---

## 4. Entry Points

Two distinct flows — do not merge these into one UI, they solve different volume problems.

### 4.1 Single proposal form
For the "I just finished one call, let me do this now" case. Standard form matching the intake fields on `proposals` (see schema). On submit, creates one `draft` proposal.

### 4.2 Bulk import
For reps handling many leads per week (tested up to ~50/week). Flow:

1. Rep uploads a CSV/spreadsheet where each row = one client/proposal, columns matching the intake fields.
2. Backend parses row by row, creates one `proposals` row per line, all linked to a new `import_batches` row.
3. **Preflight check before committing anything to the review queue:** show a table of "N valid rows / N rows missing required fields," let the rep fix or skip bad rows in the sheet before proposals are finalized as `draft`.
4. Required-field validation happens at this structural level — do not let a row silently become a `draft` proposal with required fields blank.

### 4.3 Matching supporting materials to bulk-imported clients
This is the part that makes bulk import actually useful, not just faster data entry. Two complementary mechanisms:

- **Folder/zip upload (primary path):** rep uploads a zip where each subfolder is named to match a client identifier from the CSV (e.g. company name or a proposal ID assigned at import). Backend unzips, matches subfolder → `proposal_id`, creates one `proposal_materials` row per file inside.
- **Per-row attach screen (fallback/manual correction):** dashboard shows each imported proposal with a file count; rep can click into any row and drag files in individually. Always available, used for anything that didn't auto-match, or one-off additions later.

---

## 5. File Handling & Processing

All files land in Supabase Storage (see §9), never in the database directly — the DB only stores `storage_path` references.

Each file gets a `material_type`: `intake_form`, `call_recording`, `old_proposal`, `other`.

Processing pipeline per file, tracked via `proposal_materials.status` (`uploaded` → `processing` → `processed`, or `failed`):

- **Text documents** (intake forms, old proposals, notes) → extract text directly, store in `processed_content`.
- **Call/discovery recordings** → transcribe (e.g. Whisper API), store transcript in `processed_content`.
- **Old proposals** → extract text, but tag explicitly as *reference material* in the generation prompt — not authoritative content for the new proposal.

A DB trigger watches material status: once every file attached to a proposal reaches `processed`, the proposal automatically moves from `draft` → `materials_ready`. If any file processing fails, log to `error_log` with step `file_processing` or `transcription`, and surface it clearly on that proposal's row rather than leaving it silently stuck.

---

## 6. Missing Information Handling

Two layers, both required:

**Layer 1 — Structural (pre-generation):** before any Claude call, check intake fields against a required-field list. Anything missing gets recorded in `proposals.missing_fields` (text array). Required fields already get caught at form/CSV level, but this layer catches optional-but-important gaps too (e.g. present-but-thin fields).

**Layer 2 — Semantic (during generation):** the generation prompt instructs Claude that if it cannot support a statement from the provided inputs, it must not invent one — instead insert an inline marker: `[NEEDS INPUT: <what's missing>]`. This is more reliable than pre-checking every possible content gap, since some gaps only become apparent while drafting (e.g. "pricing model" was filled in but too vague to write a concrete pricing section).

**Enforcement:** `proposal_sections.has_gap_marker` is set true if a section's content contains a `[NEEDS INPUT:` marker; a trigger rolls this up into `proposals.has_gaps`. **The "Submit for Approval" action must be blocked server-side while `has_gaps = true`.** This is a hard gate, not a UI suggestion — do not rely on the rep noticing the bracketed text unassisted.

---

## 7. Proposal Generation (Claude API)

- Content is stored as discrete rows in `proposal_sections`, not one text blob. Standard section set (adjust to match `assets/proposal-template.md`): `introduction`, `executive_summary`, `client_needs_summary`, `recommended_approach`, `scope`, `deliverables`, `pricing`, `timeline`, `next_steps`. Use `snake_case` keys consistently — these keys will be used as identifiers in code and prompt tags, not just display labels.
- **Prompt structure:** send all structured intake fields + processed material content (transcripts, old proposal text tagged as reference-only) to Claude in a single call. Instruct Claude to return output with each section wrapped in an XML tag matching the section key (e.g. `<pricing>...</pricing>`) — this is more reliable to parse than asking for a large JSON blob containing long-form prose. Parse the response, split into per-section rows.
- Record `claude_model`, `claude_input_tokens`, `claude_output_tokens` on the proposal row for cost traceability.
- On success: proposal moves `generating` → `generated`. On failure: log to `error_log` with step `generation`, proposal moves to `failed` with a clear reason surfaced in the UI (don't leave it stuck in `generating`).

### 7.1 Section regeneration
- Rep can regenerate a single section without touching the rest of the proposal.
- Send Claude a smaller prompt containing: (a) that section's generation instructions, (b) the *other* current section contents as context (for tone/fact consistency), (c) optional rep note (e.g. "make this more concise").
- Response replaces only that section's `content`, bumps `version`. A DB trigger automatically snapshots every version into `proposal_section_versions` (tagged `generation` / `regeneration` / `manual_edit`), so history is free — no extra app logic needed to preserve prior versions.
- Manual edits (rep typing directly into a section) also count as a version bump — set `updated_by` to the rep's id (vs. null for Claude-authored content), which is how the trigger distinguishes `generation`/`regeneration` from `manual_edit` in the version history.

---

## 8. Approval Workflow

- Rep reviews the full draft (`in_review`), can regenerate/edit sections freely, cannot submit while `has_gaps = true`.
- On submit, proposal moves to `pending_approval`, `submitted_for_approval_at` is set. Approver (any user with `approver`/`admin` role) sees it in their queue regardless of who created it.
- Approver either:
  - **Approves** → `approved_by`, `approved_at` set, state → `approved`.
  - **Rejects** → `rejection_notes` set, state → `in_review` (back to the rep, with the reason visible).
- **Server-side enforcement:** the "Send to Client" action must check `state == 'approved'` before allowing document export/email send to fire — this check cannot live only in the UI, since a direct API call must not be able to bypass it.

---

## 9. Delivery & Logging

On approval:

1. **Document export** — render approved sections into the final proposal document (PDF/doc) using `assets/proposal-template.md` as the layout reference. Store in the `proposal-documents` Supabase Storage bucket, save path to `proposals.document_url`, set `document_generated_at`. On failure: log to `error_log`, step `document_export`, do not proceed to email.
2. **Email delivery** — send to `client_contact_email` using `assets/client-email-template.md`, attaching or linking the exported document. Record the attempt in `delivery_log` (status `pending`/`sent`/`failed`/`bounced`, provider message id). On success, set `proposals.email_sent_at`, `email_provider_id`, state → `sent`.
3. **Final logging** — once delivery is confirmed, state moves to `logged` as the terminal state. This closes the record; `proposal_events` already holds the full history of how it got there.

Document export and email delivery are tracked as **independent** steps with independent failure states — a doc-export success followed by an email failure must not look like a generic "stuck" proposal; the UI should say exactly which step failed and offer a retry.

---

## 10. Failure Handling (applies system-wide)

Every external call — file processing, transcription, Claude generation/regeneration, document export, email send — is wrapped so that failure:

1. Writes a row to `error_log` (`step`, `message`, `detail` as raw payload/stack, linked `proposal_id` and optionally `material_id`).
2. Moves the proposal to a state that makes the failure visible (`failed`, or a step-specific flag) rather than leaving it silently stuck in an in-progress state (`generating`, etc.).
3. Surfaces the most recent unresolved error on that proposal's row in the dashboard — not a generic "something went wrong," but the specific step and message.

This is what makes Testing Scenario 7 (Failure Handling) verifiable: any of document creation, approval, email delivery, or logging failing should produce a traceable row in `error_log` and a visible state change, not a silent hang.

---

## 11. Database Schema

Full schema (tables, enums, triggers, RLS policies, storage buckets) is provided in the companion file **`proposal_app_schema.sql`** — run this in the Supabase SQL editor before building app logic. Summary of tables:

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users`; holds role (`sales_rep`/`approver`/`admin`) |
| `import_batches` | Tracks one bulk CSV import event |
| `proposals` | Core table; one row per client/project; holds state + intake fields |
| `proposal_materials` | One row per uploaded file (intake form, recording, old proposal, other) |
| `proposal_sections` | Current content per section, keyed by `section_key` |
| `proposal_section_versions` | Full history of every section change, auto-snapshotted |
| `proposal_events` | Auto-logged state transition audit trail |
| `error_log` | Every failed external call, by step |
| `delivery_log` | Email delivery attempts, separate from generic errors for retry visibility |

Notable automatic behaviors (via DB triggers, not app code):
- `materials_ready` state fires automatically once all attached files are `processed`.
- Every `proposals.state` change auto-logs to `proposal_events`.
- Every section content change auto-snapshots to `proposal_section_versions`.
- `proposals.has_gaps` auto-syncs from section-level `has_gap_marker` flags.

Storage: two private Supabase Storage buckets, `proposal-materials` and `proposal-documents`, with RLS policies matching DB access rules. **File path convention: `{proposal_id}/{filename}`** — this is required for the storage RLS policies to correctly scope access; confirm the upload implementation follows this convention.

---

## 12. Dashboard / Key Screens

1. **Dashboard (table view):** one row per proposal — client, state, gap count, file count, created date, contextual action button. Entry points for both single-form and bulk-import creation.
2. **Bulk import screen:** CSV upload → preflight validation table (valid vs. flagged rows) → confirm → creates batch of `draft` proposals.
3. **Materials attach screen:** per-proposal file list, drag-and-drop, `material_type` tagging, processing status per file.
4. **Review/regenerate screen:** full proposal broken into sections, each with its own "Regenerate" action and inline edit, gap markers visually highlighted, "Submit for Approval" button (disabled while `has_gaps = true`).
5. **Approval screen (approver view):** queue of `pending_approval` proposals, full read view, Approve / Reject (with required notes on reject) actions.
6. **Proposal detail / audit view:** shows current state, full `proposal_events` history, any unresolved `error_log` entries, delivery status — this is the debugging view referenced in Testing Scenario 7.

---

## 13. Testing Scenarios → Implementation Mapping

| # | Scenario | Where it's enforced |
|---|---|---|
| 1 | Normal generation | §7 — full intake + materials → Claude → structured sections |
| 2 | Missing information | §6 — structural + semantic gap detection, hard gate on submit |
| 3 | Supporting material used | §5, §7 — processed transcripts/old proposals included in generation prompt, tagged appropriately |
| 4 | Section regeneration | §7.1 — single-section regen, version history preserved automatically |
| 5 | Human approval before send | §8 — `pending_approval` → `approved` required, enforced server-side on send action |
| 6 | Final delivery + logging | §9 — independent doc export / email send steps, `delivery_log`, terminal `logged` state |
| 7 | Failure handling | §10 — `error_log` on every external call, visible state change, no silent hangs |

---

## 14. Out of Scope (v1)

- Email-in intake (forwarding call notes to a parsing inbox) — noted as a possible v2, not required now.
- Auto-fire generation / debounced auto-generation — explicitly rejected in favor of an explicit "Generate" action, for cost predictability and to avoid duplicate runs on re-uploads.
- Cloudinary or any external media service — Supabase Storage covers file storage/reference needs for this app; no on-the-fly media transformation requirement exists here.
- Revert-to-previous-version UI for sections — version history is captured in the schema (`proposal_section_versions`) but a restore action is not required for v1; can be added later since the data is already there.

---

## 15. Reference Assets

Build against these existing references (adjust schema/template mapping as needed to match exactly):
- `assets/intake-form-fields.md` — source for `proposals` structured fields
- `assets/proposal-template.md` — source for section set and final document layout
- `assets/client-email-template.md` — source for the delivery email content/format
