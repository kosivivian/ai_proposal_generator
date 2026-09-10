import { NewProposalForm } from "./NewProposalForm";

export default function NewProposalPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New proposal</h1>
        <p className="text-sm text-muted-foreground">
          For a single client you just finished a call with. For handling many leads at once, use bulk import instead.
        </p>
      </div>
      <NewProposalForm />
    </div>
  );
}
