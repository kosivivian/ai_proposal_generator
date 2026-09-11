// Hand-written to mirror proposal_app_schema.sql exactly (no `supabase gen types` access
// in this environment). Keep in sync with the schema file if it ever changes.
//
// Shape matches the official Supabase codegen output exactly (Tables/Views/Functions
// with Relationships on every table, Enums, CompositeTypes) — the postgrest-js/
// supabase-js generics require this exact structure (GenericSchema) or query results
// silently collapse to `never` instead of erroring loudly.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = "sales_rep" | "approver" | "admin";
export type BatchStatus = "processing" | "ready_for_review" | "completed" | "failed";
export type ProposalState =
  | "draft"
  | "materials_ready"
  | "generating"
  | "generated"
  | "in_review"
  | "pending_approval"
  | "rejected"
  | "approved"
  | "sent"
  | "logged"
  | "failed";
export type MaterialType = "intake_form" | "call_recording" | "old_proposal" | "other";
export type MaterialStatus = "uploaded" | "processing" | "processed" | "failed";
export type ErrorStep =
  | "file_processing"
  | "transcription"
  | "generation"
  | "regeneration"
  | "document_export"
  | "email_delivery"
  | "logging";
export type DeliveryStatus = "pending" | "sent" | "failed" | "bounced";
export type SectionVersionSource = "generation" | "regeneration" | "manual_edit";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          role: UserRole;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email: string;
          role?: UserRole;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          role?: UserRole;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      import_batches: {
        Row: {
          id: string;
          uploaded_by: string;
          source_filename: string | null;
          row_count: number | null;
          valid_row_count: number | null;
          status: BatchStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          uploaded_by: string;
          source_filename?: string | null;
          row_count?: number | null;
          valid_row_count?: number | null;
          status?: BatchStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          uploaded_by?: string;
          source_filename?: string | null;
          row_count?: number | null;
          valid_row_count?: number | null;
          status?: BatchStatus;
          created_at?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          client_name: string;
          company_name: string | null;
          client_contact_email: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_name: string;
          company_name?: string | null;
          client_contact_email: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_name?: string;
          company_name?: string | null;
          client_contact_email?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      proposals: {
        Row: {
          id: string;
          batch_id: string | null;
          created_by: string;
          state: ProposalState;
          client_id: string;
          date_of_call: string | null;
          client_needs_summary: string | null;
          project_title: string | null;
          project_scope: string | null;
          budget_range: string | null;
          timeline: string | null;
          goals_and_objectives: string | null;
          recommended_services: string | null;
          additional_notes: string | null;
          missing_fields: string[];
          has_gaps: boolean;
          generated_at: string | null;
          generated_by: string | null;
          claude_model: string | null;
          claude_input_tokens: number | null;
          claude_output_tokens: number | null;
          submitted_for_approval_at: string | null;
          approved_by: string | null;
          approved_at: string | null;
          rejection_notes: string | null;
          document_url: string | null;
          document_generated_at: string | null;
          email_sent_at: string | null;
          email_provider_id: string | null;
          email_opened_at: string | null;
          email_clicked_at: string | null;
          reminder_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          batch_id?: string | null;
          created_by: string;
          state?: ProposalState;
          client_id: string;
          date_of_call?: string | null;
          client_needs_summary?: string | null;
          project_title?: string | null;
          project_scope?: string | null;
          budget_range?: string | null;
          timeline?: string | null;
          goals_and_objectives?: string | null;
          recommended_services?: string | null;
          additional_notes?: string | null;
          missing_fields?: string[];
          has_gaps?: boolean;
          generated_at?: string | null;
          generated_by?: string | null;
          claude_model?: string | null;
          claude_input_tokens?: number | null;
          claude_output_tokens?: number | null;
          submitted_for_approval_at?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          rejection_notes?: string | null;
          document_url?: string | null;
          document_generated_at?: string | null;
          email_sent_at?: string | null;
          email_provider_id?: string | null;
          email_opened_at?: string | null;
          email_clicked_at?: string | null;
          reminder_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          batch_id?: string | null;
          created_by?: string;
          state?: ProposalState;
          client_id?: string;
          date_of_call?: string | null;
          client_needs_summary?: string | null;
          project_title?: string | null;
          project_scope?: string | null;
          budget_range?: string | null;
          timeline?: string | null;
          goals_and_objectives?: string | null;
          recommended_services?: string | null;
          additional_notes?: string | null;
          missing_fields?: string[];
          has_gaps?: boolean;
          generated_at?: string | null;
          generated_by?: string | null;
          claude_model?: string | null;
          claude_input_tokens?: number | null;
          claude_output_tokens?: number | null;
          submitted_for_approval_at?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          rejection_notes?: string | null;
          document_url?: string | null;
          document_generated_at?: string | null;
          email_sent_at?: string | null;
          email_provider_id?: string | null;
          email_opened_at?: string | null;
          email_clicked_at?: string | null;
          reminder_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      proposal_materials: {
        Row: {
          id: string;
          proposal_id: string;
          material_type: MaterialType;
          file_name: string;
          storage_path: string;
          mime_type: string | null;
          status: MaterialStatus;
          processed_content: string | null;
          uploaded_by: string;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          proposal_id: string;
          material_type?: MaterialType;
          file_name: string;
          storage_path: string;
          mime_type?: string | null;
          status?: MaterialStatus;
          processed_content?: string | null;
          uploaded_by: string;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          proposal_id?: string;
          material_type?: MaterialType;
          file_name?: string;
          storage_path?: string;
          mime_type?: string | null;
          status?: MaterialStatus;
          processed_content?: string | null;
          uploaded_by?: string;
          created_at?: string;
          processed_at?: string | null;
        };
        Relationships: [];
      };
      proposal_sections: {
        Row: {
          id: string;
          proposal_id: string;
          section_key: string;
          order_index: number;
          content: string;
          has_gap_marker: boolean;
          version: number;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          proposal_id: string;
          section_key: string;
          order_index: number;
          content?: string;
          has_gap_marker?: boolean;
          version?: number;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          proposal_id?: string;
          section_key?: string;
          order_index?: number;
          content?: string;
          has_gap_marker?: boolean;
          version?: number;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      proposal_section_versions: {
        Row: {
          id: string;
          section_id: string;
          version: number;
          content: string;
          source: SectionVersionSource;
          changed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          section_id: string;
          version: number;
          content: string;
          source: SectionVersionSource;
          changed_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          section_id?: string;
          version?: number;
          content?: string;
          source?: SectionVersionSource;
          changed_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      proposal_events: {
        Row: {
          id: string;
          proposal_id: string;
          from_state: ProposalState | null;
          to_state: ProposalState;
          actor_id: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          proposal_id: string;
          from_state?: ProposalState | null;
          to_state: ProposalState;
          actor_id?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          proposal_id?: string;
          from_state?: ProposalState | null;
          to_state?: ProposalState;
          actor_id?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      error_log: {
        Row: {
          id: string;
          proposal_id: string | null;
          material_id: string | null;
          step: ErrorStep;
          message: string;
          detail: Json | null;
          resolved: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          proposal_id?: string | null;
          material_id?: string | null;
          step: ErrorStep;
          message: string;
          detail?: Json | null;
          resolved?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          proposal_id?: string | null;
          material_id?: string | null;
          step?: ErrorStep;
          message?: string;
          detail?: Json | null;
          resolved?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      delivery_log: {
        Row: {
          id: string;
          proposal_id: string;
          recipient_email: string;
          status: DeliveryStatus;
          provider_id: string | null;
          provider_response: Json | null;
          attempted_at: string;
        };
        Insert: {
          id?: string;
          proposal_id: string;
          recipient_email: string;
          status?: DeliveryStatus;
          provider_id?: string | null;
          provider_response?: Json | null;
          attempted_at?: string;
        };
        Update: {
          id?: string;
          proposal_id?: string;
          recipient_email?: string;
          status?: DeliveryStatus;
          provider_id?: string | null;
          provider_response?: Json | null;
          attempted_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      batch_status: BatchStatus;
      proposal_state: ProposalState;
      material_type: MaterialType;
      material_status: MaterialStatus;
      error_step: ErrorStep;
      delivery_status: DeliveryStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
