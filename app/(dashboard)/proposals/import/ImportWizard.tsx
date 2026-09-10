"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import type { ValidRow, InvalidRow } from "@/lib/intake/csv";

type Step = "upload" | "preflight" | "materials" | "done";

interface ConfirmResult {
  batch: { id: string };
  created: { id: string; client_name: string }[];
  skipped: InvalidRow[];
}

export function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [sourceFilename, setSourceFilename] = useState("");
  const [validRows, setValidRows] = useState<ValidRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<InvalidRow[]>([]);
  const [included, setIncluded] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [zipResult, setZipResult] = useState<{ matchedFolders: { folder: string; fileCount: number }[]; unmatchedFolders: { folder: string; fileCount: number }[] } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const uploadCsv = async (file: File) => {
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import-batches/preflight", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error);
        return;
      }
      setSourceFilename(body.source_filename);
      setValidRows(body.validRows);
      setInvalidRows(body.invalidRows);
      setIncluded(new Set<number>(body.validRows.map((r: ValidRow) => r.rowNumber)));
      setStep("preflight");
    } finally {
      setBusy(false);
    }
  };

  const toggleRow = (rowNumber: number) => {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  };

  const confirmImport = async () => {
    setBusy(true);
    try {
      const rows = validRows.filter((r) => included.has(r.rowNumber)).map((r) => r.data);
      const res = await fetch("/api/import-batches/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_filename: sourceFilename, rows }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error);
        return;
      }
      setConfirmResult(body);
      toast.success(`Created ${body.created.length} proposal(s)`);
      setStep("materials");
    } finally {
      setBusy(false);
    }
  };

  const uploadZip = async (file: File) => {
    if (!confirmResult) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/import-batches/${confirmResult.batch.id}/materials-zip`, { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error);
        return;
      }
      setZipResult(body);
      setStep("done");
    } finally {
      setBusy(false);
    }
  };

  if (step === "upload") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>1. Upload CSV</CardTitle>
          <CardDescription>
            Columns: client_name (required), client_contact_name, client_contact_email, project_title, project_scope, budget_range, timeline, industry, additional_notes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:bg-muted/40"
            onClick={() => csvInputRef.current?.click()}
          >
            <p className="text-sm text-muted-foreground">{busy ? "Parsing..." : "Click to choose a CSV file"}</p>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadCsv(e.target.files[0])}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "preflight") {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>2. Review rows</CardTitle>
            <CardDescription>
              {validRows.length} valid row(s), {invalidRows.length} row(s) with errors (excluded automatically). Uncheck any valid row to skip it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {validRows.length > 0 && (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Row</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Contact email</TableHead>
                      <TableHead>Missing (non-blocking)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validRows.map((r) => (
                      <TableRow key={r.rowNumber}>
                        <TableCell>
                          <Checkbox checked={included.has(r.rowNumber)} onCheckedChange={() => toggleRow(r.rowNumber)} />
                        </TableCell>
                        <TableCell>{r.rowNumber}</TableCell>
                        <TableCell>{r.data.client_name}</TableCell>
                        <TableCell>{r.data.client_contact_email || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.missing_fields.length > 0 ? r.missing_fields.join(", ") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {invalidRows.length > 0 && (
              <div className="border rounded-lg overflow-x-auto border-destructive/40">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Reasons</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invalidRows.map((r) => (
                      <TableRow key={r.rowNumber}>
                        <TableCell>{r.rowNumber}</TableCell>
                        <TableCell className="text-sm text-destructive">{r.reasons.join("; ")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={confirmImport} disabled={busy || included.size === 0}>
                {busy ? "Importing..." : `Create ${included.size} proposal(s)`}
              </Button>
              <Button variant="ghost" onClick={() => setStep("upload")} disabled={busy}>
                Start over
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "materials" && confirmResult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>3. Attach materials (optional)</CardTitle>
          <CardDescription>
            Upload a zip where each top-level subfolder is named after a client from the CSV. Files inside each matching
            folder are attached automatically. Anything that doesn&apos;t match can be attached later from each
            proposal&apos;s materials screen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:bg-muted/40"
            onClick={() => zipInputRef.current?.click()}
          >
            <p className="text-sm text-muted-foreground">{busy ? "Matching..." : "Click to choose a .zip file"}</p>
            <input
              ref={zipInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadZip(e.target.files[0])}
            />
          </div>
          <Button variant="ghost" render={<Link href="/">Skip — I&apos;ll attach files per-proposal</Link>} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import complete</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>Created {confirmResult?.created.length ?? 0} proposal(s).</p>
        {zipResult && (
          <>
            <p>{zipResult.matchedFolders.length} folder(s) matched and attached.</p>
            {zipResult.unmatchedFolders.length > 0 && (
              <div className="text-amber-700 dark:text-amber-400">
                {zipResult.unmatchedFolders.length} folder(s) didn&apos;t match a client and were skipped:{" "}
                {zipResult.unmatchedFolders.map((f) => f.folder).join(", ")}. Attach these from each proposal&apos;s
                materials screen.
              </div>
            )}
          </>
        )}
        <Button render={<Link href="/">Go to dashboard</Link>} />
      </CardContent>
    </Card>
  );
}
