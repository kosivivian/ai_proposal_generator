"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createProposal, type CreateProposalState } from "./actions";

const initialState: CreateProposalState = {};

function Field({
  name,
  label,
  required,
  error,
  textarea,
}: {
  name: string;
  label: string;
  required?: boolean;
  error?: string;
  textarea?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {textarea ? (
        <Textarea id={name} name={name} required={required} />
      ) : (
        <Input id={name} name={name} required={required} />
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function NewProposalForm() {
  const [state, action, pending] = useActionState(createProposal, initialState);

  return (
    <form action={action} className="space-y-5 max-w-xl">
      <Field name="client_name" label="Client name" required error={state.fieldErrors?.client_name} />
      <div className="grid grid-cols-2 gap-4">
        <Field name="client_contact_name" label="Client contact name" error={state.fieldErrors?.client_contact_name} />
        <Field name="client_contact_email" label="Client contact email" error={state.fieldErrors?.client_contact_email} />
      </div>
      <Field name="project_title" label="Project title" />
      <Field name="project_scope" label="Project scope" textarea />
      <div className="grid grid-cols-2 gap-4">
        <Field name="budget_range" label="Budget range" />
        <Field name="timeline" label="Timeline" />
      </div>
      <Field name="industry" label="Industry" />
      <Field name="additional_notes" label="Additional notes" textarea />

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create proposal"}
      </Button>
    </form>
  );
}
