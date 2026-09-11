"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProposalStateBadge } from "@/components/proposal-state-badge";
import { proposalActionLink } from "@/lib/proposals/actionLink";
import type { ProposalState, UserRole } from "@/lib/types/database";
import { advanceIfNoMaterials } from "./proposals/[id]/materials/actions";

export interface DashboardProposalRow {
  id: string;
  client_name: string;
  company_name: string | null;
  project_title: string | null;
  state: ProposalState;
  has_gaps: boolean;
  created_at: string;
}

interface Props {
  proposals: DashboardProposalRow[];
  role: UserRole;
  fileCountByProposal: Record<string, number>;
  gapCountByProposal: Record<string, number>;
  latestErrorByProposal: Record<string, { step: string; message: string }>;
}

type BulkGroup = "continue_without_files" | "generate" | "submit" | "send";

const BULK_LABELS: Record<BulkGroup, string> = {
  continue_without_files: "Continue without files",
  generate: "Generate",
  submit: "Submit for approval",
  send: "Send to client",
};

function bulkGroupFor(row: DashboardProposalRow, fileCount: number): BulkGroup | null {
  if (row.state === "draft" && fileCount === 0) return "continue_without_files";
  if (row.state === "materials_ready") return "generate";
  if (row.state === "in_review" && !row.has_gaps) return "submit";
  if (row.state === "approved") return "send";
  return null;
}

/** Runs `fn` over `ids` with at most `limit` in flight at once. */
async function runWithConcurrency<T>(ids: string[], limit: number, fn: (id: string) => Promise<T>): Promise<T[]> {
  const results: T[] = new Array(ids.length);
  let next = 0;
  async function worker() {
    while (next < ids.length) {
      const i = next++;
      results[i] = await fn(ids[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, ids.length) }, worker));
  return results;
}

async function runBulkAction(group: BulkGroup, id: string): Promise<{ error?: string }> {
  switch (group) {
    case "continue_without_files":
      return advanceIfNoMaterials(id);
    case "generate": {
      const res = await fetch(`/api/proposals/${id}/generate`, { method: "POST" });
      const body = await res.json();
      return res.ok ? {} : { error: body.error };
    }
    case "submit": {
      const res = await fetch(`/api/proposals/${id}/submit-for-approval`, { method: "POST" });
      const body = await res.json();
      return res.ok ? {} : { error: body.error };
    }
    case "send": {
      const res = await fetch(`/api/proposals/${id}/send-to-client`, { method: "POST" });
      const body = await res.json();
      return res.ok ? {} : { error: body.error };
    }
  }
}

export function ProposalsTable({ proposals, role, fileCountByProposal, gapCountByProposal, latestErrorByProposal }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);

  const groupById = useMemo(() => {
    const map = new Map<string, BulkGroup | null>();
    for (const p of proposals) map.set(p.id, bulkGroupFor(p, fileCountByProposal[p.id] ?? 0));
    return map;
  }, [proposals, fileCountByProposal]);

  const selectedGroup = selected.size > 0 ? groupById.get([...selected][0]) ?? null : null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runBulk = async () => {
    if (!selectedGroup) return;
    setRunning(true);
    try {
      const ids = [...selected];
      const outcomes = await runWithConcurrency(ids, 3, (id) => runBulkAction(selectedGroup, id));
      const failed = outcomes.filter((o) => o.error);
      if (failed.length === 0) {
        toast.success(`${BULK_LABELS[selectedGroup]}: ${ids.length} succeeded`);
      } else {
        toast.warning(
          `${BULK_LABELS[selectedGroup]}: ${ids.length - failed.length} succeeded, ${failed.length} failed`,
          { description: failed.map((f) => f.error).join("; ") },
        );
      }
      setSelected(new Set());
      router.refresh();
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      {selected.size > 0 && selectedGroup && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-2">
          <span className="text-sm">{selected.size} selected</span>
          <Button size="sm" onClick={runBulk} disabled={running}>
            {running ? "Working..." : `${BULK_LABELS[selectedGroup]} (${selected.size})`}
          </Button>
        </div>
      )}

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Client</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Gaps</TableHead>
              <TableHead>Files</TableHead>
              <TableHead>Created</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proposals.map((p) => {
              const action = proposalActionLink(p.id, p.state, role);
              const error = latestErrorByProposal[p.id];
              const group = groupById.get(p.id);
              const checkboxDisabled = !group || (selectedGroup !== null && group !== selectedGroup);

              return (
                <TableRow key={p.id}>
                  <TableCell>
                    {group && (
                      <Checkbox
                        checked={selected.has(p.id)}
                        disabled={checkboxDisabled}
                        onCheckedChange={() => toggle(p.id)}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{p.company_name || p.client_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[p.company_name && p.client_name, p.project_title].filter(Boolean).join(" · ")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <ProposalStateBadge state={p.state} />
                      {error && (
                        <span className="text-xs text-destructive">
                          {error.step.replace("_", " ")}: {error.message}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{p.has_gaps ? `${gapCountByProposal[p.id] ?? 0} gap(s)` : "—"}</TableCell>
                  <TableCell>{fileCountByProposal[p.id] ?? 0}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(p.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="secondary" size="sm" nativeButton={false} render={<Link href={action.href}>{action.label}</Link>} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
