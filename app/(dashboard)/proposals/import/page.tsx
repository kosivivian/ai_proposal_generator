import { ImportWizard } from "./ImportWizard";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bulk import</h1>
        <p className="text-sm text-muted-foreground">For handling many leads at once (tested up to ~50/week).</p>
      </div>
      <ImportWizard />
    </div>
  );
}
