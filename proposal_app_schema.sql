-- ============================================================================
-- AI Proposal Application — Supabase Schema
-- ============================================================================
-- Design principles this schema follows:
--   1. One proposal = one client/project (bulk import creates many proposal rows,
--      not one row holding many clients).
--   2. Every state transition is logged (proposal_events) — this is the audit
--      trail and the backbone of failure-handling/debugging.
--   3. Proposal content is stored as discrete sections, not one blob, so
--      section-level regeneration and version history are cheap.
--   4. Every external call (transcription, Claude generation, doc export,
--      email send) has its own status + its own row in error_log on failure.
--   5. Explicit "Generate" trigger — materials_ready is a real state, not an
--      auto-fire trigger.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()


-- ----------------------------------------------------------------------------
-- 1. Profiles (extends Supabase auth.users)
-- ----------------------------------------------------------------------------
create type user_role as enum ('sales_rep', 'approver', 'admin');

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null,
  email         text not null,
  role          user_role not null default 'sales_rep',
  created_at    timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up
create function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ----------------------------------------------------------------------------
-- 2. Import batches (bulk CSV import tracking)
-- ----------------------------------------------------------------------------
create type batch_status as enum ('processing', 'ready_for_review', 'completed', 'failed');

create table import_batches (
  id              uuid primary key default gen_random_uuid(),
  uploaded_by     uuid not null references profiles(id),
  source_filename text,
  row_count       int,
  valid_row_count int,
  status          batch_status not null default 'processing',
  created_at      timestamptz not null default now()
);


-- keep updated_at fresh (shared by clients and proposals below)
create function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


-- ----------------------------------------------------------------------------
-- Clients (separate entity — a client can have many proposals; email is
-- the unique identity key used to resolve "does this client already exist"
-- both on single-form creation and bulk CSV import).
-- ----------------------------------------------------------------------------
create table clients (
  id                   uuid primary key default gen_random_uuid(),
  client_name          text not null,           -- contact person
  company_name         text,
  client_contact_email text not null unique,     -- the identity key
  created_by           uuid not null references profiles(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger trg_clients_updated_at
  before update on clients
  for each row execute function set_updated_at();


-- ----------------------------------------------------------------------------
-- 3. Proposals (the core table / state machine)
-- ----------------------------------------------------------------------------
create type proposal_state as enum (
  'draft',              -- intake captured, may have gaps
  'materials_ready',    -- all attached files finished processing, eligible for Generate
  'generating',         -- Claude call in flight
  'generated',          -- first draft produced
  'in_review',          -- salesperson editing / regenerating sections
  'pending_approval',   -- submitted internally, awaiting approver
  'rejected',           -- approver sent back with notes
  'approved',           -- cleared to send
  'sent',               -- delivered to client
  'logged',             -- final state, delivery confirmed + record closed
  'failed'              -- terminal failure at any step; see error_log for reason
);

create table proposals (
  id                  uuid primary key default gen_random_uuid(),
  batch_id            uuid references import_batches(id) on delete set null, -- null if created via single form
  created_by          uuid not null references profiles(id),
  state               proposal_state not null default 'draft',

  client_id           uuid not null references clients(id),

  -- Structured intake fields (mirrors intake-form-fields.md — adjust to match exactly)
  date_of_call        date,
  client_needs_summary text,
  project_title       text,
  project_scope       text,
  budget_range        text,
  timeline            text,
  goals_and_objectives text,
  recommended_services text,
  additional_notes    text,

  -- Gap tracking (structural check, run at intake time — see section 4 notes)
  missing_fields      text[] not null default '{}',   -- e.g. {'budget_range','timeline'}
  has_gaps            boolean not null default false, -- convenience flag, kept in sync by trigger

  -- Generation bookkeeping
  generated_at        timestamptz,
  generated_by        uuid references profiles(id),
  claude_model         text,       -- model string used, for traceability
  claude_input_tokens  int,
  claude_output_tokens int,

  -- Approval bookkeeping
  submitted_for_approval_at timestamptz,
  approved_by          uuid references profiles(id),
  approved_at           timestamptz,
  rejection_notes        text,

  -- Delivery bookkeeping
  document_url          text,       -- final exported PDF/doc in Supabase Storage
  document_generated_at timestamptz,
  email_sent_at          timestamptz,
  email_provider_id      text,       -- id returned by Resend/SendGrid etc., for tracing
  email_opened_at        timestamptz, -- first open, from a Resend webhook
  email_clicked_at       timestamptz, -- first proposal-link click, from a Resend webhook
  reminder_sent_at       timestamptz, -- set once the 2-day no-response follow-up has fired

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index idx_proposals_state on proposals(state);
create index idx_proposals_created_by on proposals(created_by);
create index idx_proposals_batch_id on proposals(batch_id);
create index idx_proposals_client_id on proposals(client_id);

create trigger trg_proposals_updated_at
  before update on proposals
  for each row execute function set_updated_at();


-- ----------------------------------------------------------------------------
-- 4. Proposal materials (uploaded files: intake form, call recordings, old
--    proposals, misc docs — many per proposal)
-- ----------------------------------------------------------------------------
create type material_type as enum ('intake_form', 'call_recording', 'old_proposal', 'other');
create type material_status as enum ('uploaded', 'processing', 'processed', 'failed');

create table proposal_materials (
  id                uuid primary key default gen_random_uuid(),
  proposal_id       uuid not null references proposals(id) on delete cascade,
  material_type     material_type not null default 'other',
  file_name         text not null,
  storage_path      text not null,        -- Supabase Storage object path
  mime_type         text,
  status            material_status not null default 'uploaded',
  processed_content text,                 -- extracted text / transcript
  uploaded_by       uuid not null references profiles(id),
  created_at        timestamptz not null default now(),
  processed_at      timestamptz
);

create index idx_materials_proposal_id on proposal_materials(proposal_id);
create index idx_materials_status on proposal_materials(status);

-- When all materials for a proposal are 'processed', flip proposal to materials_ready.
-- (Only applies if proposal currently has files and is still in draft.)
create function check_materials_ready()
returns trigger as $$
declare
  outstanding int;
begin
  select count(*) into outstanding
  from proposal_materials
  where proposal_id = new.proposal_id
    and status in ('uploaded', 'processing');

  if outstanding = 0 then
    update proposals
      set state = 'materials_ready'
      where id = new.proposal_id and state = 'draft';
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger trg_materials_ready
  after update of status on proposal_materials
  for each row
  when (new.status = 'processed')
  execute function check_materials_ready();


-- ----------------------------------------------------------------------------
-- 5. Proposal sections (current, editable content — one row per section)
-- ----------------------------------------------------------------------------
create table proposal_sections (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   uuid not null references proposals(id) on delete cascade,
  section_key   text not null,          -- 'executive_summary','scope','pricing','timeline', etc.
  order_index   int not null,
  content       text not null default '',
  has_gap_marker boolean not null default false,  -- true if content still contains [NEEDS INPUT: ...]
  version       int not null default 1,
  updated_by    uuid references profiles(id),      -- null if last write was Claude, set if human-edited
  updated_at    timestamptz not null default now(),

  unique (proposal_id, section_key)
);

create index idx_sections_proposal_id on proposal_sections(proposal_id);

-- History of every section version (for regen diffing / "revert" if you want it later)
create table proposal_section_versions (
  id              uuid primary key default gen_random_uuid(),
  section_id      uuid not null references proposal_sections(id) on delete cascade,
  version         int not null,
  content         text not null,
  source          text not null check (source in ('generation', 'regeneration', 'manual_edit')),
  changed_by      uuid references profiles(id),   -- null if Claude
  created_at      timestamptz not null default now()
);

create index idx_section_versions_section_id on proposal_section_versions(section_id);

-- Snapshot every section change into history automatically
create function snapshot_section_version()
returns trigger as $$
begin
  insert into proposal_section_versions (section_id, version, content, source, changed_by)
  values (
    new.id,
    new.version,
    new.content,
    case when new.updated_by is null then 'generation' else 'manual_edit' end,
    new.updated_by
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_snapshot_section
  after insert or update of content on proposal_sections
  for each row execute function snapshot_section_version();

-- Keep proposals.has_gaps in sync with section-level gap markers
create function sync_proposal_gap_flag()
returns trigger as $$
begin
  update proposals p
  set has_gaps = exists (
    select 1 from proposal_sections s
    where s.proposal_id = p.id and s.has_gap_marker = true
  )
  where p.id = new.proposal_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_sync_gap_flag
  after insert or update of has_gap_marker on proposal_sections
  for each row execute function sync_proposal_gap_flag();


-- ----------------------------------------------------------------------------
-- 6. Proposal events (state-transition audit trail — the backbone of
--    debuggability and of test case #7, failure handling)
-- ----------------------------------------------------------------------------
create table proposal_events (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   uuid not null references proposals(id) on delete cascade,
  from_state    proposal_state,
  to_state      proposal_state not null,
  actor_id      uuid references profiles(id),   -- null if system-triggered
  note          text,                            -- e.g. rejection reason, retry note
  created_at    timestamptz not null default now()
);

create index idx_events_proposal_id on proposal_events(proposal_id);

-- Every time proposals.state changes, log it automatically
create function log_state_transition()
returns trigger as $$
begin
  if new.state is distinct from old.state then
    insert into proposal_events (proposal_id, from_state, to_state, note)
    values (new.id, old.state, new.state, null);
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_log_state_transition
  after update of state on proposals
  for each row execute function log_state_transition();


-- ----------------------------------------------------------------------------
-- 7. Error log (every failed external call: transcription, Claude API,
--    doc export, email send)
-- ----------------------------------------------------------------------------
create type error_step as enum (
  'file_processing', 'transcription', 'generation', 'regeneration',
  'document_export', 'email_delivery', 'logging'
);

create table error_log (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   uuid references proposals(id) on delete cascade,
  material_id   uuid references proposal_materials(id) on delete cascade,
  step          error_step not null,
  message       text not null,
  detail        jsonb,             -- raw error payload / stack for debugging
  resolved      boolean not null default false,
  created_at    timestamptz not null default now()
);

create index idx_error_log_proposal_id on error_log(proposal_id);
create index idx_error_log_unresolved on error_log(proposal_id) where resolved = false;


-- ----------------------------------------------------------------------------
-- 8. Delivery log (separate from error_log — tracks attempts, not just failures,
--    useful for retry logic on email specifically)
-- ----------------------------------------------------------------------------
create type delivery_status as enum ('pending', 'sent', 'failed', 'bounced');

create table delivery_log (
  id              uuid primary key default gen_random_uuid(),
  proposal_id     uuid not null references proposals(id) on delete cascade,
  recipient_email text not null,
  status          delivery_status not null default 'pending',
  provider_id     text,             -- Resend/SendGrid message id
  provider_response jsonb,
  attempted_at    timestamptz not null default now()
);

create index idx_delivery_log_proposal_id on delivery_log(proposal_id);


-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table profiles enable row level security;
alter table clients enable row level security;
alter table import_batches enable row level security;
alter table proposals enable row level security;
alter table proposal_materials enable row level security;
alter table proposal_sections enable row level security;
alter table proposal_section_versions enable row level security;
alter table proposal_events enable row level security;
alter table error_log enable row level security;
alter table delivery_log enable row level security;

-- Helper: is the current user an approver or admin?
create function is_approver_or_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('approver', 'admin')
  );
$$ language sql security definer stable;

-- profiles: everyone can read all profiles (needed for assigning/displaying names),
-- but only update their own
create policy "profiles_select_all" on profiles for select using (true);
create policy "profiles_update_own" on profiles for update using (id = auth.uid());

-- clients: open read (any rep must be able to find any client to resolve
-- duplicates across reps — the reason this table exists); insert by the
-- creating rep; update by the creator or approver/admin. No delete policy.
create policy "clients_select_all" on clients for select using (true);
create policy "clients_insert" on clients for insert with check (created_by = auth.uid());
create policy "clients_update" on clients for update
  using (created_by = auth.uid() or is_approver_or_admin());

-- import_batches: owner or approver/admin
create policy "batches_select" on import_batches for select
  using (uploaded_by = auth.uid() or is_approver_or_admin());
create policy "batches_insert" on import_batches for insert
  with check (uploaded_by = auth.uid());

-- proposals: sales reps see their own; approvers/admins see everything;
-- approvers specifically need visibility into pending_approval regardless of owner
create policy "proposals_select" on proposals for select
  using (created_by = auth.uid() or is_approver_or_admin());
create policy "proposals_insert" on proposals for insert
  with check (created_by = auth.uid());
create policy "proposals_update" on proposals for update
  using (created_by = auth.uid() or is_approver_or_admin());

-- child tables inherit access via their parent proposal
create policy "materials_access" on proposal_materials for all
  using (
    exists (select 1 from proposals p
            where p.id = proposal_materials.proposal_id
            and (p.created_by = auth.uid() or is_approver_or_admin()))
  );

create policy "sections_access" on proposal_sections for all
  using (
    exists (select 1 from proposals p
            where p.id = proposal_sections.proposal_id
            and (p.created_by = auth.uid() or is_approver_or_admin()))
  );

create policy "section_versions_select" on proposal_section_versions for select
  using (
    exists (select 1 from proposal_sections s
            join proposals p on p.id = s.proposal_id
            where s.id = proposal_section_versions.section_id
            and (p.created_by = auth.uid() or is_approver_or_admin()))
  );

create policy "events_select" on proposal_events for select
  using (
    exists (select 1 from proposals p
            where p.id = proposal_events.proposal_id
            and (p.created_by = auth.uid() or is_approver_or_admin()))
  );

create policy "error_log_select" on error_log for select
  using (
    exists (select 1 from proposals p
            where p.id = error_log.proposal_id
            and (p.created_by = auth.uid() or is_approver_or_admin()))
  );

create policy "delivery_log_select" on delivery_log for select
  using (
    exists (select 1 from proposals p
            where p.id = delivery_log.proposal_id
            and (p.created_by = auth.uid() or is_approver_or_admin()))
  );

-- Note: inserts/updates to error_log, delivery_log, proposal_events, and
-- proposal_section_versions are expected to come from server-side (service role)
-- code paths — edge functions / backend — not directly from the client, so no
-- client-facing insert policies are defined for them above.


-- ============================================================================
-- Storage bucket (run separately in Supabase Storage settings, or via SQL below)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('proposal-materials', 'proposal-materials', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('proposal-documents', 'proposal-documents', false)
on conflict (id) do nothing;

-- Storage RLS: restrict access to files belonging to proposals the user can see.
-- (Adjust path convention — this assumes objects are stored as
--  {proposal_id}/{filename} within each bucket.)
create policy "materials_storage_access" on storage.objects for all
  using (
    bucket_id = 'proposal-materials'
    and exists (
      select 1 from proposals p
      where p.id::text = (storage.foldername(name))[1]
      and (p.created_by = auth.uid() or is_approver_or_admin())
    )
  );

create policy "documents_storage_access" on storage.objects for all
  using (
    bucket_id = 'proposal-documents'
    and exists (
      select 1 from proposals p
      where p.id::text = (storage.foldername(name))[1]
      and (p.created_by = auth.uid() or is_approver_or_admin())
    )
  );
