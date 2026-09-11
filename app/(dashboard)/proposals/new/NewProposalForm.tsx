"use client";

import { useEffect, useRef, useState, useActionState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { createProposal, searchClients, type CreateProposalState } from "./actions";

const initialState: CreateProposalState = {};

type ClientOption = { id: string; client_name: string; company_name: string | null; client_contact_email: string };

function Field({
  name,
  label,
  required,
  error,
  textarea,
  type,
  inputRef,
  defaultValue,
}: {
  name: string;
  label: string;
  required?: boolean;
  error?: string;
  textarea?: boolean;
  type?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {textarea ? (
        <Textarea id={name} name={name} required={required} defaultValue={defaultValue} />
      ) : (
        <Input id={name} name={name} required={required} type={type} ref={inputRef} defaultValue={defaultValue} />
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function ClientSearchCombobox({
  selected,
  onSelect,
}: {
  selected: ClientOption | null;
  onSelect: (client: ClientOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientOption[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (!q) return; // handled synchronously in the input's onValueChange instead
    const timeout = setTimeout(() => {
      searchClients(q).then(setResults);
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (!value.trim()) setResults([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" className="w-full justify-start">
            {selected ? selected.company_name || selected.client_name : "Search for a client..."}
          </Button>
        }
      />
      <PopoverContent className="w-80 p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search by name, company, or email..." value={query} onValueChange={handleQueryChange} />
          <CommandList>
            <CommandEmpty>{query.trim() ? "No clients found." : "Start typing to search."}</CommandEmpty>
            {results.map((client) => (
              <CommandItem
                key={client.id}
                value={client.id}
                onSelect={() => {
                  onSelect(client);
                  setOpen(false);
                }}
              >
                <div>
                  <div>{client.company_name || client.client_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {client.company_name && `${client.client_name} · `}
                    {client.client_contact_email}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function NewProposalForm() {
  const [state, action, pending] = useActionState(createProposal, initialState);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const clientIdRef = useRef<HTMLInputElement>(null);

  // Set imperatively after mount (not at module/render scope, not via
  // React state) so the server-rendered HTML never claims a "today" that
  // might differ from the browser's own clock/timezone — avoids a
  // hydration mismatch on the input's max attribute.
  const dateInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (dateInputRef.current) dateInputRef.current.max = new Date().toISOString().slice(0, 10);
  }, []);

  return (
    <form action={action} className="space-y-5 max-w-xl">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="client_id" ref={clientIdRef} defaultValue={selectedClient?.id ?? ""} />

      {state.exactDuplicateProposalId && (
        <Alert variant="destructive">
          <AlertTitle>This exact proposal already exists</AlertTitle>
          <AlertDescription>
            <p>A proposal with identical details already exists for this client.</p>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 mt-1"
              nativeButton={false}
              render={<Link href={`/proposals/${state.exactDuplicateProposalId}`}>View the existing proposal</Link>}
            />
          </AlertDescription>
        </Alert>
      )}

      {state.existingClient && (
        <Alert>
          <AlertTitle>This client already exists</AlertTitle>
          <AlertDescription>
            <p>
              <strong>{state.existingClient.company_name || state.existingClient.client_name}</strong>
              {state.existingClient.company_name && ` (${state.existingClient.client_name})`} —{" "}
              {state.existingClient.client_contact_email}
            </p>
            <Button
              type="submit"
              variant="link"
              className="h-auto p-0 mt-1"
              onClick={() => {
                if (clientIdRef.current) clientIdRef.current.value = state.existingClient!.id;
              }}
            >
              Use this client and continue
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label>Client</Label>
        <Tabs
          value={mode}
          onValueChange={(value) => {
            setMode(value as "new" | "existing");
            setSelectedClient(null);
            if (clientIdRef.current) clientIdRef.current.value = "";
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value="new" className="flex-1">New client</TabsTrigger>
            <TabsTrigger value="existing" className="flex-1">Existing client</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {mode === "existing" ? (
        <div className="space-y-1.5">
          <ClientSearchCombobox
            selected={selectedClient}
            onSelect={(client) => {
              setSelectedClient(client);
              if (clientIdRef.current) clientIdRef.current.value = client.id;
            }}
          />
          {selectedClient && (
            <p className="text-sm text-muted-foreground">
              {selectedClient.client_name} · {selectedClient.client_contact_email}
            </p>
          )}
          {!selectedClient && <p className="text-sm text-destructive">Search for and select a client above.</p>}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Field name="client_name" label="Client contact name" required error={state.fieldErrors?.client_name} />
            <Field name="company_name" label="Company name" error={state.fieldErrors?.company_name} />
          </div>
          <Field
            name="client_contact_email"
            label="Client contact email"
            required
            error={state.fieldErrors?.client_contact_email}
          />
        </>
      )}

      <Field name="date_of_call" label="Date of call" type="date" inputRef={dateInputRef} required error={state.fieldErrors?.date_of_call} />
      <Field name="client_needs_summary" label="Summary of client's needs" textarea required error={state.fieldErrors?.client_needs_summary} />
      <Field name="project_title" label="Project title" />
      <Field name="project_scope" label="Project scope" textarea required error={state.fieldErrors?.project_scope} />
      <Field name="goals_and_objectives" label="Goals and objectives" textarea required error={state.fieldErrors?.goals_and_objectives} />
      <Field name="recommended_services" label="Recommended services / deliverables" textarea required error={state.fieldErrors?.recommended_services} />
      <div className="grid grid-cols-2 gap-4">
        <Field name="budget_range" label="Estimated pricing / budget range" required error={state.fieldErrors?.budget_range} />
        <Field name="timeline" label="Proposed timeline" required error={state.fieldErrors?.timeline} />
      </div>
      <Field name="additional_notes" label="Additional notes" textarea />

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending || (mode === "existing" && !selectedClient)}>
        {pending ? "Creating..." : "Create proposal"}
      </Button>
    </form>
  );
}
